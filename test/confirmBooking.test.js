import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { confirmBooking } from "../src/utils/confirmBooking.js";

function matches(doc, filter) {
  for (const [key, cond] of Object.entries(filter ?? {})) {
    if (key === "$and") {
      if (!cond.every((f) => matches(doc, f))) return false;
      continue;
    }
    if (key === "$or") {
      if (!cond.some((f) => matches(doc, f))) return false;
      continue;
    }
    const value = doc[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof ObjectId) && !(cond instanceof Date) && !Array.isArray(cond)) {
      for (const [op, operand] of Object.entries(cond)) {
        if (op === "$lte" && !(value <= operand)) return false;
        if (op === "$gte" && !(value >= operand)) return false;
        if (op === "$ne" && String(value) === String(operand)) return false;
        if (op === "$lt" && !(value < operand)) return false;
      }
      continue;
    }
    if (String(value) !== String(cond)) return false;
  }
  return true;
}

function makeDb(seed) {
  const bookings = seed.bookings ?? [];
  const payments = seed.payments ?? [];
  const equipment = seed.equipment ?? [];
  function collection(name) {
    const store = name === "bookings" ? bookings : name === "payments" ? payments : equipment;
    return {
      findOne: async (filter) => store.find((d) => matches(d, filter)) ?? null,
      find: (filter) => ({ toArray: async () => store.filter((d) => matches(d, filter)) }),
      updateOne: async (filter, update) => {
        const doc = store.find((d) => matches(d, filter));
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };
        Object.assign(doc, update.$set ?? {});
        for (const k of Object.keys(update.$unset ?? {})) delete doc[k];
        return { matchedCount: 1, modifiedCount: 1 };
      },
      insertOne: async (doc) => {
        if (name === "payments" && payments.some((p) => p.sessionId === doc.sessionId)) {
          throw Object.assign(new Error("duplicate key"), { code: 11000 });
        }
        doc._id = new ObjectId();
        store.push(doc);
        return { insertedId: doc._id };
      },
    };
  }
  return { bookings, payments, equipment, collection };
}

function seedBooking() {
  const equipmentId = new ObjectId();
  return {
    equipment: { _id: equipmentId, quantity: 2 },
    booking: {
      _id: new ObjectId(),
      equipmentId,
      equipment: { name: "Excavator", image: null, category: "Construction Equipment", rentalType: "daily", price: 18500 },
      owner: { id: "owner1", name: "O", email: "o@t.dev" },
      customer: { id: "cust1", name: "C", email: "c@t.dev", image: null },
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-03"),
      quantity: 2,
      days: 3,
      units: 3,
      totalAmount: 111000,
      status: "pending",
      paymentStatus: "unpaid",
      holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  };
}

function fakeStripe(session) {
  return { checkout: { sessions: { retrieve: async () => session } } };
}

function paidSession(booking, overrides = {}) {
  return {
    id: "cs_test_1",
    payment_status: "paid",
    payment_intent: "pi_test_1",
    currency: "bdt",
    amount_total: 111000 * 100,
    metadata: { bookingId: String(booking._id) },
    ...overrides,
  };
}

describe("confirmBooking", () => {
  it("confirms a reservation and writes exactly one payments row", async () => {
    const { equipment, booking } = seedBooking();
    const db = makeDb({ equipment: [equipment], bookings: [booking], payments: [] });
    const { booking: out, payment } = await confirmBooking({
      db,
      stripe: fakeStripe(paidSession(booking)),
      sessionId: "cs_test_1",
      callerId: "cust1",
    });
    assert.equal(out.status, "confirmed");
    assert.equal(out.paymentStatus, "paid");
    assert.equal(out.holdExpiresAt, undefined);
    assert.equal(out.transactionId, "pi_test_1");
    assert.equal(db.payments.length, 1);
    assert.equal(payment.sessionId, "cs_test_1");
    assert.equal(payment.amount, 111000);
  });

  it("is idempotent: confirming twice keeps exactly one payments row", async () => {
    const { equipment, booking } = seedBooking();
    const db = makeDb({ equipment: [equipment], bookings: [booking], payments: [] });
    const stripe = fakeStripe(paidSession(booking));
    await confirmBooking({ db, stripe, sessionId: "cs_test_1", callerId: "cust1" });
    const second = await confirmBooking({ db, stripe, sessionId: "cs_test_1", callerId: "cust1" });
    assert.equal(second.booking.status, "confirmed");
    assert.equal(db.payments.length, 1);
  });

  it("rejects a wrong amount with 400", async () => {
    const { equipment, booking } = seedBooking();
    const db = makeDb({ equipment: [equipment], bookings: [booking], payments: [] });
    await assert.rejects(
      () =>
        confirmBooking({
          db,
          stripe: fakeStripe(paidSession(booking, { amount_total: 100 })),
          sessionId: "cs_test_1",
          callerId: "cust1",
        }),
      (err) => err.status === 400 && /amount/i.test(err.message)
    );
  });

  it("rejects another customer's session with 403", async () => {
    const { equipment, booking } = seedBooking();
    const db = makeDb({ equipment: [equipment], bookings: [booking], payments: [] });
    await assert.rejects(
      () =>
        confirmBooking({
          db,
          stripe: fakeStripe(paidSession(booking)),
          sessionId: "cs_test_1",
          callerId: "someone-else",
        }),
      (err) => err.status === 403
    );
  });

  it("rejects an unpaid session with 400", async () => {
    const { equipment, booking } = seedBooking();
    const db = makeDb({ equipment: [equipment], bookings: [booking], payments: [] });
    await assert.rejects(
      () =>
        confirmBooking({
          db,
          stripe: fakeStripe(paidSession(booking, { payment_status: "unpaid" })),
          sessionId: "cs_test_1",
          callerId: "cust1",
        }),
      (err) => err.status === 400
    );
  });

  it("409s when re-check finds no availability left", async () => {
    const { equipment, booking } = seedBooking();
    const blocker = {
      _id: new ObjectId(),
      equipmentId: equipment._id,
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-03"),
      quantity: 2,
      status: "confirmed",
      paymentStatus: "paid",
    };
    const db = makeDb({ equipment: [equipment], bookings: [booking, blocker], payments: [] });
    await assert.rejects(
      () => confirmBooking({ db, stripe: fakeStripe(paidSession(booking)), sessionId: "cs_test_1", callerId: "cust1" }),
      (err) => err.status === 409
    );
  });
});
