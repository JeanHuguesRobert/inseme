import test from "node:test";import assert from "node:assert/strict";
function decision({snapshot,mandate,stream,revocationObserved,atomicAppendAvailable=false}){
 if(snapshot.mandateRevision!==mandate.revision||!mandate.active||revocationObserved)return {decision:"fenced",reason:"revoked_or_stale_mandate"};
 if(!mandate.allowedStreams.includes(stream))return {decision:"blocked",reason:"scope"};
 if(!atomicAppendAvailable)return {decision:"preflight_only",reason:"non_atomic_check_write_window"};
 return {decision:"provider_check_required"};
}
const stream="case:alpha",old={mandateRevision:1},initial={revision:1,active:true,allowedStreams:[stream]},revoked={...initial,revision:2,active:false};
test("revoke after original authorization fences stale handler on fresh observation",()=>{assert.equal(decision({snapshot:old,mandate:initial,stream}).decision,"preflight_only");assert.deepEqual(decision({snapshot:old,mandate:revoked,stream,revocationObserved:true}),{decision:"fenced",reason:"revoked_or_stale_mandate"})});
test("preflight cannot guarantee safety if revocation races after check",()=>assert.equal(decision({snapshot:old,mandate:initial,stream}).reason,"non_atomic_check_write_window"));
test("fresh authorization alone still cannot imply atomic append",()=>assert.equal(decision({snapshot:{mandateRevision:2},mandate:{...initial,revision:2},stream}).decision,"preflight_only"));
