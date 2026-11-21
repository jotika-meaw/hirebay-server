import jwt from "jsonwebtoken";
import { getDb } from "../lib/db.js";
import { matchUserId } from "../utils/userId.js";

// Verifies the BetterAuth-bridged JWT, then loads the user from `user`
// (role always comes from the database, never the token).
// 401: missing/bad token, unknown or deleted user.
export async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      });
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const db = await getDb();
    const user = await db.collection("user").findOne(matchUserId(payload.sub));
    if (!user) return res.status(401).json({ message: "Account not found" });
    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role ?? "customer",
      name: user.name ?? null,
      image: user.image ?? null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}
