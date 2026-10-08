import test from "node:test";
import assert from "node:assert/strict";
import { recoverComputeFailure } from "./github-compute-failure.js";
const request={computation_id:"x-1",repository:{name:"JeanHuguesRobert/inseme",ref:"a".repeat(40)},operation:{kind:"node-test"}};
test("interrupted compute returns failed receipt not exception",()=>{
 const r=recoverComputeFailure({request,runId:"123",reason:"timeout"});
 assert.equal(r.execution_receipt.status,"failed");
 assert.equal(r.computation_id,"x-1");
 assert.equal(r.result.error_class,"compute_exception");
});
test("existing receipt wins over fallback",()=>{
 const done={schema:"cop.compute-result/v1",computation_id:"x-1",execution_receipt:{status:"completed"}};
 assert.equal(recoverComputeFailure({request,priorResult:done}),done);
});
test("reason is bounded and newline-free",()=>{
 const r=recoverComputeFailure({request,reason:"oops\n"+"x".repeat(400)});
 assert.ok(r.result.error.length<=200);
 assert.ok(!r.result.error.includes("\n"));
});
