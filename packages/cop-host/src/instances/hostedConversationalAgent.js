/** A conversational agent is a digital-native actor, not its human subject/Twin.
 * Identity and COP event history survive changes of ChatGPT account, hosting or MCP.
 * This bootstrap does not authorize account access or grant any COP mandate.
 */
import {declareLogicalAgent,projectLogicalAgent} from '../../../cop-core/src/logical-agent-composition.js';

const ref=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,79}$/.test(x);
export function conversationalAgentIdentity(twin,{provider='openai',subtype='chatgpt'}={}){
  if(!twin?.id||!ref(twin.canonical_slug)||!/^twin:[a-z][a-z0-9-]+$/.test(twin.subject_root_ref||'')||
     twin.subject_kind!=='living_person'||provider!=='openai'||subtype!=='chatgpt')
    throw Error('invalid_personal_twin_or_provider');
  const slug=twin.canonical_slug;
  return {
    logical_agent_id:`agent:${slug}:chatgpt`,
    canonical_slug:`chatgpt-${slug}`,
    subject_ref:`agent:${slug}:chatgpt`,
    subject_root_ref:`agent:${slug}:chatgpt`,
    host_instance_id:twin.id,
    principal_id:twin.principal_id??null,
    twin_root_ref:twin.subject_root_ref,
    reports_to:`agent:${slug}`,
    display_name:`ChatGPT — ${twin.display_name}`,
    bot_name:'ChatGPT',
    provider,subtype,
  };
}

export async function ensureHostedConversationalAgent({adapter,store,twin_slug,apply=false,
  issued_by_ref='agent:jhn',source_ref='principal-instruction:2026-11-21'}={}){
  if(!ref(twin_slug))throw Error('invalid_twin_slug');
  const twin=await adapter.instanceBySlug(twin_slug);
  if(!twin)throw Error('personal_twin_not_found');
  const a=conversationalAgentIdentity(twin);
  const [bySlug,bySubject,logical,aliasOwner]=await Promise.all([
    adapter.instanceBySlug(a.canonical_slug),adapter.instanceBySubject(a.subject_ref),
    adapter.logicalAgentById(a.logical_agent_id),adapter.aliasOwner(a.canonical_slug)
  ]);
  if(bySlug&&bySubject&&bySlug.id!==bySubject.id)throw Error('agent_instance_identity_collision');
  const instance=bySlug??bySubject;
  if(instance && (instance.canonical_slug!==a.canonical_slug||instance.subject_ref!==a.subject_ref||
     instance.subject_root_ref!==a.subject_root_ref||instance.host_instance_id!==a.host_instance_id||
     instance.subject_kind!=='digital_native'||instance.is_claimable!==false||
     instance.principal_id!==a.principal_id))throw Error('agent_instance_conflict');
  if(aliasOwner&&aliasOwner!==instance?.id)throw Error('agent_alias_collision');
  if(logical&&(logical.logical_agent_id!==a.logical_agent_id||
     logical.twin_root_ref!==a.twin_root_ref||
     logical.instance_id && logical.instance_id!==instance?.id||
     logical.active_mandate_ref))throw Error('agent_projection_conflict');
  if(store){
    const prior=projectLogicalAgent(store,{agent_ref:a.logical_agent_id});
    if(!prior.ok)throw Error('agent_cop_projection_conflict');
    if(prior.exists&&(prior.twin_root_ref!==a.twin_root_ref||prior.reports_to!==a.reports_to||
       prior.profile_ref!=='profile:conversational.chatgpt'))throw Error('agent_cop_identity_conflict');
  }
  const result={ok:true,logical_agent_id:a.logical_agent_id,twin_slug,instance_id:instance?.id??null,
    hosted_by:a.host_instance_id,principal_bound:Boolean(a.principal_id),
    interface_role:'primary',connection:'not_connected',
    next:instance?'reconcile':'create'};
  if(!apply)return result;
  if(!store)throw Error('canonical_cop_event_store_required');
  // Append canonical evidence BEFORE projecting to Supabase. Retry after a
  // projection failure is safe and never rewrites the COP declaration.
  const declaration=declareLogicalAgent(store,{
    agent_ref:a.logical_agent_id,twin_root_ref:a.twin_root_ref,
    profile_ref:'profile:conversational.chatgpt',member_of:[a.twin_root_ref],
    reports_to:a.reports_to,spawned_by:issued_by_ref,
    issued_by_ref,source_ref,
    declaration_id:`chatgpt-primary-${twin_slug}`,
    activation_policy:'on_demand',
    metadata:{kind:'conversational',provider:a.provider,subtype:a.subtype,
      interface_role:'primary',account_binding:'not_verified',mcp_connection:'not_connected'}
  });
  if(!declaration.ok)throw Error('agent_cop_declaration:'+declaration.status);
  let created=instance;
  if(!created){
    created=await adapter.createInstance({
      canonical_slug:a.canonical_slug,display_name:a.display_name,bot_name:a.bot_name,
      subject_ref:a.subject_ref,subject_root_ref:a.subject_root_ref,
      host_instance_id:a.host_instance_id,principal_id:a.principal_id,
      subject_kind:'digital_native',is_claimable:false,
      deployment_kind:'personal',status:'provisional',
      metadata:{kind:'conversational',provider:a.provider,subtype:a.subtype,
        interface_role:'primary',twin_root_ref:a.twin_root_ref,
        account_binding:'not_verified',mcp_connection:'not_connected'}
    });
  }
  if(!aliasOwner)await adapter.createAlias({alias:a.canonical_slug,
    instance_id:created.id,is_primary:true,alias_kind:'canonical_slug',
    description:'Hosted conversational agent; not the Personal Twin'});
  if(!logical)await adapter.createLogicalAgent({
    logical_agent_id:a.logical_agent_id,logical_agent_name:a.display_name,
    status:'declared',twin_root_ref:a.twin_root_ref,instance_id:created.id,
    active_mandate_ref:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    metadata:JSON.stringify({kind:'conversational',provider:a.provider,subtype:a.subtype,
      interface_role:'primary',reports_to:a.reports_to,
      account_binding:'not_verified',mcp_connection:'not_connected',
      authority:'no_independent_mandate',cop_receipt_ref:declaration.receipt_ref})
  });
  else if(!logical.instance_id)await adapter.linkLogicalAgent(a.logical_agent_id,created.id);
  return {...result,instance_id:created.id,action:instance?'reconciled':'created',
    cop_receipt_ref:declaration.receipt_ref,cop_duplicate:declaration.duplicate===true,
    applied:true};
}
