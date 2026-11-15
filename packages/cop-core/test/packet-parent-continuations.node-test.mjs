import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {COPScheduler} from '../../cop-kernel/src/scheduler.js';
import {COPBus} from '../../cop-kernel/src/bus.js';
import {PACKET_PARENT_PROFILE,linkPacketChild,reportChildStateToParent,
  reconcileParentChildStates,registerParentJoin,projectParentJoin,resumeParentJoin,
  listLinkedPacketParents,reconcilePacketParentContinuations}
  from '../src/packet-parent-continuations.js';
const P='continuation:ctn_parent_001';
const A='continuation:ctn_child_a_001';
const B='continuation:ctn_child_b_001';
const other='continuation:ctn_unknown_001';
function event(store,ref,id,phase,status=null){
 const partial={topic_id:ref,event_type:'cop.event/v1',actor_id:'agent:test',
  subject_ref:ref,visibility:'restricted',epistemic_status:'decided',
  idempotency_key:id,payload:phase==='returned'
    ?{profile:'cop.continuation-result/v1',phase:'returned',continuation_id:ref.slice(13)}
    :{profile:'cop.continuation-dispatch/v1',phase:'handler_completed',
      continuation_id:ref.slice(13),parent_packet_status:status}};
 const r=store.append(partial);assert.equal(r.ok,true,JSON.stringify(r));return r.event;
}
function setup(store,{join='all'}={}){
 assert.equal(linkPacketChild(store,{parent_ref:P,child_ref:A}).ok,true);
 assert.equal(linkPacketChild(store,{parent_ref:P,child_ref:B}).ok,true);
 assert.equal(registerParentJoin(store,{parent_ref:P,join_id:'join-01',mode:join}).ok,true);
}

test('an unrelated or forged child cannot notify a parent without an existing causal child link',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);event(s,other,'unknown-done','completed','completed');
  assert.equal(reportChildStateToParent(s,{parent_ref:P,child_ref:other,
    source_receipt_ref:'unknown-done'}).status,'child_not_linked');
  assert.equal(reportChildStateToParent(s,{parent_ref:P,child_ref:A,
    source_receipt_ref:'unknown-done'}).status,'unrecognized_child_transition');
  assert.equal(s.listTopic(P).filter(e=>e.payload?.phase==='child_state_changed').length,0);
 }finally{s.close()}
});

test('parent learns returned, then completed; no premature join; identical events do not multiply',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  event(s,A,'child-a-returned','returned');
  const first=reportChildStateToParent(s,{parent_ref:P,child_ref:A,
    source_receipt_ref:'child-a-returned'});
  assert.equal(first.status,'parent_notified');assert.equal(first.child_state,'returned');
  assert.equal(reportChildStateToParent(s,{parent_ref:P,child_ref:A,
    source_receipt_ref:'child-a-returned'}).duplicate,true);
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'join-01'}).ready,false);
  event(s,A,'child-a-completed','completed','completed');
  assert.equal(reconcileParentChildStates(s,{parent_ref:P}).notifications,1);
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'join-01'}).completed,1);
  event(s,B,'child-b-completed','completed','completed');
  assert.equal(reconcileParentChildStates(s,{parent_ref:P}).notifications,1);
  const ready=projectParentJoin(s,{parent_ref:P,join_id:'join-01'});
  assert.equal(ready.ready,true);assert.equal(ready.status,'completed');
  assert.deepEqual(ready.children.map(c=>c.state),['completed','completed']);
  assert.equal(reconcileParentChildStates(s,{parent_ref:P}).notifications,0);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('all fails fast, allSettled waits for both terminal children',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s,{join:'allSettled'});
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'fail-fast',mode:'all'}).ok,true);
  event(s,A,'child-a-failed','completed','blocked');
  reconcileParentChildStates(s,{parent_ref:P});
  const early=projectParentJoin(s,{parent_ref:P,join_id:'fail-fast'});
  assert.equal(early.ready,true);assert.equal(early.status,'failed');
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'join-01'}).ready,false);
  event(s,B,'child-b-complete','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});
  const settled=projectParentJoin(s,{parent_ref:P,join_id:'join-01'});
  assert.equal(settled.ready,true);assert.equal(settled.status,'completed');
  assert.equal(settled.failed,1);
  assert.deepEqual(settled.children.map(c=>c.state),['blocked','completed']);
 }finally{s.close()}
});

