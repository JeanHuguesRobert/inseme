import test from "node:test";
import assert from "node:assert/strict";
import {createGithubComputeAccountingConsumer} from "../cop/githubComputeAccountingConsumer.js";
const expected={epoch_id:"z0",computation_id:"job-1",run_id:"123",repository:"JeanHuguesRobert/inseme",source_ref:"a".repeat(40),actor:"instance:fracta2",usage_dimension:"runner_wall_seconds"};
const receipt={schema:"cop.compute-result/v1",computation_id:"job-1",source:{repository:expected.repository,ref:expected.source_ref},
 execution_binding:{provider_ref:"provider:github-actions",provider_execution_id:"123"},
 execution_receipt:{terminal:true,binding:{provider_execution_id:"123"}},
 resource_accounting:{usage:{runner_wall_seconds:{status:"observed",unit:"runner_wall_seconds",value:2.5}}}};
test("trusted callback and same deterministic reservation survive duplicate delivery",async()=>{
 const calls=[], reservations=new Set(),settlements=new Set();
 const consumer=createGithubComputeAccountingConsumer({fetchResult:async()=>receipt,lifecycle:{
  reserve:async x=>{calls.push(x);const duplicate=reservations.has(x.reservation_key);reservations.add(x.reservation_key);return {duplicate};},
  settle:async x=>{calls.push(x);const duplicate=settlements.has(x.reservation_key);settlements.add(x.reservation_key);return {duplicate};}
 }});
 const args={...expected,budget_ref:"compute",unit:"runner_wall_seconds",maximum:"300"};
 assert.deepEqual(await consumer.reserve(args),{duplicate:false});
 assert.deepEqual(await consumer.reserve(args),{duplicate:true});
 assert.deepEqual(await consumer.settle(expected),{duplicate:false});
 assert.deepEqual(await consumer.settle(expected),{duplicate:true});
 assert.equal(reservations.size,1);assert.equal(settlements.size,1);
 assert.equal(calls[0].reservation_key,"github-compute:job-1:123");
 assert.equal(calls[2].spent,"2.5");
});
test("reject mismatched computation, run and source without settlement",async()=>{
 for (const altered of [
  {...receipt,computation_id:"other"},
  {...receipt,execution_binding:{...receipt.execution_binding,provider_execution_id:"456"}},
  {...receipt,source:{...receipt.source,ref:"b".repeat(40)}}
 ]) {
  let count=0;
  const consumer=createGithubComputeAccountingConsumer({fetchResult:async()=>altered,lifecycle:{
   reserve:async()=>{},settle:async()=>{count++}
  }});
  await assert.rejects(()=>consumer.settle(expected),/BINDING_MISMATCH/);
  assert.equal(count,0);
 }
});
test("missing independent fetcher cannot create consumer",()=>{
 assert.throws(()=>createGithubComputeAccountingConsumer({lifecycle:{}}),/trusted callback fetcher/);
});