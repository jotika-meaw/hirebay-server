import { Router } from "express";
import {
  deleteUser,
  listAllEquipment,
  listUsers,
  updateEquipmentStatus,
  updateUserRole,
} from "../controllers/admin.controller.js";
import { listAdminBookings, updateBookingStatus } from "../controllers/bookings.controller.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/equipment", verifyToken, verifyAdmin, listAllEquipment);
router.patch("/equipment/:id/status", verifyToken, verifyAdmin, updateEquipmentStatus);
router.get("/bookings", verifyToken, verifyAdmin, listAdminBookings);
router.patch("/bookings/:id/status", verifyToken, verifyAdmin, updateBookingStatus);
router.get("/users", verifyToken, verifyAdmin, listUsers);
router.patch("/users/:id/role", verifyToken, verifyAdmin, updateUserRole);
router.delete("/users/:id", verifyToken, verifyAdmin, deleteUser);

export default router;
