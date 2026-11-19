import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {assignPacketWork,ensurePacketWorkAssignment,
  projectPacketWorkAssignment,
  PACKET_WORK_ASSIGNMENT_PROFILE} from '../src/packet-work-assignment.js';
import {linkPacketChild} from '../src/packet-parent-continuations.js';
import {declarePacketTaskSteps,advancePacketTaskStep}
  from '../src/packet-task-step-cursor.js';

function withStore(run) {
  const s=createSqliteCopEventStore(':memory:');
  try{run(s);assert.equal(s.auditCommitments().ok,true);}
  finally{s.close();}
}
const parent_ref='packet:work-parent',child_ref='packet:work-child';
const assigned=(s,work='packet:work-a')=>assignPacketWork(s,{
  packet_ref:work,assignment_id:'initial',responsible_agent_ref:'agent:b',
  commissioned_by_agent_ref:'agent:a',expected_revision:0,
  source_ref:'source:mandate-1'});
test('explicit logical agent assignment is durable, projected and idempotent',()=>{
  withStore(s=>{
    const r=assigned(s);assert.equal(r.status,'assigned');
    assert.equal(assigned(s).status,'already_applied');
    const p=projectPacketWorkAssignment(s,{packet_ref:'packet:work-a'});
    assert.equal(p.status,'assigned');assert.equal(p.revision,1);
    assert.equal(p.responsible_agent_ref,'agent:b');
    assert.equal(p.commissioned_by_agent_ref,'agent:a');
    assert.equal(p.history.length,1);
    assert.equal(s.listTopic('packet:work-a').length,1);
  });
});
test('single logical agent is enforced under a shared SQLite CAS transaction',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cop-work-assignment-'));
  const path=join(dir,'shared.db');
  const a=createSqliteCopEventStore(path),b=createSqliteCopEventStore(path);
  try{
    assert.equal(assigned(a).ok,true);
    const one=assignPacketWork(a,{packet_ref:'packet:work-a',
      assignment_id:'transfer-1',expected_revision:1,
      responsible_agent_ref:'agent:c',commissioned_by_agent_ref:'agent:a'});
    const two=assignPacketWork(b,{packet_ref:'packet:work-a',
      assignment_id:'transfer-2',expected_revision:1,
      responsible_agent_ref:'agent:d',commissioned_by_agent_ref:'agent:a'});
    assert.equal(one.status,'transferred');
    assert.equal(two.status,'stale_assignment_revision');
    const view=projectPacketWorkAssignment(b,{packet_ref:'packet:work-a'});
    assert.equal(view.revision,2);assert.equal(view.responsible_agent_ref,'agent:c');
    assert.equal(view.history[1].revision,2);
    assert.equal(a.auditCommitments().ok,true);
  }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
test('the commissioned agent must be distinct; a root Principal can commission directly',()=>{
  withStore(s=>{
    const invalid=assignPacketWork(s,{packet_ref:'packet:invalid',
      assignment_id:'bad',responsible_agent_ref:'agent:john',
      commissioned_by_agent_ref:'agent:john'});
    assert.equal(invalid.status,'invalid_assignment');
    const root=assignPacketWork(s,{packet_ref:'packet:root',
      assignment_id:'root',responsible_agent_ref:'agent:john',
      commissioned_by_principal_ref:'principal:person-jhn'});
    assert.equal(root.ok,true);
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:'packet:root'})
      .commissioned_by_principal_ref,'principal:person-jhn');
  });
});
test('old packets with explicit typed historical evidence are assigned on reactivation',()=>{
  withStore(s=>{
    const r=ensurePacketWorkAssignment(s,{
      packet_ref:child_ref,
      legacy_work:{source_ref:'task:legacy-42',
        assignedLogicalAgentRef:'agent:b',
        commissionedByLogicalAgentRef:'agent:a'}});
    assert.equal(r.status,'assigned');
    assert.equal(r.revision,1);
    assert.equal(ensurePacketWorkAssignment(s,{packet_ref:child_ref})
      .status,'assigned');
  });
});
test('single parent work responsibility is deterministic commissioner evidence',()=>{
  withStore(s=>{
    assert.equal(assignPacketWork(s,{packet_ref:parent_ref,
      assignment_id:'parent-assign',responsible_agent_ref:'agent:a',
      commissioned_by_agent_ref:'agent:john'}).ok,true);
    assert.equal(linkPacketChild(s,{parent_ref,child_ref}).ok,true);
    const r=ensurePacketWorkAssignment(s,{packet_ref:child_ref,
      legacy_work:{source_ref:'task:legacy-child',
        assignedLogicalAgentRef:'agent:b'}});
    assert.equal(r.status,'assigned');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:child_ref})
      .commissioned_by_agent_ref,'agent:a');
  });
});
test('insufficient or contradictory evidence creates one Judgment request, never a guessed owner',()=>{
  withStore(s=>{
    const unknown=ensurePacketWorkAssignment(s,{packet_ref:child_ref,
      legacy_work:{source_ref:'task:legacy-99',
        workerHandlerName:'john-worker'}});
    assert.equal(unknown.status,'needs_judgment');
    assert.equal(unknown.judgment_requested,true);
    assert.equal(ensurePacketWorkAssignment(s,{packet_ref:child_ref})
      .judgment_requested,false);
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:child_ref})
      .responsible_agent_ref,null);
    assert.equal(s.listTopic(child_ref).filter(e=>
      e.payload.profile===PACKET_WORK_ASSIGNMENT_PROFILE).length,1);
    const later=assignPacketWork(s,{packet_ref:child_ref,
      assignment_id:'judgment-reviewed-1',
      responsible_agent_ref:'agent:b',
      commissioned_by_agent_ref:'agent:a',
      source_ref:'judgment:reviewed-1'});
    assert.equal(later.status,'assigned');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:child_ref})
      .status,'assigned');
  });
});
test('conflicting parent vs explicit commissioner produces a Judgment request',()=>{
  withStore(s=>{
    assert.equal(assignPacketWork(s,{packet_ref:parent_ref,
      assignment_id:'parent-assign',responsible_agent_ref:'agent:a',
      commissioned_by_agent_ref:'agent:john'}).ok,true);
    assert.equal(linkPacketChild(s,{parent_ref,child_ref}).ok,true);
    const r=ensurePacketWorkAssignment(s,{packet_ref:child_ref,
      legacy_work:{source_ref:'task:legacy-conflict',
        assignedLogicalAgentRef:'agent:b',
        commissionedByLogicalAgentRef:'agent:someone-else'}});
    assert.equal(r.status,'needs_judgment');
    const e=s.listTopic(child_ref).find(e=>e.payload.phase==='judgment_requested');
    assert.equal(e.payload.reason,'conflicting_explicit_evidence');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref:child_ref}).revision,0);
  });
});
test('legacy task step resumes: request for Judgment is additive and does not break existing work',()=>{
  withStore(s=>{
    const packet_ref='packet:step-legacy';
    assert.equal(declarePacketTaskSteps(s,{packet_ref,
      task_ref:'task:legacy',step_refs:['step:one'],plan_id:'plan:v1'}).ok,true);
    const r=advancePacketTaskStep(s,{packet_ref,task_ref:'task:legacy',
      expected_step_ref:'step:one',expected_version:0,
      transition_id:'resume-v1'});
    assert.equal(r.status,'completed');
    assert.equal(r.work_assignment_status,'needs_judgment');
    assert.equal(s.listTopic(packet_ref).filter(e=>
      e.payload.phase==='judgment_requested').length,1);
  });
});
test('legacy task step reactivation deterministically upgrades typed historical fields',()=>{
  withStore(s=>{
    const packet_ref='packet:step-legacy-known';
    assert.equal(declarePacketTaskSteps(s,{packet_ref,task_ref:'task:known',
      step_refs:['step:first'],plan_id:'plan:v1'}).ok,true);
    const r=advancePacketTaskStep(s,{packet_ref,task_ref:'task:known',
      expected_step_ref:'step:first',expected_version:0,
      transition_id:'resume-known',
      legacy_work:{source_ref:'task:known',assignedLogicalAgentRef:'agent:b',
        commissionedByLogicalAgentRef:'agent:a'}});
    assert.equal(r.status,'completed');
    assert.equal(r.work_assignment_status,'assigned');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref}).responsible_agent_ref,'agent:b');
  });
});
test('new packet task plan and explicit owner are atomically created',()=>{
  withStore(s=>{
    const packet_ref='packet:new-plan';
    const declared=declarePacketTaskSteps(s,{packet_ref,
      task_ref:'task:new',step_refs:['step:alpha'],plan_id:'plan:new',
      work_assignment:{assignment_id:'work-accepted',
        responsible_agent_ref:'agent:b',
        commissioned_by_agent_ref:'agent:a',source_ref:'work-order:new'}});
    assert.equal(declared.ok,true);
    assert.equal(declared.work_assignment_status,'assigned');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref}).revision,1);
    const resumed=advancePacketTaskStep(s,{packet_ref,task_ref:'task:new',
      expected_step_ref:'step:alpha',expected_version:0,
      transition_id:'advance-new'});
    assert.equal(resumed.status,'completed');
    assert.equal(resumed.work_assignment_status,'assigned');
    assert.equal(s.listTopic(packet_ref).filter(e=>
      e.payload.phase==='judgment_requested').length,0);
  });
});
test('invalid new owner/mandant rolls back task plan and assignment together',()=>{
  withStore(s=>{
    const packet_ref='packet:invalid-plan';
    const declared=declarePacketTaskSteps(s,{packet_ref,task_ref:'task:new',
      step_refs:['step:alpha'],plan_id:'plan:new',
      work_assignment:{assignment_id:'bad',responsible_agent_ref:'agent:b',
        commissioned_by_agent_ref:'agent:b'}});
    assert.equal(declared.status,'invalid_assignment');
    assert.equal(s.listTopic(packet_ref).length,0);
  });
});

