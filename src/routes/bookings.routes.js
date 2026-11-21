import { Router } from "express";
import {
  createBooking,
  listMyBookings,
  listOwnerBookings,
} from "../controllers/bookings.controller.js";
import { verifyOwner, verifyRenter } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/mine", verifyToken, verifyRenter, listMyBookings);
router.get("/owner", verifyToken, verifyOwner, listOwnerBookings);
router.post("/", verifyToken, verifyRenter, createBooking);

export default router;
