import test from "node:test";
import assert from "node:assert/strict";
import {createSupabaseEpochBudgetGrant} from "../cop/supabaseEpochBudgetGrant.js";
test("budget grant uses the transactional RPC",async()=>{
 let name,values;
 const grant=createSupabaseEpochBudgetGrant({supabase:{rpc:async(n,v)=>{name=n;values=v;return {data:{ok:true},error:null};}}});
 const result=await grant({epoch_id:"z0",budget_ref:"B",mandate_ref:"M",mandate_version:2,unit:"TEST_UNIT",amount:"2",actor:"P",authority_ref:"A"});
 assert.equal(name,"cop_grant_epoch_budget_v2");
 assert.equal(values.p_mandate_ref,"M");
 assert.equal(values.p_mandate_version,2);
 assert.equal(values.p_actor,"P");
 assert.deepEqual(result,{ok:true});
});
test("database error propagates",async()=>{
 const grant=createSupabaseEpochBudgetGrant({supabase:{rpc:async()=>({error:{code:"42501"}})}});
 await assert.rejects(()=>grant({}),/COP_ACCOUNTING_GRANT_FAILED/);
});
