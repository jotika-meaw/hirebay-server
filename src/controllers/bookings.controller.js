import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { availableQuantityDb } from "../utils/availability.js";
import { paginate } from "../utils/paginate.js";
import { normalizePhone } from "../utils/phone.js";
import { billableUnits, wholeDays } from "../utils/pricing.js";

function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, id: String(doc._id) };
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toUtcMidnight(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function statusFilter(q) {
  if (!q.status) return null;
  const statuses = String(q.status)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (statuses.length === 0) return null;
  if (statuses.length === 1) return { status: statuses[0] };
  return { status: { $in: statuses } };
}

export async function createBooking(req, res, next) {
  try {
    const { equipmentId, startDate, endDate, quantity, phone, address, notes } = req.body ?? {};
    if (!ObjectId.isValid(equipmentId)) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    const db = await getDb();
    const equipment = await db.collection("equipment").findOne({ _id: new ObjectId(equipmentId) });
    if (!equipment || equipment.status !== "approved") {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);
    if (!start || !end) {
      return res.status(400).json({ message: "Start and end dates are required" });
    }
    const today = startOfTodayUTC();
    if (start < today) {
      return res.status(400).json({ message: "Start date cannot be in the past" });
    }
    if (end < start) {
      return res.status(400).json({ message: "End date cannot be before the start date" });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > equipment.quantity) {
      return res.status(400).json({ message: `Quantity must be between 1 and ${equipment.quantity}` });
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone === null) {
      return res.status(400).json({ message: "Enter a valid Bangladeshi mobile number" });
    }
    if (typeof address !== "string" || address.trim().length < 5 || address.trim().length > 200) {
      return res.status(400).json({ message: "Address must be 5–200 characters" });
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
      return res.status(400).json({ message: "Notes must be under 500 characters" });
    }

    const days = wholeDays(start, end);
    if (days > 365) {
      return res.status(400).json({ message: "Rentals can be at most 365 days" });
    }
    const units = billableUnits(days, equipment.rentalType);
    const totalAmount = units * equipment.price * qty;

    const now = new Date();
    const available = await availableQuantityDb(db, equipment._id, equipment.quantity, start, end, now);
    if (available < qty) {
      return res.status(409).json({ message: "Not enough quantity available for these dates" });
    }

    const result = await db.collection("bookings").insertOne({
      equipmentId: equipment._id,
      equipment: {
        name: equipment.name,
        image: equipment.image ?? null,
        category: equipment.category,
        rentalType: equipment.rentalType,
        price: equipment.price,
      },
      owner: {
        id: equipment.owner?.id ?? null,
        name: equipment.owner?.name ?? null,
        email: equipment.owner?.email ?? null,
      },
      customer: {
        id: req.user.id,
        name: req.user.name ?? null,
        email: req.user.email ?? null,
        image: req.user.image ?? null,
      },
      startDate: start,
      endDate: end,
      quantity: qty,
      days,
      units,
      totalAmount,
      phone: normalizedPhone,
      address: address.trim(),
      notes: typeof notes === "string" ? notes : "",
      status: "pending",
      paymentStatus: "unpaid",
      holdExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const created = await db.collection("bookings").findOne({ _id: result.insertedId });
    return res.status(201).json({ data: withId(created) });
  } catch (err) {
    return next(err);
  }
}

async function listBookings(req, res, next, baseFilter) {
  try {
    const q = req.query ?? {};
    const and = [baseFilter];
    const sf = statusFilter(q);
    if (sf) and.push(sf);
    const filter = and.length === 1 ? and[0] : { $and: and };
    const db = await getDb();
    const total = await db.collection("bookings").countDocuments(filter);
    const { page, limit, pages, skip } = paginate({ page: q.page, limit: q.limit, total });
    const docs = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return res.json({ items: docs.map(withId), total, page, pages });
  } catch (err) {
    return next(err);
  }
}

export function listMyBookings(req, res, next) {
  return listBookings(req, res, next, { "customer.id": req.user.id });
}

export function listOwnerBookings(req, res, next) {
  return listBookings(req, res, next, { "owner.id": req.user.id });
}

export function listAdminBookings(req, res, next) {
  return listBookings(req, res, next, {});
}

export async function updateBookingStatus(req, res, next) {
  try {
    const { status } = req.body ?? {};
    if (status !== "confirmed" && status !== "completed" && status !== "cancelled") {
      return res.status(400).json({ message: "Status must be confirmed, completed or cancelled" });
    }
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const db = await getDb();
    const updated = await db
      .collection("bookings")
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    return res.json({ data: withId(updated) });
  } catch (err) {
    return next(err);
  }
}
