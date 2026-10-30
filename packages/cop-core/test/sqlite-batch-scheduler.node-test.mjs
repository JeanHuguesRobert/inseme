import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {createSqliteBatchScheduler} from '../src/sqlite-batch-scheduler.js';
const event=(seq,key)=>({event_type:'Act',topic:{id:'queue:one',seq},idempotency_key:key,epistemic_status:'observed',visibility:'restricted',payload:{kind:'Act'}});
test('size threshold commits batch, and results correspond to individual entries',async()=>{
 const s=createSqliteCopEventStore(':memory:'),q=createSqliteBatchScheduler({store:s,maxBatchSize:3,maxWaitMs:1000});
 try{
  const a=q.enqueue(event(1,'a'),{batchable:true});
  const b=q.enqueue(event(2,'b'),{batchable:true});
  assert.equal(s.listTopic('queue:one').length,0);
  const c=q.enqueue(event(3,'c'),{batchable:true});
  const results=await Promise.all([a,b,c]);
  assert.deepEqual(results.map(x=>x.ok),[true,true,true]);
  assert.equal(q.pendingCount,0);
  assert.equal(s.topicCommitment('queue:one').seq,3);
 }finally{q.close();s.close();}
});
test('timer and explicit flush preserve bounded latency and truthful durability',async()=>{
 const s=createSqliteCopEventStore(':memory:'),q=createSqliteBatchScheduler({store:s,maxBatchSize:20,maxWaitMs:10});
 try {
  await assert.rejects(q.enqueue(event(1,'a')),/explicit_batchable/);
  const a=q.enqueue(event(1,'a'),{batchable:true});
  assert.equal(s.listTopic('queue:one').length,0);
  assert.equal((await a).ok,true);
  const b=q.enqueue(event(2,'b'),{batchable:true});
  assert.equal(q.flush().attempted,1);
  assert.equal((await b).ok,true);
 }finally{q.close();s.close();}
});
test('immediate write drains older queued events and returns committed result',async()=>{
 const s=createSqliteCopEventStore(':memory:'),q=createSqliteBatchScheduler({store:s,maxBatchSize:20,maxWaitMs:1000});
 try{
  const a=q.enqueue(event(1,'a'),{batchable:true});
  assert.equal(q.appendImmediate(event(2,'b')).ok,true);
  assert.equal((await a).ok,true);
  assert.equal(s.listTopic('queue:one').length,2);
 }finally{q.close();s.close();}
});
test('atomic batch conflict resolves every queued promise as not committed',async()=>{
 const s=createSqliteCopEventStore(':memory:'),q=createSqliteBatchScheduler({store:s,maxBatchSize:2,maxWaitMs:1000});
 try{
  const a=q.enqueue(event(1,'a'),{batchable:true});
  const b=q.enqueue(event(4,'b'),{batchable:true});
  assert.deepEqual((await Promise.all([a,b])).map(x=>x.ok),[false,false]);
  assert.equal(s.listTopic('queue:one').length,0);
 }finally{q.close();s.close();}
});

test('budget topic cannot be queued for delayed durability',async()=>{
 const s=createSqliteCopEventStore(':memory:'),q=createSqliteBatchScheduler({store:s});
 try{
  await assert.rejects(q.enqueue({...event(1,'b'),topic:{id:'execution-budget:budget',seq:1}},{batchable:true}),/budget_events_require_immediate_commit/);
  assert.equal(q.pendingCount,0);
 }finally{q.close();s.close();}
});
