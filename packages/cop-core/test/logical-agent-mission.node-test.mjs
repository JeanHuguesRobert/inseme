import test from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {declareLogicalAgent,transitionLogicalAgent} from '../src/logical-agent-composition.js';
import {dispatchLogicalAgentMission} from '../src/logical-agent-mission.js';
import {recordMandateDeclaration,recordMandateControl} from '../src/governed-act.js';
import {recordExecutionBudgetGrant,createEventSourcedExecutionBudgetLedger} from '../src/execution-budget.js';
import {projectPacketWorkAssignment} from '../src/packet-work-assignment.js';

const principal='principal:jhn',john='agent:jhn',twin='twin:jhn',
  member='agent:minesteggio:vulcain',parent='mandate:jhn:john-root';
const declared=()=>({agent_ref:member,twin_root_ref:twin,
  profile_ref:'profile:minesteggio:informatique',
  member_of:['organization:minesteggio'],
  reports_to:john,spawned_by:john,
  issued_by_ref:principal,declaration_id:'test-vulcain'});
function setup(){
  const store=createSqliteCopEventStore(':memory:');
  assert.equal(declareLogicalAgent(store,declared()).ok,true);
  assert.equal(transitionLogicalAgent(store,{agent_ref:member,
    to_status:'available',expected_revision:1,
    operation_id:'ready',issued_by_ref:principal}).ok,true);
  return store;
}
function budget(store,mandate_ref,id){
  recordExecutionBudgetGrant(store,{
    budget_id:id,mandate_ref,principal_ref:principal,
    limits:{max_steps:4}});
  return createEventSourcedExecutionBudgetLedger({
    store,budget_id:id,limits:{max_steps:4}});
}
function handler(){
  const h={id:'handler:magistral:vulcain',calls:0,
    async invoke(input){h.calls++;return {text:'analysis:'+input.agent_profile_ref,
      execution_usage:{max_steps:1}};}};
  return h;
}
test('supervised member performs a real COP governed Act with John authority, not a synthetic child mandate',async()=>{
  const s=setup();
  try{
    recordMandateDeclaration(s,{mandate_id:parent,principal_ref:principal,
      logical_agent_ref:john,scope:{allowed_actions:['host.process.run']}});
    const h=handler();
    const r=await dispatchLogicalAgentMission({store:s,
      agent_ref:member,packet_ref:'packet:minesteggio:first',
      mission_id:'mission:first',commissioned_by_agent_ref:john,
      identity:{principal_ref:principal,logical_agent_ref:john,mandate_ref:parent},
      capability:'host.process.run',handler:h,
      ledger:budget(s,parent,'budget:test:john'),
      demand:{max_steps:1},input:{prompt:'public synthetic reasoning'}});
    assert.equal(r.ok,true,JSON.stringify(r));
    assert.equal(r.execution_relation,'supervised_member_handler');
    assert.equal(r.authority_agent_ref,john);
    assert.equal(h.calls,1);
    assert.equal(r.receipt.logical_agent_ref,john);
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:'packet:minesteggio:first'})
      .responsible_agent_ref,member);
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close();}
});
test('declaration and available lifecycle are not authority: absent mandate denies before invoking provider',async()=>{
  const s=setup();
  try{
    const h=handler();
    const result=await dispatchLogicalAgentMission({store:s,
      agent_ref:member,packet_ref:'packet:minesteggio:denied',
      mission_id:'mission:denied',commissioned_by_agent_ref:john,
      identity:{principal_ref:principal,logical_agent_ref:john,
        mandate_ref:'mandate:missing'},capability:'host.process.run',
      handler:h,ledger:budget(s,'mandate:missing','budget:test:absent'),
      demand:{max_steps:1},input:{prompt:'none'}});
    assert.equal(result.ok,false);
    assert.equal(result.error,'mandate_not_found');
    assert.equal(h.calls,0);
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:'packet:minesteggio:denied'})
      .status,'unassigned');
  }finally{s.close();}
});
test('independently delegated child mandate works, revocation blocks future provider calls',async()=>{
  const s=setup();
  try{
    recordMandateDeclaration(s,{mandate_id:parent,principal_ref:principal,
      logical_agent_ref:john,scope:{allowed_actions:['host.process.run']}});
    const child='mandate:minesteggio:vulcain';
    recordMandateDeclaration(s,{mandate_id:child,principal_ref:principal,
      logical_agent_ref:member,parent_mandate_ref:parent,
      scope:{allowed_actions:['host.process.run']}});
    const ledger=budget(s,child,'budget:test:vulcain');
    const h=handler();
    const opts={store:s,agent_ref:member,
      packet_ref:'packet:minesteggio:autonomous',mission_id:'mission:autonomous',
      commissioned_by_agent_ref:john,
      identity:{principal_ref:principal,logical_agent_ref:member,mandate_ref:child},
      capability:'host.process.run',handler:h,ledger,demand:{max_steps:1}};
    const done=await dispatchLogicalAgentMission(opts);
    assert.equal(done.ok,true,JSON.stringify(done));
    assert.equal(done.execution_relation,'mandated_logical_agent');
    assert.equal(done.authority_agent_ref,member);
    assert.equal(h.calls,1);
    recordMandateControl(s,{principal_ref:principal,mandate_ref:child,
      action:'revoke',reason:'Reality Test'});
    const denied=await dispatchLogicalAgentMission({...opts,
      packet_ref:'packet:minesteggio:revoked',mission_id:'mission:revoked'});
    assert.equal(denied.ok,false);
    assert.equal(denied.error,'mandate_inactive');
    assert.equal(h.calls,1);
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close();}
});

