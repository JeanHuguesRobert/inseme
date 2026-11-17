/**
 * CPKT-2026-010 H4: preserve COP evidence across independently opened SQLite
 * localities. This tests transport of HISTORICAL events and projections, not
 * the transfer of mandates or authority to perform a new Act in the destination.
 * No provider, network, token, production database, new ledger or scheduler.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {createEventSourcedExecutionBudgetLedger,recordExecutionBudgetGrant} from '../src/execution-budget.js';

const budgetId='cpkt010-history';
const limits={max_steps:4};
const budget=(store,id=budgetId)=>createEventSourcedExecutionBudgetLedger({
  store,budget_id:id,limits,require_authority_grant:true,
});

test('H4: COP historical journal, causal refs and settled budget survive independent locality replay',()=>{
  const root=mkdtempSync(join(tmpdir(),'cop-history-transfer-'));
  let origin,destination;
  try{
    origin=createSqliteCopEventStore(join(root,'origin.sqlite'));
    const granted=recordExecutionBudgetGrant(origin,{
      budget_id:budgetId,mandate_ref:'mandate:fixture:source-locality',
      principal_ref:'principal:fixture',limits,
    });
    assert.equal(granted.ok,true,JSON.stringify(granted));
    const sourceBudget=budget(origin);
    const reserved=sourceBudget.reserve({
      idempotency_key:'fixture:invoke:once',
      expected_version:sourceBudget.snapshot().version,
      demand:{max_steps:2},
    });
    assert.equal(reserved.ok,true,JSON.stringify(reserved));
    const settled=sourceBudget.settle({
      reservation_id:reserved.reservation.reservation_id,
      expected_version:sourceBudget.snapshot().version,
      usage:{max_steps:1},
      idempotency_key:'fixture:invoke:settled',
    });
    assert.equal(settled.ok,true,JSON.stringify(settled));

    const observation=origin.append({
      topic_id:'continuation:ctn_cpkt010_h4_fixture',
      event_type:'cop.event/v1',
      actor_id:'fixture:interpreter',
      subject_ref:'continuation:ctn_cpkt010_h4_fixture',
      idempotency_key:'fixture:judgment:returned',
      payload:{profile:'cop.continuation-result/v1',phase:'returned',
        candidate_result:{status:'answered',result:{
          answer:'{"decision":"source","reason":"Public fixture"}',
        }}},
    });
    assert.equal(observation.ok,true,JSON.stringify(observation));
    const reentry=origin.append({
      topic_id:'continuation:ctn_cpkt010_h4_fixture',
      event_type:'cop.event/v1',
      actor_id:'fixture:local-resumer',
      subject_ref:'continuation:ctn_cpkt010_h4_fixture',
      idempotency_key:'fixture:reentry:confirmed',
      causal_refs:['fixture:judgment:returned'],
      payload:{profile:'cop.continuation-resumption/v1',phase:'resumed',
        local_resume_receipt_ref:'fixture:sqlite-slot:sha256:verified'},
    });
    assert.equal(reentry.ok,true,JSON.stringify(reentry));
    const audit=origin.auditCommitments();
    assert.equal(audit.ok,true);
    const originalEvents=origin.replay();
    const originalHeads=Object.fromEntries(
      [...new Set(originalEvents.map(e=>e.topic.id))].map(t=>
        [t,origin.topicCommitment(t)]),
    );

    // The transport is serialized by value, not shared SQLite state or
    // provider-specific session identity.
    const transported=JSON.parse(JSON.stringify(originalEvents));
    destination=createSqliteCopEventStore(join(root,'independent.sqlite'));
    const imported=destination.appendBatch(transported);
    assert.equal(imported.ok,true,JSON.stringify(imported));
    assert.deepEqual(destination.replay(),originalEvents);
    assert.equal(destination.auditCommitments().ok,true);
    for(const [topic,head] of Object.entries(originalHeads)){
      assert.deepEqual(destination.topicCommitment(topic),head);
    }
    const destinationBudget=budget(destination);
    assert.equal(sourceBudget.snapshot().settled.max_steps,1);
    assert.equal(destinationBudget.snapshot().settled.max_steps,1);
    assert.equal(destinationBudget.snapshot().reserved.max_steps,0);
    assert.equal(destinationBudget.snapshot().available.max_steps,3);
    const localReentry=destination.eventByIdempotency('fixture:reentry:confirmed');
    assert.deepEqual(localReentry.parent_event_ids,['fixture:judgment:returned']);
    assert.equal(localReentry.payload.phase,'resumed');

    // Re-import of identical history cannot create a second posting.
    const duplicate=destination.appendBatch(transported);
    assert.equal(duplicate.ok,true);
    assert.ok(duplicate.results.every(r=>r.duplicate===true));
    assert.deepEqual(destinationBudget.snapshot().settled,sourceBudget.snapshot().settled);
    assert.deepEqual(destination.replay(),originalEvents);

    // Altered payload with stale hash must not cross the integrity boundary.
    const forged={...transported.find(e=>e.idempotency_key==='fixture:reentry:confirmed'),
      event_id:'fixture:forged-event',
      idempotency_key:'fixture:forged-idempotency',
      topic:{id:'continuation:ctn_cpkt010_h4_fixture',seq:0},
      payload:{phase:'resumed',local_resume_receipt_ref:'fixture:counterfeit'}};
    const before=destination.auditCommitments();
    const denied=destination.appendBatch([forged]);
    assert.equal(denied.ok,false,'tampered history may not be accepted');
    assert.deepEqual(destination.auditCommitments(),before);
    assert.deepEqual(destination.replay(),originalEvents);

    // A historical grant for the SOURCE cannot authorize an unrelated NEW
    // destination budget. Real transfer requires independently verified local
    // control; this test does not claim to implement that admission step.
    const newLocalBudget=budget(destination,'cpkt010-destination-new-act');
    const refused=newLocalBudget.reserve({
      idempotency_key:'fixture:destination:new-act',
      expected_version:newLocalBudget.snapshot().version,
      demand:{max_steps:1},
    });
    assert.equal(refused.ok,false);
    assert.equal(destination.auditCommitments().ok,true);
  }finally{
    destination?.close();
    origin?.close();
    rmSync(root,{recursive:true,force:true});
  }
});
