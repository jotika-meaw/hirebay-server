import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { billableUnits, computePricing, wholeDays } from "../src/utils/pricing.js";

describe("pricing", () => {
  it("same day counts as 1 day", () => {
    assert.equal(wholeDays("2026-11-21", "2026-11-21"), 1);
    assert.equal(computePricing({ startDate: "2026-11-21", endDate: "2026-11-21", price: 18500, rentalType: "daily", quantity: 1 }).total, 18500);
  });

  it("8 days weekly = 2 units", () => {
    assert.equal(wholeDays("2026-11-01", "2026-11-08"), 8);
    assert.equal(billableUnits(8, "weekly"), 2);
  });

  it("31 days monthly = 2 units", () => {
    assert.equal(wholeDays("2026-11-01", "2026-12-01"), 31);
    assert.equal(billableUnits(31, "monthly"), 2);
  });

  it("3 days x 18500 x 2 = 111000", () => {
    const { days, units, total } = computePricing({
      startDate: "2026-11-21",
      endDate: "2026-11-23",
      price: 18500,
      rentalType: "daily",
      quantity: 2,
    });
    assert.equal(days, 3);
    assert.equal(units, 3);
    assert.equal(total, 111000);
  });
});
