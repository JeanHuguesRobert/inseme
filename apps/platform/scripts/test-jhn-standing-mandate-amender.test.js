import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryCopEventStore} from '../../../packages/cop-core/src/cop-event-spool.js';
import {recordMandateDeclaration,resolveMandate} from '../../../packages/cop-core/src/governed-act.js';
import {createJhnStandingMandateAmender} from './lib/jhn-standing-mandate-amender.js';
import {JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mandate='mandate:jhn:agent:1';
const accessToken='TEST_TOKEN_DO_NOT_LOG';
const instanceClient={from(n){assert.equal(n,'instances');return {select(){return {eq(){return {single:async()=>({data:{id:JHN_VAULT_INSTANCE_ID,canonical_slug:'jhn',status:'autonomous',principal_id:owner},error:null})}}}}}}};
const authClient={auth:{getUser:async(token)=>({data:{user:{id:token===accessToken?owner:'different',
  email_confirmed_at:'2026-11-13T00:00:00Z',is_anonymous:false}}})}};
const scope={allowed_actions:['corpus.read','git.write'],repos:['JeanHuguesRobert/*']};
const proposal={mandate_ref:mandate,expected_version:'v1',principal_ref:'principal:jhn',
  scope,reason:'Principal approves all owned repositories'};
const approval='trusted-web-approval-fixture';
function setup(){
 const store=createMemoryCopEventStore();
 recordMandateDeclaration(store,{mandate_id:mandate,version:'v1',principal_ref:'principal:jhn',
  logical_agent_ref:'agent:jhn',scope:{allowed_actions:['corpus.read']}});
 return store;
}
function adapter(store,override={}){
 return createJhnStandingMandateAmender({store,authClient,instanceClient,
  verifyApproval:({proposal:exact,evidence,principal_ref})=>
    evidence===approval && principal_ref==='principal:jhn' &&
    exact.mandate_ref===mandate && exact.previous_version==='v1' &&
    JSON.stringify(exact.scope)===JSON.stringify(scope)
      ? {verified:true,principal_ref,evidence_ref:'test:independent-web-approval',scheme:'fixture'}
      : {verified:false},
  ...override});
}
test('valid owner session plus independently verified exact proposal amends append-only',async()=>{
 const store=setup();
 const result=await adapter(store).amend({session:{accessToken},proposal,approval});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.version,'v2');
 assert.equal(store.replay().length,2);
 assert.deepEqual(resolveMandate(store,mandate).scope,scope);
 assert.deepEqual(resolveMandate(store,mandate+'@v1').scope.allowed_actions,['corpus.read']);
 assert.equal(JSON.stringify(result).includes(accessToken),false);
});
test('missing verifier, unverified session and missing approval cannot mutate',async()=>{
 for(const overrides of [
  {verifyApproval:null},
  {},
  {}
 ]){
  const store=setup();
  const amender=adapter(store,overrides);
  const result=await amender.amend({
   session: overrides.verifyApproval===null?{accessToken}:{accessToken:overrides===undefined?accessToken:'WRONG'},
   proposal,approval
  });
  assert.equal(result.ok,false);
  assert.equal(store.replay().length,1);
 }
 const store=setup();
 const result=await adapter(store).amend({session:{accessToken},proposal,approval:'unapproved'});
 assert.equal(result.ok,false);
 assert.equal(store.replay().length,1);
});
test('scope tampering, stale version, wrong Principal and no canonical mandate fail closed',async()=>{
 for(const edited of [
  {...proposal,scope:{...scope,repos:['*']}},
  {...proposal,expected_version:'v0'},
  {...proposal,principal_ref:'principal:other'}
 ]){
  const store=setup();
  const result=await adapter(store).amend({session:{accessToken},proposal:edited,approval});
  assert.equal(result.ok,false);
  assert.equal(store.replay().length,1);
 }
 const store=createMemoryCopEventStore();
 const r=await adapter(store).amend({session:{accessToken},proposal,approval});
 assert.equal(r.ok,false);
});
