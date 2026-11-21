import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { paginate } from "../utils/paginate.js";
import { matchUserId } from "../utils/userId.js";

const SAFE_USER_FIELDS = {
  email: 1,
  name: 1,
  image: 1,
  role: 1,
  phone: 1,
  address: 1,
  createdAt: 1,
};

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

export async function listUsers(req, res, next) {
  try {
    const q = req.query ?? {};
    const and = [];
    if (q.role) {
      const roles = String(q.role)
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (roles.length === 1) and.push({ role: roles[0] });
      else if (roles.length > 1) and.push({ role: { $in: roles } });
    }
    const search = String(q.search ?? "").slice(0, 60).trim();
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      and.push({ $or: [{ name: re }, { email: re }] });
    }
    const db = await getDb();
    const filter = and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
    const total = await db.collection("user").countDocuments(filter);
    const { page, limit, pages, skip } = paginate({ page: q.page, limit: q.limit, total });
    const docs = await db
      .collection("user")
      .find(filter, { projection: SAFE_USER_FIELDS })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return res.json({ items: docs.map(withId), total, page, pages });
  } catch (err) {
    return next(err);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body ?? {};
    if (role !== "customer" && role !== "owner" && role !== "admin") {
      return res.status(400).json({ message: "Role must be customer, owner or admin" });
    }
    const db = await getDb();
    const target = await db.collection("user").findOne(matchUserId(req.params.id), { projection: SAFE_USER_FIELDS });
    if (!target) return res.status(404).json({ message: "User not found" });
    if (String(target._id) === req.user.id) {
      return res.status(403).json({ message: "You cannot change your own role" });
    }
    const updated = await db
      .collection("user")
      .findOneAndUpdate(
        matchUserId(req.params.id),
        { $set: { role, updatedAt: new Date() } },
        { returnDocument: "after", projection: SAFE_USER_FIELDS }
      );
    if (!updated) return res.status(404).json({ message: "User not found" });
    return res.json({ data: withId(updated) });
  } catch (err) {
    return next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const db = await getDb();
    const target = await db.collection("user").findOne(matchUserId(req.params.id), { projection: { _id: 1 } });
    if (!target) return res.status(404).json({ message: "User not found" });
    if (String(target._id) === req.user.id) {
      return res.status(403).json({ message: "You cannot delete your own account" });
    }
    const idStrings = [String(target._id)];
    if (target.id && !idStrings.includes(String(target.id))) idStrings.push(String(target.id));
    await db.collection("user").deleteOne({ _id: target._id });
    await db.collection("session").deleteMany({ userId: { $in: idStrings } });
    await db.collection("account").deleteMany({ userId: { $in: idStrings } });
    await db.collection("favorites").deleteMany({ userId: { $in: idStrings } });
    return res.json({ message: "User deleted" });
  } catch (err) {
    return next(err);
  }
}
