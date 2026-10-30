import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
const event=(topic,seq,key)=>({event_type:'Act',topic:{id:topic,seq},idempotency_key:key,epistemic_status:'observed',visibility:'restricted',payload:{kind:'Act'}});
test('atomic batch maintains ordered events, idempotency and hash chain',()=>{
 const s=createSqliteCopEventStore(':memory:');
 try {
  const docs=[event('test:one',1,'a'),event('test:one',2,'b'),event('test:two',1,'c')];
  const first=s.appendBatch(docs);
  assert.equal(first.ok,true);
  assert.deepEqual(first.results.map(x=>x.duplicate),[false,false,false]);
  const head=s.topicCommitment('test:one');
  assert.equal(head.seq,2);
  const again=s.appendBatch(docs);
  assert.equal(again.ok,true);
  assert.deepEqual(again.results.map(x=>x.duplicate),[true,true,true]);
  assert.deepEqual(s.topicCommitment('test:one'),head);
  assert.equal(s.listTopic('test:one').length,2);
  assert.equal(s.listTopic('test:two').length,1);
 }finally{s.close();}
});
test('a middle conflict rolls back ALL events and commitments',()=>{
 const s=createSqliteCopEventStore(':memory:');
 try {
  const rejected=s.appendBatch([event('test:rollback',1,'r1'),event('test:rollback',9,'r2')]);
  assert.equal(rejected.ok,false);assert.equal(rejected.index,1);
  assert.equal(rejected.error,'topic_seq_conflict');
  assert.equal(s.listTopic('test:rollback').length,0);
  assert.equal(s.topicCommitment('test:rollback'),null);
  assert.equal(s.eventByIdempotency('r1'),null);
  assert.equal(s.appendBatch([event('test:rollback',1,'r1'),event('test:rollback',2,'r2')]).ok,true);
 }finally{s.close();}
});
test('batch limit validation happens before writes',()=>{
 const s=createSqliteCopEventStore(':memory:');
 try {
  assert.throws(()=>s.appendBatch([]),RangeError);
  assert.throws(()=>s.appendBatch([event('test:limit',1,'l1'),event('test:limit',2,'l2')],{maxBatchSize:1}),RangeError);
  assert.equal(s.listTopic('test:limit').length,0);
 }finally{s.close();}
});

test('batch preserves budget projection and rolls back invalid settlement',async()=>{
 const {recordExecutionBudgetGrant,createEventSourcedExecutionBudgetLedger}=await import('../src/execution-budget.js');
 const s=createSqliteCopEventStore(':memory:');
 try{
  recordExecutionBudgetGrant(s,{budget_id:'batch',mandate_ref:'mandate:batch',principal_ref:'person:test',limits:{max_steps:10}});
  const ledger=createEventSourcedExecutionBudgetLedger({store:s,budget_id:'batch',limits:{max_steps:10},require_authority_grant:true});
  assert.equal(ledger.snapshot().version,1); // seed durable projection
  const reservation={reservation_id:'reservation:batch:r1',budget_id:'batch',idempotency_key:'r1',demand:{max_steps:4},forecasts:[],status:'reserved',settled:{max_steps:0}};
  const base=(event_type,seq,idempotency_key,payload)=>({event_type,topic:{id:'execution-budget:batch',seq},idempotency_key,epistemic_status:'observed',visibility:'restricted',payload:{budget_id:'batch',...payload}});
  const committed=s.appendBatch([
   base('ExecutionBudgetReservation',2,'res:r1',{reservation}),
   base('ExecutionBudgetSettlement',3,'settle:r1',{reservation_id:reservation.reservation_id,usage:{max_steps:2}}),
  ]);
  assert.equal(committed.ok,true);
  assert.equal(ledger.snapshot().settled.max_steps,2);
  assert.equal(ledger.snapshot().reserved.max_steps,0);
  assert.throws(()=>s.appendBatch([
   base('ExecutionBudgetReservation',4,'res:r2',{reservation:{...reservation,reservation_id:'reservation:batch:r2',idempotency_key:'r2'}}),
   base('ExecutionBudgetSettlement',5,'settle:unknown',{reservation_id:'missing',usage:{max_steps:1}}),
  ]),/budget_projection_unknown_reservation/);
  assert.equal(ledger.snapshot().version,3);
  assert.equal(s.eventByIdempotency('res:r2'),null);
  assert.equal(s.topicCommitment('execution-budget:batch').seq,3);
 }finally{s.close();}
});
