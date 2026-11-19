/**
 * Logical responsibility for existing Cognitive Packet work, projected from
 * the canonical COP EventStore.  An assignment is not an execution lease, a
 * PacketClaim, a Mandate, or an authorization to perform any external effect.
 *
 * Backward compatibility: historical packets are reconciled *on activation*.
 * Only explicit, non-conflicting logical-agent evidence produces an automatic
 * assignment; unknowns are recorded as a bounded Judgment request.  Work
 * remains executable while this additive projection is being adopted.
 */
import {createHash} from 'node:crypto';
import {packetLineageGraph} from './packet-temperature.js';

export const PACKET_WORK_ASSIGNMENT_PROFILE='cop.packet-work-assignment/v1';
const validRef=x=>typeof x==='string'&&x.length>=3&&x.length<=256&&
  /^[A-Za-z0-9][A-Za-z0-9_.:/@-]+$/.test(x);
const agentRef=x=>validRef(x)&&
  (x.startsWith('agent:')||x.startsWith('logical-agent:')||
   /^urn:[A-Za-z0-9_.-]+:agent:/.test(x));
const principalRef=x=>validRef(x)&&
  (x.startsWith('principal:')||x.startsWith('person:')||
   /^urn:[A-Za-z0-9_.-]+:principal:/.test(x));
const reasonId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(x);
const packetRef=x=>validRef(x)&&
  (x.startsWith('packet:')||x.startsWith('continuation:'));
const hash=(purpose,...parts)=>'cop-work-assignment:'+purpose+':'+createHash('sha256')
  .update(parts.join('\\0')).digest('hex').slice(0,40);
const fail=status=>({ok:false,status});
const validCommission=(who,principal,responsible)=>
  ((agentRef(who)&&principal==null&&who!==responsible)||
   (who==null&&principalRef(principal)));
function event(packet_ref,phase,key,data,causal_refs=[]){
  return {topic_id:packet_ref,event_type:'cop.event/v1',
    actor_id:'cop:work-assignment',subject_ref:packet_ref,
    epistemic_status:phase==='judgment_requested'||phase==='judgment_proposed'?'proposed':'decided',
    visibility:'restricted',idempotency_key:key,
    causal_refs:causal_refs.filter(Boolean),
    payload:{profile:PACKET_WORK_ASSIGNMENT_PROFILE,phase,...data}};
}
/** Reconstruct without assuming that a handler, GitHub assignee, or principal
 * is the logical agent responsible for work. */
