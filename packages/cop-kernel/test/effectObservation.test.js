import test from "node:test";
import assert from "node:assert/strict";
import { classifyEffectObservation } from "../src/effectObservation.js";

test("claim without provider proof remains indeterminate", () => {
  const observed = classifyEffectObservation({ intentId:"same-intent", claimPresent:true });
  assert.equal(observed.status, "indeterminate");
  assert.equal(observed.automatic_retry_allowed, false);
  assert.equal(observed.effect_verification, null);
});

test("provider evidence is required to declare verified effect", () => {
  assert.throws(() => classifyEffectObservation({
    intentId:"same-intent", claimPresent:true, effectVerified:true,
  }), /source reference/);
  assert.equal(classifyEffectObservation({
    intentId:"same-intent", claimPresent:true,
    effectVerified:true, effectVerification:"provider:synthetic:receipt:001",
  }).status, "effect_verified");
});

test("absence of claim is not evidence of safe replay", () => {
  const observed = classifyEffectObservation({intentId:"same-intent"});
  assert.equal(observed.status,"unclaimed");
  assert.equal(observed.automatic_retry_allowed,false);
});

test("classification requires an attributable intention", () => {
  assert.throws(() => classifyEffectObservation({claimPresent:true}), /intentId/);
});