test('canonical historical CPS child_dispatched link is reusable with no separate migration',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  const result=s.append({topic_id:P,event_type:'cop.event/v1',
    actor_id:'cop:test',subject_ref:P,visibility:'restricted',
    epistemic_status:'observed',idempotency_key:'parent-child-original',
    payload:{profile:'cop.continuation-next-step/v1',phase:'child_dispatched',
      continuation_id:P.slice(13),child_continuation_id:A.slice(13)}});
  assert.equal(result.ok,true);
  event(s,A,'historical-completion','completed','completed');
  const replay=reconcileParentChildStates(s,{parent_ref:P});
  assert.equal(replay.ok,true);assert.equal(replay.notifications,1);
  const notification=s.listTopic(P).find(e=>e.payload?.phase==='child_state_changed');
  assert.equal(notification.payload.child_ref,A);
  assert.ok(notification.parent_event_ids.includes('parent-child-original'));
 }finally{s.close()}
});

test('parent exact-once wake uses COPScheduler callback; restart cannot repeat effects',async()=>{
 const d=mkdtempSync(join(tmpdir(),'cop-parent-'));const path=join(d,'cop.sqlite');
 try{
  let s=createSqliteCopEventStore(path);setup(s);
  event(s,A,'child-a-complete','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});
  let calls=0;
  assert.equal((await resumeParentJoin(s,{parent_ref:P,join_id:'join-01',
    execute:async()=>{calls++;return {ok:true,receipt_ref:'handler:parent-result'}}})).status,'waiting');
  assert.equal(calls,0);s.close();
  s=createSqliteCopEventStore(path);
  event(s,B,'child-b-complete','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'join-01'}).ready,true);
  const resumed=await resumeParentJoin(s,{parent_ref:P,join_id:'join-01',
    execute:async(view)=>{calls++;assert.equal(view.completed,2);
      return {ok:true,receipt_ref:'handler:parent-result'};}});
  assert.equal(resumed.status,'parent_resumed');assert.equal(calls,1);
  s.close();s=createSqliteCopEventStore(path);
  const retry=await resumeParentJoin(s,{parent_ref:P,join_id:'join-01',
    execute:async()=>{calls++;throw Error('not executed')}});
  assert.equal(retry.status,'already_resumed');assert.equal(calls,1);
  assert.equal(s.auditCommitments().ok,true);
  s.close();
 }finally{rmSync(d,{recursive:true,force:true})}
});

test('unknown result of handler cannot cause another execution after reboot',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);event(s,A,'a-done','completed','completed');event(s,B,'b-done','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});let calls=0;
  const first=await resumeParentJoin(s,{parent_ref:P,join_id:'join-01',
    execute:async()=>{calls++;throw Error('transport ambiguous')}});
  assert.equal(first.status,'needs_reconciliation');
  assert.equal((await resumeParentJoin(s,{parent_ref:P,join_id:'join-01',
    execute:async()=>{calls++;return {ok:true,receipt_ref:'bad-duplicate'}}})).status,'needs_reconciliation');
  assert.equal(calls,1);
 }finally{s.close()}
});

test('two independent OS worker processes publish child transitions while parent is down',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cop-distributed-'));
 const file=join(dir,'cop.sqlite');const s=createSqliteCopEventStore(file);
 try{
  setup(s);s.close();
  // Real independent Node processes operate the same durable SQLite store;
  // no shared in-memory Promise/Bus. One child may return during parent outage.
  for(const [child,keyid] of [[A,'a-process-done'],[B,'b-process-done']]){
    const script=`import {createSqliteCopEventStore} from ${JSON.stringify(new URL('../src/sqlite-cop-event-store.js',import.meta.url).href)}; const s=createSqliteCopEventStore(process.argv[1]);try{const r=s.append({topic_id:process.argv[2],event_type:'cop.event/v1',actor_id:'agent:child-worker',subject_ref:process.argv[2],visibility:'restricted',epistemic_status:'decided',idempotency_key:process.argv[3],payload:{profile:'cop.continuation-dispatch/v1',phase:'handler_completed',parent_packet_status:'completed'}});if(!r.ok)process.exitCode=2;}finally{s.close()}`;
    const run=spawnSync(process.execPath,['--input-type=module','-e',script,file,child,keyid],{encoding:'utf8',timeout:12000});
    assert.equal(run.status,0,run.stderr);
  }
  const reopened=createSqliteCopEventStore(file);
  try{
    assert.equal(reconcileParentChildStates(reopened,{parent_ref:P}).notifications,2);
    const aggregate=projectParentJoin(reopened,{parent_ref:P,join_id:'join-01'});
    assert.equal(aggregate.ready,true);
    assert.equal(aggregate.completed,2);
    let times=0;
    assert.equal((await resumeParentJoin(reopened,{parent_ref:P,join_id:'join-01',
      execute:async()=>{times++;return {ok:true,receipt_ref:'parent:resumption'}}})).status,'parent_resumed');
    assert.equal(times,1);
  }finally{reopened.close()}
 }finally{rmSync(dir,{recursive:true,force:true})}
});


