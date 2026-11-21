import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/utils/paginate.js";

describe("paginate", () => {
  it("applies defaults (page 1, limit 9)", () => {
    assert.deepEqual(paginate({ total: 100 }), { page: 1, limit: 9, pages: 12, skip: 0 });
  });

  it("clamps limit to 1–24 and page to ≥ 1", () => {
    assert.equal(paginate({ page: 0, limit: 100, total: 100 }).limit, 24);
    assert.equal(paginate({ page: -3, limit: 0, total: 100 }).page, 1);
    assert.equal(paginate({ page: -3, limit: 0, total: 100 }).limit, 9);
  });

  it("computes skip and at least one page", () => {
    assert.deepEqual(paginate({ page: 3, limit: 9, total: 100 }), { page: 3, limit: 9, pages: 12, skip: 18 });
    assert.deepEqual(paginate({ page: 5, limit: 9, total: 0 }), { page: 5, limit: 9, pages: 1, skip: 36 });
  });
});
