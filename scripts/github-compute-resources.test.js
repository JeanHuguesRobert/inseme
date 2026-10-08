import test from "node:test";import assert from "node:assert/strict";
import{computeResourceSnapshot,admitComputeResources,computeResourceReceipt}from "./github-compute-resources.js";
test("unknown available provider quota is unknown, not zero",()=>{
 const s=computeResourceSnapshot();
 assert.equal(s.available.actions_minutes.status,"not_estimated");
 assert.equal(admitComputeResources({before:s,required:{actions_minutes:2}}).decision,"deferred");
 assert.equal(admitComputeResources({before:s,required:{actions_minutes:2},policy:"allow_unknown"}).decision,"admitted");
});
test("known insufficiency prevents admission and protects reserve",()=>{
 const s=computeResourceSnapshot({available:{actions_minutes:3}});
 const r=admitComputeResources({before:s,required:{actions_minutes:2},reserve:{actions_minutes:2}});
 assert.equal(r.decision,"refused");assert.equal(r.deficits[0].available,3);
});
test("before and after receipt keeps budget separate from provider quota",()=>{
 const b=computeResourceSnapshot({available:{api_requests:100}});
 const a=computeResourceSnapshot({available:{api_requests:99}});
 const admitted=admitComputeResources({before:b,required:{api_requests:1}});
 const r=computeResourceReceipt({before:b,after:a,admission:admitted,executionStatus:"completed",usage:{api_requests:1}});
 assert.equal(r.before.available.api_requests.value,100);assert.equal(r.after.available.api_requests.value,99);
 assert.equal(r.admission.budget_check,"separate_required");
 assert.equal(r.usage.api_requests.value,1);
});
test("invalid requirements fail closed",()=>{
 assert.throws(()=>admitComputeResources({before:computeResourceSnapshot(),required:{actions_minutes:-1}}));
});
