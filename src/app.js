import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import adminRoutes from "./routes/admin.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import equipmentRoutes from "./routes/equipment.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import { stripeWebhook } from "./controllers/payments.controller.js";
import statsRoutes from "./routes/stats.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();

// Raw body for the Stripe webhook — mounted BEFORE express.json()
// so signature verification sees the untouched payload.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhook);

const allowList = (process.env.CLIENT_URLS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowList.includes(origin)),
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/users", usersRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/cron", cronRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
