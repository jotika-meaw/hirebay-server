import { Router } from "express";
import { getMe, updateMe } from "../controllers/users.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/me", verifyToken, getMe);
router.patch("/me", verifyToken, updateMe);

export default router;
