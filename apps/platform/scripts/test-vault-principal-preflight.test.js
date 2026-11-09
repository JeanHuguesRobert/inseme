import test from 'node:test';
import assert from 'node:assert/strict';
import {createVaultPrincipalPreflight} from './lib/vault-principal-preflight.js';
import {JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';
const user='99999999-0000-4000-8000-000000000001';
const record={id:JHN_VAULT_INSTANCE_ID,canonical_slug:'jhn',status:'autonomous',principal_id:user};
function client(row){return {from(table){assert.equal(table,'instances');return {select(fields){assert.equal(fields,'id,canonical_slug,status,principal_id');return {
 eq(field,val){assert.equal(field,'id');assert.equal(val,JHN_VAULT_INSTANCE_ID);return this;},
 async single(){return {data:row,error:null};}
};}};}};}
const verifier=async()=>({verified:true,user_id:user,principal_ref:'principal:jhn',audience:'cogentia:principal-issuer'});
test('unbound owner is an explicit authority blocker even with functional Vault',async()=>{
 const x=await createVaultPrincipalPreflight({client:client({...record,principal_id:null}),authenticateHuman:verifier}).inspect({});
 assert.equal(x.reason,'principal_identity_unbound');assert.equal(x.may_issue,false);
});
test('linked human identity can pass preflight, never autonomously issue mandate',async()=>{
 const x=await createVaultPrincipalPreflight({client:client(record),authenticateHuman:verifier}).inspect({});
 assert.equal(x.ok,true);assert.equal(x.may_issue,false);assert.equal(x.reason,'mandate_approval_still_required');
 assert.equal(JSON.stringify(x).includes(user),false);
});
test('service-key possession alone, wrong user and wrong instance fail closed',async()=>{
 const cases=[
  [record,undefined,'human_authenticator_unavailable'],
  [record,async()=>({verified:true,user_id:'other',principal_ref:'principal:jhn',audience:'cogentia:principal-issuer'}),'principal_authentication_failed'],
  [{...record,id:'other'},verifier,'instance_identity_invalid'],
  [{...record,status:'provisional'},verifier,'instance_identity_invalid'],
 ];
 for(const [row,authenticateHuman,reason] of cases){const x=await createVaultPrincipalPreflight({client:client(row),authenticateHuman}).inspect({});assert.equal(x.reason,reason);}
});
