import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {declarePacketTaskSteps,advancePacketTaskStep,
  projectPacketTaskSteps} from '../src/packet-task-step-cursor.js';
import {changePacketTemperature} from '../src/packet-temperature.js';
import {linkPacketChild} from '../src/packet-parent-continuations.js';

const packet_ref='packet:test-cursor';
const task_ref='task:local-projection';
const step_refs=['step:prepare','step:compute','step:finish'];
const plan_id='plan.v1';
const declare=store=>declarePacketTaskSteps(store,{packet_ref,task_ref,step_refs,plan_id});
const advance=(store,expected_step_ref,expected_version,transition_id,extra={})=>
  advancePacketTaskStep(store,{packet_ref,task_ref,expected_step_ref,
    expected_version,transition_id,...extra});
function persisted(){
  const root=mkdtempSync(join(tmpdir(),'cop-step-cursor-'));
  return {root,path:join(root,'cop.sqlite'),close(){rmSync(root,{recursive:true,force:true})}};
}

test('COPTask step progression is packet-local, deterministic and has no new packet or task identity',()=>{
  const s=createSqliteCopEventStore(':memory:');try{
    assert.equal(projectPacketTaskSteps(s,{packet_ref}).status,'uninitialized');
    const init=declare(s);assert.equal(init.status,'declared');
    assert.equal(declare(s).status,'already_declared');
    const cursor=projectPacketTaskSteps(s,{packet_ref});
    assert.equal(cursor.version,0);
    assert.deepEqual(cursor.resumption_target,{
      kind:'task_step',task_ref,step_ref:step_refs[0],packet_ref});
    for(let i=0;i<step_refs.length;i++){
      const result=advance(s,step_refs[i],i,'transition-'+i);
      assert.equal(result.ok,true,JSON.stringify(result));
      assert.equal(result.version,i+1);
      assert.equal(result.next_step_ref,step_refs[i+1]||null);
      assert.equal(s.listTopic(packet_ref).filter(x=>
        x.payload?.profile==='cop.packet-task-step-cursor/v1').length,i+2);
    }
    const final=projectPacketTaskSteps(s,{packet_ref});
    assert.equal(final.status,'completed');
    assert.equal(final.version,3);
    assert.equal(final.resumption_target,null);
    assert.equal(final.completed_steps.length,3);
    assert.equal(advance(s,'step:finish',3,'after-final').status,'task_steps_completed');
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close()}
});

test('competing FractaSchedulers sharing SQLite cannot advance the same version twice',async()=>{
  const f=persisted();let left=createSqliteCopEventStore(f.path),right=createSqliteCopEventStore(f.path);
  try{
    assert.equal(declare(left).ok,true);
    const [a,b]=await Promise.all([
      Promise.resolve().then(()=>advance(left,step_refs[0],0,'actor:A')),
      Promise.resolve().then(()=>advance(right,step_refs[0],0,'actor:B')),
    ]);
    assert.equal([a,b].filter(x=>x.ok).length,1,JSON.stringify([a,b]));
    assert.equal([a,b].filter(x=>x.status==='stale_step_cursor').length,1);
    assert.equal(projectPacketTaskSteps(left,{packet_ref}).version,1);
    assert.equal(projectPacketTaskSteps(right,{packet_ref}).version,1);
    assert.equal(left.auditCommitments().ok,true);
  }finally{left.close();right.close();f.close()}
});

test('persisted cursor survives process restart and resumes only next step',()=>{
  const f=persisted();let s=createSqliteCopEventStore(f.path);
  try{
    declare(s);
    const first=advance(s,step_refs[0],0,'step:first',
      {source_ref:'result:step-prepare'});
    assert.equal(first.ok,true);
    s.close();s=createSqliteCopEventStore(f.path);
    const next=projectPacketTaskSteps(s,{packet_ref});
    assert.equal(next.version,1);assert.equal(next.next_step_ref,'step:compute');
    assert.equal(next.completed_steps[0].source_ref,'result:step-prepare');
    assert.equal(advance(s,step_refs[0],0,'step:first',
      {source_ref:'result:step-prepare'}).status,'already_advanced');
    assert.equal(advance(s,'step:compute',1,'step:second').status,'advanced');
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close();f.close()}
});

