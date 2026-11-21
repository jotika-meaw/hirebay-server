import { ObjectId } from "mongodb";

// Availability (01 decision 2).
// A booking blocks stock when it overlaps [start, end] (inclusive on both
// edges: start <= other.endDate AND end >= other.startDate) AND it is either
// a paid + confirmed reservation OR an unpaid + pending hold that has not
// expired yet (holdExpiresAt > now). Cancelled / completed / expired holds
// never block.

export function overlaps(start, end, otherStart, otherEnd) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const os = new Date(otherStart).getTime();
  const oe = new Date(otherEnd).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(os) || !Number.isFinite(oe)) return false;
  return s <= oe && e >= os;
}

export function isBlockingBooking(booking, now = new Date()) {
  if (!booking || typeof booking !== "object") return false;
  const nowTime = new Date(now).getTime();
  if (booking.paymentStatus === "paid" && booking.status === "confirmed") return true;
  if (booking.paymentStatus === "unpaid" && booking.status === "pending") {
    const hold = new Date(booking.holdExpiresAt).getTime();
    return Number.isFinite(hold) && hold > nowTime;
  }
  return false;
}

// Pure part (no DB): sum of blocking quantities overlapping [start, end].
export function blockingQuantity(bookings, start, end, now = new Date()) {
  let sum = 0;
  for (const b of bookings ?? []) {
    if (!isBlockingBooking(b, now)) continue;
    if (!overlaps(start, end, b.startDate, b.endDate)) continue;
    sum += Number(b.quantity) || 0;
  }
  return sum;
}

export function availableQuantity(equipmentQuantity, bookings, start, end, now = new Date()) {
  const qty = Number(equipmentQuantity) || 0;
  return qty - blockingQuantity(bookings, start, end, now);
}

function equipmentIdOr(equipmentId) {
  if (ObjectId.isValid(equipmentId)) {
    const oid = new ObjectId(equipmentId);
    return [{ equipmentId: oid }, { equipmentId: String(equipmentId) }];
  }
  return [{ equipmentId }];
}

// DB part: loads overlapping bookings, then reuses the pure filter above.
export async function availableQuantityDb(db, equipmentId, equipmentQuantity, start, end, now = new Date()) {
  const overlapping = await db
    .collection("bookings")
    .find({
      $and: [
        { $or: equipmentIdOr(equipmentId) },
        { startDate: { $lte: new Date(end) } },
        { endDate: { $gte: new Date(start) } },
      ],
    })
    .toArray();
  return availableQuantity(equipmentQuantity, overlapping, start, end, now);
}
