import test from "node:test";import assert from "node:assert/strict";
import {classifyEffectFailure,createDeferredEffect,evaluateDeferredEffect} from "./deferred-effect.js";
const make=(opts={})=>createDeferredEffect({effectId:"e1",capability:"document.update",operation:"replace",target:"draft:1",inputs:{body:"new"},failure:classifyEffectFailure({code:"timeout",transient:true}),mandateRef:"m",budgetRef:"b",expectedTargetRevision:"v1",expectedPacketGeneration:2,...opts});
const current={now:"2026-10-08T12:00:00Z",observationCurrent:true,latestTargetRevision:"v1",currentGeneration:2,mandateValid:true,budgetAvailable:true,claimCurrent:true};
test("previously failed effect no-ops when independent handler already satisfied it",()=>assert.equal(evaluateDeferredEffect(make(),{...current,alreadySatisfied:true}).decision,"satisfied_elsewhere"));
test("newer target blocks stale replay",()=>assert.equal(evaluateDeferredEffect(make(),{...current,latestTargetRevision:"v2"}).decision,"reconcile"));
test("expiry and late supersession cancel prior intention",()=>{
 assert.equal(evaluateDeferredEffect(make({validUntil:"2026-10-08T11:59:59Z"}),current).decision,"obsolete");
 assert.equal(evaluateDeferredEffect(make(),{...current,supersededBy:"e2"}).reason,"superseded");
});
test("absent fresh proof never authorizes replay",()=>assert.equal(evaluateDeferredEffect(make(),{...current,observationCurrent:false}).decision,"deferred"));
test("eligible still demands atomic effect-boundary check",()=>assert.equal(evaluateDeferredEffect(make(),current).atomic_effect_check_required,true));
