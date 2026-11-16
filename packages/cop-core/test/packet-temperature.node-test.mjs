import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {linkPacketChild} from '../src/packet-parent-continuations.js';
import {changePacketTemperature,projectPacketTemperature,
  projectTemperatureReadyCandidates,deletePacketLogically,
  purgeUnpublishedDraft,packetLineageGraph} from '../src/packet-temperature.js';
const P='continuation:heat-parent',A='continuation:heat-child-a',
  B='continuation:heat-child-b',C='continuation:heat-grandchild';
const linked=s=>{
  for(const [x,y] of [[P,A],[P,B],[A,C]]){
    const r=linkPacketChild(s,{parent_ref:x,child_ref:y});
    assert.equal(r.ok,true,JSON.stringify(r));
  }
};
const temperature=(s,ref)=>projectPacketTemperature(s,{packet_ref:ref});
const change=(s,ref,t,id)=>changePacketTemperature(s,{packet_ref:ref,
  temperature:t,transition_id:id});

test('Suspend(parent) cascades; Resume(parent) never resumes descendants',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linked(s);
  const cool=change(s,P,'suspended','suspend-1');
  assert.equal(cool.ok,true);assert.equal(cool.affected,4);
  for(const ref of [P,A,B,C]){
    assert.equal(temperature(s,ref).temperature,'suspended');
    assert.equal(temperature(s,ref).runnable,false);
  }
  const root=change(s,P,'active','resume-1');
  assert.equal(root.ok,true);assert.equal(temperature(s,P).runnable,true);
  for(const ref of [A,B,C])assert.equal(temperature(s,ref).runnable,false);
  change(s,A,'active','resume-a');
  assert.equal(temperature(s,A).runnable,true);
  assert.equal(temperature(s,C).runnable,false);
  assert.equal(temperature(s,B).runnable,false);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('Park keeps a previously colder descendant; cooling cannot warm',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linked(s);
  assert.equal(change(s,B,'archived','archive-b').ok,true);
  assert.equal(change(s,P,'parked','park-all').ok,true);
  assert.equal(temperature(s,B).temperature,'archived');
  assert.equal(change(s,P,'suspended','bad-warm').status,'would_implicitly_warm');
  assert.equal(change(s,P,'active','resume-root').ok,true);
  assert.equal(temperature(s,P).runnable,true);
  assert.equal(temperature(s,A).temperature,'parked');
  assert.equal(temperature(s,B).temperature,'archived');
  assert.equal(temperature(s,C).temperature,'parked');
 }finally{s.close()}
});

test('children created during parent parking stay parked when the parent resumes',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  const parked=change(s,P,'parked','parent-parked');
  assert.equal(parked.ok,true);
  assert.equal(linkPacketChild(s,{parent_ref:P,child_ref:A}).ok,true);
  assert.equal(linkPacketChild(s,{parent_ref:A,child_ref:C}).ok,true);
  assert.equal(temperature(s,C).temperature,'active');
  assert.equal(temperature(s,C).effective_temperature,'parked');
  assert.equal(temperature(s,C).runnable,false);
  assert.equal(change(s,P,'active','root-resumes').ok,true);
  assert.equal(temperature(s,P).runnable,true);
  assert.equal(temperature(s,A).temperature,'parked');
  assert.equal(temperature(s,C).temperature,'parked');
 }finally{s.close()}
});

test('duplicate transition ID never appends twice or changes meaning',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linked(s);
  assert.equal(change(s,P,'suspended','same-id').duplicate,false);
  const count=s.replay().length;
  assert.equal(change(s,P,'suspended','same-id').duplicate,true);
  assert.equal(s.replay().length,count);
  assert.equal(change(s,P,'parked','same-id').status,'transition_conflict');
  assert.equal(s.replay().length,count);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('select READY candidates by effective temperature; not by priority alone',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linked(s);change(s,P,'suspended','pause-root');
  const q=projectTemperatureReadyCandidates(s,{packet_refs:[P,A,B,C]});
  assert.equal(q.ready.length,0);assert.equal(q.blocked.length,4);
  assert.equal(q.mandate_and_capability_checked,false);
  change(s,P,'active','resume-root');
  const next=projectTemperatureReadyCandidates(s,{packet_refs:[P,A,B,C]});
  assert.deepEqual(next.ready.map(x=>x.packet_ref),[P]);
  assert.equal(next.blocked.length,3);
  assert.equal(next.blocked[0].reason,'suspended');
 }finally{s.close()}
});

test('a descendant with multiple parents remains blocked while either parent is cold',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  assert.equal(linkPacketChild(s,{parent_ref:P,child_ref:A}).ok,true);
  assert.equal(linkPacketChild(s,{parent_ref:B,child_ref:A}).ok,true);
  change(s,P,'suspended','p-pause');
  assert.equal(temperature(s,A).runnable,false);
  change(s,A,'active','a-self-resume');
  assert.deepEqual(temperature(s,A).blocked_by,[P]);
  change(s,P,'active','p-resume');
  // A's premature resume while P was suspended did not unlock it.
  assert.equal(temperature(s,A).runnable,false);
  change(s,A,'active','a-resume-after-parent');
  assert.equal(temperature(s,A).runnable,true);
  change(s,B,'parked','b-park');
  assert.equal(temperature(s,A).effective_temperature,'parked');
  assert.equal(temperature(s,A).runnable,false);
 }finally{s.close()}
});

