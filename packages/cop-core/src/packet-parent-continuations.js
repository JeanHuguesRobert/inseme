/**
 * Distributed Promise composition over EXISTING COP Events and Continuations.
 * No new core entity or scheduler: child-to-parent notifications are immutable
 * causal events under the parent's already-existing COP topic.
 *
 * This module is intentionally transport- and handler-independent: a child
 * on another machine can write its result to a shared COP Store, or its result
 * can first arrive through a normalizing ingress adapter. Reconciliation
 * projects the same notifications after process restart or missed wake.
 */
import {createHash} from 'node:crypto';

export const PACKET_PARENT_PROFILE='cop.packet-parent-continuation/v1';
const LINK='child_linked',CHANGED='child_state_changed',WAIT='join_wait',
  INTENT='resume_intent',RESUMED='parent_resumed',
  NEXT_INTENT='next_child_dispatch_intent',NEXT_DISPATCHED='next_child_dispatched',
  CANCEL_REQUEST='cancel_requested',CANCEL_ACK='cancel_acknowledged';
const COMPLETED=new Set(['completed','failed','blocked','cancelled']);
const MODES=new Set(['all','allSettled','race','any','quorum','fallback',
  'then','catch','finally','sequence']);
const UNARY=new Set(['then','catch','finally']);
const ref=x=>typeof x==='string'&&x.length>=3&&x.length<=256&&
  (x.startsWith('continuation:')||x.startsWith('packet:'));
const key=(kind,...parts)=>'cop-parent:'+kind+':'+createHash('sha256')
  .update(parts.join('\0')).digest('hex').slice(0,40);
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,96}$/.test(x);
const failure=x=>({ok:false,status:x});
const topicEvents=(store,topic)=>store.listTopic(topic);
function fact({topic,actor='cop:packet-parent-continuation',phase,id,refs=[],data={}}){
  return {topic_id:topic,event_type:'cop.event/v1',actor_id:actor,
    subject_ref:topic,epistemic_status:'observed',visibility:'restricted',
    idempotency_key:id,causal_refs:refs.filter(Boolean),
    payload:{profile:PACKET_PARENT_PROFILE,phase,...data}};
}
function listedChildren(rows){
  const children=new Map();
  for(const row of rows){
    const p=row.payload||{};
    if(p.profile===PACKET_PARENT_PROFILE&&p.phase===LINK&&ref(p.child_ref))
      children.set(p.child_ref,{child_ref:p.child_ref,link_receipt_ref:row.idempotency_key});
    // Backwards-compatible with the existing live ChatGPT CPS child dispatch
    // journal: no migration or rewriting old parent/child events.
    if(p.profile==='cop.continuation-next-step/v1'&&p.phase==='child_dispatched'&&
       validId(p.child_continuation_id)){
      const child_ref='continuation:'+p.child_continuation_id;
      children.set(child_ref,{child_ref,link_receipt_ref:row.idempotency_key});
    }
  }
  return children;
}
function transitionFromSource(event,child_ref){
  if(event?.topic?.id!==child_ref||typeof event.idempotency_key!=='string'||
     !event.idempotency_key)return null;
  const p=event.payload||{};
  if(p.profile==='cop.continuation-result/v1'&&p.phase==='returned')
    return {state:'returned',result_ref:event.idempotency_key};
  if(p.profile==='cop.continuation-dispatch/v1'&&p.phase==='handler_completed'){
    // 'handler_completed' is a step/packet judgment, not a grant, and does
    // not mean the standing Principal mandate itself has terminated.
    const st=p.parent_packet_status??p.parent_mandate_status;
    if(COMPLETED.has(st))return {state:st,result_ref:event.idempotency_key};
    return {state:'progress',result_ref:event.idempotency_key};
  }
  if(p.profile===PACKET_PARENT_PROFILE&&p.phase===CANCEL_ACK&&
     p.child_ref===child_ref)return {state:'cancelled',result_ref:event.idempotency_key};
  if(p.profile===PACKET_PARENT_PROFILE&&p.phase==='packet_transition'&&
     ['returned','completed','failed','blocked','cancelled','assimilated'].includes(p.state))
    return {state:p.state,result_ref:event.idempotency_key};
  return null;
}

