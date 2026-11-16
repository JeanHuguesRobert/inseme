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
  listLinkedPacketParents,reconcilePacketParentContinuations,
  dispatchNextParentChild,requestChildCancellation,acknowledgeChildCancellation,
  listPendingChildCancellationRequests}
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


test('then / catch / finally use one persistent Promise branch and propagate nonmatching outcomes',()=>{
 for(const mode of ['then','catch','finally']){
  for(const outcome of ['completed','failed']){
   const s=createSqliteCopEventStore(':memory:');try{
    assert.equal(linkPacketChild(s,{parent_ref:P,child_ref:A}).ok,true);
    assert.equal(registerParentJoin(s,{parent_ref:P,join_id:mode,mode}).ok,true);
    event(s,A,mode+':'+outcome,'completed',outcome);
    reconcileParentChildStates(s,{parent_ref:P});
    const j=projectParentJoin(s,{parent_ref:P,join_id:mode});
    assert.equal(j.ready,true);
    assert.equal(j.status,outcome==='completed'?'completed':'failed');
    assert.equal(j.handler_phase,mode==='finally'?'finally':
      mode==='then'&&outcome==='completed'?'then':
      mode==='catch'&&outcome==='failed'?'catch':'propagate');
    assert.equal(j.winner_child_ref,null);
   }finally{s.close()}
  }
 }
});

test('race settles on first COP-observed terminal failure; any waits for first success',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'race1',mode:'race'}).ok,true);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'any1',mode:'any'}).ok,true);
  // Create B first despite alphabetical topic order A before B.
  event(s,B,'b-failed-first','completed','failed');
  reconcileParentChildStates(s,{parent_ref:P});
  let race=projectParentJoin(s,{parent_ref:P,join_id:'race1'});
  assert.equal(race.ready,true);assert.equal(race.status,'failed');
  assert.equal(race.winner_child_ref,B);
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'any1'}).ready,false);
  event(s,A,'a-success-after','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});
  race=projectParentJoin(s,{parent_ref:P,join_id:'race1'});
  assert.equal(race.winner_child_ref,B);
  const any=projectParentJoin(s,{parent_ref:P,join_id:'any1'});
  assert.equal(any.ready,true);assert.equal(any.status,'completed');
  assert.equal(any.winner_child_ref,A);
  assert.equal(s.listTopic(A).some(e=>e.payload?.phase==='cancel_requested'),false);
 }finally{s.close()}
});

test('any rejects after all failures and quorum succeeds early or detects impossibility',()=>{
 for(const kind of ['quorum_success','quorum_impossible','any_failed']){
  const s=createSqliteCopEventStore(':memory:');try{
   const C='continuation:ctn_child_c_001';
   for(const child_ref of [A,B,C])assert.equal(linkPacketChild(s,{parent_ref:P,child_ref}).ok,true);
   const type=kind==='any_failed'?'any':'quorum';
   assert.equal(registerParentJoin(s,{parent_ref:P,join_id:kind,mode:type,
     quorum:type==='quorum'?2:null}).ok,true);
   const states=kind==='quorum_success'?[['a','completed'],['b','completed']]:
     kind==='quorum_impossible'?[['a','failed'],['b','blocked']]:
     [['a','failed'],['b','blocked'],['c','cancelled']];
   for(const [which,state] of states){
    event(s,{a:A,b:B,c:C}[which],kind+which,'completed',state);
   }
   reconcileParentChildStates(s,{parent_ref:P});
   const j=projectParentJoin(s,{parent_ref:P,join_id:kind});
   assert.equal(j.ready,true);
   assert.equal(j.status,kind==='quorum_success'?'completed':'failed');
   assert.equal(j.expected,3);
   assert.equal(j.successes,kind==='quorum_success'?2:0);
  }finally{s.close()}
 }
});

