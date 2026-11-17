/**
 * Packet-backed COPTask / COPStep cursor: the durable equivalent of moving
 * an in-memory task's instruction pointer to its next Step.
 *
 * Only the existing COP EventStore is authoritative. This module neither
 * executes a step nor launches a process, dispatches a packet or grants a
 * provider effect. It records a previously observed local step completion
 * and atomically advances the canonical packet's *task projection*.
 */
import {createHash} from 'node:crypto';
import {projectPacketTemperature} from './packet-temperature.js';

export const PACKET_TASK_STEP_CURSOR_PROFILE='cop.packet-task-step-cursor/v1';
const ref=x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_.:/-]{2,255}$/.test(x);
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(x);
const packetRef=x=>ref(x)&&x.startsWith('packet:');
const key=(phase,...parts)=>'cop-task-step:'+phase+':'+createHash('sha256')
  .update(parts.join('\0')).digest('hex').slice(0,40);
const fail=status=>({ok:false,status});
const event=(topic,phase,eventId,payload,causal_refs=[])=>({
  topic_id:topic,event_type:'cop.event/v1',actor_id:'cop:packet-task-step-cursor',
  subject_ref:topic,visibility:'restricted',epistemic_status:'observed',
  idempotency_key:eventId,causal_refs:causal_refs.filter(Boolean),
  payload:{profile:PACKET_TASK_STEP_CURSOR_PROFILE,phase,...payload},
});

/** Read packet-local steps only. Any unrelated COP events on the same packet
 * topic are intentionally ignored: this is a projection, not another queue.
 */
export function projectPacketTaskSteps(store,{packet_ref}={}){
  if(typeof store?.listTopic!=='function'||!packetRef(packet_ref))
    return fail('invalid_packet_cursor');
  const all=store.listTopic(packet_ref).filter(e=>
    e.payload?.profile===PACKET_TASK_STEP_CURSOR_PROFILE);
  let plan=null,version=0,cursor=0,terminal=false,last_receipt_ref=null;
  const history=[];
  for(const e of all){
    const p=e.payload||{};
    if(p.phase==='steps_declared'){
      if(plan||!ref(p.task_ref)||!id(p.plan_id)||
         !Array.isArray(p.step_refs)||p.step_refs.length<1||p.step_refs.length>128||
         p.step_refs.some(x=>!ref(x))||
         new Set(p.step_refs).size!==p.step_refs.length)
        return fail('cursor_journal_conflict');
      plan={task_ref:p.task_ref,plan_id:p.plan_id,step_refs:p.step_refs};
      last_receipt_ref=e.idempotency_key;
    }else if(p.phase==='step_advanced'){
      if(!plan||terminal||p.task_ref!==plan.task_ref||
         p.step_ref!==plan.step_refs[cursor]||
         p.next_step_ref!==(plan.step_refs[cursor+1]||null)||
         p.expected_version!==version||p.version!==version+1||
         typeof p.transition_id!=='string'||!id(p.transition_id))
        return fail('cursor_journal_conflict');
      history.push({step_ref:p.step_ref,receipt_ref:e.idempotency_key,
        source_ref:p.source_ref||null,version:p.version});
      cursor++;version++;
      terminal=cursor===plan.step_refs.length;
      last_receipt_ref=e.idempotency_key;
    }else return fail('unknown_cursor_event');
  }
  if(!plan)return {ok:true,status:'uninitialized',packet_ref,
    version:0,next_step_ref:null,terminal:false};
  return {ok:true,status:terminal?'completed':'ready',packet_ref,
    task_ref:plan.task_ref,plan_id:plan.plan_id,
    step_refs:[...plan.step_refs],version,terminal,
    next_step_ref:terminal?null:plan.step_refs[cursor],
    completed_steps:history,last_receipt_ref,
    // Compatible with Cogentia's pure `task_step` target descriptor.
    resumption_target:terminal?null:{kind:'task_step',task_ref:plan.task_ref,
      step_ref:plan.step_refs[cursor],packet_ref},
  };
}

/** Define a finite linear local step sequence once, under the Packet's topic.
 * Task/Step ids are projections, not additional canonical work identities.
 */
