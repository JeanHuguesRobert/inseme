import assert from 'node:assert/strict';
import {createPrincipalEnrollment} from './principal-enrollment.js';
const userId='11111111-1111-4111-8111-111111111111';
const instanceId='22222222-2222-4222-8222-222222222222';
const token='non-secret-fixture-access-token';
let writes=0;let principalId=null;
const authClient={auth:{getUser:async()=>({data:{user:{id:userId,email_confirmed_at:'2026-11-07T00:00:00Z',is_anonymous:false}}})}};
const table=(name)=>({
 select(){return this;},eq(k,v){this.filters??={};this.filters[k]=v;return this;},
 is(k,v){this.filters??={};this.filters[k]=v;return this;},
 async maybeSingle(){return {data:name==='users'?{id:userId}:{id:instanceId,canonical_slug:'jhn',principal_id:principalId,status:'autonomous',subject_kind:'living_person'}};},
 update(value){const q=table(name);q.value=value;return q;},
 then(resolve){writes++;if(principalId!==null||this.filters?.id!==instanceId||this.filters?.principal_id!==null)return Promise.resolve(resolve({data:[]}));principalId=this.value.principal_id;return Promise.resolve(resolve({data:[{id:instanceId,principal_id:principalId}]}));},
});
// PostgREST query builder .select follows .update; use scoped minimal mock.
const adminClient={from:(name)=>{const q=table(name);const orig=q.select;q.select=function(){if(this.value)return this;return orig.call(this)};return q;}};
const verifyRootClaim=async({subjectUserId,instanceId:id})=>({verified:true,issuerVerified:true,scope:'principal-instance-claim',subjectUserId,instanceId:id});
const input={accessToken:token,instanceId,rootClaim:'fixture-proof'};
const enrolled=createPrincipalEnrollment({authClient,adminClient,verifyRootClaim});
assert.equal((await enrolled.prepare(input)).claim_verified,true);
assert.equal(writes,0);
assert.equal((await enrolled.claim(input)).changed,true);
assert.equal(writes,1);
assert.equal((await enrolled.claim(input)).already_bound,true);
const denied=createPrincipalEnrollment({authClient,adminClient,verifyRootClaim:async()=>({verified:false})});
assert.equal((await denied.claim(input)).reason,'principal_claim_not_verified');
assert.equal(writes,1);
const untrusted=createPrincipalEnrollment({authClient,adminClient});
assert.equal((await untrusted.claim(input)).reason,'enrollment_authority_unconfigured');
assert.equal(writes,1);
console.log('principal enrollment: controlled fixtures ok');