test('Archive and later Restore(parent) preserve work history and child coldness after process restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cop-heat-'));
 try{
  const path=join(dir,'cop.sqlite');let s=createSqliteCopEventStore(path);
  linked(s);
  const e=s.append({topic_id:A,event_type:'cop.event/v1',actor_id:'handler:test',
    subject_ref:A,idempotency_key:'child-a:already-worked',
    payload:{profile:'cop.continuation-dispatch/v1',phase:'handler_completed',
      parent_packet_status:'completed',result_ref:'artifact:interesting-output'}});
  assert.equal(e.ok,true);
  assert.equal(change(s,P,'archived','archive-root').ok,true);
  const initial=s.replay().length;s.close();
  s=createSqliteCopEventStore(path);
  assert.equal(s.replay().length,initial);
  assert.equal(temperature(s,P).temperature,'archived');
  assert.equal(temperature(s,A).temperature,'archived');
  assert.equal(change(s,P,'active','restore-root').ok,true);
  assert.equal(temperature(s,P).runnable,true);
  assert.equal(temperature(s,A).temperature,'archived');
  assert.ok(s.eventByIdempotency('child-a:already-worked'));
  assert.equal(s.auditCommitments().ok,true);
  s.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});

test('Delete worked packet means tombstone only, existing result/effect and lineage stay',()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  linked(s);
  const added=s.append({topic_id:C,event_type:'cop.event/v1',
    actor_id:'handler:effect',subject_ref:C,idempotency_key:'effect:c:receipt',
    payload:{profile:'cop.effect/receipt',external_effect:true,status:'completed'}});
  assert.equal(added.ok,true);
  assert.equal(deletePacketLogically(s,{packet_ref:P,transition_id:'delete-tree'}).status,
    'live_descendants_require_explicit_disposition');
  assert.equal(deletePacketLogically(s,{packet_ref:C,transition_id:'delete-c'}).ok,true);
  assert.equal(temperature(s,C).deleted,true);
  assert.equal(temperature(s,C).retention,'tombstone');
  assert.equal(temperature(s,C).runnable,false);
  assert.ok(s.eventByIdempotency('effect:c:receipt'));
  assert.equal(change(s,C,'active','illegal-restore').status,'packet_deleted');
  const row=s.listTopic(C).find(x=>x.payload?.phase==='deleted');
  assert.equal(row.payload.historical_events_preserved,true);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('unpublished orphan draft can be purged; canonical draft cannot disappear silently',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  const drafts=new Map([['draft:ephemeral',{packet_id:'draft:ephemeral'}],
    ['draft:canon',{packet_id:'draft:canon'}]]);
  const staging_store={staging_only:true,exclusive:true,
    hasPacket:async k=>drafts.has(k),
    deletePacket:async k=>drafts.delete(k)};
  assert.equal((await purgeUnpublishedDraft(s,{draft_ref:'draft:ephemeral',
    staging_store:{...staging_store,exclusive:false}})).status,'invalid_staged_draft');
  const clean=await purgeUnpublishedDraft(s,{draft_ref:'draft:ephemeral',staging_store});
  assert.equal(clean.status,'purged_unpublished_draft');
  assert.equal(drafts.has('draft:ephemeral'),false);
  assert.equal(s.replay().length,0);
  assert.equal(s.append({topic_id:'draft:canon',event_type:'cop.event/v1',
    actor_id:'author:draft',subject_ref:'draft:canon',
    idempotency_key:'created:canonical-draft',payload:{phase:'created'}}).ok,true);
  const refused=await purgeUnpublishedDraft(s,{draft_ref:'draft:canon',staging_store});
  assert.equal(refused.status,'draft_has_canonical_history');
  assert.equal(drafts.has('draft:canon'),true);
 }finally{s.close()}
});

test('separately started workers cannot lose cold barriers when parent restarts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cop-heat-process-'));const file=join(dir,'events.sqlite');
 try{
  let s=createSqliteCopEventStore(file);linked(s);s.close();
  const src=new URL('../src/packet-temperature.js',import.meta.url).href;
  const dbmod=new URL('../src/sqlite-cop-event-store.js',import.meta.url).href;
  for(const [temperature,id] of [['suspended','pause-x'],['active','resume-x']]){
    const code=`import {createSqliteCopEventStore} from ${JSON.stringify(dbmod)};import {changePacketTemperature} from ${JSON.stringify(src)};const s=createSqliteCopEventStore(process.argv[1]);try{const x=changePacketTemperature(s,{packet_ref:process.argv[2],temperature:process.argv[3],transition_id:process.argv[4]});if(!x.ok)throw Error(x.status)}finally{s.close()}`;
    const p=spawnSync(process.execPath,['--input-type=module','-e',code,file,P,temperature,id],
      {encoding:'utf8',timeout:13000});assert.equal(p.status,0,p.stderr);
  }
  s=createSqliteCopEventStore(file);
  assert.deepEqual(projectTemperatureReadyCandidates(s,{packet_refs:[P,A,B,C]}).ready.map(x=>x.packet_ref),[P]);
  assert.equal(s.auditCommitments().ok,true);s.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});
