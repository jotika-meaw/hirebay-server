import { Router } from "express";
import { getPublicStats } from "../controllers/equipment.controller.js";

const router = Router();

router.get("/public", getPublicStats);

export default router;