/** Register fork by reference, with no copies of the child packet. */
export function linkPacketChild(store,{parent_ref,child_ref,source_ref=null}={}){
  if(typeof store?.transaction!=='function'||!ref(parent_ref)||!ref(child_ref)||
    parent_ref===child_ref)return failure('invalid_link');
  const id=key('link',parent_ref,child_ref);
  const t=store.transaction(tx=>{
    const old=listedChildren(tx.listTopic(parent_ref)).get(child_ref);
    if(old)return {ok:true,duplicate:true,receipt_ref:old.link_receipt_ref};
    const r=tx.append(fact({topic:parent_ref,phase:LINK,id,
      refs:[source_ref],data:{parent_ref,child_ref}}));
    if(!r.ok)throw Error(r.error||'link_append_failed');
    return {ok:true,duplicate:r.duplicate,receipt_ref:id};
  });
  return t.ok?t.value:failure('link_commit_failed');
}

/** A child may change state many times; each canonical event is announced
 * once to its parent, and the parent can rebuild the same view after restart.
 */
export function reportChildStateToParent(store,{parent_ref,child_ref,source_receipt_ref}={}){
  if(typeof store?.transaction!=='function'||!ref(parent_ref)||!ref(child_ref)||
     typeof source_receipt_ref!=='string'||!source_receipt_ref)return failure('invalid_transition');
  const id=key('child-state',parent_ref,child_ref,source_receipt_ref);
  const t=store.transaction(tx=>{
    const linked=listedChildren(tx.listTopic(parent_ref)).get(child_ref);
    if(!linked)return {ok:false,status:'child_not_linked'};
    const source=tx.eventByIdempotency(source_receipt_ref);
    const parsed=transitionFromSource(source,child_ref);
    if(!parsed)return {ok:false,status:'unrecognized_child_transition'};
    const receipt=tx.append(fact({topic:parent_ref,phase:CHANGED,id,
      refs:[linked.link_receipt_ref,source_receipt_ref],
      data:{parent_ref,child_ref,child_state:parsed.state,
        source_receipt_ref,result_ref:parsed.result_ref}}));
    if(!receipt.ok)throw Error(receipt.error||'notification_append_failed');
    return {ok:true,status:'parent_notified',duplicate:receipt.duplicate,
      receipt_ref:id,child_state:parsed.state};
  });
  return t.ok?t.value:failure('notification_commit_failed');
}

/** Polling is a repair path for lost pushes and process crashes, not a new
 * scheduler. The same canonical events are used for fast-path notification.
 */
export function reconcileParentChildStates(store,{parent_ref,max_events=100}={}){
  if(typeof store?.replay!=='function'||!ref(parent_ref)||
     !Number.isSafeInteger(max_events)||max_events<1||max_events>1000)
    return failure('invalid_reconciliation');
  const children=listedChildren(topicEvents(store,parent_ref));
  if(!children.size)return {ok:true,notifications:0,children:0};
  let notifications=0,examined=0;
  // Replay() groups by topic; that order has no business deciding a race.
  // Sort by authoritative store-recording time instead: this is the order
  // in which COP first observed these settlements, not remote wall clocks.
  const observations=store.replay().filter(e=>children.has(e.topic?.id)&&
    transitionFromSource(e,e.topic.id)).sort((a,b)=>
      (a.time?.recorded_at||'').localeCompare(b.time?.recorded_at||'')||
      a.event_id.localeCompare(b.event_id));
  for(const source of observations){
    if(!children.has(source.topic?.id))continue;
    if(!transitionFromSource(source,source.topic.id))continue;
    // Bound the NEW work, not the old history: a large append-only log
    // must not starve recent child transitions forever on every poll.
    const notificationId=key('child-state',parent_ref,source.topic.id,source.idempotency_key);
    if(store.eventByIdempotency(notificationId))continue;
    if(examined>=max_events)break;
    examined++;
    const r=reportChildStateToParent(store,{parent_ref,
      child_ref:source.topic.id,source_receipt_ref:source.idempotency_key});
    if(!r.ok)return {...r,notifications,examined};
    if(!r.duplicate)notifications++;
  }
  return {ok:true,notifications,children:children.size,examined,
    remaining_possible:examined>=max_events};
}

