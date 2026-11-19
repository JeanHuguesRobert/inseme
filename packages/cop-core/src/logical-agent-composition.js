/**
 * Durable LogicalAgent identities and lifecycle on the COP EventStore.
 *
 * Identity, membership, reporting and runtime readiness are distinct from
 * COP Mandate authority and from concrete HandlerInstance execution. This
 * module cannot issue mandates or perform governed effects. Its event journal
 * is the source of truth; SQLite tables or UI lists are derived projections.
 *
 * First Reality Test: a personal Twin hosts the members of Minesteggio, but
 * neither Minesteggio nor any particular Principal is hard-coded here.
 */
import {createHash} from 'node:crypto';

export const LOGICAL_AGENT_COMPOSITION_PROFILE='cop.logical-agent-composition/v1';
const validRef=x=>typeof x==='string'&&x.length>=3&&x.length<=256&&
  /^[A-Za-z0-9][A-Za-z0-9_.:/@-]+$/.test(x);
const agentRef=x=>validRef(x)&&(x.startsWith('agent:')||
  x.startsWith('logical-agent:')||/^urn:[A-Za-z0-9_.-]+:agent:/.test(x));
const twinRef=x=>validRef(x)&&(x.startsWith('twin:')||
  /^urn:[A-Za-z0-9_.-]+:twin:/.test(x));
const token=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(x);
const plainObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=status=>({ok:false,status});
const key=(agent,operation)=>'cop-agent-composition:'+createHash('sha256')
  .update(agent+'\0'+operation).digest('hex').slice(0,40);
