import test from "node:test";import assert from "node:assert/strict";import {inspectEffectLease,makeEffectLease} from "./effect-lease-fence.js";import {makeLeaseCost,assessLeaseBudget} from "./effect-lease-accounting.js";
const cost=makeLeaseCost({budgetRef:"budget:test",quote:"zero monetary price does not imply zero resources",dimensions:[{kind:"money",unit:"EUR",status:"observed",value:0},{kind:"coordination",unit:"api_requests",status:"estimated",value:2},{kind:"agent_attention",unit:"tokens",status:"unknown"}]});
const lease=makeEffectLease({cost,effectId:"test",holder:"agent-a",generation:2,expectedRevision:4,expectedTargetRevision:"v7",expiresAt:"2026-10-08T20:00:00Z"});
const valid={lease,now:"2026-10-08T19:00:00Z",canonicalGeneration:2,canonicalRevision:4,targetRevision:"v7",mandateValid:true,budgetAvailable:true,reservationRecorded:true,unknownCostPolicy:"authorized_bounded_unknown"};
test("same generation only passes preflight",()=>{const r=inspectEffectLease(valid);assert.equal(r.decision,"preflight_only");assert.equal(r.provider_atomic_check_required,true)});
test("new generation fences stale holder",()=>assert.equal(inspectEffectLease({...valid,canonicalGeneration:3}).decision,"fenced"));
test("expired lease fences previous holder",()=>assert.equal(inspectEffectLease({...valid,now:"2026-10-08T20:00:01Z"}).reason,"lease_expired"));
test("superseded intention cannot execute",()=>assert.equal(inspectEffectLease({...valid,desired:false}).decision,"obsolete"));
test("completion elsewhere cancels duplicate",()=>assert.equal(inspectEffectLease({...valid,alreadySatisfied:true}).decision,"no_op"));
test("unknown authoritative revision fails closed",()=>assert.equal(inspectEffectLease({...valid,canonicalRevision:undefined}).decision,"defer"));
test("target revision divergence reconciles",()=>assert.equal(inspectEffectLease({...valid,targetRevision:"v8"}).decision,"reconcile"));

test("monetary zero coexists with estimated and unknown costs",()=>{assert.equal(lease.cost.dimensions.length,3);assert.equal(lease.cost.dimensions[0].value,0);assert.equal(lease.cost.dimensions[2].status,"unknown")});
test("missing budget reservation blocks lease",()=>assert.equal(inspectEffectLease({...valid,reservationRecorded:false}).decision,"blocked"));
test("unknown cost requires explicit authorization policy",()=>assert.equal(inspectEffectLease({...valid,unknownCostPolicy:"defer"}).decision,"deferred"));
test("unknown cost cannot masquerade as numerical zero",()=>assert.throws(()=>makeLeaseCost({budgetRef:"budget:x",dimensions:[{kind:"time",unit:"seconds",status:"unknown",value:0}]})));