/** Express the parent's existing wait policy in COP Events, not local RAM. */
/** Stable join policy registered as a COP event.  Branch order is retained
 * for fallback and sequence; race order comes from the parent's event journal,
 * not wall clocks across nodes. The policy is immutable after registration.
 */
export function registerParentJoin(store,{parent_ref,join_id,mode='all',child_refs=null,
  quorum=null,cancel_remaining=false}={}){
  if(typeof store?.transaction!=='function'||!ref(parent_ref)||!validId(join_id)||
     !MODES.has(mode)||typeof cancel_remaining!=='boolean')return failure('invalid_join');
  const id=key('join',parent_ref,join_id);
  const t=store.transaction(tx=>{
    const children=listedChildren(tx.listTopic(parent_ref));
    const selected=child_refs==null?[...children.keys()]:child_refs;
    if(!Array.isArray(selected)||!selected.length||
       selected.some(x=>!children.has(x))||new Set(selected).size!==selected.length||
       (UNARY.has(mode)&&selected.length!==1)||
       (mode==='quorum'&&(!Number.isSafeInteger(quorum)||quorum<1||quorum>selected.length))||
       (mode!=='quorum'&&quorum!==null))
      return {ok:false,status:'join_children_missing_or_policy_invalid'};
    const ordered=['fallback','sequence'].includes(mode)
      ?[...selected]:[...selected].sort();
    const policy={parent_ref,join_id,mode,child_refs:ordered,
      quorum:mode==='quorum'?quorum:null,cancel_remaining};
    const prev=tx.eventByIdempotency(id);
    if(prev){
      const p=prev.payload||{};
      // Legacy join records had no quorum/cancel options. Replay them as the
      // default rather than making completed work suddenly conflict.
      return p.mode===mode&&JSON.stringify(p.child_refs)===JSON.stringify(ordered)&&
        (p.quorum??null)===policy.quorum&&(p.cancel_remaining??false)===cancel_remaining
        ?{ok:true,duplicate:true,receipt_ref:id}
        :{ok:false,status:'join_conflict'};
    }
    const receipt=tx.append(fact({topic:parent_ref,phase:WAIT,id,
      refs:ordered.map(x=>children.get(x).link_receipt_ref),data:policy}));
    if(!receipt.ok)throw Error(receipt.error||'join_registration_failed');
    return {ok:true,duplicate:false,receipt_ref:id};
  });
  return t.ok?t.value:failure('join_registration_failed');
}

/** Pure durable Promise settlement projection.  Terminal evidence is ranked
 * by parent-topic sequence, which is the authoritative observable ordering
 * of distributed arrivals. Returned/progress facts are nonterminal; a later
 * duplicate cannot rewrite a terminal outcome. No handler is invoked here.
 */
