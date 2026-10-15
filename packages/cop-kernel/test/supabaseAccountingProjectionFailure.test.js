import test from "node:test";
import assert from "node:assert/strict";
import {createSupabaseAccountingStore} from "../src/accounting/supabaseAccountingStore.js";

const event={idempotency_key:"test:projection:1",payload:{
 accounting_domain:"provisional_execution_spending",
 postings:[{account:"expense:test",posting_type:"debit",quantity:{unit:"USD",scale:0,coefficient:"1"}}]
}};
function stub({balanceError=false,indexError=false}={}) {
 const calls=[];
 return {calls,from(name){
  const entry={select(){return this},eq(){return this},
    async maybeSingle(){if(name==="cop_accounting_event")return {data:{...event,id:4},error:null};return {data:null,error:null}},
    upsert(){calls.push(name);return this;},
    then(resolve){return Promise.resolve({error:
      name==="cop_accounting_balance"&&balanceError?{message:"balance denied"}:
      name==="cop_accounting_packet_spend"&&indexError?{message:"index denied"}:null}).then(resolve)},
  };
  return entry;
 }};
}
test("balance projection error is not reported as successful durable accounting",async()=>{
 const db=stub({balanceError:true});
 const result=await createSupabaseAccountingStore({supabase:db}).append(event);
 assert.equal(result.ok,false);
 assert.equal(result.persisted_event,true);
 assert.equal(result.recovery_required,true);
 assert.equal(result.error,"accounting_projection_incomplete");
});
test("successful balance projection retains append success",async()=>{
 const db=stub();
 const result=await createSupabaseAccountingStore({supabase:db}).append(event);
 assert.equal(result.ok,true);
 assert.equal(result.duplicate,false);
});
