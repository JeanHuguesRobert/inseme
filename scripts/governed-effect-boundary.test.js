import test from "node:test";
import assert from "node:assert/strict";
import {classifyGovernedEffect,EffectBoundary} from "./governed-effect-boundary.js";
test("unknown effect is blocked",()=>assert.equal(classifyGovernedEffect({}).code,"UNKNOWN_EFFECT_BOUNDARY"));
test("only recognized synthetic SQLite local effect is advisory ready",()=>{
  const x=classifyGovernedEffect({effect:{boundary:EffectBoundary.LOCAL_TRANSACTIONAL,provider:"sqlite-governed-effect-gateway",kind:"synthetic_state_update"}});
  assert.equal(x.status,"ADVISORY_READY");
  assert.equal(x.execution_authorized,false);
  assert.equal(x.required_boundary,"SqliteGovernedEffectGateway.commit");
});
test("local label cannot authorize a GitHub mutation",()=>{
  const x=classifyGovernedEffect({effect:{boundary:EffectBoundary.LOCAL_TRANSACTIONAL,provider:"github",kind:"update_file"}});
  assert.equal(x.code,"UNSUPPORTED_LOCAL_EFFECT");
});
test("external unfenced effects always blocked",()=>{
  const x=classifyGovernedEffect({effect:{boundary:EffectBoundary.EXTERNAL_UNFENCED,provider:"github"}});
  assert.equal(x.code,"EXTERNAL_EFFECT_UNFENCED");
});
test("provider fence declarations alone cannot authorize external effects",()=>{
  const effect={boundary:EffectBoundary.EXTERNAL_PROVIDER_FENCED,provider:"github",kind:"update_file"};
  assert.equal(classifyGovernedEffect({effect,providerFence:{verified:true}}).code,"PROVIDER_FENCE_ADAPTER_NOT_CONNECTED");
  assert.equal(classifyGovernedEffect({effect}).execution_authorized,false);
});
