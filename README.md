# Hirebay API

Hirebay — equipment rental platform API. Owners list equipment, an admin approves it, customers browse, favorite, book and pay with Stripe. The booking is confirmed only after successful payment.

- Live: `https://hirebay-server.vercel.app`
- Client: Hirebay web app (`hirebay-client`, Next.js + BetterAuth) — same MongoDB database.
- Health: `GET /api/health` → `{ ok: true }`.

## Key features

- JWT auth bridged from BetterAuth (`verifyToken`) + role middlewares (`verifyRenter`, `verifyOwner`, `verifyAdmin`, `verifyOwnerOrAdmin`) — the role always comes from the database.
- Public catalog: server-side search (regex-escaped), category/location/price/availability filters, sorting, pagination, featured, categories, public stats.
- Owner equipment CRUD with ownership checks; status resets to `pending` on owner edits; delete blocked (409) while upcoming paid bookings exist.
- Admin moderation for equipment, bookings and users (self-change/self-delete blocked).
- Customer favorites (idempotent add, joined list).
- Server-side pricing (inclusive days; daily / ceil-7 weekly / ceil-30 monthly) + availability re-checked at booking and at payment.
- Stripe Checkout with idempotent `confirmBooking` (shared by `/payments/confirm` and the webhook), `payments` rows with a unique `sessionId`.
- Hourly completion job (plus a daily Vercel cron): past-end paid bookings → `completed`, expired unpaid holds → `cancelled`.
- Admin + owner analytics aggregations over the last 6 calendar months (empty months return 0).

## Packages

- `express` — HTTP server (v5, ESM).
- `mongodb` — native driver, cached client on `globalThis`.
- `cors` — origin allow-list from `CLIENT_URLS`.
- `dotenv` — local `.env` loading.
- `jsonwebtoken` — HS256 JWT verification (issuer + audience).
- `stripe` — Checkout Sessions + webhook signature verification.
- `node-cron` — hourly completion job in local dev.
- `nodemon` (dev) — auto-reload on `:5000`.
- `eslint` + `@eslint/js` + `globals` (dev) — linting.

## Env vars (names only — values never committed; see `.env.example`)

`PORT`, `MONGODB_URI`, `DB_NAME`, `CLIENT_URLS`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`.

## Endpoint table (base `/api`)

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/health` | public | `{ ok: true }` liveness |
| GET | `/stats/public` | public | listings, cities, completedRentals, avgRating |
| GET | `/equipment` | public | approved only; search/location/category/rentalType/minPrice/maxPrice/availability/sort/page/limit |
| GET | `/equipment/featured` | public | newest 6 approved |
| GET | `/equipment/categories` | public | counts per category |
| GET | `/equipment/mine/list` | owner | own equipment, paginated, optional status |
| POST | `/equipment` | owner | create (status forced `pending`) |
| GET | `/equipment/:id` | logged in | approved → anyone; pending/rejected → owner or admin |
| PATCH | `/equipment/:id` | owner or admin | whitelist; owner edit resets status to `pending` |
| DELETE | `/equipment/:id` | owner or admin | 409 with upcoming paid bookings; favorites cleaned |
| GET | `/favorites` | customer | joined with equipment, newest first |
| GET | `/favorites/ids` | customer | equipment id strings for heart state |
| POST | `/favorites` | customer | idempotent add (approved equipment only) |
| DELETE | `/favorites/:equipmentId` | customer | remove |
| POST | `/bookings` | customer | validate, availability check, create reservation (pending + unpaid, 30-min hold) |
| GET | `/bookings/mine` | customer | own bookings, paginated, optional status |
| GET | `/bookings/owner` | owner | bookings of own equipment, paginated |
| GET | `/admin/bookings` | admin | all bookings, paginated, status filter |
| PATCH | `/admin/bookings/:id/status` | admin | confirmed / completed / cancelled |
| POST | `/payments/checkout` | customer | Stripe Checkout Session for own unpaid, unexpired booking |
| POST | `/payments/confirm` | customer | confirm by sessionId (idempotent) |
| POST | `/payments/webhook` | Stripe signature | `checkout.session.completed` → confirm (raw body) |
| GET | `/users/me` · PATCH | logged in | profile (name, image, phone, address) |
| GET | `/admin/users` | admin | paginated, search, role filter |
| PATCH | `/admin/users/:id/role` | admin | change role (not self) |
| DELETE | `/admin/users/:id` | admin | remove user + sessions/accounts (not self) |
| GET | `/admin/equipment` | admin | all statuses, filter, search, paginated |
| PATCH | `/admin/equipment/:id/status` | admin | approve / reject |
| GET | `/analytics/admin` | admin | totals + revenue + 6-month bookings/revenue |
| GET | `/analytics/owner` | owner | listings, earnings, status mix, 6-month earnings |
| GET | `/cron/complete-bookings` | `Bearer CRON_SECRET` | run the completion job |

## Booking → payment → confirmation → completion

1. `POST /api/bookings` validates input, computes the total on the server and creates a reservation (`status: 'pending'`, `paymentStatus: 'unpaid'`, `holdExpiresAt = now + 30 min`). The booking is confirmed only after successful payment.
2. `POST /api/payments/checkout` creates a Stripe Checkout Session (expires in ~30 min) for that booking.
3. Stripe redirects to `/payment/success?session_id=…`; the client calls `POST /api/payments/confirm`, and the webhook (`POST /api/payments/webhook`, event `checkout.session.completed`) runs the same `confirmBooking`: paid + confirmed, `transactionId` saved, one `payments` row (duplicate-safe).
4. After the end date passes, the hourly job (or daily Vercel cron) flips paid + confirmed bookings to `completed`; expired unpaid holds become `cancelled`.

## Run locally / tests

```bash
npm run dev    # nodemon on :5000 (needs .env, DB_NAME=hirebay_dev)
npm run lint
npm test       # node --test (unit + stubbed integration tests, no live DB needed)
```

Never seed, test or write against the `hirebay` (production) database.
