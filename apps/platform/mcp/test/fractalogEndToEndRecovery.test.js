import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteCopEventStore} from '../../../../packages/cop-core/src/sqlite-cop-event-store.js';
import {createEventSourcedExecutionBudgetLedger,recordExecutionBudgetGrant} from '../../../../packages/cop-core/src/execution-budget.js';
import {createFractalogSqliteStore} from '../cop/fractalogSqliteStore.js';
import {enqueueBudgetCheckpoint} from '../cop/fractalogBudgetCheckpoint.js';
import {createBudgetCheckpointReceiver} from '../cop/fractalogCheckpointReceiver.js';
import {createCheckpointBatchHandler} from '../cop/fractalogCheckpointHttpBatchServer.js';
import {createFractalogHttpBatchIngress} from '../cop/fractalogHttpIngress.js';
const params={budget_id:'end2end',mandate_ref:'mandate:e2e',principal_ref:'person:p',limits:{max_steps:20}};
const path=(dir,name)=>join(dir,`${name}.sqlite`);
test('durable journal to outbox to HTTP: outages, lost ACKs, independent restarts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fractalog-e2e-'));
 let source=null,outDb=null,recvDb=null,server=null;
 try{
  source=createSqliteCopEventStore(path(dir,'source'));
  outDb=new DatabaseSync(path(dir,'outbox'));recvDb=new DatabaseSync(path(dir,'receiver'));
  let outbox=createFractalogSqliteStore(outDb);
  recordExecutionBudgetGrant(source,params);
  let ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:params.budget_id,limits:params.limits,require_authority_grant:true});
  const reservation=ledger.reserve({idempotency_key:'unit-work',expected_version:ledger.snapshot().version,demand:{max_steps:12}});
  assert.equal(reservation.ok,true);
  assert.equal(ledger.settle({reservation_id:reservation.reservation.reservation_id,expected_version:ledger.snapshot().version,usage:{max_steps:7}}).ok,true);
  const enqueue=()=>enqueueBudgetCheckpoint({ledger,sourceStore:source,outbox,mandate_ref:params.mandate_ref,owner_instance_ref:'handler:e2e',source_ref:'cop://e2e'});
  assert.equal(enqueue().ok,true);
  const id='budget:end2end:checkpoint:3';
  assert.equal((await outbox.synchronizeBatch(async()=>{throw Error('offline')})).pending,1);
  assert.equal(outbox.outbox(id).state,'pending');
  source.close();source=null;outDb.close();outDb=null;
  source=createSqliteCopEventStore(path(dir,'source'));
  outDb=new DatabaseSync(path(dir,'outbox'));outbox=createFractalogSqliteStore(outDb);
  ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:params.budget_id,limits:params.limits,require_authority_grant:true});
  assert.equal(ledger.snapshot().settled.max_steps,7);
  assert.equal(enqueue().duplicate,true);
  let receiver=createBudgetCheckpointReceiver(recvDb);
  server=createServer(createCheckpointBatchHandler({receiver,capability:'pilot-cap'}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/fractalog/checkpoints/batch`;
  const send=createFractalogHttpBatchIngress({url,capability:'pilot-cap'});
  const lost=async docs=>{await send(docs);throw Error('ack_lost');};
  assert.equal((await outbox.synchronizeBatch(lost)).pending,1);
  assert.equal(receiver.latest('cop://e2e','end2end'),3);
  assert.equal(outbox.outbox(id).state,'pending');
  await new Promise(resolve=>server.close(resolve));server=null;
  recvDb.close();recvDb=null;recvDb=new DatabaseSync(path(dir,'receiver'));
  receiver=createBudgetCheckpointReceiver(recvDb);
  server=createServer(createCheckpointBatchHandler({receiver,capability:'pilot-cap'}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const retry=createFractalogHttpBatchIngress({url:`http://127.0.0.1:${server.address().port}/fractalog/checkpoints/batch`,capability:'pilot-cap'});
  assert.equal((await outbox.synchronizeBatch(retry)).accepted,1);
  assert.equal(outbox.outbox(id).receipt.duplicate,true);
  assert.equal(outbox.outbox(id).receipt.projection_only,true);
  assert.equal(recvDb.prepare('SELECT COUNT(*) n FROM budget_checkpoint_receipts').get().n,1);
  assert.equal(source.listTopic('execution-budget:end2end').length,3);
  assert.equal(ledger.snapshot().settled.max_steps,7);
  assert.equal((await outbox.synchronizeBatch(retry)).attempted,0);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  source?.close();outDb?.close();recvDb?.close();rmSync(dir,{recursive:true,force:true});
 }
});

test('checkpoint may be regenerated after crash between local settlement and outbox enqueue',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fractalog-gap-'));
 let source=null,outDb=null;
 try{
  source=createSqliteCopEventStore(path(dir,'source'));
  recordExecutionBudgetGrant(source,params);
  let ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:params.budget_id,limits:params.limits,require_authority_grant:true});
  const r=ledger.reserve({idempotency_key:'crash',expected_version:ledger.snapshot().version,demand:{max_steps:8}});
  assert.equal(r.ok,true);
  assert.equal(ledger.settle({reservation_id:r.reservation.reservation_id,expected_version:ledger.snapshot().version,usage:{max_steps:6}}).ok,true);
  // Source committed. No outbox or checkpoint yet. Restart source.
  source.close();source=null;
  source=createSqliteCopEventStore(path(dir,'source'));
  ledger=createEventSourcedExecutionBudgetLedger({store:source,budget_id:params.budget_id,limits:params.limits,require_authority_grant:true});
  outDb=new DatabaseSync(path(dir,'outbox'));
  const outbox=createFractalogSqliteStore(outDb);
  const args={ledger,sourceStore:source,outbox,mandate_ref:params.mandate_ref,owner_instance_ref:'handler:e2e',source_ref:'cop://e2e'};
  assert.equal(enqueueBudgetCheckpoint(args).ok,true);
  assert.equal(enqueueBudgetCheckpoint(args).duplicate,true);
  assert.equal(outbox.pending().length,1);
  assert.equal(outbox.pending()[0].record.effect.settled.max_steps,6);
  assert.equal(outbox.pending()[0].record.trace.topic_seq,3);
 }finally{source?.close();outDb?.close();rmSync(dir,{recursive:true,force:true});}
});
