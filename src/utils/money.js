// Currency (01 decision 4). Stripe takes integer minor units:
// unit_amount = totalBDT × 100, currency "bdt". If Stripe ever rejects BDT,
// switch STRIPE_CURRENCY to "usd" and convert with BDT_PER_USD in both repos.
export const STRIPE_CURRENCY = "bdt";
export const BDT_PER_USD = 120;

export function toStripeAmount(totalBDT) {
  if (STRIPE_CURRENCY === "usd") return Math.round((totalBDT / BDT_PER_USD) * 100);
  return totalBDT * 100;
}

export function stripeAmountMatches(sessionAmount, totalBDT) {
  return sessionAmount === toStripeAmount(totalBDT);
}
