import { ObjectId } from "mongodb";
import { blockingQuantity } from "./availability.js";
import { STRIPE_CURRENCY, stripeAmountMatches } from "./money.js";

function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, id: String(doc._id) };
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

// Shared by POST /payments/confirm and the Stripe webhook (02 §5).
// `stripe` is injected so tests/proofs can stub checkout.sessions.retrieve.
export async function confirmBooking({ db, stripe, sessionId, callerId }) {
  if (!sessionId) fail(400, "sessionId is required");
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session || session.payment_status !== "paid") {
    fail(400, "Payment has not completed");
  }
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || !ObjectId.isValid(bookingId)) fail(404, "Booking not found");
  const bookingObjectId = new ObjectId(bookingId);
  const booking = await db.collection("bookings").findOne({ _id: bookingObjectId });
  if (!booking) fail(404, "Booking not found");
  if (callerId && booking.customer?.id !== callerId) {
    fail(403, "This payment does not belong to you");
  }
  if (session.currency !== STRIPE_CURRENCY || !stripeAmountMatches(session.amount_total, booking.totalAmount)) {
    fail(400, "Payment amount does not match the booking total");
  }

  // Idempotent: already paid → just return the current booking + payment.
  if (booking.paymentStatus === "paid") {
    const existing = await db.collection("payments").findOne({ sessionId: session.id || sessionId });
    return { booking: withId(booking), payment: existing ? withId(existing) : null };
  }

  // Re-check availability excluding this booking (01 decision 2).
  const equipment = await db.collection("equipment").findOne({ _id: booking.equipmentId });
  if (equipment) {
    const overlapping = await db
      .collection("bookings")
      .find({
        $and: [
          {
            $or: [
              { equipmentId: booking.equipmentId },
              { equipmentId: String(booking.equipmentId) },
            ],
          },
          { startDate: { $lte: new Date(booking.endDate) } },
          { endDate: { $gte: new Date(booking.startDate) } },
          { _id: { $ne: bookingObjectId } },
        ],
      })
      .toArray();
    const now = new Date();
    if (equipment.quantity - blockingQuantity(overlapping, booking.startDate, booking.endDate, now) < booking.quantity) {
      fail(409, "Not enough quantity available for these dates");
    }
  }

  const now = new Date();
  const updated = await db.collection("bookings").updateOne(
    { _id: bookingObjectId, paymentStatus: "unpaid" },
    {
      $set: {
        paymentStatus: "paid",
        status: "confirmed",
        transactionId: session.payment_intent ?? null,
        checkoutSessionId: session.id || sessionId,
        updatedAt: now,
      },
      $unset: { holdExpiresAt: "" },
    }
  );
  // Lost a race with a concurrent confirm: return the winner's state.
  if (updated.matchedCount === 0) {
    const current = await db.collection("bookings").findOne({ _id: bookingObjectId });
    const payment = await db.collection("payments").findOne({ sessionId: session.id || sessionId });
    return { booking: withId(current), payment: payment ? withId(payment) : null };
  }

  const paymentDoc = {
    bookingId: bookingObjectId,
    sessionId: session.id || sessionId,
    transactionId: session.payment_intent ?? null,
    amount: booking.totalAmount,
    currency: STRIPE_CURRENCY,
    customerEmail: booking.customer?.email ?? null,
    ownerEmail: booking.owner?.email ?? null,
    status: "paid",
    createdAt: now,
  };
  try {
    await db.collection("payments").insertOne(paymentDoc);
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  const payment = await db.collection("payments").findOne({ sessionId: paymentDoc.sessionId });
  const fresh = await db.collection("bookings").findOne({ _id: bookingObjectId });
  return { booking: withId(fresh), payment: withId(payment) };
}
