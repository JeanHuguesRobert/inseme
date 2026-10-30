import {it,expect} from 'vitest';
import {createMemoryCopEventStore as memory} from '../src/cop-event-spool.js';
import {createEventSourcedExecutionBudgetLedger as ledger,recordExecutionBudgetGrant as grant} from '../src/execution-budget.js';
import {recordMandateDeclaration as declare} from '../src/governed-act.js';
import {reserveEventSourcedDelegatedBudget as delegate} from '../src/delegated-budget.js';
import {executeDelegatedPacket as execute} from '../src/distributed-packet-handler.js';

it('fractal budgets: 3 packets, nested delegation, failed handler, no duplicated acts',async()=>{
 const [root,a,b,a1,a2,b1]=Array.from({length:6},()=>memory());
 grant(root,{budget_id:'root',mandate_ref:'mandate:root@v1',principal_ref:'person:p',limits:{max_steps:100}});
 const R=ledger({store:root,budget_id:'root',limits:{max_steps:100},require_authority_grant:true});
 const allocate=(parent,account,local,id,n)=>delegate({store:parent,child_store:local,parent_ledger:account,child_budget_id:id,child_mandate_ref:`mandate:${id}@v1`,child_source_ref:`cop://local/${id}`,principal_ref:'person:p',allocation:{max_steps:n},idempotency_key:id});
 const A=allocate(root,R,a,'a',60),B=allocate(root,R,b,'b',40);
 expect(A.ok&&B.ok).toBe(true);
 const run=(parent,account,local,id,n,use,fail=false)=>{
  declare(local,{mandate_id:`mandate:${id}@v1`,principal_ref:'person:p',logical_agent_ref:`agent:${id}`,scope:{allowed_actions:['tool:read'],budget_ceiling:{max_steps:n}}});
  return execute({packet:{packet_id:`packet:${id}`,mandate_id:`mandate:${id}@v1`},handler:{id:`handler:${id}`,async invoke(){if(fail){const error=new Error('simulated failure');error.execution_usage={max_steps:use};throw error;}return {execution_usage:{max_steps:use}};}},capability:'tool:read',demand:{max_steps:n},parent_store:parent,parent_ledger:account,child_store:local,child_budget_id:id,child_mandate_ref:`mandate:${id}@v1`,child_source_ref:`cop://local/${id}`,principal_ref:'person:p',logical_agent_ref:`agent:${id}`,allocation:{max_steps:n},idempotency_key:id});
 };
 const [x,y]=await Promise.all([run(a,A.child_ledger,a1,'a1',30,12),run(a,A.child_ledger,a2,'a2',20,7,true)]);
 expect(x.ok).toBe(true);expect(y.ok).toBe(false);expect(y.execution.called_provider).toBe(true);
 const z=await run(b,B.child_ledger,b1,'b1',35,9);expect(z.ok).toBe(true);
 expect(A.child_ledger.snapshot().settled.max_steps).toBe(19);
 expect(B.child_ledger.snapshot().settled.max_steps).toBe(9);
 expect(A.close().ok).toBe(true);expect(B.close().ok).toBe(true);
 expect(R.snapshot().settled.max_steps).toBe(28);expect(R.snapshot().available.max_steps).toBe(72);
 expect(R.snapshot().reserved.max_steps).toBe(0);
 expect(root.replay().filter(e=>['Act','Trace','Imputation'].includes(e.payload?.kind))).toHaveLength(0);
 for(const [local,id] of [[a1,'a1'],[a2,'a2'],[b1,'b1']]){
  const imputation=local.replay().find(e=>e.payload?.kind==='Imputation');
  expect(imputation.payload.packet_id).toBe(`packet:${id}`);
  expect(imputation.payload.handler_instance_ref).toBe(`handler:${id}`);
 }
 expect(a.replay().some(e=>e.payload?.kind==='Act')).toBe(false);
 expect(root.replay().filter(e=>e.event_type==='ExecutionBudgetSettlement')).toHaveLength(2);
 expect(A.close().duplicate).toBe(true);expect(R.snapshot().settled.max_steps).toBe(28);
});
