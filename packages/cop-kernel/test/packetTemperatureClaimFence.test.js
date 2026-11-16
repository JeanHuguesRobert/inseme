import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSqliteCopEventStore} from '../../cop-core/src/sqlite-cop-event-store.js';
import {linkPacketChild} from '../../cop-core/src/packet-parent-continuations.js';
import {changePacketTemperature,projectPacketTemperature,
  projectTemperatureReadyCandidates} from '../../cop-core/src/packet-temperature.js';
import {EventStorePacketClaimCoordinator} from '../src/packetCoordination.js';
import {COPScheduler} from '../src/scheduler.js';
import {COPBus} from '../src/bus.js';

const P='packet:claim-temperature-parent', C='packet:claim-temperature-child';
const change=(s,ref,temp,id)=>changePacketTemperature(s,{packet_ref:ref,temperature:temp,transition_id:id});
function runChild(file,packetRef,handlerRef){
 return new Promise((resolve,reject)=>{
  const code=`import {createSqliteCopEventStore} from ${JSON.stringify(new URL('../../cop-core/src/sqlite-cop-event-store.js',import.meta.url).href)};import {EventStorePacketClaimCoordinator} from ${JSON.stringify(new URL('../src/packetCoordination.js',import.meta.url).href)};const store=createSqliteCopEventStore(process.argv[1]);try{const out=await new EventStorePacketClaimCoordinator({store}).tryClaim({packetRef:process.argv[2],handlerRef:process.argv[3],ttlMs:60000});process.stdout.write(JSON.stringify(out));}finally{store.close()}`;
  const p=spawn(process.execPath,['--input-type=module','-e',code,file,packetRef,handlerRef],{stdio:['ignore','pipe','pipe']});
  let out='',err='';
  const timeout=setTimeout(()=>{p.kill();reject(new Error('worker_timeout'))},14000);
  p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);
  p.on('error',e=>{clearTimeout(timeout);reject(e)});
  p.on('close',c=>{clearTimeout(timeout);if(c!==0)reject(new Error(err));else {
   try{resolve(JSON.parse(out))}catch(e){reject(e)}
  }});
 });
}

test('claim and tree temperature share a serialized COP transaction across independent OS schedulers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cop-claim-temperature-'));const file=join(dir,'events.sqlite');
 try{
  let store=createSqliteCopEventStore(file);
  assert.equal(linkPacketChild(store,{parent_ref:P,child_ref:C}).ok,true);
  const candidates=projectTemperatureReadyCandidates(store,{packet_refs:[C]});
  assert.equal(candidates.eligible_count,1);
  assert.equal(change(store,P,'suspended','parent-pauses-after-selection').ok,true);
  store.close();
  // Two independent FractaScheduler worker processes race for a now-cold
  // candidate; both MUST be denied without ever inserting PacketClaim.
  const rejected=await Promise.all([
    runChild(file,C,'handler:node-A'),runChild(file,C,'handler:node-B')]);
  assert.deepEqual(rejected.map(x=>x.code),['PACKET_TEMPERATURE_BLOCKED','PACKET_TEMPERATURE_BLOCKED']);
  store=createSqliteCopEventStore(file);
  let coordinator=new EventStorePacketClaimCoordinator({store});
  assert.equal(coordinator.inspect(C).active_claim,null);
  assert.equal(coordinator.inspect(C).last_epoch,0);
  assert.equal(change(store,P,'active','parent-only-resumed').ok,true);
  assert.equal(projectPacketTemperature(store,{packet_ref:C}).runnable,false);
  store.close();
  assert.equal((await runChild(file,C,'handler:node-A')).code,'PACKET_TEMPERATURE_BLOCKED');
  store=createSqliteCopEventStore(file);
  assert.equal(change(store,C,'active','child-explicit-resumed').ok,true);
  store.close();
  const contenders=await Promise.all([
    runChild(file,C,'handler:node-A'),runChild(file,C,'handler:node-B')]);
  assert.equal(contenders.filter(x=>x.ok).length,1);
  assert.equal(contenders.filter(x=>x.code==='PACKET_BUSY').length,1);
  store=createSqliteCopEventStore(file);
  coordinator=new EventStorePacketClaimCoordinator({store});
  const winner=contenders.find(x=>x.ok).claim;
  assert.equal(coordinator.inspect(C).active_claim.claim_id,winner.claim_id);
  const release=await coordinator.release({packetRef:C,claimId:winner.claim_id,
    handlerRef:winner.handler_ref,epoch:winner.epoch});
  assert.equal(release.ok,true);
  assert.equal(store.auditCommitments().ok,true);
  store.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});

test('Suspend during slow claim routing defers without publishing resume or invoking a handler',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  const realCoordinator=new EventStorePacketClaimCoordinator({store:s});
  let calls=0;const published=[];
  const bus=new COPBus({name:'atomic-suspend-post-claim'});
  bus.subscribeAll(e=>published.push(e.type));
  const scheduler=new COPScheduler(bus,{
   admissionResolver:continuation=>{
    const p=projectPacketTemperature(s,{packet_ref:continuation.packetRef});
    return {admitted:p.runnable,reason:'temperature:'+p.effective_temperature};
   },
   coordinationResolver:async()=>({mode:'MUTATE',packetRef:C,
     handlerRef:'handler:node-A'}),
   packetClaimCoordinator:{
     tryClaim:async args=>{
       const grant=await realCoordinator.tryClaim(args);
       assert.equal(grant.ok,true);
       // Competing scheduler/thread parks P after coordinator granted
       // but BEFORE the first scheduler enters its actual handler.
       assert.equal(change(s,C,'suspended','interleaved-after-grant').ok,true);
       return grant;
     },
     release:args=>realCoordinator.release(args),
     complete:args=>realCoordinator.complete(args),
   },
   handlerResolver:async()=>({execute:async()=>{calls++;return {ok:true}}}),
  });
  const outcome=await scheduler.execute({continuationId:'child-claim',packetRef:C,
    topicId:C,resumeTo:'handler:node-A'});
  assert.equal(outcome.deferred,true);
  assert.equal(outcome.reason,'temperature:suspended');
  assert.equal(calls,0);
  assert.equal(published.includes('cop.continuation.resume'),false);
  assert.equal(realCoordinator.inspect(C).active_claim,null);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});

test('cooling a claimed packet forbids lease renewal but permits a cooperative release',async()=>{
 const s=createSqliteCopEventStore(':memory:');try{
  const coord=new EventStorePacketClaimCoordinator({store:s});
  const got=await coord.tryClaim({packetRef:C,handlerRef:'handler:heartbeat',ttlMs:30000});
  assert.equal(got.ok,true);
  assert.equal(change(s,C,'parked','work-no-longer-hot').ok,true);
  const h=await coord.heartbeat({packetRef:C,claimId:got.claim.claim_id,
    handlerRef:got.claim.handler_ref,epoch:got.claim.epoch,ttlMs:30000});
  assert.equal(h.code,'PACKET_TEMPERATURE_BLOCKED');
  assert.equal(coord.events(C).filter(e=>e.type==='PACKET_CLAIM_RENEWED').length,0);
  assert.equal((await coord.release({packetRef:C,claimId:got.claim.claim_id,
    handlerRef:got.claim.handler_ref,epoch:got.claim.epoch})).ok,true);
  assert.equal(coord.inspect(C).active_claim,null);
  assert.equal(s.auditCommitments().ok,true);
 }finally{s.close()}
});
