import assert from "node:assert/strict";
import test from "node:test";
import { classifyAcpError } from "../src/router.js";

test("classifies a real Codex quota-exhaustion error as exhausted, with the real message preserved", () => {
  const err = new Error("Internal error");
  err.acpError = {
    code: -32603,
    message: "Internal error",
    data: {
      message: "You've hit your usage limit. Upgrade to Pro...",
      codexErrorInfo: "usageLimitExceeded",
    },
  };
  const result = classifyAcpError(err);
  assert.equal(result.exhausted, true);
  assert.match(result.reason, /usageLimitExceeded/);
  assert.match(result.reason, /usage limit/);
});

test("does not mark a continuation resolution-timeout as exhausted", () => {
  const err = new Error("Timed out waiting for a resolver to answer the continuation");
  err.acpError = {
    code: -32603,
    message: "Timed out...",
    data: { continuationErrorInfo: "resolution_timeout", continuationId: "ctn_x", waitedMs: 5000 },
  };
  const result = classifyAcpError(err);
  assert.equal(result.exhausted, false);
  assert.match(result.reason, /resolution_timeout/);
});

test("falls back to err.message when no structured acpError is attached", () => {
  const err = new Error("spawn ENOENT");
  const result = classifyAcpError(err);
  assert.equal(result.exhausted, false);
  assert.equal(result.reason, "spawn ENOENT");
});

test("recognizes rateLimited as an exhaustion signal alongside usageLimitExceeded", () => {
  const err = new Error("Internal error");
  err.acpError = { data: { message: "slow down", codexErrorInfo: "rateLimited" } };
  const result = classifyAcpError(err);
  assert.equal(result.exhausted, true);
});
