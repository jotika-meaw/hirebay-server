import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { completeBookings } from "../src/jobs/completeBookings.js";

function matches(doc, filter) {
  for (const [key, cond] of Object.entries(filter ?? {})) {
    const value = doc[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      for (const [op, operand] of Object.entries(cond)) {
        if (op === "$lt" && !(value < operand)) return false;
      }
      continue;
    }
    if (String(value) !== String(cond)) return false;
  }
  return true;
}

function makeDb(bookings) {
  return {
    bookings,
    collection(name) {
      if (name !== "bookings") throw new Error(`unexpected collection ${name}`);
      return {
        updateMany: async (filter, update) => {
          let n = 0;
          for (const doc of bookings) {
            if (!matches(doc, filter)) continue;
            Object.assign(doc, update.$set ?? {});
            n += 1;
          }
          return { matchedCount: n, modifiedCount: n };
        },
      };
    },
  };
}

const NOW = new Date("2026-11-21T12:00:00.000Z");

describe("completeBookings", () => {
  it("completes past-end paid bookings and cancels expired holds only", async () => {
    const bookings = [
      // past end, paid + confirmed → completed
      { _id: 1, status: "confirmed", paymentStatus: "paid", endDate: new Date("2026-11-20T00:00:00.000Z") },
      // ends today, paid + confirmed → stays (endDate is not < start of today)
      { _id: 2, status: "confirmed", paymentStatus: "paid", endDate: new Date("2026-11-21T00:00:00.000Z") },
      // future end → stays
      { _id: 3, status: "confirmed", paymentStatus: "paid", endDate: new Date("2026-11-25T00:00:00.000Z") },
      // expired hold → cancelled
      { _id: 4, status: "pending", paymentStatus: "unpaid", holdExpiresAt: new Date("2026-11-21T11:00:00.000Z") },
      // live hold → stays
      { _id: 5, status: "pending", paymentStatus: "unpaid", holdExpiresAt: new Date("2026-11-21T13:00:00.000Z") },
      // pending but paid (awaiting confirm) → stays
      { _id: 6, status: "pending", paymentStatus: "paid", holdExpiresAt: new Date("2026-10-01T00:00:00.000Z") },
      // already cancelled → stays
      { _id: 7, status: "cancelled", paymentStatus: "unpaid", holdExpiresAt: new Date("2026-10-01T00:00:00.000Z") },
    ];
    const db = makeDb(bookings);
    const counts = await completeBookings(db, NOW);
    assert.deepEqual(counts, { completed: 1, cancelled: 1 });
    const byId = Object.fromEntries(bookings.map((b) => [b._id, b.status]));
    assert.deepEqual(byId, {
      1: "completed",
      2: "confirmed",
      3: "confirmed",
      4: "cancelled",
      5: "pending",
      6: "pending",
      7: "cancelled",
    });
  });
});
