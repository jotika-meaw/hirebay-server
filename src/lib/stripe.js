import Stripe from "stripe";

const cache = (globalThis.__hirebayStripe ??= {});

// Lazily created so builds and health checks stay Stripe-free.
// Throws 503 when no key is configured (proofs run without Stripe).
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error("Payments are not configured"), { status: 503 });
  }
  if (!cache.client) {
    cache.client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cache.client;
}
