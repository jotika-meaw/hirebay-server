import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyAdmin, verifyOwner, verifyOwnerOrAdmin, verifyRenter } from "../src/middlewares/verifyRole.js";

function run(mw, role) {
  let status;
  let body;
  let nextCalled = false;
  const req = { user: role === undefined ? undefined : { role } };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  mw(req, res, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled };
}

describe("verifyRole middlewares", () => {
  it("lets matching roles through", () => {
    assert.equal(run(verifyRenter, "customer").nextCalled, true);
    assert.equal(run(verifyOwner, "owner").nextCalled, true);
    assert.equal(run(verifyAdmin, "admin").nextCalled, true);
    assert.equal(run(verifyOwnerOrAdmin, "owner").nextCalled, true);
    assert.equal(run(verifyOwnerOrAdmin, "admin").nextCalled, true);
  });

  it("rejects mismatched roles with 403 { message }", () => {
    const r = run(verifyOwner, "customer");
    assert.equal(r.nextCalled, false);
    assert.equal(r.status, 403);
    assert.deepEqual(Object.keys(r.body), ["message"]);
  });

  it("rejects missing user or role with 403", () => {
    assert.equal(run(verifyAdmin, undefined).status, 403);
    assert.equal(run(verifyRenter, "owner").status, 403);
    assert.equal(run(verifyOwnerOrAdmin, "customer").status, 403);
  });
});
