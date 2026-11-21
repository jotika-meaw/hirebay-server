import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { paginate } from "../utils/paginate.js";

function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, id: String(doc._id) };
}

export async function listEquipment(req, res, next) {
  try {
    const q = req.query ?? {};
    const search = String(q.search ?? "").slice(0, 60).trim();
    const location = String(q.location ?? "").slice(0, 60).trim();
    const and = [{ status: "approved" }];
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      and.push({ $or: [{ name: re }, { location: re }, { category: re }] });
    }
    if (location) {
      and.push({ location: new RegExp(escapeRegex(location), "i") });
    }
    if (q.category) {
      const cats = String(q.category)
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cats.length === 1) and.push({ category: cats[0] });
      else if (cats.length > 1) and.push({ category: { $in: cats } });
    }
    if (q.rentalType) and.push({ rentalType: String(q.rentalType) });
    if (q.minPrice !== undefined && q.minPrice !== "") {
      const min = Number(q.minPrice);
      if (Number.isFinite(min)) and.push({ price: { $gte: min } });
    }
    if (q.maxPrice !== undefined && q.maxPrice !== "") {
      const max = Number(q.maxPrice);
      if (Number.isFinite(max)) and.push({ price: { $lte: max } });
    }
    if (q.availability === "available") and.push({ quantity: { $gt: 0 } });
    else if (q.availability === "unavailable") and.push({ quantity: { $lte: 0 } });

    let sort = { createdAt: -1 };
    if (q.sort === "price_asc") sort = { price: 1 };
    else if (q.sort === "price_desc") sort = { price: -1 };

    const db = await getDb();
    const filter = and.length === 1 ? and[0] : { $and: and };
    const total = await db.collection("equipment").countDocuments(filter);
    const { page, limit, pages, skip } = paginate({ page: q.page, limit: q.limit, total });
    const docs = await db
      .collection("equipment")
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    return res.json({ items: docs.map(withId), total, page, pages });
  } catch (err) {
    return next(err);
  }
}

export async function getFeaturedEquipment(req, res, next) {
  try {
    const db = await getDb();
    const docs = await db
      .collection("equipment")
      .aggregate([
        { $match: { status: "approved" } },
        { $sort: { createdAt: -1 } },
        { $limit: 6 },
      ])
      .toArray();
    return res.json({ data: docs.map(withId) });
  } catch (err) {
    return next(err);
  }
}

export async function getEquipmentCategories(req, res, next) {
  try {
    const db = await getDb();
    const rows = await db
      .collection("equipment")
      .aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $project: { _id: 0, category: "$_id", count: 1 } },
        { $sort: { category: 1 } },
      ])
      .toArray();
    return res.json({ data: rows });
  } catch (err) {
    return next(err);
  }
}

export async function getPublicStats(req, res, next) {
  try {
    const db = await getDb();
    const [listings, completedRentals, locations] = await Promise.all([
      db.collection("equipment").countDocuments({ status: "approved" }),
      db.collection("bookings").countDocuments({ status: "completed" }),
      db.collection("equipment").distinct("location", { status: "approved" }),
    ]);
    const cities = new Set(
      locations.map((l) => String(l).split(",")[0].trim()).filter(Boolean)
    ).size;
    return res.json({ data: { listings, cities, completedRentals, avgRating: 4.8 } });
  } catch (err) {
    return next(err);
  }
}

export const EQUIPMENT_CATEGORIES = [
  "Construction Equipment",
  "Photography Equipment",
  "Vehicles & Transportation",
  "Agriculture Equipment",
  "Electronics",
  "Event Equipment",
];

export const EQUIPMENT_CONDITIONS = ["Like new", "Excellent", "Good", "Fair"];
export const EQUIPMENT_RENTAL_TYPES = ["daily", "weekly", "monthly"];

const EQUIPMENT_FIELDS = [
  "name",
  "description",
  "category",
  "location",
  "price",
  "rentalType",
  "quantity",
  "condition",
  "brand",
  "model",
  "image",
  "terms",
];

function isValidImage(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.startsWith("/images/") && v.length > "/images/".length) return true;
  return /^https?:\/\/\S+$/i.test(v);
}

// Returns a sanitized document (without status/owner/timestamps) or a
// `{ message }` string describing the first validation failure.
function validateEquipmentInput(body, { partial = false } = {}) {
  const src = body ?? {};
  if (!partial || src.name !== undefined) {
    if (typeof src.name !== "string" || !src.name.trim() || src.name.trim().length > 120) {
      return { message: "Name must be 1–120 characters" };
    }
  }
  if (!partial || src.description !== undefined) {
    if (typeof src.description !== "string" || !src.description.trim() || src.description.length > 2000) {
      return { message: "Description must be 1–2000 characters" };
    }
  }
  if (!partial || src.category !== undefined) {
    if (!EQUIPMENT_CATEGORIES.includes(src.category)) {
      return { message: "Category must be one of the 6 equipment categories" };
    }
  }
  if (!partial || src.location !== undefined) {
    if (typeof src.location !== "string" || !src.location.trim() || src.location.trim().length > 120) {
      return { message: "Location must be 1–120 characters" };
    }
  }
  if (!partial || src.price !== undefined) {
    const price = Number(src.price);
    if (!Number.isInteger(price) || price <= 0) {
      return { message: "Price must be a positive integer" };
    }
  }
  if (!partial || src.rentalType !== undefined) {
    if (!EQUIPMENT_RENTAL_TYPES.includes(src.rentalType)) {
      return { message: "Rental type must be daily, weekly or monthly" };
    }
  }
  if (!partial || src.quantity !== undefined) {
    const qty = Number(src.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      return { message: "Quantity must be an integer of 0 or more" };
    }
  }
  if (!partial || src.condition !== undefined) {
    if (!EQUIPMENT_CONDITIONS.includes(src.condition)) {
      return { message: "Condition must be Like new, Excellent, Good or Fair" };
    }
  }
  if (src.brand !== undefined && (typeof src.brand !== "string" || src.brand.length > 80)) {
    return { message: "Brand must be under 80 characters" };
  }
  if (src.model !== undefined && (typeof src.model !== "string" || src.model.length > 80)) {
    return { message: "Model must be under 80 characters" };
  }
  if (src.image !== undefined && src.image !== "" && !isValidImage(src.image)) {
    return { message: "Image must be an http(s) URL or an /images/ path" };
  }
  if (src.terms !== undefined && (typeof src.terms !== "string" || src.terms.length > 2000)) {
    return { message: "Terms must be under 2000 characters" };
  }
  if (!partial) {
    for (const field of ["name", "description", "category", "location", "price", "rentalType", "quantity", "condition"]) {
      if (src[field] === undefined) return { message: `${field} is required` };
    }
  }
  return null;
}

