import test from "node:test";
import assert from "node:assert/strict";
import { createGovernedEpochBudgetGrantHandler } from "../cop/governedEpochBudget.js";

const request = {body:{epoch_id:"z0",budget_ref:"budget:test",unit:"TEST_UNIT",amount:"2",
 actor:"forged",mandate_ref:"forged",authority_ref:"forged"}};
const active = {principal:{id:"principal:test"},mandateRef:"mandate:verified",mandateVersion:2,
 mandate:{status:"active",granteeRef:"principal:test",permissions:["cop.accounting.budget.grant"]}};

test("verified authority fixes principal and mandate for budget grant",async()=>{
 const calls=[];
 const handler=createGovernedEpochBudgetGrantHandler({
  resolveContext:async()=>active,grantBudget:async args=>(calls.push(args),{ok:true})});
 const result=await handler(request);
 assert.equal(result.status,201);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{epoch_id:"z0",budget_ref:"budget:test",unit:"TEST_UNIT",
  amount:"2",actor:"principal:test",mandate_ref:"mandate:verified",authority_ref:"mandate:mandate:verified:v2"});
});
test("missing or ungranted mandate never reaches budget store",async()=>{
 let calls=0;
 const grantBudget=async()=>{calls++};
 const absent=createGovernedEpochBudgetGrantHandler({resolveContext:async()=>null,grantBudget});
 assert.equal((await absent(request)).status,401);
 const denied=createGovernedEpochBudgetGrantHandler({resolveContext:async()=>({
  ...active,mandate:{...active.mandate,permissions:[]}}),grantBudget});
 await assert.rejects(()=>denied(request),{code:"COP_ACCESS_DENIED"});
 assert.equal(calls,0);
});
test("unsigned identity claims in request do not confer authority",async()=>{
 let calls=0;
 const handler=createGovernedEpochBudgetGrantHandler({
 resolveContext:async()=>({...active,mandateRef:null}),grantBudget:async()=>{calls++}});
 await assert.rejects(()=>handler(request),/verified mandate identity/);
 assert.equal(calls,0);
});
