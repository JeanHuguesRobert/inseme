import test from "node:test";
import assert from "node:assert/strict";
import {classifyEffectFailure,createDeferredEffect} from "./deferred-effect.js";
import {planDeferredForward} from "./deferred-effect-queue.js";

function effect(){return createDeferredEffect({effectId:"e4-shared-effect",capability:"demo.noop",operation:"record",target:"e4-target",inputs:{value:"desired"},failure:classifyEffectFailure({code:"transient",transient:true}),mandateRef:"synthetic-mandate",budgetRef:"synthetic-budget",expectedTargetRevision:"rev1"});}
const observed={now:"2026-10-08T19:00:00Z",latestTargetRevision:"rev1",observationCurrent:true,mandateValid:true,budgetAvailable:true,claimCurrent:true};

test("E4: two independent handlers both pass preflight on same snapshot — atomic fencing necessary",()=>{
 const e=effect();
 const handlerA=planDeferredForward(e,[],observed);
 const handlerB=planDeferredForward(e,[],observed);
 assert.equal(handlerA.decision,"eligible_preflight_only");
 assert.equal(handlerB.decision,"eligible_preflight_only");
 assert.equal(handlerA.atomic_revalidation_required,true);
 assert.equal(handlerB.atomic_revalidation_required,true);
});

test("E4: after authoritative completion, other handler must no-op",()=>{
 const e=effect();
 const history=[{effect_id:e.effect_id,type:"delivered",evidence_ref:"receipt:handler-A"}];
 const handlerB=planDeferredForward(e,history,observed);
 assert.equal(handlerB.decision,"no_op");
 assert.equal(handlerB.reason,"delivered");
});

test("E4: concurrent target revision change yields reconciliation, not overwrite",()=>{
 const result=planDeferredForward(effect(),[],{...observed,latestTargetRevision:"rev2"});
 assert.equal(result.decision,"reconcile");
});
