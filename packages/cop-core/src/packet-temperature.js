/**
 * COP packet temperature and hierarchy projections (#190/#191).
 *
 * Separate dimensions: CognitivePacket.lifecycle ≠ processing temperature
 * ≠ retention. Events live in the EXISTING canonical COP Event Store.
 * No second queue, new scheduler, or separate lock database.
 */
import {createHash} from 'node:crypto';

export const PACKET_TEMPERATURE_PROFILE='cop.packet-temperature/v1';
export const PACKET_TEMPERATURES=Object.freeze(['active','suspended','parked','archived']);
const rank=Object.freeze({active:0,suspended:1,parked:2,archived:3});
const ref=x=>typeof x==='string'&&x.length>=3&&x.length<=256&&
  (x.startsWith('packet:')||x.startsWith('continuation:'));
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_:.-]{1,160}$/.test(x);
const key=(tag,...items)=>'cop-temperature:'+tag+':'+createHash('sha256')
  .update(items.join('\0')).digest('hex').slice(0,40);
const fail=(status)=>({ok:false,status});
function envelope(topic,id,phase,data,refs=[]){
  return {topic_id:topic,event_type:'cop.event/v1',actor_id:'cop:packet-temperature',
    subject_ref:topic,visibility:'restricted',epistemic_status:'decided',
    idempotency_key:id,causal_refs:refs.filter(Boolean),
    payload:{profile:PACKET_TEMPERATURE_PROFILE,phase,...data}};
}
function directState(rows){
  let temperature='active',deleted=false,retention='full',last_ref=null;
  for(const e of rows){
    const p=e.payload||{};
    if(p.profile!==PACKET_TEMPERATURE_PROFILE)continue;
    if(p.phase==='temperature_changed'&&Object.hasOwn(rank,p.temperature)){
      temperature=p.temperature;
      last_ref=e.idempotency_key;
    }else if(p.phase==='deleted'){
      deleted=true;
      retention='tombstone';
      last_ref=e.idempotency_key;
    }
  }
  return {temperature,deleted,retention,last_ref};
}
/** Derive the current parent/child DAG from pre-existing COP link events. */
export function packetLineageGraph(events){
  const children=new Map(),parents=new Map(),links=new Map();
  for(const e of events){
    const p=e.payload||{};
    let parent=null,child=null;
    if(p.profile==='cop.packet-parent-continuation/v1'&&p.phase==='child_linked'){
      parent=p.parent_ref||e.topic?.id;child=p.child_ref;
    }else if(p.profile==='cop.continuation-next-step/v1'&&
      p.phase==='child_dispatched'&&validId(p.child_continuation_id)){
      parent=e.topic?.id;child='continuation:'+p.child_continuation_id;
    }
    if(!ref(parent)||!ref(child)||parent===child)continue;
    if(!children.has(parent))children.set(parent,new Set());
    if(!parents.has(child))parents.set(child,new Set());
    children.get(parent).add(child);parents.get(child).add(parent);
    links.set(parent+'\0'+child,e.idempotency_key);
  }
  return {children,parents,links};
}
function descendants(graph,root){
  const results=[],visited=new Set(),path=new Set();
  function visit(node){
    if(path.has(node))throw Error('packet_lineage_cycle');
    if(visited.has(node))return;
    visited.add(node);path.add(node);
    for(const child of graph.children.get(node)||[]){
      visit(child);
      if(!results.includes(child)&&child!==root)results.push(child);
    }
    path.delete(node);
  }
  visit(root);
  return results;
}
/** Read temperature without changing business lifecycle or mandate status. */
export function projectPacketTemperature(store,{packet_ref}={}){
  if(typeof store?.replay!=='function'||typeof store?.listTopic!=='function'||!ref(packet_ref))
    return fail('invalid_packet_ref');
  const all=store.replay(),graph=packetLineageGraph(all);
  const direct=directState(store.listTopic(packet_ref));
  const blocked_by=new Set(),seen=new Set(),stack=[packet_ref];
  let effective=direct.temperature,deleted=direct.deleted;
  while(stack.length){
    const node=stack.pop();
    if(seen.has(node))continue;
    seen.add(node);
    if(node!==packet_ref){
      const state=directState(store.listTopic(node));
      if(state.deleted)deleted=true;
      if(rank[state.temperature]>rank[effective])effective=state.temperature;
      if(state.deleted||state.temperature!=='active')blocked_by.add(node);
    }
    for(const parent of graph.parents.get(node)||[])stack.push(parent);
  }
  return {ok:true,packet_ref,temperature:direct.temperature,
    effective_temperature:effective,deleted,retention:direct.retention,
    blocked_by:[...blocked_by].sort(),runnable:!deleted&&effective==='active',
    last_transition_ref:direct.last_ref};
}
/**
 * Durable barrier transition. Cooling cascades; warming is SELF-ONLY.
 * Child copies record independent barriers, so Resume(parent) NEVER
 * resumes children, even if they were forked while parent was cold.
 * The whole graph read + writes share one SQLite BEGIN IMMEDIATE claim lock.
 */