export function projectPacketWorkAssignment(store,{packet_ref}={}){
  if(!packetRef(packet_ref)||typeof store?.listTopic!=='function')
    return fail('invalid_work_ref');
  let revision=0,responsible_agent_ref=null,commissioned_by_agent_ref=null,
    commissioned_by_principal_ref=null,receipt_ref=null,pending=false;
  const history=[];
  for(const e of store.listTopic(packet_ref)){
    const p=e.payload||{};
    if(p.profile!==PACKET_WORK_ASSIGNMENT_PROFILE)continue;
    if(p.phase==='judgment_requested'||p.phase==='judgment_proposed'){if(!revision)pending=true;continue;}
    if(p.phase!=='assigned'&&p.phase!=='transferred')
      return fail('unknown_assignment_event');
    if(p.revision!==revision+1||!agentRef(p.responsible_agent_ref)||
       !validCommission(p.commissioned_by_agent_ref??null,
          p.commissioned_by_principal_ref??null,p.responsible_agent_ref)||
       (revision===0&&p.phase!=='assigned')||
       (revision>0&&(p.phase!=='transferred'||
         p.previous_responsible_agent_ref!==responsible_agent_ref)))
      return fail('assignment_journal_conflict');
    revision=p.revision;
    responsible_agent_ref=p.responsible_agent_ref;
    commissioned_by_agent_ref=p.commissioned_by_agent_ref??null;
    commissioned_by_principal_ref=p.commissioned_by_principal_ref??null;
    receipt_ref=e.idempotency_key;
    history.push({revision,responsible_agent_ref,commissioned_by_agent_ref,
      commissioned_by_principal_ref,receipt_ref,source_ref:p.source_ref??null});
    pending=false;
  }
  return {ok:true,packet_ref,status:revision?'assigned':pending?
      'needs_judgment':'unassigned',
    revision,responsible_agent_ref,commissioned_by_agent_ref,
    commissioned_by_principal_ref,receipt_ref,history};
}
function appendAssignment(tx,{packet_ref,responsible_agent_ref,
  commissioned_by_agent_ref=null,commissioned_by_principal_ref=null,
  assignment_id,expected_revision=0,source_ref=null}){
  const old=projectPacketWorkAssignment(tx,{packet_ref});
  if(!old.ok)return old;
  const key=hash('change',packet_ref,assignment_id);
  const prev=tx.eventByIdempotency(key);
  if(prev){
    const p=prev.payload||{};
    return p.profile===PACKET_WORK_ASSIGNMENT_PROFILE&&
      p.responsible_agent_ref===responsible_agent_ref&&
      (p.commissioned_by_agent_ref??null)===commissioned_by_agent_ref&&
      (p.commissioned_by_principal_ref??null)===commissioned_by_principal_ref&&
      p.revision===expected_revision+1&&
      (p.source_ref??null)===source_ref?
      {ok:true,status:old.revision>p.revision?'superseded_assignment':'already_applied',
        revision:p.revision,current_revision:old.revision,
        current_responsible_agent_ref:old.responsible_agent_ref,
        receipt_ref:key,duplicate:true}:fail('assignment_id_conflict');
  }
  if(old.revision!==expected_revision)return fail('stale_assignment_revision');
  if(!agentRef(responsible_agent_ref)||
     !validCommission(commissioned_by_agent_ref,
       commissioned_by_principal_ref,responsible_agent_ref)||
     !reasonId(assignment_id)||(source_ref!==null&&!validRef(source_ref)))
    return fail('invalid_assignment');
  const phase=old.revision?'transferred':'assigned';
  const receipt=tx.append(event(packet_ref,phase,key,{
    packet_ref,revision:old.revision+1,responsible_agent_ref,
    commissioned_by_agent_ref,commissioned_by_principal_ref,
    previous_responsible_agent_ref:old.responsible_agent_ref,source_ref,
    assignment_id},[old.receipt_ref,source_ref]));
  if(!receipt.ok)throw Error(receipt.error||'assignment_append_failed');
  return {ok:true,status:phase,revision:old.revision+1,receipt_ref:key,
    duplicate:receipt.duplicate};
}
/** A synchronous transaction covers read/compare/append, including transfers.
 * This records responsibility, not authority; caller's mandate is separate. */
