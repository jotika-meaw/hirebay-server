import { Router } from "express";
import {
  createEquipment,
  deleteEquipment,
  getEquipmentById,
  getEquipmentCategories,
  getFeaturedEquipment,
  listEquipment,
  listMyEquipment,
  updateEquipment,
} from "../controllers/equipment.controller.js";
import { verifyOwner, verifyOwnerOrAdmin } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

// NOTE: /featured, /categories and /mine/list are registered before /:id
// so they are never swallowed by the id parameter.
router.get("/featured", getFeaturedEquipment);
router.get("/categories", getEquipmentCategories);
router.get("/mine/list", verifyToken, verifyOwner, listMyEquipment);
router.get("/", listEquipment);
router.post("/", verifyToken, verifyOwner, createEquipment);
router.get("/:id", verifyToken, getEquipmentById);
router.patch("/:id", verifyToken, verifyOwnerOrAdmin, updateEquipment);
router.delete("/:id", verifyToken, verifyOwnerOrAdmin, deleteEquipment);

export default router;