test('fallback and sequence retain declared child order, never choose a later step prematurely',()=>{
 for(const mode of ['fallback','sequence']){
  const s=createSqliteCopEventStore(':memory:');try{
   setup(s);
   assert.equal(registerParentJoin(s,{parent_ref:P,join_id:mode,mode,child_refs:[B,A]}).ok,true);
   assert.equal(projectParentJoin(s,{parent_ref:P,join_id:mode}).next_child_ref,B);
   // A may have returned early, but it is second in the declared program.
   event(s,A,mode+'-a-early','completed','completed');
   reconcileParentChildStates(s,{parent_ref:P});
   assert.equal(projectParentJoin(s,{parent_ref:P,join_id:mode}).ready,false);
   assert.equal(projectParentJoin(s,{parent_ref:P,join_id:mode}).next_child_ref,B);
   event(s,B,mode+'-b-later','completed',mode==='fallback'?'failed':'completed');
   reconcileParentChildStates(s,{parent_ref:P});
   const r=projectParentJoin(s,{parent_ref:P,join_id:mode});
   assert.equal(r.ready,true);assert.equal(r.status,'completed');
   if(mode==='fallback')assert.equal(r.winner_child_ref,A);
   assert.equal(r.next_child_ref,null);
  }finally{s.close()}
 }
});

test('cooperative cancel is requested only when explicit, remains pending until handler acknowledges',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'race-cancel',mode:'race',
    cancel_remaining:true}).ok,true);
  const blocked=requestChildCancellation(s,{parent_ref:P,join_id:'race-cancel',child_ref:B});
  assert.equal(blocked.status,'cancellation_not_admitted_by_join');
  event(s,A,'a-race-winner','completed','completed');
  let observed=await reconcilePacketParentContinuations(s);
  assert.equal(observed.cancellation_requests,1);
  assert.equal(observed.notified,1);
  assert.equal(listPendingChildCancellationRequests(s,{child_ref:B}).length,1);
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'race-cancel'}).winner_child_ref,A);
  assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'race-cancel'}).children[1].state,'pending');
  observed=await reconcilePacketParentContinuations(s);
  assert.equal(observed.cancellation_requests,0);
  const ack=acknowledgeChildCancellation(s,{parent_ref:P,join_id:'race-cancel',
    child_ref:B,handler_receipt_ref:'handler:b:stopped'});
  assert.equal(ack.status,'cancel_acknowledged');
  assert.equal(acknowledgeChildCancellation(s,{parent_ref:P,join_id:'race-cancel',
    child_ref:B,handler_receipt_ref:'handler:b:stopped'}).duplicate,true);
  assert.equal(listPendingChildCancellationRequests(s,{child_ref:B}).length,0);
  observed=await reconcilePacketParentContinuations(s);
  assert.equal(observed.notified,1);
  const parent=projectParentJoin(s,{parent_ref:P,join_id:'race-cancel'});
  assert.equal(parent.winner_child_ref,A);
  assert.equal(parent.children[1].state,'cancelled');
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('late completion remains visible but cannot be renamed a successful cancellation',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'race-late',mode:'race',
    cancel_remaining:true}).ok,true);
  event(s,A,'a-late-winner','completed','completed');
  await reconcilePacketParentContinuations(s);
  event(s,B,'b-late-finished','completed','completed');
  assert.equal(acknowledgeChildCancellation(s,{parent_ref:P,join_id:'race-late',
    child_ref:B,handler_receipt_ref:'handler:b:stop-attempt'}).status,'child_already_terminal');
  await reconcilePacketParentContinuations(s);
  const p=projectParentJoin(s,{parent_ref:P,join_id:'race-late'});
  assert.equal(p.winner_child_ref,A);assert.equal(p.children[1].state,'completed');
  assert.equal(p.ready,true);
  assert.equal(s.listTopic(B).filter(e=>e.payload?.phase==='cancel_requested').length,1);
  assert.equal(listPendingChildCancellationRequests(s,{child_ref:B}).length,0);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('cancellation across a process restart keeps one request and one handler acknowledgment',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cop-distributed-cancel-'));
 const db=join(dir,'journal.sqlite');
 try{
  let s=createSqliteCopEventStore(db);setup(s);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'cancel-restart',mode:'race',
    cancel_remaining:true}).ok,true);
  event(s,A,'winner:crash','completed','completed');
  assert.equal((await reconcilePacketParentContinuations(s)).cancellation_requests,1);
  s.close();
  const code=`import {createSqliteCopEventStore} from ${JSON.stringify(new URL('../src/sqlite-cop-event-store.js',import.meta.url).href)};import {acknowledgeChildCancellation} from ${JSON.stringify(new URL('../src/packet-parent-continuations.js',import.meta.url).href)}; const s=createSqliteCopEventStore(process.argv[1]);try{const r=acknowledgeChildCancellation(s,{parent_ref:process.argv[2],join_id:'cancel-restart',child_ref:process.argv[3],handler_receipt_ref:'remote:stop:confirmed'});if(!r.ok)throw Error(r.status);}finally{s.close()}`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',code,db,P,B],
    {encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
  s=createSqliteCopEventStore(db);
  try{
   assert.equal((await reconcilePacketParentContinuations(s)).notified,1);
   assert.equal((await reconcilePacketParentContinuations(s)).cancellation_requests,0);
   assert.equal(projectParentJoin(s,{parent_ref:P,join_id:'cancel-restart'}).children[1].state,'cancelled');
  }finally{s.close()}
 }finally{rmSync(dir,{recursive:true,force:true})}
});