test('a JudgmentHandler candidate is recorded with provenance but does not seize the work',async()=>{
  const {listPendingWorkAssignmentJudgments,preparePacketWorkAssignmentJudgment,
    runPacketWorkAssignmentJudgment}=await import('../src/packet-work-assignment.js');
  const s=createSqliteCopEventStore(':memory:');
  try{
    const packet_ref='packet:legacy-judgment';
    assert.equal(ensurePacketWorkAssignment(s,{packet_ref}).status,'needs_judgment');
    assert.equal(listPendingWorkAssignmentJudgments(s).count,1);
    const req=preparePacketWorkAssignmentJudgment(s,{packet_ref});
    assert.equal(req.ok,true);assert.equal(req.effect_authorized,false);
    let calls=0;
    const judge=async request=>{
      calls++;
      assert.equal(request.work_ref,packet_ref);
      return {status:'proposed',
        responsible_agent_ref:'agent:b',
        commissioned_by_agent_ref:'agent:a',
        evidence_refs:['source:reviewed-packet'],
        explanation:'A recorded work order identifies the responsible logical agent and its commissioner.',
        confidence:'high'};
    };
    const a=await runPacketWorkAssignmentJudgment(s,{
      packet_ref,judgment_result_id:'model-result-123',judge});
    assert.equal(a.status,'candidate_recorded');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref}).revision,0);
    const again=await runPacketWorkAssignmentJudgment(s,{
      packet_ref,judgment_result_id:'model-result-123',judge});
    assert.equal(again.status,'already_proposed');assert.equal(calls,1);
    assert.equal(listPendingWorkAssignmentJudgments(s).count,1);
    const admitted=assignPacketWork(s,{packet_ref,
      assignment_id:'admission-after-judgment',
      responsible_agent_ref:'agent:b',
      commissioned_by_agent_ref:'agent:a',
      source_ref:a.receipt_ref});
    assert.equal(admitted.ok,true);
    assert.equal(listPendingWorkAssignmentJudgments(s).count,0);
    assert.equal(s.auditCommitments().ok,true);
  }finally{s.close();}
});
test('a JudgmentHandler can decline to choose; no assignment is fabricated',async()=>{
  const {runPacketWorkAssignmentJudgment}=await import('../src/packet-work-assignment.js');
  const s=createSqliteCopEventStore(':memory:');
  try{
    const packet_ref='packet:legacy-unresolved';
    ensurePacketWorkAssignment(s,{packet_ref});
    const result=await runPacketWorkAssignmentJudgment(s,{
      packet_ref,judgment_result_id:'no-evidence',
      judge:async()=>({status:'undetermined',explanation:'Insufficient independent evidence'})});
    assert.equal(result.status,'needs_judgment');
    assert.equal(projectPacketWorkAssignment(s,{packet_ref}).revision,0);
    assert.equal(s.listTopic(packet_ref).length,1);
  }finally{s.close();}
});
test('retrying an earlier assignment after a transfer never reports the old agent as current',()=>{
  withStore(s=>{
    assert.equal(assigned(s).status,'assigned');
    assert.equal(assignPacketWork(s,{packet_ref:'packet:work-a',
      assignment_id:'transfer-1',expected_revision:1,
      responsible_agent_ref:'agent:c',commissioned_by_agent_ref:'agent:a'})
      .status,'transferred');
    const old=assigned(s);
    assert.equal(old.status,'superseded_assignment');
    assert.equal(old.current_responsible_agent_ref,'agent:c');
    assert.equal(old.current_revision,2);
  });
});
test('task, handler, session and principal references cannot impersonate agent identities',()=>{
  withStore(s=>{
    for(const bad of ['task:old','handler:chatgpt','session:42','principal:jhn']){
      const r=assignPacketWork(s,{packet_ref:'packet:bad-ref',assignment_id:'bad-'+bad.replace(':','-'),
        responsible_agent_ref:bad,commissioned_by_agent_ref:'agent:john'});
      assert.equal(r.status,'invalid_assignment');
    }
    assert.equal(s.listTopic('packet:bad-ref').length,0);
  });
});
