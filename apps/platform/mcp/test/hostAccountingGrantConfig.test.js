import test from "node:test";
import assert from "node:assert/strict";
import {resolveAccountingGrantAdapter} from "../cop/hostAccountingGrantConfig.js";

test("Z0 accounting grant is disabled by default",()=>{
 let made=0;
 const callback=resolveAccountingGrantAdapter({env:{},createClient:()=>{made++}});
 assert.equal(callback,undefined);
 assert.equal(made,0);
});
test("opt-in fails closed without trusted credentials",()=>{
 assert.throws(()=>resolveAccountingGrantAdapter({env:{COP_ACCOUNTING_Z0_GRANT_ENABLED:"1"}}),/host-only/);
});
test("trusted host config resolves RPC without leaking supplied credentials",async()=>{
 let passed;
 const adapter=resolveAccountingGrantAdapter({
  env:{COP_ACCOUNTING_Z0_GRANT_ENABLED:"1",
   COP_ACCOUNTING_SUPABASE_URL:"https://ndiysuhzmztatpxbkezn.supabase.co",
   COP_ACCOUNTING_SUPABASE_SERVICE_ROLE_KEY:"synthetic-test-key"},
  createClient:(url,key,opts)=>{
   passed={url,key,opts};
   return {rpc:async()=>({data:{duplicate:false},error:null})};
  }
 });
 assert.equal(passed.key,"synthetic-test-key");
 assert.equal(passed.opts.auth.persistSession,false);
 const receipt=await adapter({epoch_id:"z0",budget_ref:"test",mandate_ref:"mandate:test",
 unit:"TEST_UNIT",amount:"1",actor:"principal:test",authority_ref:"authority:test"});
 assert.deepEqual(receipt,{duplicate:false});
});
test("unexpected URL host rejected before client creation",()=>{
 assert.throws(()=>resolveAccountingGrantAdapter({
 env:{COP_ACCOUNTING_Z0_GRANT_ENABLED:"1",COP_ACCOUNTING_SUPABASE_URL:"https://evil.example",
 COP_ACCOUNTING_SUPABASE_SERVICE_ROLE_KEY:"test"},createClient:()=>{throw Error("not reached");}}),
 /exact hosted project endpoint/);
});
