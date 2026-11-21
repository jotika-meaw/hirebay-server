import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";

function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, id: String(doc._id) };
}

function toObjectIdOrNull(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function listFavorites(req, res, next) {
  try {
    const db = await getDb();
    const rows = await db
      .collection("favorites")
      .aggregate([
        { $match: { userId: req.user.id } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "equipment",
            localField: "equipmentId",
            foreignField: "_id",
            as: "equipment",
          },
        },
        { $unwind: "$equipment" },
      ])
      .toArray();
    return res.json({
      data: rows.map((f) => ({
        userId: f.userId,
        equipmentId: String(f.equipmentId),
        createdAt: f.createdAt ?? null,
        equipment: withId(f.equipment),
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function getFavoriteIds(req, res, next) {
  try {
    const db = await getDb();
    const rows = await db
      .collection("favorites")
      .find({ userId: req.user.id }, { projection: { equipmentId: 1 } })
      .toArray();
    return res.json({ data: rows.map((f) => String(f.equipmentId)) });
  } catch (err) {
    return next(err);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const { equipmentId } = req.body ?? {};
    const objectId = toObjectIdOrNull(equipmentId);
    if (!objectId) return res.status(404).json({ message: "Equipment not found" });
    const db = await getDb();
    const equipment = await db.collection("equipment").findOne({ _id: objectId });
    if (!equipment || equipment.status !== "approved") {
      return res.status(404).json({ message: "Equipment not found" });
    }
    await db.collection("favorites").updateOne(
      { userId: req.user.id, equipmentId: objectId },
      { $setOnInsert: { userId: req.user.id, equipmentId: objectId, createdAt: new Date() } },
      { upsert: true }
    );
    return res.json({ data: { equipmentId: String(objectId) } });
  } catch (err) {
    return next(err);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    const objectId = toObjectIdOrNull(req.params.equipmentId);
    const db = await getDb();
    const or = objectId
      ? [{ equipmentId: objectId }, { equipmentId: String(objectId) }]
      : [{ equipmentId: req.params.equipmentId }];
    await db.collection("favorites").deleteOne({ userId: req.user.id, $or: or });
    return res.json({ data: { equipmentId: req.params.equipmentId } });
  } catch (err) {
    return next(err);
  }
}
