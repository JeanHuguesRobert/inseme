import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createFractalogActRecord} from '../../../../packages/cop-core/src/fractalog.js';
import {createFractalogSqliteStore} from '../cop/fractalogSqliteStore.js';
import {createBudgetCheckpointReceiver} from '../cop/fractalogCheckpointReceiver.js';
import {createCheckpointBatchHandler} from '../cop/fractalogCheckpointHttpBatchServer.js';
import {createFractalogHttpBatchIngress} from '../cop/fractalogHttpIngress.js';
const make=i=>createFractalogActRecord({record_id:`budget:batch:checkpoint:${i}`,act_id:`budget:batch:checkpoint:${i}`,
 act_kind:'accounting.budget.checkpoint',owner_instance_ref:'handler:test',governed_chain:{mandate_ref:'mandate:test'},
 trace:{source_ref:'cop://test',source_hash:`sha256:source${i}`,topic_seq:i,budget_id:'batch'},
 effect:{kind:'provisional_budget_projection',settled:{max_steps:i}}});
test('actual HTTP batch transport, selective ACK and replay after lost response',async()=>{
 const srcDb=new DatabaseSync(':memory:'),dstDb=new DatabaseSync(':memory:');
 const outbox=createFractalogSqliteStore(srcDb),receiver=createBudgetCheckpointReceiver(dstDb);
 const handler=createCheckpointBatchHandler({receiver,capability:'test-secret'});
 const server=createServer(handler);
 try{
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/fractalog/checkpoints/batch`;
  const send=createFractalogHttpBatchIngress({url,capability:'test-secret'});
  for(let i=1;i<=5;i++)outbox.append(make(i));
  const lost=async docs=>{await send(docs);throw Error('lost ACK');};
  assert.equal((await outbox.synchronizeBatch(lost,{limit:2,batchSize:2})).pending,2);
  const result=await outbox.synchronizeBatch(send,{batchSize:3});
  assert.equal(result.accepted,5);
  assert.equal(receiver.latest('cop://test','batch'),5);
  assert.equal(dstDb.prepare('SELECT COUNT(*) AS n FROM budget_checkpoint_receipts').get().n,5);
  assert.equal((await outbox.synchronizeBatch(send)).attempted,0);
  await assert.rejects(createFractalogHttpBatchIngress({url,capability:'wrong'})([make(1)]),/401/);
 }finally{server.close();srcDb.close();dstDb.close();}
});