const legalTransitions={
  declared:['available','retired'],
  available:['hibernated','suspended','retired'],
  hibernated:['available','suspended','retired'],
  suspended:['available','retired'],
  retired:[],
};
function event(agent_ref,actor_ref,phase,operation_id,payload,source_ref=null){
  return {topic_id:agent_ref,event_type:'cop.event/v1',
    actor_ref,subject_ref:agent_ref,epistemic_status:'declared',
    visibility:'restricted',idempotency_key:key(agent_ref,operation_id),
    causal_refs:source_ref?[source_ref]:[],
    payload:{profile:LOGICAL_AGENT_COMPOSITION_PROFILE,phase,
      agent_ref,...payload}};
}
function normalizedDeclaration(input){
  if(!agentRef(input?.agent_ref)||!twinRef(input?.twin_root_ref)||
     !validRef(input?.profile_ref)||!agentRef(input?.reports_to)&&
       input?.reports_to!=null ||
     !Array.isArray(input?.member_of)||
     !input.member_of.every(validRef)||
     !validRef(input?.issued_by_ref)||
     !token(input?.declaration_id)||
     input?.spawned_by!=null&&!agentRef(input.spawned_by)||
     input?.memory_ref!=null&&!validRef(input.memory_ref)||
     input?.source_ref!=null&&!validRef(input.source_ref)||
     input?.reports_to===input?.agent_ref||
     input?.spawned_by===input?.agent_ref||
     input?.member_of.includes(input?.agent_ref)||
     new Set(input?.member_of).size!==input?.member_of.length||
     input?.metadata!==undefined&&!plainObject(input.metadata)){
    return null;
  }
  return {
    twin_root_ref:input.twin_root_ref,
    profile_ref:input.profile_ref,
    member_of:[...input.member_of],
    reports_to:input.reports_to??null,
    spawned_by:input.spawned_by??null,
    memory_ref:input.memory_ref??null,
    activation_policy:input.activation_policy??'on_demand',
    metadata:structuredClone(input.metadata??{}),
    issued_by_ref:input.issued_by_ref,
    declaration_id:input.declaration_id,
    source_ref:input.source_ref??null,
  };
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

/** Replay one agent's immutable journal, never derive identity from a handler. */
export function projectLogicalAgent(store,{agent_ref}={}){
  if(!agentRef(agent_ref)||typeof store?.listTopic!=='function')
    return fail('invalid_agent_ref');
  let revision=0,state=null,details=null,receipt_ref=null;
  const history=[];
  for(const e of store.listTopic(agent_ref)){
    const p=e.payload??{};
    if(p.profile!==LOGICAL_AGENT_COMPOSITION_PROFILE)continue;
    if(p.agent_ref!==agent_ref)return fail('agent_journal_conflict');
    if(!revision){
      if(p.phase!=='declared'||p.revision!==1||
         !normalizedDeclaration({...p.declaration,agent_ref}))
        return fail('agent_journal_conflict');
      details=structuredClone(p.declaration);
      state='declared';
    }else{
      if(p.phase!=='transitioned'||p.revision!==revision+1||
         p.from_status!==state||
         !legalTransitions[state]?.includes(p.to_status))
        return fail('agent_journal_conflict');
      state=p.to_status;
    }
    revision++;
    receipt_ref=e.idempotency_key??null;
    history.push({revision,phase:p.phase,status:state,
      receipt_ref,checkpoint_ref:p.checkpoint_ref??null,
      operation_id:p.operation_id??p.declaration?.declaration_id??null});
  }
  return {ok:true,exists:!!revision,agent_ref,status:state,revision,
    ...details,receipt_ref,history};
}

/**
 * Record a DECLARATION only. issued_by_ref is evidence of the asserted
 * declarant, NOT proof of authority; callers must use their governed COP
 * writing boundary before entering here. No Mandate is generated.
 */
export function declareLogicalAgent(store,input={}){
  const declaration=normalizedDeclaration(input);
  if(!declaration||typeof store?.transaction!=='function')
    return fail('invalid_agent_declaration');
  const t=store.transaction(tx=>{
    const previous=projectLogicalAgent(tx,{agent_ref:input.agent_ref});
    if(!previous.ok)return previous;
    const receipt_ref=key(input.agent_ref,'declare:'+declaration.declaration_id);
    const existing=tx.eventByIdempotency(receipt_ref);
    if(existing){
      return existing.payload?.phase==='declared'&&
        same(existing.payload.declaration,declaration)?
        {ok:true,status:'already_declared',revision:1,
          receipt_ref,duplicate:true}:fail('declaration_id_conflict');
    }
    if(previous.exists)return fail('agent_already_declared');
    const receipt=tx.append(event(input.agent_ref,declaration.issued_by_ref,
      'declared','declare:'+declaration.declaration_id,
      {revision:1,declaration},declaration.source_ref));
    if(!receipt.ok)throw Error(receipt.error||'agent_declaration_append_failed');
    return {ok:true,status:'declared',revision:1,receipt_ref,duplicate:false};
  });
  return t.ok?t.value:fail('agent_declaration_commit_failed');
}

/**
 * Record a lifecycle projection update, not a process launch, a memory
 * snapshot, a revocation of Mandate, or a grant of execution authority.
 * Hibernation records a checkpoint reference when available; it does not
 * assert that checkpoint bytes were successfully captured/restored.
 */
export function transitionLogicalAgent(store,{agent_ref,to_status,
  expected_revision,operation_id,issued_by_ref,source_ref=null,
  checkpoint_ref=null}={}){
  if(!agentRef(agent_ref)||!token(operation_id)||!validRef(issued_by_ref)||
     !Number.isSafeInteger(expected_revision)||expected_revision<1||
     !Object.hasOwn(legalTransitions,to_status)||
     source_ref!==null&&!validRef(source_ref)||
     checkpoint_ref!==null&&!validRef(checkpoint_ref)||
     typeof store?.transaction!=='function')
    return fail('invalid_agent_transition');
  const t=store.transaction(tx=>{
    const old=projectLogicalAgent(tx,{agent_ref});
    if(!old.ok)return old;
    if(!old.exists)return fail('agent_not_declared');
    const receipt_ref=key(agent_ref,'transition:'+operation_id);
    const previous=tx.eventByIdempotency(receipt_ref);
    if(previous){
      const p=previous.payload??{};
      return p.profile===LOGICAL_AGENT_COMPOSITION_PROFILE&&
        p.phase==='transitioned'&&p.to_status===to_status&&
        p.revision===expected_revision+1&&
        p.issued_by_ref===issued_by_ref&&
        (p.source_ref??null)===source_ref&&
        (p.checkpoint_ref??null)===checkpoint_ref?
        {ok:true,status:'already_applied',revision:p.revision,
          current_revision:old.revision,receipt_ref,duplicate:true}:
        fail('transition_id_conflict');
    }
    if(old.revision!==expected_revision)return fail('stale_agent_revision');
    if(!legalTransitions[old.status]?.includes(to_status))
      return fail('invalid_agent_transition');
    const receipt=tx.append(event(agent_ref,issued_by_ref,'transitioned',
      'transition:'+operation_id,{revision:old.revision+1,
        from_status:old.status,to_status,operation_id,
        issued_by_ref,checkpoint_ref,source_ref},source_ref));
    if(!receipt.ok)throw Error(receipt.error||'agent_transition_append_failed');
    return {ok:true,status:to_status,revision:old.revision+1,
      receipt_ref,duplicate:false};
  });
  return t.ok?t.value:fail('agent_transition_commit_failed');
}

/** Read-only membership projection: organization is NOT a Principal grant. */
export function listTwinLogicalAgents(store,{twin_root_ref,member_of=null}={}){
  if(!twinRef(twin_root_ref)||member_of!==null&&!validRef(member_of)||
     typeof store?.replay!=='function')return fail('invalid_agent_query');
  const ids=new Set();
  for(const e of store.replay()){
    if(e.payload?.profile===LOGICAL_AGENT_COMPOSITION_PROFILE&&
       e.payload?.phase==='declared'&&agentRef(e.payload.agent_ref))
      ids.add(e.payload.agent_ref);
  }
  const agents=[];
  for(const agent_ref of [...ids].sort()){
    const current=projectLogicalAgent(store,{agent_ref});
    if(!current.ok)return current;
    if(current.twin_root_ref===twin_root_ref&&
       (member_of===null||current.member_of.includes(member_of)))
      agents.push(current);
  }
  return {ok:true,twin_root_ref,member_of,agents};
}

