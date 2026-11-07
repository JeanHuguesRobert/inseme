import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryCopEventStore } from '../src/cop-event-spool.js';
import { recordMandateDeclaration, amendMandate, resolveMandate, evaluateMandate } from '../src/governed-act.js';
const principal='principal:alice', ref='mandate:alice:agent';
function setup(){
 const store=createMemoryCopEventStore();
 recordMandateDeclaration(store,{mandate_id:ref,version:'v1',principal_ref:principal,logical_agent_ref:'agent:alice',scope:{allowed_actions:['corpus.read']}});
 return store;
}
const approver=(proposal,proof)=>proof==='independent-signed-fixture'
 ? {verified:true,principal_ref:principal,evidence_ref:'test:sshsig:fixed-fixture'}:{verified:false};
const input={mandate_ref:ref,expected_version:'v1',principal_ref:principal,scope:{allowed_actions:['corpus.read','host.process.run']},reason:'Explicitly approved extension',approval:'independent-signed-fixture'};
test('amendment retains identity, append-only lineage and refuses stale versions',()=>{
 const store=setup();const first=store.replay()[0];
 const revised=amendMandate(store,input,{verifyPrincipalApproval:approver});
 assert.equal(revised.ok,true,JSON.stringify(revised));
 assert.equal(revised.version,'v2');assert.equal(revised.receipt.previous_event_id,first.event_id);
 assert.equal(store.replay().length,2);
 assert.equal(resolveMandate(store,ref).metadata?.amendment?.approval_evidence_ref,'test:sshsig:fixed-fixture');
 assert.deepEqual(resolveMandate(store,ref+'@v1').scope.allowed_actions,['corpus.read']);
 assert.deepEqual(resolveMandate(store,ref).scope.allowed_actions,['corpus.read','host.process.run']);
 assert.ok(['mandate_version_stale','mandate_version_mismatch'].includes(evaluateMandate(store,{mandate_ref:ref,version_pin:'v1',capability:'corpus.read'}).error));
 assert.equal(evaluateMandate(store,{mandate_ref:ref,version_pin:'v2',capability:'host.process.run'}).granted,true);
 assert.equal(amendMandate(store,input,{verifyPrincipalApproval:approver}).error,'mandate_version_conflict');
});
test('extension cannot self-authorize or spoof the Principal',()=>{
 for (const [patch,verifier,expected] of [
  [{},undefined,'independent_principal_approval_required'],
  [{principal_ref:'principal:mallory'},approver,'unauthorized_principal_amendment'],
  [{approval:'chat-utterance'},approver,'principal_approval_unverified'],
  [{reason:''},approver,'reason_required'],
  [{expected_version:'v0'},approver,'mandate_version_conflict']
 ]){
  const store=setup();assert.equal(amendMandate(store,{...input,...patch},{verifyPrincipalApproval:verifier}).error,expected);
  assert.equal(store.replay().length,1);
 }
});