function buildEquipmentDoc(body) {
  const now = new Date();
  const doc = {};
  for (const field of EQUIPMENT_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === "price" || field === "quantity") doc[field] = Number(body[field]);
    else if (typeof body[field] === "string") doc[field] = body[field].trim();
    else doc[field] = body[field];
  }
  if (doc.image === "") doc.image = null;
  return { ...doc, updatedAt: now };
}

function toEquipmentId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function createEquipment(req, res, next) {
  try {
    const error = validateEquipmentInput(req.body);
    if (error) return res.status(400).json(error);
    const fields = buildEquipmentDoc(req.body);
    delete fields.updatedAt;
    const now = new Date();
    const db = await getDb();
    const result = await db.collection("equipment").insertOne({
      ...fields,
      status: "pending",
      owner: { id: req.user.id, name: req.user.name ?? null, email: req.user.email ?? null, image: req.user.image ?? null },
      createdAt: now,
      updatedAt: now,
    });
    const created = await db.collection("equipment").findOne({ _id: result.insertedId });
    return res.status(201).json({ data: withId(created) });
  } catch (err) {
    return next(err);
  }
}

export async function listMyEquipment(req, res, next) {
  try {
    const q = req.query ?? {};
    const and = [{ "owner.id": req.user.id }];
    if (q.status) {
      const statuses = String(q.status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) and.push({ status: statuses[0] });
      else if (statuses.length > 1) and.push({ status: { $in: statuses } });
    }
    const db = await getDb();
    const filter = and.length === 1 ? and[0] : { $and: and };
    const total = await db.collection("equipment").countDocuments(filter);
    const { page, limit, pages, skip } = paginate({ page: q.page, limit: q.limit, total });
    const docs = await db
      .collection("equipment")
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

export async function getEquipmentById(req, res, next) {
  try {
    const objectId = toEquipmentId(req.params.id);
    if (!objectId) return res.status(404).json({ message: "Equipment not found" });
    const db = await getDb();
    const doc = await db.collection("equipment").findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ message: "Equipment not found" });
    if (doc.status !== "approved") {
      const isOwner = doc.owner?.id === req.user.id;
      const isAdmin = req.user.role === "admin";
      if (!isOwner && !isAdmin) return res.status(404).json({ message: "Equipment not found" });
    }
    return res.json({ data: withId(doc) });
  } catch (err) {
    return next(err);
  }
}

export async function updateEquipment(req, res, next) {
  try {
    const objectId = toEquipmentId(req.params.id);
    if (!objectId) return res.status(404).json({ message: "Equipment not found" });
    const db = await getDb();
    const doc = await db.collection("equipment").findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ message: "Equipment not found" });
    if (req.user.role !== "admin" && doc.owner?.id !== req.user.id) {
      return res.status(403).json({ message: "You do not own this equipment" });
    }
    const error = validateEquipmentInput(req.body, { partial: true });
    if (error) return res.status(400).json(error);
    const fields = buildEquipmentDoc(req.body);
    delete fields.updatedAt;
    const update = { ...fields, updatedAt: new Date() };
    if (req.user.role === "owner") update.status = "pending";
    const updated = await db
      .collection("equipment")
      .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: "after" });
    if (!updated) return res.status(404).json({ message: "Equipment not found" });
    return res.json({ data: withId(updated) });
  } catch (err) {
    return next(err);
  }
}

export async function deleteEquipment(req, res, next) {
  try {
    const objectId = toEquipmentId(req.params.id);
    if (!objectId) return res.status(404).json({ message: "Equipment not found" });
    const db = await getDb();
    const doc = await db.collection("equipment").findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ message: "Equipment not found" });
    if (req.user.role !== "admin" && doc.owner?.id !== req.user.id) {
      return res.status(403).json({ message: "You do not own this equipment" });
    }
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const blocking = await db.collection("bookings").countDocuments({
      $and: [
        { $or: [{ equipmentId: objectId }, { equipmentId: String(objectId) }] },
        { paymentStatus: "paid" },
        { status: "confirmed" },
        { endDate: { $gte: todayStart } },
      ],
    });
    if (blocking > 0) {
      return res.status(409).json({ message: "Cannot delete equipment with upcoming paid bookings" });
    }
    await db.collection("equipment").deleteOne({ _id: objectId });
    await db.collection("favorites").deleteMany({
      $or: [{ equipmentId: objectId }, { equipmentId: String(objectId) }],
    });
    return res.json({ message: "Equipment deleted" });
  } catch (err) {
    return next(err);
  }
}
