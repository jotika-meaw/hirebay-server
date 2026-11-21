import { Router } from "express";
import { getAdminAnalytics, getOwnerAnalytics } from "../controllers/analytics.controller.js";
import { verifyAdmin, verifyOwner } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/admin", verifyToken, verifyAdmin, getAdminAnalytics);
router.get("/owner", verifyToken, verifyOwner, getOwnerAnalytics);

export default router;
