import { Router } from "express";
import {
  getEquipmentCategories,
  getFeaturedEquipment,
  listEquipment,
} from "../controllers/equipment.controller.js";

const router = Router();

// NOTE: /featured and /categories are registered before /:id (added in
// B-05) so they are never swallowed by the id parameter.
router.get("/featured", getFeaturedEquipment);
router.get("/categories", getEquipmentCategories);
router.get("/", listEquipment);

export default router;
