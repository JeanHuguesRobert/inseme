import test from "node:test";
import assert from "node:assert/strict";
import {createGithubComputeAccountingBridge} from "../cop/githubComputeAccountingBridge.js";

test("host reserves bound compute budget and settles only measured terminal usage",async()=>{
 const calls=[];
 const bridge=createGithubComputeAccountingBridge({lifecycle:{
  reserve:async args=>(calls.push(["reserve",args]),{duplicate:false}),
  settle:async args=>(calls.push(["settle",args]),{duplicate:false})
 }});
 await bridge.reserve({epoch_id:"z0",budget_ref:"compute:1",unit:"runner_wall_seconds",reservation_key:"run:1",maximum:"300",actor:"instance:jhn"});
 const result={schema:"cop.compute-result/v1",computation_id:"one",execution_receipt:{terminal:true},
  resource_accounting:{usage:{runner_wall_seconds:{status:"observed",unit:"runner_wall_seconds",value:17.5}}}};
 await bridge.settle({epoch_id:"z0",reservation_key:"run:1",actor:"instance:jhn",result,usage_dimension:"runner_wall_seconds"});
 assert.equal(calls[0][1].amount,"300");
 assert.equal(calls[1][1].spent,"17.5");
});
test("unknown Actions billed minutes never become zero-cost settlement",async()=>{
 let n=0;
 const bridge=createGithubComputeAccountingBridge({lifecycle:{reserve:async()=>{},settle:async()=>{n++}}});
 const result={schema:"cop.compute-result/v1",execution_receipt:{terminal:true},
  resource_accounting:{usage:{runner_wall_seconds:{status:"observed",unit:"runner_wall_seconds",value:15},actions_minutes:{status:"not_estimated",unit:"actions_minutes"}}}};
 await assert.rejects(()=>bridge.settle({epoch_id:"z0",reservation_key:"r",actor:"a",result,usage_dimension:"actions_minutes"}),/UNMEASURED_USAGE/);
 await assert.rejects(()=>bridge.settle({epoch_id:"z0",reservation_key:"r",actor:"a",result:{...result,execution_receipt:{terminal:false}},usage_dimension:"runner_wall_seconds"}),/NONTERMINAL/);
 assert.equal(n,0);
});