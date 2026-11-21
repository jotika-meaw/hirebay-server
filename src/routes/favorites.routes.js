import { Router } from "express";
import {
  addFavorite,
  getFavoriteIds,
  listFavorites,
  removeFavorite,
} from "../controllers/favorites.controller.js";
import { verifyRenter } from "../middlewares/verifyRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/ids", verifyToken, verifyRenter, getFavoriteIds);
router.get("/", verifyToken, verifyRenter, listFavorites);
router.post("/", verifyToken, verifyRenter, addFavorite);
router.delete("/:equipmentId", verifyToken, verifyRenter, removeFavorite);

export default router;
