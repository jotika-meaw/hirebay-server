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
      and.push({ price: { $gte: Number(q.minPrice) } });
    }
    if (q.maxPrice !== undefined && q.maxPrice !== "") {
      and.push({ price: { $lte: Number(q.maxPrice) } });
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