export function declarePacketTaskSteps(store,{packet_ref,task_ref,step_refs,
  plan_id}={}){
  if(typeof store?.transaction!=='function'||!packetRef(packet_ref)||
     !ref(task_ref)||!id(plan_id)||!Array.isArray(step_refs)||
     step_refs.length<1||step_refs.length>128||step_refs.some(x=>!ref(x))||
     new Set(step_refs).size!==step_refs.length)
    return fail('invalid_step_plan');
  const eid=key('plan',packet_ref,plan_id);
  const t=store.transaction(tx=>{
    const old=projectPacketTaskSteps(tx,{packet_ref});
    if(!old.ok)return old;
    if(old.status!=='uninitialized'){
      const same=old.plan_id===plan_id&&old.task_ref===task_ref&&
        JSON.stringify(old.step_refs)===JSON.stringify(step_refs);
      return same?{ok:true,status:'already_declared',duplicate:true,
        receipt_ref:eid,version:old.version,next_step_ref:old.next_step_ref}:
        fail('step_plan_conflict');
    }
    const p=tx.append(event(packet_ref,'steps_declared',eid,{packet_ref,
      task_ref,step_refs:[...step_refs],plan_id}));
    if(!p.ok)throw Error(p.error||'step_plan_append_failed');
    return {ok:true,status:'declared',duplicate:false,receipt_ref:eid,
      version:0,next_step_ref:step_refs[0]};
  });
  return t.ok?t.value:fail('step_plan_commit_failed');
}

/** Commit one observed step completion and select the next one in ONE
 * BEGIN IMMEDIATE transaction. `source_ref` is optional provenance for a
 * pure local step, not a claim of independent permission for external effects.
 */
export function advancePacketTaskStep(store,{packet_ref,task_ref,
  expected_step_ref,expected_version,transition_id,source_ref=null}={}){
  if(typeof store?.transaction!=='function'||!packetRef(packet_ref)||
     !ref(task_ref)||!ref(expected_step_ref)||
     !Number.isSafeInteger(expected_version)||expected_version<0||
     !id(transition_id)||(source_ref!==null&&!ref(source_ref)))
    return fail('invalid_step_transition');
  const eid=key('advance',packet_ref,transition_id);
  const t=store.transaction(tx=>{
    const prev=tx.eventByIdempotency(eid);
    if(prev){
      const p=prev.payload||{};
      return p.profile===PACKET_TASK_STEP_CURSOR_PROFILE&&
        p.phase==='step_advanced'&&p.task_ref===task_ref&&
        p.step_ref===expected_step_ref&&p.expected_version===expected_version&&
        (p.source_ref||null)===source_ref?
        {ok:true,status:'already_advanced',duplicate:true,receipt_ref:eid,
          version:p.version,next_step_ref:p.next_step_ref}:
        fail('transition_id_conflict');
    }
    const cur=projectPacketTaskSteps(tx,{packet_ref});
    if(!cur.ok)return cur;
    if(cur.status==='uninitialized')return fail('step_plan_missing');
    if(cur.terminal)return fail('task_steps_completed');
    if(cur.task_ref!==task_ref||cur.version!==expected_version||
       cur.next_step_ref!==expected_step_ref)return fail('stale_step_cursor');
    const temp=projectPacketTemperature(tx,{packet_ref});
    if(!temp.ok||!temp.runnable)return fail('packet_not_runnable');
    const idx=cur.version+1;
    const next=cur.step_refs[idx]||null;
    const p=tx.append(event(packet_ref,'step_advanced',eid,{
      packet_ref,task_ref,step_ref:expected_step_ref,
      next_step_ref:next,expected_version,version:idx,
      transition_id,source_ref,external_effect_executed:false,
    },[cur.last_receipt_ref,source_ref]));
    if(!p.ok)throw Error(p.error||'step_advance_append_failed');
    return {ok:true,status:next?'advanced':'completed',
      duplicate:false,receipt_ref:eid,version:idx,
      next_step_ref:next,terminal:!next};
  });
  return t.ok?t.value:fail('step_advance_commit_failed');
}