export function assignPacketWork(store,options={}){
  if(!packetRef(options.packet_ref)||
     typeof store?.transaction!=='function')return fail('invalid_work_ref');
  const t=store.transaction(tx=>appendAssignment(tx,options));
  return t.ok?t.value:fail('assignment_commit_failed');
}
function collectLegacyEvidence(tx,packet_ref,legacy_work){
  // Do not invent an owner from a handler name, issue assignee, or Task status.
  // Only caller-supplied typed historical fields with a source ref count.
  const evidence=[],responsibles=new Set(),commissioners=new Set();
  const source=legacy_work?.source_ref;
  if(validRef(source)){
    const responsible=legacy_work.assignedLogicalAgentRef;
    const commissioner=legacy_work.commissionedByLogicalAgentRef;
    const principal=legacy_work.commissionedByPrincipalRef;
    if(agentRef(responsible)){
      responsibles.add(responsible);
      evidence.push({field:'assignedLogicalAgentRef',value:responsible,source_ref:source});
    }
    if(agentRef(commissioner)){
      commissioners.add('agent|'+commissioner);
      evidence.push({field:'commissionedByLogicalAgentRef',value:commissioner,source_ref:source});
    }
    if(principalRef(principal)){
      commissioners.add('principal|'+principal);
      evidence.push({field:'commissionedByPrincipalRef',value:principal,source_ref:source});
    }
  }
  // A child with exactly ONE parent has an explicit commissioning relation:
  // parent responsibility is the sender of the bounded sub-work. It is not
  // copied as the child's responsible agent or as its effective mandate.
  if(typeof tx.replay==='function'){
    const parents=[...(packetLineageGraph(tx.replay()).parents.get(packet_ref)||[])];
    if(parents.length===1){
      const parent=projectPacketWorkAssignment(tx,{packet_ref:parents[0]});
      if(parent.ok&&parent.status==='assigned'){
        commissioners.add('agent|'+parent.responsible_agent_ref);
        evidence.push({field:'parent_responsible_agent',
          value:parent.responsible_agent_ref,source_ref:parent.receipt_ref});
      }
    }
  }
  return {evidence,responsibles:[...responsibles],commissioners:[...commissioners]};
}
function ensureInTransaction(tx,{packet_ref,legacy_work=null}={}){
  const existing=projectPacketWorkAssignment(tx,{packet_ref});
  if(!existing.ok||existing.status==='assigned')return existing;
  const found=collectLegacyEvidence(tx,packet_ref,legacy_work);
  const [responsible]=found.responsibles;
  const [commission]=found.commissioners;
  if(found.responsibles.length===1&&found.commissioners.length===1){
    const [kind,ref]=commission.split('|');
    if(kind==='principal'||ref!==responsible){
      // One immutable receipt per packet for the first reactivation, even
      // across restarts. A subsequently accepted Judgment uses a new ID.
      return appendAssignment(tx,{packet_ref,
        responsible_agent_ref:responsible,
        commissioned_by_agent_ref:kind==='agent'?ref:null,
        commissioned_by_principal_ref:kind==='principal'?ref:null,
        assignment_id:'legacy-deterministic-v1',expected_revision:0,
        source_ref:found.evidence[0]?.source_ref||null});
    }
  }
  const key=hash('judgment',packet_ref,'legacy-v1');
  const previous=tx.eventByIdempotency(key);
  if(!previous){
    const receipt=tx.append(event(packet_ref,'judgment_requested',key,{
      packet_ref,required_fields:['responsible_agent_ref',
        'commissioned_by_agent_ref OR commissioned_by_principal_ref'],
      reason:found.responsibles.length>1||found.commissioners.length>1?
        'conflicting_explicit_evidence':'insufficient_explicit_evidence',
      // Evidence is references and field names, not private document bodies.
      evidence:found.evidence,
      judgment_kind:'work_assignment',
      effect_authorized:false,
    },found.evidence.map(x=>x.source_ref)));
    if(!receipt.ok)throw Error(receipt.error||'assignment_judgment_append_failed');
  }
  return {ok:true,status:'needs_judgment',packet_ref,revision:0,
    receipt_ref:key,judgment_requested:!previous,
    evidence:found.evidence};
}
/** Lazy repair for old packets: ambiguity is a typed Judgment demand, never
 * a guessed assignment. A future LLM candidate requires separate review and
 * an authorized assignPacketWork call to turn it into a recorded decision. */
export function ensurePacketWorkAssignment(store,{packet_ref,legacy_work=null}={}){
  if(!packetRef(packet_ref)||typeof store?.transaction!=='function')
    return fail('invalid_work_ref');
  const t=store.transaction(tx=>ensureInTransaction(tx,{packet_ref,legacy_work}));
  return t.ok?t.value:fail('assignment_ensure_failed');
}
export {ensureInTransaction as ensurePacketWorkAssignmentWithinTransaction};
export {appendAssignment as assignPacketWorkWithinTransaction};

/** Expose unresolved historic work to an existing COP JudgmentHandler.
 * This is a read-only projection over the canonical event journal, not a
 * second task queue, and never routes private evidence to a model by itself.
 */
