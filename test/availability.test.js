import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { availableQuantity, blockingQuantity, isBlockingBooking, overlaps } from "../src/utils/availability.js";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const liveHold = new Date("2026-11-21T12:20:00.000Z");
const expiredHold = new Date("2026-11-21T11:00:00.000Z");

function booking(overrides) {
  return {
    startDate: new Date("2026-11-22"),
    endDate: new Date("2026-11-24"),
    quantity: 1,
    status: "confirmed",
    paymentStatus: "paid",
    ...overrides,
  };
}

describe("availability", () => {
  it("edge-day overlap counts (inclusive)", () => {
    assert.equal(overlaps("2026-11-24", "2026-11-26", "2026-11-22", "2026-11-24"), true);
    assert.equal(overlaps("2026-11-20", "2026-11-22", "2026-11-22", "2026-11-24"), true);
    assert.equal(
      blockingQuantity([booking({})], "2026-11-24", "2026-11-26", NOW),
      1
    );
  });

  it("back-to-back ranges do not overlap", () => {
    assert.equal(overlaps("2026-11-25", "2026-11-26", "2026-11-22", "2026-11-24"), false);
    assert.equal(
      blockingQuantity([booking({})], "2026-11-25", "2026-11-26", NOW),
      0
    );
    assert.equal(availableQuantity(2, [booking({})], "2026-11-25", "2026-11-26", NOW), 2);
  });

  it("expired holds are ignored", () => {
    const expired = booking({ status: "pending", paymentStatus: "unpaid", holdExpiresAt: expiredHold });
    assert.equal(isBlockingBooking(expired, NOW), false);
    assert.equal(blockingQuantity([expired], "2026-11-22", "2026-11-24", NOW), 0);
  });

  it("live unpaid holds are counted", () => {
    const live = booking({ status: "pending", paymentStatus: "unpaid", holdExpiresAt: liveHold, quantity: 2 });
    assert.equal(isBlockingBooking(live, NOW), true);
    assert.equal(blockingQuantity([live], "2026-11-22", "2026-11-24", NOW), 2);
    assert.equal(availableQuantity(2, [live], "2026-11-22", "2026-11-24", NOW), 0);
  });

  it("cancelled bookings never block", () => {
    const cancelledPaid = booking({ status: "cancelled", paymentStatus: "paid" });
    const cancelledHold = booking({ status: "cancelled", paymentStatus: "unpaid", holdExpiresAt: liveHold });
    const completed = booking({ status: "completed", paymentStatus: "paid" });
    assert.equal(isBlockingBooking(cancelledPaid, NOW), false);
    assert.equal(isBlockingBooking(cancelledHold, NOW), false);
    assert.equal(isBlockingBooking(completed, NOW), false);
    assert.equal(blockingQuantity([cancelledPaid, cancelledHold, completed], "2026-11-22", "2026-11-24", NOW), 0);
  });
});