export function projectParentJoin(store,{parent_ref,join_id}={}){
  if(typeof store?.listTopic!=='function'||!ref(parent_ref)||!validId(join_id))
    return failure('invalid_join');
  const rows=topicEvents(store,parent_ref);
  const registration=rows.find(e=>e.payload?.profile===PACKET_PARENT_PROFILE&&
    e.payload.phase===WAIT&&e.payload.join_id===join_id);
  if(!registration)return failure('join_not_registered');
  const {child_refs,mode}=registration.payload;
  const quorum=registration.payload.quorum??null;
  const cancel_remaining=registration.payload.cancel_remaining===true;
  const outcomes=new Map();
  for(const event of rows){
    const p=event.payload||{};
    if(p.profile!==PACKET_PARENT_PROFILE||p.phase!==CHANGED||
       !child_refs.includes(p.child_ref))continue;
    const prev=outcomes.get(p.child_ref);
    if(!prev||!COMPLETED.has(prev.state))
      outcomes.set(p.child_ref,{state:p.child_state,result_ref:p.result_ref,
        notification_ref:event.idempotency_key,settled_seq:event.topic.seq});
  }
  const children=child_refs.map(child_ref=>({child_ref,
    state:outcomes.get(child_ref)?.state||'pending',
    result_ref:outcomes.get(child_ref)?.result_ref||null,
    notification_ref:outcomes.get(child_ref)?.notification_ref||null,
    settled_seq:COMPLETED.has(outcomes.get(child_ref)?.state)
      ?outcomes.get(child_ref).settled_seq:null}));
  const done=children.filter(x=>COMPLETED.has(x.state));
  const successes=done.filter(x=>x.state==='completed');
  const failures=done.filter(x=>x.state!=='completed');
  const firstSettled=[...done].sort((a,b)=>a.settled_seq-b.settled_seq)[0]||null;
  const firstSuccess=[...successes].sort((a,b)=>a.settled_seq-b.settled_seq)[0]||null;
  let ready=false,status='waiting',winner=null,next_child_ref=null,handler_phase=null;
  switch(mode){
    case 'all':
      ready=failures.length>0||done.length===children.length;
      if(ready)status=failures.length?'failed':'completed';
      break;
    case 'allSettled':
      ready=done.length===children.length;
      if(ready)status='completed';
      break;
    case 'race':
      ready=!!firstSettled;
      winner=firstSettled;
      if(ready)status=winner.state==='completed'?'completed':'failed';
      break;
    case 'any':
      ready=!!firstSuccess||done.length===children.length;
      winner=firstSuccess;
      if(ready)status=winner?'completed':'failed';
      break;
    case 'quorum':
      ready=successes.length>=quorum||successes.length+(children.length-done.length)<quorum;
      if(ready)status=successes.length>=quorum?'completed':'failed';
      break;
    case 'then': case 'catch': case 'finally': {
      const only=children[0];
      ready=COMPLETED.has(only.state);
      if(ready){
        status=only.state==='completed'?'completed':'failed';
        handler_phase=mode==='finally'?'finally':
          (mode==='then'&&status==='completed')?'then':
          (mode==='catch'&&status==='failed')?'catch':'propagate';
      }
      break;
    }
    case 'fallback': {
      // Only the current candidate may decide fallback. Later candidates
      // are not considered until all earlier alternatives have failed.
      for(const child of children){
        if(child.state==='completed'){
          ready=true;winner=child;status='completed';break;
        }
        if(!COMPLETED.has(child.state)){
          next_child_ref=child.child_ref;break;
        }
      }
      if(!ready&&!next_child_ref){ready=true;status='failed';}
      break;
    }
    case 'sequence': {
      for(const child of children){
        if(child.state!=='completed'){
          if(COMPLETED.has(child.state)){
            ready=true;status='failed';
          }else next_child_ref=child.child_ref;
          break;
        }
      }
      if(!ready&&!next_child_ref){ready=true;status='completed';}
      break;
    }
  }
  const pending=children.filter(x=>!COMPLETED.has(x.state));
  return {ok:true,parent_ref,join_id,mode,ready,status,
    children,completed:done.length,successes:successes.length,
    failed:failures.length,expected:children.length,
    winner_child_ref:winner?.child_ref||null,
    winner_result_ref:winner?.result_ref||null,
    next_child_ref,handler_phase,
    quorum, cancel_remaining,
    remaining_refs:ready?pending.map(c=>c.child_ref):[],
    registration_ref:registration.idempotency_key};
}

/** A Promise race/any does NOT cancel losers by default. A persisted
 * cancel_remaining policy may explicitly request cooperative cancellation.
 * This event is written to the CHILD topic so its distributed worker can
 * discover it; the request itself does not assert that work has stopped.
 */
export function requestChildCancellation(store,{parent_ref,join_id,child_ref}={}){
  if(typeof store?.transaction!=='function'||!ref(parent_ref)||!ref(child_ref)||
     !validId(join_id))return failure('invalid_cancellation');
  const id=key('cancel-request',parent_ref,join_id,child_ref);
  const t=store.transaction(tx=>{
    const view=projectParentJoin(tx,{parent_ref,join_id});
    if(!view.ok||!view.ready||!view.cancel_remaining||
       !view.remaining_refs.includes(child_ref))
      return {ok:false,status:'cancellation_not_admitted_by_join'};
    const receipt=tx.append(fact({topic:child_ref,phase:CANCEL_REQUEST,id,
      refs:[view.registration_ref,view.winner_result_ref],data:{parent_ref,
        child_ref,join_id,cancellation_requested:true,work_stopped:false}}));
    if(!receipt.ok)throw Error(receipt.error||'cancel_request_failed');
    return {ok:true,status:'cancel_requested',duplicate:receipt.duplicate,
      receipt_ref:id};
  });
  return t.ok?t.value:failure('cancel_request_commit_failed');
}

