import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseInternalBudgetLifecycle } from "../cop/supabaseEpochBudgetGrant.js";

function mockStore() {
 const calls = [];
 const supabase = {
  from(table) {
   assert.equal(table, "cop_accounting_epoch_budget");
   const query = { select() {return this;}, eq(k,v) {calls.push(["filter",k,v]); return this;},
    async single() {return {data:{mandate_ref:"epoch:founding-provenance"},error:null};} };
   return query;
  },
  async rpc(name, params) {calls.push(["rpc",name,params]); return {data:{duplicate:false},error:null};}
 };
 return {calls,supabase};
}

test("internal reservation uses existing budget provenance and recorded atomic RPC", async () => {
 const {calls,supabase}=mockStore();
 const lifecycle=createSupabaseInternalBudgetLifecycle({supabase});
 const result=await lifecycle.reserve({epoch_id:"z0",budget_ref:"budget:x",unit:"TEST_UNIT",
  reservation_key:"r:1",amount:"1.25",actor:"instance:trusted"});
 assert.equal(result.duplicate,false);
 assert.deepEqual(calls.at(-1),["rpc","cop_reserve_epoch_budget_recorded",{
  p_epoch_id:"z0",p_budget_ref:"budget:x",p_mandate_ref:"epoch:founding-provenance",
  p_unit:"TEST_UNIT",p_key:"r:1",p_amount:"1.25",p_actor:"instance:trusted"
 }]);
});

test("internal settlement uses durable recorded RPC, not a raw table write", async () => {
 const {calls,supabase}=mockStore();
 const lifecycle=createSupabaseInternalBudgetLifecycle({supabase});
 await lifecycle.settle({epoch_id:"z0",reservation_key:"r:1",spent:"0.5",actor:"instance:trusted"});
 assert.deepEqual(calls.at(-1),["rpc","cop_settle_epoch_budget_recorded",{
  p_epoch_id:"z0",p_reservation_key:"r:1",p_spent:"0.5",p_actor:"instance:trusted"
 }]);
});

test("rejects malformed amounts and missing audit identity before touching Supabase", async()=>{
 const {calls,supabase}=mockStore();
 const lifecycle=createSupabaseInternalBudgetLifecycle({supabase});
 await assert.rejects(()=>lifecycle.reserve({epoch_id:"z0",budget_ref:"b",unit:"U",reservation_key:"r",amount:"-2",actor:"i"}),/valid reservation/);
 await assert.rejects(()=>lifecycle.settle({epoch_id:"z0",reservation_key:"r",spent:"-1",actor:"i"}),/valid settlement/);
 await assert.rejects(()=>lifecycle.settle({epoch_id:"z0",reservation_key:"r",spent:"0"}),/audit identity/);
 assert.equal(calls.length,0);
});

test("database failures never appear as successful settlements",async()=>{
 const {supabase}=mockStore();
 supabase.rpc=async()=>({data:null,error:{code:"P0001",message:"budget_exhausted"}});
 const lifecycle=createSupabaseInternalBudgetLifecycle({supabase});
 await assert.rejects(()=>lifecycle.settle({epoch_id:"z0",reservation_key:"r",spent:"0",actor:"i"}),/COP_ACCOUNTING_LIFECYCLE_FAILED: P0001/);
});
