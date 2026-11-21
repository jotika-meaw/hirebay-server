import { Router } from "express";
import { listAllEquipment, updateEquipmentStatus } from "../controllers/admin.controller.js";
import { listAdminBookings, updateBookingStatus } from "../controllers/bookings.controller.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/equipment", verifyToken, verifyAdmin, listAllEquipment);
router.patch("/equipment/:id/status", verifyToken, verifyAdmin, updateEquipmentStatus);
router.get("/bookings", verifyToken, verifyAdmin, listAdminBookings);
router.patch("/bookings/:id/status", verifyToken, verifyAdmin, updateBookingStatus);

export default router;