/** Call only from the worker that actually acknowledged the cancellation.
 * A request is not an acknowledgement; a late completed result may win the
 * race and must never be erased or falsely called undone. */
export function acknowledgeChildCancellation(store,{parent_ref,join_id,child_ref,
  handler_receipt_ref}={}){
  if(typeof store?.transaction!=='function'||!ref(parent_ref)||!ref(child_ref)||
     !validId(join_id)||typeof handler_receipt_ref!=='string'||
     !handler_receipt_ref)return failure('invalid_acknowledgment');
  const requested=key('cancel-request',parent_ref,join_id,child_ref);
  const id=key('cancel-ack',parent_ref,join_id,child_ref);
  const t=store.transaction(tx=>{
    if(!tx.eventByIdempotency(requested))return {ok:false,status:'not_requested'};
    const previous=tx.eventByIdempotency(id);
    if(previous)return previous.payload.handler_receipt_ref===handler_receipt_ref
      ?{ok:true,status:'cancel_acknowledged',duplicate:true,receipt_ref:id}
      :{ok:false,status:'acknowledgment_conflict'};
    // Terminal child facts always take precedence. An acknowledgement
    // cannot rewrite completed external work as a successful cancellation.
    if(tx.listTopic(child_ref).some(e=>{
      const parsed=transitionFromSource(e,child_ref);
      return parsed&&COMPLETED.has(parsed.state);
    }))return {ok:false,status:'child_already_terminal'};
    const receipt=tx.append(fact({topic:child_ref,phase:CANCEL_ACK,id,
      refs:[requested,handler_receipt_ref],data:{parent_ref,join_id,child_ref,
        handler_receipt_ref,work_stopped:true}}));
    if(!receipt.ok)throw Error(receipt.error||'cancel_ack_failed');
    return {ok:true,status:'cancel_acknowledged',duplicate:false,receipt_ref:id};
  });
  return t.ok?t.value:failure('cancel_ack_commit_failed');
}

export function listPendingChildCancellationRequests(store,{child_ref}={}){
  if(typeof store?.listTopic!=='function'||!ref(child_ref))return [];
  const rows=store.listTopic(child_ref),acked=new Set(rows.filter(e=>
    e.payload?.profile===PACKET_PARENT_PROFILE&&e.payload.phase===CANCEL_ACK)
    .map(e=>e.payload.join_id+'\0'+e.payload.parent_ref));
  // A cancellation request is obsolete if the worker has already settled its
  // child, even if no cancellation acknowledgement was possible. Preserve the
  // original request for audit, but do not send STOP after work completed.
  const terminal=rows.some(e=>{
    const result=transitionFromSource(e,child_ref);
    return result&&COMPLETED.has(result.state);
  });
  if(terminal)return [];
  return rows.filter(e=>e.payload?.profile===PACKET_PARENT_PROFILE&&
    e.payload.phase===CANCEL_REQUEST&&
    !acked.has(e.payload.join_id+'\0'+e.payload.parent_ref)).map(e=>({
      child_ref,parent_ref:e.payload.parent_ref,join_id:e.payload.join_id,
      receipt_ref:e.idempotency_key}));
}

/** Advance a sequence/fallback program to the next child selected by
 * its durable policy. This is dispatch into the EXISTING COP handler route,
 * not an invented scheduler. A crash after intent but before receipt leaves
 * reconciliation pending instead of repeating an uncertain external effect.
 */
