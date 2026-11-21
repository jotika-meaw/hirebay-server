import express from "express";

const app = express();

// B-10 mounts express.raw({ type: "application/json" }) for
// POST /api/payments/webhook here, BEFORE express.json().

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

export default app;