test('idempotency keys cannot silently rewrite a step result or plan',()=>{
  const s=createSqliteCopEventStore(':memory:');try{
    declare(s);
    assert.equal(declarePacketTaskSteps(s,{packet_ref,task_ref,step_refs:[
      'step:prepare','step:other'],plan_id}).status,'step_plan_conflict');
    assert.equal(declarePacketTaskSteps(s,{packet_ref,task_ref,
      step_refs,plan_id:'plan.v2'}).status,'step_plan_conflict');
    assert.equal(advance(s,step_refs[0],0,'same-id').status,'advanced');
    assert.equal(advance(s,step_refs[0],0,'same-id',
      {source_ref:'different-result'}).status,'transition_id_conflict');
    assert.equal(advance(s,step_refs[1],1,'same-id').status,'transition_id_conflict');
    assert.equal(projectPacketTaskSteps(s,{packet_ref}).version,1);
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close()}
});

test('Suspended/Parked prevent step progression; resume does not erase audit',()=>{
  const s=createSqliteCopEventStore(':memory:');try{
    declare(s);
    assert.equal(changePacketTemperature(s,{packet_ref,
      temperature:'parked',transition_id:'park-test'}).ok,true);
    assert.equal(advance(s,step_refs[0],0,'while-parked').status,
      'packet_not_runnable');
    assert.equal(projectPacketTaskSteps(s,{packet_ref}).version,0);
    assert.equal(changePacketTemperature(s,{packet_ref,
      temperature:'active',transition_id:'warm-test'}).ok,true);
    assert.equal(advance(s,step_refs[0],0,'after-resume').status,'advanced');
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close()}
});

test('step cursor does not authorize distributed effects or execute a handler',()=>{
  const s=createSqliteCopEventStore(':memory:');try{
    assert.equal(advance(s,step_refs[0],0,'no-plan').status,'step_plan_missing');
    assert.equal(declarePacketTaskSteps(s,{packet_ref,task_ref,
      step_refs:['step:one','step:one'],plan_id}).status,'invalid_step_plan');
    declare(s);
    const before=s.replay().length;
    const projected=projectPacketTaskSteps(s,{packet_ref});
    assert.equal(projected.status,'ready');
    assert.equal(s.replay().length,before);
    assert.equal(Object.hasOwn(projected,'executor'),false);
    assert.equal(advance(s,'step:random',0,'unrelated').status,'stale_step_cursor');
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close()}
});


function separateProcess(args){
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.execPath,[fileURLToPath(new URL('./fixtures/task-step-advance-worker.mjs',import.meta.url)),...args],
      {stdio:['ignore','pipe','pipe']});
    let output='',error='';
    proc.stdout.setEncoding('utf8');proc.stderr.setEncoding('utf8');
    proc.stdout.on('data',x=>output+=x);
    proc.stderr.on('data',x=>error+=x);
    proc.once('error',reject);
    proc.once('close',code=>{
      if(code!==0)return reject(Error('worker process failed: '+error.slice(0,300)));
      try{resolve(JSON.parse(output))}catch(e){reject(e)}
    });
  });
}

test('two independent Node VM processes race for a shared durable COPStep',async()=>{
  const f=persisted(),s=createSqliteCopEventStore(f.path);
  try{
    assert.equal(declare(s).ok,true);
    const params=[f.path,packet_ref,task_ref,step_refs[0],'0'];
    const [a,b]=await Promise.all([
      separateProcess([...params,'fracta-node-A']),
      separateProcess([...params,'fracta-node-B']),
    ]);
    assert.equal([a,b].filter(v=>v.status==='advanced').length,1,
      JSON.stringify([a,b]));
    assert.equal([a,b].filter(v=>v.status==='stale_step_cursor').length,1);
    assert.equal(projectPacketTaskSteps(s,{packet_ref}).version,1);
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close();f.close()}
});

test('Park(parent) freezes its child cursor; Resume(parent) does not silently wake it',()=>{
  const s=createSqliteCopEventStore(':memory:');
  try{
    assert.equal(declare(s).ok,true);
    assert.equal(linkPacketChild(s,{parent_ref:'packet:root',
      child_ref:packet_ref}).ok,true);
    assert.equal(changePacketTemperature(s,{packet_ref:'packet:root',
      temperature:'parked',transition_id:'freeze-parent'}).ok,true);
    assert.equal(advance(s,step_refs[0],0,'no-advance-while-parent-parked').status,
      'packet_not_runnable');
    assert.equal(changePacketTemperature(s,{packet_ref:'packet:root',
      temperature:'active',transition_id:'wake-parent-only'}).ok,true);
    assert.equal(advance(s,step_refs[0],0,'no-child-wake').status,
      'packet_not_runnable');
    assert.equal(changePacketTemperature(s,{packet_ref,
      temperature:'active',transition_id:'wake-child-explicit'}).ok,true);
    assert.equal(advance(s,step_refs[0],0,'child-unblocked').status,'advanced');
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close()}
});
