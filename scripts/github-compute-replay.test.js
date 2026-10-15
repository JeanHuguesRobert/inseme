import test from "node:test";
import assert from "node:assert/strict";
import {isSkippedComputeReplay} from "./github-compute-replay.js";
const phases={request:"success",replay:"success",admission:"skipped",verify:"skipped",execute:"skipped"};
test("completed prior request is a replay skip, never a failed computation",()=>{
 assert.equal(isSkippedComputeReplay({request:{computation_id:"same"},result:null,diagnostic:null,phases}),true);
});
test("real execution/failure is not mistaken for replay",()=>{
 assert.equal(isSkippedComputeReplay({request:{},result:null,diagnostic:null,phases:{...phases,execute:"failure"}}),false);
 assert.equal(isSkippedComputeReplay({request:{},result:null,diagnostic:{message:"failed"},phases}),false);
 assert.equal(isSkippedComputeReplay({request:{},result:{schema:"cop.compute-result/v1"},diagnostic:null,phases}),false);
 assert.equal(isSkippedComputeReplay({request:null,result:null,diagnostic:null,phases}),false);
});
