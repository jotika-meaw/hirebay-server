export function startOfTodayUTC(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Booking completion job (02 §6). Returns both counts.
// - confirmed + paid with endDate before the start of today (UTC) → completed.
// - pending + unpaid with holdExpiresAt before now → cancelled (expired hold).
export async function completeBookings(db, now = new Date()) {
  const completed = await db.collection("bookings").updateMany(
    {
      status: "confirmed",
      paymentStatus: "paid",
      endDate: { $lt: startOfTodayUTC(now) },
    },
    { $set: { status: "completed", updatedAt: now } }
  );
  const cancelled = await db.collection("bookings").updateMany(
    {
      status: "pending",
      paymentStatus: "unpaid",
      holdExpiresAt: { $lt: now },
    },
    { $set: { status: "cancelled", updatedAt: now } }
  );
  return {
    completed: completed.modifiedCount ?? 0,
    cancelled: cancelled.modifiedCount ?? 0,
  };
}