export function changePacketTemperature(store,{packet_ref,temperature,transition_id}={}){
  if(typeof store?.transaction!=='function'||!ref(packet_ref)||
    !Object.hasOwn(rank,temperature)||!validId(transition_id))
    return fail('invalid_temperature_transition');
  const id=key('transition',packet_ref,transition_id);
  const t=store.transaction(tx=>{
    if(typeof tx.replay!=='function')throw Error('atomic_lineage_replay_required');
    const existing=tx.eventByIdempotency(id);
    if(existing){
      const p=existing.payload||{};
      return p.temperature===temperature?
        {ok:true,status:'already_applied',duplicate:true,receipt_ref:id,affected:0}:
        fail('transition_conflict');
    }
    const graph=packetLineageGraph(tx.replay());
    const descendantsList=descendants(graph,packet_ref);
    const current=directState(tx.listTopic(packet_ref));
    if(current.deleted)return fail('packet_deleted');
    // Cooling is monotonic. A warmer target requires an explicit self resume.
    if(temperature!=='active'&&rank[current.temperature]>rank[temperature])
      return fail('would_implicitly_warm');
    const updated=[];
    const emit=(node,temp,source)=>{
      const eid=node===packet_ref?id:key('cascade',packet_ref,transition_id,node);
      const old=directState(tx.listTopic(node));
      if(old.deleted)return;
      const result=tx.append(envelope(node,eid,'temperature_changed',{
        temperature:temp,transition_id,initiated_by:packet_ref,
        scope:node===packet_ref?'self':'descendant',source},
      node===packet_ref?[]:[id,graph.links.get(packet_ref+'\0'+node)]));
      if(!result.ok)throw Error(result.error||'temperature_append_failed');
      updated.push(node);
    };
    // Snapshot every descendant that might be implicitly warmed by the
    // parent activation, including children linked during its suspension.
    if(temperature==='active'){
      if(current.temperature!=='active'){
        for(const child of descendantsList){
          const old=directState(tx.listTopic(child));
          if(!old.deleted&&rank[old.temperature]<rank[current.temperature])
            emit(child,current.temperature,'frozen_on_parent_resume');
        }
      }
      emit(packet_ref,'active','explicit_resume');
    }else{
      emit(packet_ref,temperature,'explicit_cooling');
      for(const child of descendantsList){
        const old=directState(tx.listTopic(child));
        if(!old.deleted&&rank[old.temperature]<rank[temperature])
          emit(child,temperature,'inherited_cooling');
      }
    }
    return {ok:true,status:'temperature_changed',duplicate:false,
      receipt_ref:id,temperature,affected:updated.length,descendants:descendantsList.length};
  });
  return t.ok?t.value:fail('temperature_commit_failed');
}

/** Logical deletion only. Canonical event history remains append-only.
 * A parent with live descendants cannot be deleted in one silent step.
 */
