import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore as open} from '../src/sqlite-cop-event-store.js';
import {createEventSourcedExecutionBudgetLedger as ledger,recordExecutionBudgetGrant as grant} from '../src/execution-budget.js';
const budget=(s)=>ledger({store:s,budget_id:'test',limits:{max_steps:1000},require_authority_grant:true});
test('durable budget snapshot survives reopen without event replay; second connection sees changes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'budget-projection-')),path=join(dir,'events.sqlite');
 let a,b;
 try {
  a=open(path);grant(a,{budget_id:'test',mandate_ref:'mandate:test',principal_ref:'person:p',limits:{max_steps:1000}});
  const x=budget(a);assert.equal(x.snapshot().version,1);
  for(let i=0;i<60;i++) {
   const r=x.reserve({idempotency_key:`i${i}`,expected_version:x.snapshot().version,demand:{max_steps:2}});
   assert.equal(r.ok,true);
   if(i%2===0)assert.equal(x.settle({reservation_id:r.reservation.reservation_id,expected_version:x.snapshot().version,usage:{max_steps:1}}).ok,true);
  }
  assert.equal(x.snapshot().settled.max_steps,30);
  assert.equal(x.snapshot().reserved.max_steps,60);
  a.close();a=null;
  a=open(path);
  const replayForbidden={...a,listTopic:()=>{throw Error('replay during recovery')}};
  const recovered=budget(replayForbidden);
  assert.equal(recovered.snapshot().settled.max_steps,30);
  assert.equal(recovered.snapshot().reserved.max_steps,60);
  b=open(path);
  const other=budget(b);
  const r=other.reserve({idempotency_key:'other',expected_version:other.snapshot().version,demand:{max_steps:5}});
  assert.equal(r.ok,true);
  assert.equal(recovered.snapshot().reserved.max_steps,65);
  assert.equal(recovered.reserve({idempotency_key:'stale',expected_version:r.snapshot.version-1,demand:{max_steps:1}}).error,'budget_version_conflict');
  assert.equal(recovered.snapshot().available.max_steps,905);
 } finally {a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});

test('projection failure rolls back event and commitment in the same transaction',()=>{
 const s=open(':memory:');
 try{
  grant(s,{budget_id:'test',mandate_ref:'mandate:test',principal_ref:'person:p',limits:{max_steps:10}});
  const l=budget(s);assert.equal(l.snapshot().version,1);
  const before=s.topicCommitment('execution-budget:test');
  assert.throws(()=>s.append({event_type:'ExecutionBudgetSettlement',topic:{id:'execution-budget:test',seq:2},
   epistemic_status:'observed',visibility:'restricted',idempotency_key:'invalid-direct-settle',
   payload:{budget_id:'test',reservation_id:'nonexistent',usage:{max_steps:1}}}),/budget_projection_unknown_reservation/);
  assert.deepEqual(s.topicCommitment('execution-budget:test'),before);
  assert.equal(s.listTopic('execution-budget:test').length,1);
  assert.equal(l.snapshot().version,1);
 }finally{s.close();}
});
