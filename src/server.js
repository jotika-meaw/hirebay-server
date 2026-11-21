import "dotenv/config.js";
import cron from "node-cron";
import app from "./app.js";
import { completeBookings } from "./jobs/completeBookings.js";
import { getDb } from "./lib/db.js";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`hirebay-server listening on :${PORT}`);
});

// Hourly completion job (02 §6). Vercel serverless keeps no timers,
// so production also runs it via the daily Vercel cron (vercel.json).
cron.schedule("0 * * * *", async () => {
  try {
    const db = await getDb();
    const counts = await completeBookings(db, new Date());
    console.log(`completeBookings: ${counts.completed} completed, ${counts.cancelled} cancelled`);
  } catch (err) {
    console.error("completeBookings failed:", err.message);
  }
});
