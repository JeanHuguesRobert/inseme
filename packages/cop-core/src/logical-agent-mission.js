/**
 * Dispatch one packet to a durable member of a composite Twin.
 *
 * The member's identity and assignment NEVER manufacture authority. In the
 * supervised phase John stays the responsible COP LogicalAgent and the member
 * is a named specialization of a replaceable execution handler. Once the
 * member has its own independently valid Mandate, the same route may use that
 * member as the responsible LogicalAgent.
 */
import {projectLogicalAgent} from './logical-agent-composition.js';
import {assignPacketWork,projectPacketWorkAssignment} from './packet-work-assignment.js';
import {evaluateMandate,invokeGovernedCapability} from './governed-act.js';

const ref=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/@-]{2,255}$/.test(x);
const fail=(status,extra={})=>({ok:false,status,called_provider:false,...extra});
export async function dispatchLogicalAgentMission({
  store,agent_ref,packet_ref,mission_id,commissioned_by_agent_ref,
  identity,capability,handler,ledger,demand,input={},source_ref=null,
}={}){
  if(!store||typeof store.transaction!=='function'||!ref(agent_ref)||
     !ref(packet_ref)||!packet_ref.startsWith('packet:')||
     !ref(mission_id)||!ref(commissioned_by_agent_ref)||
     !ref(identity?.principal_ref)||!ref(identity?.logical_agent_ref)||
     !ref(identity?.mandate_ref)||!ref(capability)||
     !ref(handler?.id)||typeof handler?.invoke!=='function'||
     !ledger||typeof ledger.reserve!=='function'||
     !demand||typeof demand!=='object'||
     source_ref!==null&&!ref(source_ref))
    return fail('invalid_mission');
  const actor=projectLogicalAgent(store,{agent_ref});
  if(!actor.ok)return fail(actor.status);
  if(!actor.exists)return fail('agent_not_declared');
  if(actor.status!=='available')return fail('agent_not_available',{agent_status:actor.status});
  const autonomous=identity.logical_agent_ref===agent_ref;
  const supervised=identity.logical_agent_ref===commissioned_by_agent_ref&&
    agent_ref!==identity.logical_agent_ref;
  if(!autonomous&&!supervised)return fail('agent_authority_mismatch');
  // Group membership and reportsTo are descriptive, never a grant.
  if(!autonomous&&actor.reports_to!==commissioned_by_agent_ref)
    return fail('supervision_not_declared');
  if(autonomous&&commissioned_by_agent_ref===agent_ref)
    return fail('self_commission_forbidden');
  const granted=evaluateMandate(store,{
    mandate_ref:identity.mandate_ref,
    version_pin:identity.version_pin??null,
    expected_principal_ref:identity.principal_ref,
    expected_actor_ref:identity.logical_agent_ref,
    capability,demand,
  });
  if(!granted.granted)return fail('mandate_refused',{error:granted.error});
  const prior=projectPacketWorkAssignment(store,{packet_ref});
  if(!prior.ok)return fail(prior.status);
  if(prior.status==='assigned'){
    if(prior.responsible_agent_ref!==agent_ref||
       prior.commissioned_by_agent_ref!==commissioned_by_agent_ref)
      return fail('assignment_conflict');
  }else{
    const assignment=assignPacketWork(store,{packet_ref,
      assignment_id:mission_id,responsible_agent_ref:agent_ref,
      commissioned_by_agent_ref,source_ref,expected_revision:prior.revision});
    if(!assignment.ok)return fail(assignment.status);
  }
  const result=await invokeGovernedCapability({store,ledger,handler,
    identity:{...identity,topic_id:packet_ref},
    capability,demand,
    input:{...input,assigned_agent_ref:agent_ref,
      authority_agent_ref:identity.logical_agent_ref,
      agent_profile_ref:actor.profile_ref},
    packet_id:packet_ref,
    idempotency_key:'twin-member:'+packet_ref+':'+mission_id,
  });
  return {...result,agent_ref,packet_ref,mission_id,
    authority_agent_ref:identity.logical_agent_ref,
    execution_relation:autonomous?'mandated_logical_agent':'supervised_member_handler',
    status:result.ok?'completed':result.called_provider?'execution_failed':'refused'};
}

