import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import os from "node:os";
import path from "node:path";
import {createJhnLocalCopRuntime} from "../cop/localRuntimeServer.js";
import {createJhnLocalCapabilityIssuer} from "../cop/localCapabilityIssuer.js";
import {bootstrapJhnLocalCopAuthority} from "../../scripts/bootstrap-jhn-cop-local.js";

test("signed budget grant route enforces current authority and never trusts request identities",async()=>{
 const stateDirectory=await mkdtemp(path.join(os.tmpdir(),"cop-governed-budget-"));
 let current=new Date("2026-10-16T10:00:00.000Z");
 const clock=()=>current;
 let runtime,issuer;
 const calls=[];
 const dbPath=path.join(stateDirectory,"cop-runtime.sqlite");
 const post=async(base,token)=>fetch(base+"/cop/accounting/budgets/grant",{
  method:"POST",
  headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},
  body:JSON.stringify({epoch_id:"z0",budget_ref:"test:budget",unit:"TEST_UNIT",amount:"2",
    actor:"forged",mandate_ref:"forged",authority_ref:"forged"})
 });
 try {
  await bootstrapJhnLocalCopAuthority({stateDirectory,clock});
  const db=new DatabaseSync(dbPath);
  try {
   const stamp=current.toISOString();
   db.prepare("INSERT INTO cop_mandates (mandate_ref,version,status,issuer_ref,grantee_ref,permissions,issued_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("mandate:test:budget",1,"active","instance:jhn","principal:test-budget",
      '["cop.accounting.budget.grant"]',stamp,stamp,stamp);
  } finally {db.close();}
  issuer=await createJhnLocalCapabilityIssuer({stateDirectory,clock});
  const authorized=await issuer.issue({subject:"principal:test-budget",mandateRef:"mandate:test:budget",lifetimeSeconds:30});
  const transportOnly=await issuer.issue({subject:"principal:jhn:runtime"});
  runtime=await createJhnLocalCopRuntime({stateDirectory,clock,grantBudget:async args=>{
    calls.push(args);return {duplicate:false};
  }});
  const {port}=await runtime.listen();
  const base="http://127.0.0.1:"+port;
  assert.equal((await post(base)).status,401);
  assert.equal((await post(base,transportOnly)).status,400);
  const ok=await post(base,authorized);
  assert.equal(ok.status,201);
  assert.equal(calls.length,1);
  assert.equal(calls[0].actor,"principal:test-budget");
  assert.equal(calls[0].mandate_ref,"mandate:test:budget");
  assert.equal(calls[0].authority_ref,"mandate:mandate:test:budget:v1");

  current=new Date(current.getTime()+31_000);
  assert.equal((await post(base,authorized)).status,400);
  assert.equal(calls.length,1);

  current=new Date("2026-10-16T10:00:00.000Z");
  const db2=new DatabaseSync(dbPath);
  try {db2.prepare("UPDATE cop_mandates SET status='revoked' WHERE mandate_ref=?").run("mandate:test:budget");}
  finally {db2.close();}
  assert.equal((await post(base,authorized)).status,400);
  assert.equal(calls.length,1);
 } finally {
  if(issuer) issuer.close();
  if(runtime) await runtime.close();
  await rm(stateDirectory,{recursive:true,force:true});
 }
});
