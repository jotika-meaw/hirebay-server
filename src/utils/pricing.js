// Pricing (01 decision 1). EXACT same formula as
// hirebay-client/src/lib/pricing.js. The server is the source of truth.
// days = (endDate − startDate) in whole days + 1 (inclusive; same day = 1).
// units: daily → days; weekly → ceil(days/7); monthly → ceil(days/30).
// total = units × price × quantity.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function wholeDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

export function billableUnits(days, rentalType) {
  if (rentalType === "weekly") return Math.ceil(days / 7);
  if (rentalType === "monthly") return Math.ceil(days / 30);
  return days;
}

export function computePricing({ startDate, endDate, price, rentalType, quantity }) {
  const days = wholeDays(startDate, endDate);
  const units = billableUnits(days, rentalType);
  const total = units * price * quantity;
  return { days, units, total };
}
