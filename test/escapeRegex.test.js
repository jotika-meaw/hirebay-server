import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeRegex } from "../src/utils/escapeRegex.js";

describe("escapeRegex", () => {
  it("escapes regex metacharacters so search=( cannot crash", () => {
    const re = new RegExp(escapeRegex("search=("), "i");
    assert.equal(re.test("search=(foo"), true);
    assert.equal(re.test("anything else"), false);
  });

  it("leaves plain text untouched", () => {
    assert.equal(escapeRegex("dhaka gazipur 123"), "dhaka gazipur 123");
  });

  it("escapes every special character", () => {
    assert.equal(escapeRegex(".*+?^${}()|[]\\"), "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("coerces non-strings safely", () => {
    assert.equal(escapeRegex(null), "");
    assert.equal(escapeRegex(undefined), "");
    assert.equal(escapeRegex(42), "42");
  });
});
