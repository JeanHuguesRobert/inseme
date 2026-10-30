import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createFractalogActRecord} from '../../../../packages/cop-core/src/fractalog.js';
import {createBudgetCheckpointReceiver} from '../cop/fractalogCheckpointReceiver.js';

const make=(seq,source_hash=`sha256:source-${seq}`)=>createFractalogActRecord({
 record_id:`budget:b1:checkpoint:${seq}`,act_id:`budget:b1:checkpoint:${seq}`,
 act_kind:'accounting.budget.checkpoint',act_phase:'observed',owner_instance_ref:'handler:a',
 time:{recorded_at:'2026-10-30T08:00:00.000Z'},governed_chain:{mandate_ref:'mandate:a@v1'},
 trace:{source_ref:'cop://a',source_hash,budget_id:'b1',topic_seq:seq},
 effect:{kind:'provisional_budget_projection',settled:{max_steps:1}}
});
test('receiver idempotence, gap, divergence and integrity',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const receiver=createBudgetCheckpointReceiver(db);
  assert.equal(receiver.receive(make(1)).accepted,true);
  assert.equal(receiver.receive(make(1)).duplicate,true);
  assert.deepEqual(receiver.receive(make(4)).unverified_range,{from:2,to:3});
  assert.equal(receiver.receive(make(4,'sha256:altered')).error,'checkpoint_divergence');
  assert.equal(receiver.receive(make(2)).accepted,true);
  assert.equal(receiver.latest('cop://a','b1'),4);
  const corrupt=make(5);corrupt.effect.settled.max_steps=999;
  assert.equal(receiver.receive(corrupt).error,'invalid_checkpoint_integrity');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM budget_checkpoint_receipts').get().c,3);
 }finally{db.close();}
});
