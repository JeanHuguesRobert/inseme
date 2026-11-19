/**
 * Identity reality test for one human Principal, one root LogicalAgent,
 * and two DISTINCT provider/account-scoped conversational agents.
 *
 * These are SYNTHETIC identities; this fixture does not certify any real
 * ChatGPT account ownership or authenticate the current conversation.
 * A provider, model or handler label is never itself a logical agent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {assignPacketWork,ensurePacketWorkAssignment,
  projectPacketWorkAssignment} from '../src/packet-work-assignment.js';
import {linkPacketChild} from '../src/packet-parent-continuations.js';

test('one Principal delegates to John, which commissions two independent ChatGPT agents',()=>{
  const s=createSqliteCopEventStore(':memory:');
  try {
    const root='packet:principal-work';
    const personal='packet:personal-chatgpt-work';
    const professional='packet:professional-chatgpt-work';
    const initial=assignPacketWork(s,{
      packet_ref:root,assignment_id:'root-assignment',
      responsible_agent_ref:'agent:jhn',
      commissioned_by_principal_ref:'principal:human'});
    assert.equal(initial.status,'assigned');

    assert.equal(linkPacketChild(s,{parent_ref:root,child_ref:personal}).ok,true);
    assert.equal(linkPacketChild(s,{parent_ref:root,child_ref:professional}).ok,true);

    for(const [packet_ref,agent_ref] of [
      [personal,'agent:chatgpt:personal'],
      [professional,'agent:chatgpt:professional']]){
      const a=assignPacketWork(s,{packet_ref,
        assignment_id:'distinct-persona',
        responsible_agent_ref:agent_ref,
        commissioned_by_agent_ref:'agent:jhn'});
      assert.equal(a.status,'assigned');
    }
    const one=projectPacketWorkAssignment(s,{packet_ref:personal});
    const two=projectPacketWorkAssignment(s,{packet_ref:professional});
    assert.notEqual(one.responsible_agent_ref,two.responsible_agent_ref);
    assert.equal(one.commissioned_by_agent_ref,'agent:jhn');
    assert.equal(two.commissioned_by_agent_ref,'agent:jhn');
    assert.equal(one.revision,1);
    assert.equal(two.revision,1);

    const secondIdentityCannotOverwrite=assignPacketWork(s,{
      packet_ref:personal,assignment_id:'concurrent-other-account',
      responsible_agent_ref:'agent:chatgpt:professional',
      commissioned_by_agent_ref:'agent:jhn',expected_revision:0});
    assert.equal(secondIdentityCannotOverwrite.status,'stale_assignment_revision');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:personal})
      .responsible_agent_ref,'agent:chatgpt:personal');
    assert.equal(s.auditCommitments().ok,true);
  } finally {s.close();}
});
test('old work labeled only chatgpt cannot choose between separate accounts',()=>{
  const s=createSqliteCopEventStore(':memory:');
  try {
    const root='packet:root',legacy='packet:old-chatgpt-work';
    assert.equal(assignPacketWork(s,{packet_ref:root,
      assignment_id:'root',responsible_agent_ref:'agent:jhn',
      commissioned_by_principal_ref:'principal:human'}).ok,true);
    assert.equal(linkPacketChild(s,{parent_ref:root,child_ref:legacy}).ok,true);

    const migrated=ensurePacketWorkAssignment(s,{packet_ref:legacy,
      legacy_work:{source_ref:'source:old-issue',
        workerHandlerName:'chatgpt',
        provider:'openai',
        account_label:'personal-or-professional-unknown'}});
    assert.equal(migrated.status,'needs_judgment');
    const view=projectPacketWorkAssignment(s,{packet_ref:legacy});
    assert.equal(view.responsible_agent_ref,null);
    assert.equal(view.revision,0);
    assert.equal(ensurePacketWorkAssignment(s,{packet_ref:legacy}).status,'needs_judgment');
    assert.equal(s.listTopic(legacy)
      .filter(e=>e.payload.phase==='judgment_requested').length,1);
    assert.equal(s.auditCommitments().ok,true);
  } finally {s.close();}
});