test('fallback dispatches one next child after failure, then resumes parent exactly once',async()=>{
 const d=mkdtempSync(join(tmpdir(),'cop-fallback-durable-')),file=join(d,'cop.sqlite');
 try{
  let s=createSqliteCopEventStore(file);
  for(const child_ref of [A,B])assert.equal(linkPacketChild(s,{parent_ref:P,child_ref}).ok,true);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'fallback-flow',mode:'fallback',
    child_refs:[B,A]}).ok,true);
  let dispatches=0,resumptions=0;
  const invoke=async({child_ref})=>{dispatches++;return {ok:true,receipt_ref:'handler:send:'+child_ref}};
  let check=await reconcilePacketParentContinuations(s,{dispatchNext:invoke});
  assert.equal(check.next_dispatches,1);assert.equal(dispatches,1);
  check=await reconcilePacketParentContinuations(s,{dispatchNext:invoke});
  assert.equal(check.next_dispatches,0);assert.equal(dispatches,1);
  event(s,B,'fallback-first-fails','completed','failed');
  check=await reconcilePacketParentContinuations(s,{dispatchNext:invoke});
  assert.equal(check.next_dispatches,1);assert.equal(dispatches,2);
  s.close();s=createSqliteCopEventStore(file);
  event(s,A,'fallback-second-succeeds','completed','completed');
  check=await reconcilePacketParentContinuations(s,{dispatchNext:invoke,
    execute:async({view})=>{resumptions++;
      assert.equal(view.winner_child_ref,A);
      return {ok:true,receipt_ref:'scheduler:fallback-finished'};}});
  assert.equal(check.resumed,1);
  assert.equal(resumptions,1);
  const rerun=await reconcilePacketParentContinuations(s,{dispatchNext:invoke,
    execute:async()=>{resumptions++;throw Error('duplicate')}});
  assert.equal(rerun.resumed,0);assert.equal(resumptions,1);
  assert.equal(dispatches,2);
  assert.equal(s.auditCommitments().ok,true);
  s.close();
 }finally{rmSync(d,{recursive:true,force:true})}
});

