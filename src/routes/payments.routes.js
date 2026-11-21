import { Router } from "express";
import { confirmPayment, createCheckout } from "../controllers/payments.controller.js";
import { verifyRenter } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.post("/checkout", verifyToken, verifyRenter, createCheckout);
router.post("/confirm", verifyToken, verifyRenter, confirmPayment);

export default router;