test('actual existing COPScheduler resumes parent continuation after two durable child results',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'cop-scheduler-parent-'));
  const path=join(dir,'cop.sqlite');
  try{
    const s=createSqliteCopEventStore(path);setup(s);
    event(s,A,'a-canonical-done','completed','completed');
    event(s,B,'b-canonical-done','completed','completed');
    s.close();
    // Fresh scheduler and store simulates parent process restarted after both
    // children completed. No in-process Promise from either worker survives.
    const reopened=createSqliteCopEventStore(path);
    try{
      assert.equal(reconcileParentChildStates(reopened,{parent_ref:P}).notifications,2);
      let resumed=0;
      const bus=new COPBus({name:'parent-composition-real-COPScheduler'});
      const scheduler=new COPScheduler(bus,{
        handlerResolver:async resumeTo=>resumeTo==='handler:parent-aggregation'?{
          execute:async({continuation,payload})=>{
            resumed++;
            assert.equal(continuation.continuationId,P.slice(13));
            assert.equal(payload.join.completed,2);
            return {accepted:true,combined_results:payload.join.children.map(c=>c.result_ref)};
          },
        }:null,
      });
      const call=()=>resumeParentJoin(reopened,{parent_ref:P,join_id:'join-01',
        execute:async join=>{
          const run=await scheduler.execute({continuationId:P.slice(13),
            resumeTo:'handler:parent-aggregation',state:{join_ref:'join-01'}},
            {reason:'child_results_settled',payload:{join}});
          assert.equal(run.execution.result.accepted,true);
          return {ok:true,receipt_ref:'cop-scheduler:resumed:'+P};
        }});
      const first=await call();assert.equal(first.status,'parent_resumed');
      assert.equal(resumed,1);
      assert.equal((await call()).status,'already_resumed');
      assert.equal(resumed,1);
      assert.equal(reopened.auditCommitments().ok,true);
    }finally{reopened.close()}
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('reconciler does not starve new child transitions behind many already-notified rows',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  for(let i=0;i<8;i++)event(s,A,'historical-a-'+i,'returned');
  assert.equal(reconcileParentChildStates(s,{parent_ref:P,max_events:3}).notifications,3);
  assert.equal(reconcileParentChildStates(s,{parent_ref:P,max_events:3}).notifications,3);
  assert.equal(reconcileParentChildStates(s,{parent_ref:P,max_events:3}).notifications,2);
  event(s,B,'recent-b-completed','completed','completed');
  assert.equal(reconcileParentChildStates(s,{parent_ref:P,max_events:3}).notifications,1);
 }finally{s.close()}
});


test('one reconciliation pass finds existing parent/child links and resumes only ready joins',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);event(s,A,'a-for-tick','completed','completed');
  let calls=0;
  const invoke=async()=>{calls++;return {ok:true,receipt_ref:'scheduler:parent-wake'}};
  const first=await reconcilePacketParentContinuations(s,{execute:invoke});
  assert.equal(first.notified,1);assert.equal(first.resumed,0);
  assert.equal(first.waiting,1);assert.equal(calls,0);
  event(s,B,'b-for-tick','completed','completed');
  const second=await reconcilePacketParentContinuations(s,{execute:invoke});
  assert.equal(second.notified,1);assert.equal(second.resumed,1);
  assert.equal(calls,1);
  const third=await reconcilePacketParentContinuations(s,{execute:invoke});
  assert.equal(third.notified,0);assert.equal(third.resumed,0);
  assert.equal(calls,1);
  assert.deepEqual(listLinkedPacketParents(s),[P]);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});
