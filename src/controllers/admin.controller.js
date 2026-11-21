import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { paginate } from "../utils/paginate.js";

function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, id: String(doc._id) };
}

export async function listAllEquipment(req, res, next) {
  try {
    const q = req.query ?? {};
    const and = [];
    if (q.status) {
      const statuses = String(q.status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) and.push({ status: statuses[0] });
      else if (statuses.length > 1) and.push({ status: { $in: statuses } });
    }
    const search = String(q.search ?? "").slice(0, 60).trim();
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      and.push({ $or: [{ name: re }, { location: re }, { category: re }] });
    }
    const db = await getDb();
    const filter = and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
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

export async function updateEquipmentStatus(req, res, next) {
  try {
    const { status } = req.body ?? {};
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    const db = await getDb();
    const updated = await db
      .collection("equipment")
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
    if (!updated) return res.status(404).json({ message: "Equipment not found" });
    return res.json({ data: withId(updated) });
  } catch (err) {
    return next(err);
  }
}
