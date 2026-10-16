import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createJhnLocalCopRuntime} from "../cop/localRuntimeServer.js";
import {bootstrapJhnLocalCopAuthority} from "../../scripts/bootstrap-jhn-cop-local.js";

test("local budget grant route defaults closed without a configured adapter",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"cop-budget-"));
 let runtime;
 try {
  await bootstrapJhnLocalCopAuthority({stateDirectory:dir});
  runtime=await createJhnLocalCopRuntime({stateDirectory:dir});
  const {port}=await runtime.listen();
  const response=await fetch("http://127.0.0.1:"+port+"/cop/accounting/budgets/grant",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({epoch_id:"z0",budget_ref:"B",unit:"TEST_UNIT",amount:"1"})});
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,"COP_ACCOUNTING_NOT_CONFIGURED");
 } finally {
  if(runtime) await runtime.close();
  await rm(dir,{recursive:true,force:true});
 }
});
