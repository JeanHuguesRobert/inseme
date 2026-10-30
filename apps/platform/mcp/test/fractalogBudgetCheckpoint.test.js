import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteCopEventStore} from '../../../../packages/cop-core/src/sqlite-cop-event-store.js';
import {createEventSourcedExecutionBudgetLedger,recordExecutionBudgetGrant} from '../../../../packages/cop-core/src/execution-budget.js';
import {createFractalogSqliteStore} from '../cop/fractalogSqliteStore.js';
import {enqueueBudgetCheckpoint} from '../cop/fractalogBudgetCheckpoint.js';

test('checkpoint offline, retry, idempotence, source evidence',async()=>{
 const source=createSqliteCopEventStore(':memory:');
 const db=new DatabaseSync(':memory:');
 try {
  const outbox=createFractalogSqliteStore(db);
  recordExecutionBudgetGrant(source,{budget_id:'b1',mandate_ref:'mandate:one@v1',principal_ref:'person:p',limits:{max_steps:10}});
  const ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:'b1',limits:{max_steps:10},require_authority_grant:true});
  const reservation=ledger.reserve({idempotency_key:'work',expected_version:ledger.snapshot().version,demand:{max_steps:6}});
  assert.equal(reservation.ok,true);
  assert.equal(ledger.settle({reservation_id:reservation.reservation.reservation_id,expected_version:ledger.snapshot().version,usage:{max_steps:4}}).ok,true);
  const args={ledger,sourceStore:source,outbox,mandate_ref:'mandate:one@v1',owner_instance_ref:'instance:handler-1',source_ref:'cop://handler-1/b1'};
  assert.equal(enqueueBudgetCheckpoint(args).ok,true);
  assert.equal(enqueueBudgetCheckpoint(args).duplicate,true);
  const doc=outbox.pending()[0].record;
  assert.equal(doc.effect.settled.max_steps,4);
  assert.equal(doc.effect.available.max_steps,6);
  assert.equal(doc.trace.topic_seq,ledger.snapshot().version);
  assert.equal((await outbox.synchronize(async()=>{throw Error('offline');})).accepted,0);
  const received=new Map();
  const ingress=async item=>{
   assert.equal(item.trace.source_hash,doc.trace.source_hash);
   const previous=received.get(item.record_id);
   if(previous) assert.equal(previous,item.integrity.document_hash);
   else received.set(item.record_id,item.integrity.document_hash);
   return {accepted:true,record_id:item.record_id,document_hash:item.integrity.document_hash};
  };
  assert.equal((await outbox.synchronize(ingress)).accepted,1);
  assert.equal((await outbox.synchronize(ingress)).attempted,0);
  assert.equal(received.size,1);
  assert.equal(source.listTopic('execution-budget:b1').length,3);
  assert.equal(enqueueBudgetCheckpoint({...args,mandate_ref:'mandate:other'}).error,'checkpoint_mandate_mismatch');
 }finally{source.close();db.close();}
});

test('checkpoint outbox to projection receiver: offline replay without settlement',async()=>{
 const {createBudgetCheckpointReceiver}=await import('../cop/fractalogCheckpointReceiver.js');
 const source=createSqliteCopEventStore(':memory:');
 const outDb=new DatabaseSync(':memory:'),recvDb=new DatabaseSync(':memory:');
 try {
  const outbox=createFractalogSqliteStore(outDb),receiver=createBudgetCheckpointReceiver(recvDb);
  recordExecutionBudgetGrant(source,{budget_id:'remote',mandate_ref:'mandate:remote@v1',principal_ref:'person:p',limits:{max_steps:12}});
  const ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:'remote',limits:{max_steps:12},require_authority_grant:true});
  const args={ledger,sourceStore:source,outbox,mandate_ref:'mandate:remote@v1',owner_instance_ref:'instance:handler',source_ref:'cop://handler/remote'};
  assert.equal(enqueueBudgetCheckpoint(args).ok,true);
  assert.equal((await outbox.synchronize(async()=>{throw Error('offline')})).accepted,0);
  assert.equal((await outbox.synchronize(doc=>receiver.receive(doc))).accepted,1);
  const first=outbox.get('budget:remote:checkpoint:1');
  assert.equal(receiver.receive(first).duplicate,true);
  assert.equal(receiver.latest('cop://handler/remote','remote'),1);
  assert.equal(ledger.snapshot().settled.max_steps,0);
  assert.equal(recvDb.prepare('SELECT COUNT(*) AS count FROM budget_checkpoint_receipts').get().count,1);
 } finally {source.close();outDb.close();recvDb.close();}
});

test('SQLite commitment exposes constant-sized head without listTopic checkpoint scan',()=>{
 const store=createSqliteCopEventStore(':memory:');
 const db=new DatabaseSync(':memory:');
 try{
  recordExecutionBudgetGrant(store,{budget_id:'fast',mandate_ref:'mandate:fast',principal_ref:'person:p',limits:{max_steps:9}});
  const ledger=createEventSourcedExecutionBudgetLedger({store,budget_id:'fast',limits:{max_steps:9},require_authority_grant:true});
  const head=store.topicCommitment('execution-budget:fast');
  assert.equal(head.seq,1);
  const noScan={topicCommitment:id=>store.topicCommitment(id),listTopic:()=>{throw Error('full scan forbidden')}};
  const outbox=createFractalogSqliteStore(db);
  assert.equal(enqueueBudgetCheckpoint({ledger,sourceStore:noScan,outbox,mandate_ref:'mandate:fast',owner_instance_ref:'handler:fast',source_ref:'cop://fast'}).ok,true);
  assert.equal(outbox.pending()[0].record.trace.commitment_scheme,'sha256:chain-v1');
 }finally{store.close();db.close();}
});
