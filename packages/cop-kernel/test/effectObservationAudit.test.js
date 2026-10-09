import test from "node:test";
import assert from "node:assert/strict";
import { auditEffectObservations } from "../src/accounting/effectObservationAudit.js";
import { classifyEffectObservation } from "../src/effectObservation.js";

const missing = classifyEffectObservation({intentId:"intent-1"});
test("missing provider proof produces unresolved evidence, no transaction", () => {
 const a=auditEffectObservations({observations:[{type:"cop.effect.observed",data:missing}]});
 assert.equal(a.ok,false);
 assert.equal(a.unresolved.length,1);
 assert.equal(a.unresolved[0].intent_id,"intent-1");
 assert.deepEqual(a.generated_transactions,[]);
 assert.equal(a.accounting.accounted_real_effects,0);
});
test("identical duplicate observation is not double-counted", () => {
 const a=auditEffectObservations({observations:[missing,missing]});
 assert.equal(a.observations_seen,1);
 assert.equal(a.unresolved.length,1);
 assert.deepEqual(a.conflicts,[]);
});
test("contradictory observations require reconciliation", () => {
 const verified=classifyEffectObservation({intentId:"intent-1",effectVerified:true,effectVerification:"provider:evidence:001"});
 const a=auditEffectObservations({observations:[missing,verified]});
 assert.equal(a.ok,false);
 assert.equal(a.conflicts[0].code,"conflicting_observation");
 assert.deepEqual(a.generated_transactions,[]);
});
test("independent evidence reference does not fabricate accounting entry", () => {
 const verified=classifyEffectObservation({intentId:"intent-2",effectVerified:true,effectVerification:"provider:evidence:002"});
 const a=auditEffectObservations({observations:[verified]});
 assert.equal(a.observations_seen,1);
 assert.equal(a.unresolved.length,0);
 assert.deepEqual(a.generated_transactions,[]);
});
