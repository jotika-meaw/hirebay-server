import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();

// B-10 mounts express.raw({ type: "application/json" }) for
// POST /api/payments/webhook here, BEFORE express.json().

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

app.use(notFound);
app.use(errorHandler);

export default app;
