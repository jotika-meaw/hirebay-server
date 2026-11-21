# Hirebay Server

Hirebay — equipment rental platform API. Owners list equipment, an admin approves it, customers browse, favorite, book and pay with Stripe.

- Stack: Express 5 + MongoDB native driver, JavaScript (ESM). Deployed to Vercel as serverless.
- Health: `GET /api/health` → `{ ok: true }`.

```bash
npm run dev    # nodemon on :5000
npm run lint
npm test       # node --test
```
