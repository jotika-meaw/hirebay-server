import { Router } from "express";
import { getDb } from "../lib/db.js";
import { completeBookings } from "../jobs/completeBookings.js";

const router = Router();

router.get("/complete-bookings", async (req, res, next) => {
  try {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const db = await getDb();
    const counts = await completeBookings(db, new Date());
    return res.json({ data: counts });
  } catch (err) {
    return next(err);
  }
});

export default router;