export async function dispatchNextParentChild(store,{parent_ref,join_id,dispatch}={}){
  if(typeof store?.transaction!=='function'||typeof dispatch!=='function')
    return failure('invalid_next_dispatch');
  const before=projectParentJoin(store,{parent_ref,join_id});
  if(!before.ok)return before;
  if(!['sequence','fallback'].includes(before.mode))
    return failure('next_dispatch_unsupported_mode');
  if(before.ready||!before.next_child_ref)
    return {ok:true,status:'no_next_child',ready:before.ready};
  const child_ref=before.next_child_ref;
  const intentKey=key('next-intent',parent_ref,join_id,child_ref);
  const receiptKey=key('next-dispatched',parent_ref,join_id,child_ref);
  const claim=store.transaction(tx=>{
    if(tx.eventByIdempotency(receiptKey))return {status:'already_dispatched'};
    if(tx.eventByIdempotency(intentKey))return {status:'needs_reconciliation'};
    const current=projectParentJoin(tx,{parent_ref,join_id});
    if(current.ready||current.next_child_ref!==child_ref)
      return {status:'next_changed'};
    const previous=current.children.filter(c=>COMPLETED.has(c.state));
    const record=tx.append(fact({topic:parent_ref,phase:NEXT_INTENT,id:intentKey,
      refs:[current.registration_ref,...previous.map(x=>x.notification_ref)],
      data:{parent_ref,join_id,child_ref}}));
    if(!record.ok)throw Error(record.error||'next_child_intent_failed');
    return {status:'reserved',view:current};
  });
  if(!claim.ok)return failure('next_child_intent_failed');
  if(claim.value.status!=='reserved')return {ok:claim.value.status==='already_dispatched',
    status:claim.value.status};
  let outcome;
  try{outcome=await dispatch({parent_ref,join_id,child_ref,
    view:claim.value.view,intent_receipt_ref:intentKey});}
  catch{return failure('needs_reconciliation')}
  if(outcome?.ok!==true||typeof outcome.receipt_ref!=='string'||!outcome.receipt_ref)
    return failure('needs_reconciliation');
  const saved=store.append(fact({topic:parent_ref,phase:NEXT_DISPATCHED,id:receiptKey,
    refs:[intentKey,outcome.receipt_ref],data:{parent_ref,join_id,child_ref,
      handler_receipt_ref:outcome.receipt_ref}}));
  if(!saved.ok)return failure('needs_reconciliation');
  return {ok:true,status:'next_child_dispatched',child_ref,receipt_ref:receiptKey};
}

/** Exactly-once continuation resumption request.  The actual handler is
 * still the existing COPScheduler; the caller injects its governed execute
 * callback. Unknown effects remain fenced rather than blindly re-executed.
 */
export async function resumeParentJoin(store,{parent_ref,join_id,execute}={}){
  if(typeof store?.transaction!=='function'||typeof execute!=='function')
    return failure('invalid_resume');
  const before=projectParentJoin(store,{parent_ref,join_id});
  if(!before.ok)return before;
  if(!before.ready)return {ok:true,status:'waiting',ready:false};
  const intentKey=key('resume-intent',parent_ref,join_id);
  const receiptKey=key('resumed',parent_ref,join_id);
  const claim=store.transaction(tx=>{
    if(tx.eventByIdempotency(receiptKey))return {status:'already_resumed'};
    if(tx.eventByIdempotency(intentKey))return {status:'needs_reconciliation'};
    const current=projectParentJoin(tx,{parent_ref,join_id});
    if(!current.ready)return {status:'waiting'};
    const record=tx.append(fact({topic:parent_ref,phase:INTENT,id:intentKey,
      refs:[current.registration_ref,...current.children.map(c=>c.notification_ref)],
      data:{parent_ref,join_id,status:current.status,ready:true}}));
    if(!record.ok)throw Error(record.error||'resume_intent_failed');
    return {status:'reserved',projection:current};
  });
  if(!claim.ok)return failure('resume_intent_failed');
  if(claim.value.status!=='reserved')return {ok:claim.value.status==='already_resumed',status:claim.value.status};
  let outcome;
  try{outcome=await execute(claim.value.projection)}
  catch{return failure('needs_reconciliation')}
  if(outcome?.ok!==true||typeof outcome.receipt_ref!=='string'||!outcome.receipt_ref)
    return failure('needs_reconciliation');
  const saved=store.append(fact({topic:parent_ref,phase:RESUMED,id:receiptKey,
    refs:[intentKey,outcome.receipt_ref],data:{parent_ref,join_id,
      status:claim.value.projection.status,handler_receipt_ref:outcome.receipt_ref}}));
  if(!saved.ok)return failure('needs_reconciliation');
  return {ok:true,status:'parent_resumed',receipt_ref:receiptKey,
    parent_status:claim.value.projection.status};
}


