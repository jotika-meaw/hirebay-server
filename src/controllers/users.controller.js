import { getDb } from "../lib/db.js";
import { normalizePhone } from "../utils/phone.js";
import { matchUserId } from "../utils/userId.js";

const PUBLIC_FIELDS = {
  email: 1,
  name: 1,
  image: 1,
  role: 1,
  phone: 1,
  address: 1,
  createdAt: 1,
};

function toMe(user) {
  return {
    id: String(user._id),
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role ?? "customer",
    phone: user.phone ?? null,
    address: user.address ?? null,
    createdAt: user.createdAt ?? null,
  };
}

export async function getMe(req, res, next) {
  try {
    const db = await getDb();
    const user = await db.collection("user").findOne(matchUserId(req.user.id), { projection: PUBLIC_FIELDS });
    if (!user) return res.status(401).json({ message: "Account not found" });
    return res.json({ data: toMe(user) });
  } catch (err) {
    return next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const { name, image, phone, address } = req.body ?? {};
    const update = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 1 || name.length > 80) {
        return res.status(400).json({ message: "Name must be 1–80 characters" });
      }
      update.name = name.trim();
    }
    if (image !== undefined) {
      if (typeof image !== "string" || image.length > 2048) {
        return res.status(400).json({ message: "Image must be a URL string" });
      }
      update.image = image.trim() || null;
    }
    if (phone !== undefined) {
      const normalized = normalizePhone(phone);
      if (normalized === null) {
        return res.status(400).json({ message: "Enter a valid Bangladeshi mobile number" });
      }
      update.phone = normalized;
    }
    if (address !== undefined) {
      if (typeof address !== "string" || address.length > 500) {
        return res.status(400).json({ message: "Address must be under 500 characters" });
      }
      update.address = address.trim() || null;
    }
    const db = await getDb();
    const result = await db
      .collection("user")
      .findOneAndUpdate(matchUserId(req.user.id), { $set: { ...update, updatedAt: new Date() } }, { returnDocument: "after", projection: PUBLIC_FIELDS });
    if (!result) return res.status(401).json({ message: "Account not found" });
    return res.json({ data: toMe(result) });
  } catch (err) {
    return next(err);
  }
}
