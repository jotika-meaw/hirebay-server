import { MongoClient } from "mongodb";

const cache = (globalThis.__hirebayDb ??= {});

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// Cached connection + indexes, created once per cold start.
// Never connects at import time, so builds and health checks stay DB-free.
export async function getDb() {
  if (!cache.dbPromise) {
    cache.dbPromise = connect()
      .then(async (client) => {
        const db = client.db(process.env.DB_NAME || "hirebay_dev");
        await ensureIndexes(db);
        return db;
      })
      .catch((err) => {
        cache.dbPromise = null;
        throw err;
      });
  }
  return cache.dbPromise;
}

// Index set mirrors 02-ARCHITECTURE.md §4 exactly.
export async function ensureIndexes(db) {
  await db.collection("equipment").createIndexes([
    { key: { status: 1, createdAt: -1 }, name: "status_1_createdAt_-1" },
    { key: { status: 1, category: 1 }, name: "status_1_category_1" },
    { key: { status: 1, price: 1 }, name: "status_1_price_1" },
    { key: { "owner.id": 1 }, name: "owner.id_1" },
  ]);
  await db.collection("favorites").createIndexes([
    { key: { userId: 1, equipmentId: 1 }, name: "userId_1_equipmentId_1", unique: true },
  ]);
  await db.collection("bookings").createIndexes([
    { key: { equipmentId: 1, startDate: 1, endDate: 1 }, name: "equipmentId_1_startDate_1_endDate_1" },
    { key: { "customer.id": 1, createdAt: -1 }, name: "customer.id_1_createdAt_-1" },
    { key: { "owner.id": 1, createdAt: -1 }, name: "owner.id_1_createdAt_-1" },
    { key: { status: 1, endDate: 1 }, name: "status_1_endDate_1" },
  ]);
  await db.collection("payments").createIndexes([
    { key: { sessionId: 1 }, name: "sessionId_1", unique: true },
  ]);
}
