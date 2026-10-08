import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {classifyEffectFailure,createDeferredEffect} from "./deferred-effect.js";
import {planDeferredForward} from "./deferred-effect-queue.js";

test("E3: authoritative supersession overrides stale conversational memory",()=>{
 const event=JSON.parse(fs.readFileSync("research/reality-tests/agent-memory-store-e3-superseded-20261008.json","utf8"));
 const effect=createDeferredEffect({
  effectId:event.effect_id,capability:"demo.noop",operation:"record",target:"probe:E1",
  inputs:{desired_state:"probe-recorded"},failure:classifyEffectFailure({code:"temporary",transient:true}),
  mandateRef:"synthetic:none",budgetRef:"synthetic:none"
 });
 const staleMemory={state:"pending",execution_permitted:false};
 assert.equal(staleMemory.state,"pending");
 const decision=planDeferredForward(effect,[event],{
  now:"2026-10-08T18:00:00Z",observationCurrent:true,
  mandateValid:true,budgetAvailable:true,claimCurrent:true
 });
 assert.equal(decision.decision,"no_op");
 assert.equal(decision.reason,"obsolete");
 assert.equal(event.execution_permitted,false);
});