export function listPendingWorkAssignmentJudgments(store,{limit=100}={}){
  if(typeof store?.replay!=='function'||typeof store?.listTopic!=='function'||
     !Number.isSafeInteger(limit)||limit<1||limit>1000)
    return fail('invalid_judgment_scan');
  const topics=new Set();
  for(const e of store.replay()){
    if(e.payload?.profile===PACKET_WORK_ASSIGNMENT_PROFILE&&
       e.payload.phase==='judgment_requested'&&packetRef(e.topic?.id))
      topics.add(e.topic.id);
  }
  const pending=[];
  for(const packet_ref of topics){
    const state=projectPacketWorkAssignment(store,{packet_ref});
    if(state.ok&&state.status==='needs_judgment'){
      const request=store.listTopic(packet_ref).find(e=>
        e.payload?.profile===PACKET_WORK_ASSIGNMENT_PROFILE&&
        e.payload.phase==='judgment_requested');
      pending.push({packet_ref,request_receipt_ref:request?.idempotency_key??null,
        reason:request?.payload?.reason||'undetermined'});
    }
  }
  return {ok:true,pending:pending.slice(0,limit),count:pending.length};
}
export function preparePacketWorkAssignmentJudgment(store,{packet_ref}={}){
  const state=projectPacketWorkAssignment(store,{packet_ref});
  if(!state.ok)return state;
  if(state.status==='assigned')return fail('assignment_already_resolved');
  const request=store.listTopic(packet_ref).find(e=>
    e.payload?.profile===PACKET_WORK_ASSIGNMENT_PROFILE&&
    e.payload.phase==='judgment_requested');
  if(!request)return fail('judgment_not_requested');
  return {ok:true,
    schema:'cop.work-assignment-judgment-request/v1',
    work_ref:packet_ref,request_receipt_ref:request.idempotency_key,
    reason:request.payload.reason,
    evidence:request.payload.evidence,
    task:'Identify one responsible logical agent AND one commissioning agent, or an actual root Principal. Analyze cited evidence, never equate handler, GitHub assignee or Twin with a logical responsible agent by default. Refuse to guess; return undetermined on material ambiguity.',
    expected_result:{
      status:'proposed | undetermined',
      responsible_agent_ref:'agent:...',
      commissioned_by_agent_ref:'agent:... | null',
      commissioned_by_principal_ref:'principal:... | null',
      evidence_refs:['source:...'],
      explanation:'reasoned basis',
      confidence:'high | medium | low',
    },
    effect_authorized:false,
  };
}
/** The LLM is injected through an existing JudgmentHandler/transport. Its
 * answer is only a proposal: it MUST NOT automatically issue a mandate,
 * change an existing assignment or act as proof of a Principal decision. */
export async function runPacketWorkAssignmentJudgment(store,{
  packet_ref,judgment_result_id,judge}={}){
  if(!packetRef(packet_ref)||!reasonId(judgment_result_id)||
     typeof judge!=='function'||typeof store?.transaction!=='function')
    return fail('invalid_judgment_invocation');
  const key=hash('candidate',packet_ref,judgment_result_id);
  const previously=store.eventByIdempotency?.(key);
  if(previously)return {ok:true,status:'already_proposed',duplicate:true,receipt_ref:key};
  const request=preparePacketWorkAssignmentJudgment(store,{packet_ref});
  if(!request.ok)return request;
  const candidate=await judge(request);
  if(candidate?.status==='undetermined')
    return {ok:true,status:'needs_judgment',packet_ref,
      reason:candidate.explanation||'judgment_undetermined'};
  if(candidate?.status!=='proposed'||
     !agentRef(candidate.responsible_agent_ref)||
     !validCommission(candidate.commissioned_by_agent_ref??null,
       candidate.commissioned_by_principal_ref??null,
       candidate.responsible_agent_ref)||
     !Array.isArray(candidate.evidence_refs)||
     candidate.evidence_refs.some(r=>!validRef(r))||
     typeof candidate.explanation!=='string'||
     candidate.explanation.length<10||candidate.explanation.length>4000||
     !['high','medium','low'].includes(candidate.confidence))
    return fail('invalid_judgment_candidate');
  const t=store.transaction(tx=>{
    const old=projectPacketWorkAssignment(tx,{packet_ref});
    if(!old.ok)return old;
    if(old.status==='assigned')return fail('assignment_already_resolved');
    const prev=tx.eventByIdempotency(key);
    if(prev)return {ok:true,status:'already_proposed',duplicate:true,receipt_ref:key};
    const saved=tx.append(event(packet_ref,'judgment_proposed',key,{
      packet_ref,judgment_result_id,request_receipt_ref:request.request_receipt_ref,
      proposal:{
        responsible_agent_ref:candidate.responsible_agent_ref,
        commissioned_by_agent_ref:candidate.commissioned_by_agent_ref??null,
        commissioned_by_principal_ref:candidate.commissioned_by_principal_ref??null,
        evidence_refs:candidate.evidence_refs,
        explanation:candidate.explanation,confidence:candidate.confidence,
      },
      effect_authorized:false,
    },[request.request_receipt_ref,...candidate.evidence_refs]));
    if(!saved.ok)throw Error(saved.error||'judgment_candidate_append_failed');
    return {ok:true,status:'candidate_recorded',receipt_ref:key,
      packet_ref,revision:0,requires_admission:true};
  });
  return t.ok?t.value:fail('judgment_candidate_commit_failed');
}
