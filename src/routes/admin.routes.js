import { Router } from "express";
import { listAllEquipment, updateEquipmentStatus } from "../controllers/admin.controller.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/equipment", verifyToken, verifyAdmin, listAllEquipment);
router.patch("/equipment/:id/status", verifyToken, verifyAdmin, updateEquipmentStatus);

export default router;