/** Find parents from their durable child links.  This is a derived index,
 * not a second source of truth or another scheduler. Existing CPS
 * child_dispatched events are accepted as native parent-child links.
 */
export function listLinkedPacketParents(store,{limit=100}={}){
  if(typeof store?.replay!=='function'||!Number.isSafeInteger(limit)||
     limit<1||limit>1000)throw new TypeError('bounded replay store required');
  const parents=new Set();
  for(const e of store.replay()){
    const p=e.payload||{};
    if((p.profile===PACKET_PARENT_PROFILE&&p.phase===LINK)||
       (p.profile==='cop.continuation-next-step/v1'&&p.phase==='child_dispatched')){
      if(ref(e.topic?.id))parents.add(e.topic.id);
    }
  }
  return [...parents].slice(0,limit);
}

/** A single resident reconciliation tick covers child notifications and
 * registered joins. The caller routes ready joins to the EXISTING scheduler
 * using execute(joinView); no LLM call is needed for a waiting join.
 */
export async function reconcilePacketParentContinuations(store,{execute=null,
  dispatchNext=null,max_parents=50,max_child_events=50}={}){
  if(typeof store?.replay!=='function'||
     (execute!==null&&typeof execute!=='function')||
     (dispatchNext!==null&&typeof dispatchNext!=='function')||
     !Number.isSafeInteger(max_parents)||max_parents<1||max_parents>1000||
     !Number.isSafeInteger(max_child_events)||max_child_events<1||max_child_events>1000)
    return failure('invalid_parent_reconciliation');
  const allParents=listLinkedPacketParents(store,{limit:1000});
  let notified=0,resumed=0,waiting=0,needs_reconciliation=0,
    cancellation_requests=0,next_dispatches=0;
  for(const parent_ref of allParents.slice(0,max_parents)){
    const check=reconcileParentChildStates(store,{parent_ref,max_events:max_child_events});
    if(!check.ok)return {...check,notified,resumed};
    notified+=check.notifications;
    const joins=store.listTopic(parent_ref).filter(e=>
      e.payload?.profile===PACKET_PARENT_PROFILE&&e.payload.phase===WAIT);
    for(const join of joins){
      const state=projectParentJoin(store,{parent_ref,join_id:join.payload.join_id});
      if(!state.ready){
        waiting++;
        if(dispatchNext&&state.next_child_ref){
          const advanced=await dispatchNextParentChild(store,{parent_ref,
            join_id:join.payload.join_id,dispatch:dispatchNext});
          if(advanced.status==='next_child_dispatched')next_dispatches++;
          if(advanced.status==='needs_reconciliation')needs_reconciliation++;
          else if(!advanced.ok)return {...advanced,notified,resumed,next_dispatches};
        }
        continue;
      }
      if(state.cancel_remaining){
        for(const child_ref of state.remaining_refs){
          const r=requestChildCancellation(store,{parent_ref,join_id:join.payload.join_id,child_ref});
          if(!r.ok)return {...r,notified,resumed,cancellation_requests};
          if(!r.duplicate)cancellation_requests++;
        }
      }
      if(!execute)continue;
      const r=await resumeParentJoin(store,{parent_ref,join_id:join.payload.join_id,
        execute:async view=>execute({parent_ref,join_id:join.payload.join_id,view})});
      if(r.status==='parent_resumed')resumed++;
      if(r.status==='needs_reconciliation')needs_reconciliation++;
    }
  }
  return {ok:needs_reconciliation===0,notified,resumed,waiting,cancellation_requests,
    next_dispatches,needs_reconciliation,
    parents:allParents.length,parents_scanned:Math.min(allParents.length,max_parents),
    parent_overflow:allParents.length>max_parents};
}
