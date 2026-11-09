import test from 'node:test';
import assert from 'node:assert/strict';
import {createJhnAuthSessionVerifier} from './lib/jhn-auth-session-verifier.js';
import {createVaultPrincipalPreflight} from './lib/vault-principal-preflight.js';
import {JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const client={from(n){assert.equal(n,'instances');return {select(){return {eq(){return {single:async()=>({data:{id:JHN_VAULT_INSTANCE_ID,canonical_slug:'jhn',status:'autonomous',principal_id:owner},error:null})}}}}}}};
const session={accessToken:'FAKE_AUTH_TOKEN_NOT_FOR_LOGS'};
const authClient={auth:{getUser:async token=>{assert.equal(token,session.accessToken);return {data:{user:{id:owner,email_confirmed_at:'2026-11-09T00:00:00Z',is_anonymous:false}}}}}};
test('verified live Auth user matches bound instance, but grants no issuance',async()=>{
 const verifier=createJhnAuthSessionVerifier({authClient});
 const r=await createVaultPrincipalPreflight({client,authenticateHuman:verifier}).inspect({session});
 assert.equal(r.ok,true);assert.equal(r.may_issue,false);
 assert.equal(JSON.stringify(r).includes(session.accessToken),false);
});
test('unverified, missing and wrong user sessions are refused',async()=>{
 for(const a of [undefined,{auth:{getUser:async()=>({data:{user:{id:'other',email_confirmed_at:'now'}}})}},
 {auth:{getUser:async()=>({error:{message:'bad bearer'}})}},
 {auth:{getUser:async()=>({data:{user:{id:owner,email_confirmed_at:null}}})}}]){
  const r=await createVaultPrincipalPreflight({client,authenticateHuman:createJhnAuthSessionVerifier({authClient:a})}).inspect({session});
  assert.equal(r.ok,false);assert.equal(r.reason,'principal_authentication_failed');
 }
 const r=await createJhnAuthSessionVerifier({authClient})({session:null});assert.equal(r.verified,false);
});
