import test from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCopEventStore} from '../../cop-core/src/sqlite-cop-event-store.js';
import {linkPacketChild} from '../../cop-core/src/packet-parent-continuations.js';
import {changePacketTemperature,projectPacketTemperature}
  from '../../cop-core/src/packet-temperature.js';
import {COPScheduler} from '../src/scheduler.js';
import {COPBus} from '../src/bus.js';
const P='continuation:scheduler-temp-parent',C='continuation:scheduler-temp-child';
const change=(s,ref,t,id)=>changePacketTemperature(s,{packet_ref:ref,temperature:t,transition_id:id});
const gate=s=>(continuation)=>{
  const ref=continuation.topicId||'continuation:'+continuation.continuationId;
  const state=projectPacketTemperature(s,{packet_ref:ref});
  return {admitted:state.runnable,reason:state.deleted?'deleted':
    'temperature:'+state.effective_temperature};
};

test('existing COPScheduler defers cold child but resumes only root after Resume(root)',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linkPacketChild(s,{parent_ref:P,child_ref:C});
  const calls=[],events=[];
  const bus=new COPBus({name:'packet-temperature-admission'});
  bus.subscribeAll(event=>events.push(event));
  const scheduler=new COPScheduler(bus,{admissionResolver:gate(s),
    handlerResolver:async()=>({execute:async({continuation})=>{
      calls.push(continuation.topicId);return {accepted:true};
    }})});
  const make=ref=>({continuationId:ref.slice('continuation:'.length),
    topicId:ref,resumeTo:'handler:fixture'});
  assert.equal(change(s,P,'parked','park-subtree').ok,true);
  assert.equal(projectPacketTemperature(s,{packet_ref:C}).runnable,false);
  assert.equal(scheduler.admissionResolver(make(C)).admitted,false);
  const blocked=await scheduler.execute(make(C));
  assert.equal(blocked.deferred,true);
  assert.equal(blocked.reason,'temperature:parked');
  assert.equal(calls.length,0);
  assert.equal(events.some(e=>e.type==='cop.continuation.resume'),false);
  change(s,P,'active','resume-parent-only');
  assert.equal((await scheduler.execute(make(P))).execution.result.accepted,true);
  assert.deepEqual(calls,[P]);
  assert.equal((await scheduler.execute(make(C))).deferred,true);
  assert.deepEqual(calls,[P]);
  change(s,C,'active','explicit-child-resume');
  assert.equal((await scheduler.execute(make(C))).execution.result.accepted,true);
  assert.deepEqual(calls,[P,C]);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('scheduler preserves deferred continuation in pending set until a new trigger',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linkPacketChild(s,{parent_ref:P,child_ref:C});
  assert.equal(change(s,C,'suspended','pause-child').ok,true);
  assert.equal(projectPacketTemperature(s,{packet_ref:C}).runnable,false);
  let invoked=0;
  const bus=new COPBus({name:'temp-event-resume'});
  const scheduler=new COPScheduler(bus,{admissionResolver:gate(s),
    handlerResolver:async()=>({execute:async()=>{invoked++;return {ok:true}}})});
  const continuation={continuationId:C.slice('continuation:'.length),
    topicId:C,resumeTo:'handler:fixture',conditions:{waitForEvents:['input.ready']}};
  scheduler.start();
  try{
    scheduler.register(continuation);
    await bus.publish({type:'input.ready',source:'temperature-test',data:{}});
    assert.equal(invoked,0);
    assert.equal(scheduler.pending.has(continuation.continuationId),true);
    change(s,C,'active','resume-child');
    await bus.publish({type:'input.ready',source:'temperature-test',data:{}});
    assert.equal(invoked,1);
    assert.equal(scheduler.pending.has(continuation.continuationId),false);
  }finally{scheduler.stop()}
 }finally{s.close()}
});