test('a crashed next-child transport never silently re-dispatches a duplicate',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'seq-ambiguous',
    mode:'sequence',child_refs:[A,B]}).ok,true);
  let calls=0;
  const first=await dispatchNextParentChild(s,{parent_ref:P,join_id:'seq-ambiguous',
    dispatch:async()=>{calls++;throw Error('unknown delivery')}});
  assert.equal(first.status,'needs_reconciliation');
  const again=await dispatchNextParentChild(s,{parent_ref:P,join_id:'seq-ambiguous',
    dispatch:async()=>{calls++;return {ok:true,receipt_ref:'incorrect:retry'}}});
  assert.equal(again.status,'needs_reconciliation');assert.equal(calls,1);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('sequence waits for each ordered step, executes only next and fails on an intermediate rejection',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  for(const child_ref of [A,B])assert.equal(linkPacketChild(s,{parent_ref:P,child_ref}).ok,true);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'sequence-flow',
    mode:'sequence',child_refs:[B,A]}).ok,true);
  const dispatched=[];
  const opts={dispatchNext:async({child_ref})=>{
    dispatched.push(child_ref);return {ok:true,receipt_ref:'John:'+child_ref};}};
  assert.equal((await reconcilePacketParentContinuations(s,opts)).next_dispatches,1);
  assert.deepEqual(dispatched,[B]);
  event(s,B,'sequence-b-completed','completed','completed');
  assert.equal((await reconcilePacketParentContinuations(s,opts)).next_dispatches,1);
  assert.deepEqual(dispatched,[B,A]);
  event(s,A,'sequence-a-failed','completed','failed');
  const state=await reconcilePacketParentContinuations(s,{...opts,
    execute:async({view})=>{assert.equal(view.status,'failed');
      return {ok:true,receipt_ref:'parent:failed-propagation'};}});
  assert.equal(state.resumed,1);
  assert.equal(state.next_dispatches,0);
  assert.equal(dispatched.length,2);
 }finally{s.close()}
});

test('Promise.race durable outcome follows authoritative COP recording order rather than child name',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  setup(s);
  assert.equal(registerParentJoin(s,{parent_ref:P,join_id:'race-reordering',mode:'race'}).ok,true);
  const eventAt=(ref,key,status,at)=>{
   const r=s.append({topic_id:ref,event_type:'cop.event/v1',actor_id:'agent:remote',
    subject_ref:ref,visibility:'restricted',epistemic_status:'decided',
    idempotency_key:key,recorded_at:at,
    payload:{profile:'cop.continuation-dispatch/v1',phase:'handler_completed',
      parent_packet_status:status}});
   assert.equal(r.ok,true);
  };
  // The SQLite replay groups by topic A then B. B was canonically recorded
  // earlier, so B MUST win after the parent starts and reconciles both.
  eventAt(A,'a-recorded-later','completed','2026-11-15T22:01:02.000Z');
  eventAt(B,'b-recorded-earlier','failed','2026-11-15T22:01:01.000Z');
  assert.equal(reconcileParentChildStates(s,{parent_ref:P}).notifications,2);
  const result=projectParentJoin(s,{parent_ref:P,join_id:'race-reordering'});
  assert.equal(result.winner_child_ref,B);
  assert.equal(result.status,'failed');
 }finally{s.close()}
});

test('distributed all/allSettled retain declared INPUT order, not alphabetic or resolution order',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  for(const child_ref of [A,B])assert.equal(linkPacketChild(s,{parent_ref:P,child_ref}).ok,true);
  for(const mode of ['all','allSettled'])assert.equal(registerParentJoin(s,{parent_ref:P,
    join_id:mode+'-ordered',mode,child_refs:[B,A]}).ok,true);
  event(s,A,'a-early-order','completed','completed');
  event(s,B,'b-later-order','completed','completed');
  reconcileParentChildStates(s,{parent_ref:P});
  for(const mode of ['all','allSettled']){
    const p=projectParentJoin(s,{parent_ref:P,join_id:mode+'-ordered'});
    assert.equal(p.ready,true);
    assert.deepEqual(p.children.map(c=>c.child_ref),[B,A]);
  }
 }finally{s.close()}
});