export function deletePacketLogically(store,{packet_ref,transition_id,reason='no_longer_relevant'}={}){
  if(typeof store?.transaction!=='function'||!ref(packet_ref)||
     !validId(transition_id)||typeof reason!=='string'||reason.length>512)
    return fail('invalid_deletion');
  const id=key('deleted',packet_ref,transition_id);
  const t=store.transaction(tx=>{
    if(typeof tx.replay!=='function')throw Error('atomic_lineage_replay_required');
    const existing=tx.eventByIdempotency(id);
    if(existing)return {ok:true,duplicate:true,status:'already_deleted',receipt_ref:id};
    const graph=packetLineageGraph(tx.replay());
    const kids=descendants(graph,packet_ref);
    if(kids.some(child=>!directState(tx.listTopic(child)).deleted))
      return fail('live_descendants_require_explicit_disposition');
    const prev=directState(tx.listTopic(packet_ref));
    if(prev.deleted)return {ok:true,status:'already_deleted',duplicate:true,
      receipt_ref:prev.last_ref};
    const result=tx.append(envelope(packet_ref,id,'deleted',{
      packet_ref,reason,retention:'tombstone',historical_events_preserved:true}));
    if(!result.ok)throw Error(result.error||'deletion_append_failed');
    return {ok:true,status:'deleted',duplicate:false,receipt_ref:id,
      retention:'tombstone'};
  });
  return t.ok?t.value:fail('deletion_commit_failed');
}

/** Read-only admission filter. Independent mandate/capacity/lease validation
 * STILL must happen at execution dispatch; temperature alone grants nothing.
 */
export function projectTemperatureReadyCandidates(store,{packet_refs=[]}={}){
  if(!Array.isArray(packet_refs)||packet_refs.length>10000||
     packet_refs.some(x=>!ref(x)))return fail('invalid_candidates');
  const ready=[],blocked=[];
  for(const packet_ref of [...new Set(packet_refs)]){
    const state=projectPacketTemperature(store,{packet_ref});
    if(!state.ok)return state;
    const record={packet_ref,temperature:state.temperature,
      effective_temperature:state.effective_temperature,blocked_by:state.blocked_by};
    if(state.runnable)ready.push(record);
    else blocked.push({...record,reason:state.deleted?'deleted':state.effective_temperature});
  }
  return {ok:true,ready,blocked,eligible_count:ready.length,
    // This is only a TEMPERATURE gate, not a complete ready-queue claim.
    mandate_and_capability_checked:false};
}

/** Only staging drafts that have NEVER entered canonical COP may be
 * garbage-collected without a tombstone. This is deliberately NOT a general
 * packet-store delete, and does not rewrite the append-only event log.
 */
export async function purgeUnpublishedDraft(store,{draft_ref,staging_store}={}){
  if(typeof store?.replay!=='function'||typeof draft_ref!=='string'||
     !draft_ref.startsWith('draft:')||!validId(draft_ref)||
     typeof staging_store?.deletePacket!=='function'||
     typeof staging_store?.hasPacket!=='function'||
     // Explicitly excludes ordinary shared PacketStores. Staging must be
     // exclusively owned for the whole check/delete interval.
     staging_store.staging_only!==true||staging_store.exclusive!==true)
    return fail('invalid_staged_draft');
  const all=store.replay();
  // Any canonical reference, including nested metadata or result receipts,
  // vetoes physical purge. Conservative false-positives are safe here.
  if(all.some(e=>JSON.stringify(e).includes(draft_ref)))
    return fail('draft_has_canonical_history');
  if(!(await staging_store.hasPacket(draft_ref)))return fail('draft_not_found');
  // A staging store requires exclusive ownership while this asynchronous
  // check and delete run. Do not operate on a concurrently writable store.
  const deleted=await staging_store.deletePacket(draft_ref);
  return deleted?{ok:true,status:'purged_unpublished_draft'}:fail('draft_purge_failed');
}
