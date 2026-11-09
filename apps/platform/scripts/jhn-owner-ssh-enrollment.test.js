import test from 'node:test';
import assert from 'node:assert/strict';
import {createJhnOwnerSshEnrollment} from './lib/jhn-owner-ssh-enrollment.js';
import {JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const smoke='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row={id:JHN_VAULT_INSTANCE_ID,canonical_slug:'jhn',status:'autonomous',subject_kind:'living_person',subject_ref:'subject:jhn',twin_root_ref:'twin:jhn',principal_id:null};
function fixture(opts={}) {
  let principal=opts.principal??null, writes=0;
  const users=opts.users??[{id:smoke,email:'smoke@example.org',email_confirmed_at:'today'},{id:uuid,email:'jhr@baronsmariani.org',email_confirmed_at:'today',is_anonymous:false}];
  const client={auth:{admin:{listUsers:async()=>({data:{users,total:users.length}})}},from(table){
    const chain={
      select(){return this;},eq(){return this;},is(){return this;},
      update(value){this.value=value;return this;},
      async maybeSingle(){if(table==='users')return {data:opts.profile??{id:uuid,email:'jhr@baronsmariani.org',role:'admin'}};
        if(this.fields==='principal_id')return {data:{principal_id:principal}};
        return {data:{...row,principal_id:principal}};},
      then(resolve,reject){if(this.value){writes++;if(principal!==null)return Promise.resolve({data:[]}).then(resolve,reject);
        principal=this.value.principal_id;return Promise.resolve({data:[{id:JHN_VAULT_INSTANCE_ID,principal_id:principal}]}).then(resolve,reject);}return Promise.resolve({data:null}).then(resolve,reject);}
    };
    chain.select=function(fields){this.fields=fields;return this;};
    return chain;
  }};
  return {client,getWrites:()=>writes,getPrincipal:()=>principal};
}
const approved={ownerConfirmed:true,sshOwnerSession:true};
test('owner SSH and explicit consent bind unique confirmed admin, never smoke',async()=>{
 const f=fixture(),enroll=createJhnOwnerSshEnrollment({adminClient:f.client});
 const result=await enroll.claim(approved);assert.deepEqual(result,{ok:true,changed:true,instance:'jhn',principal_ref:'principal:jhn'});
 assert.equal(f.getPrincipal(),uuid);assert.equal(f.getWrites(),1);
 const again=await enroll.claim(approved);assert.equal(again.already_bound,true);assert.equal(f.getWrites(),1);
});
test('rejects absent owner ceremony, missing confirmed owner, duplicate owner, and mismatched profile',async()=>{
 for(const bad of [{}, {ownerConfirmed:true}, {sshOwnerSession:true}]){
  const f=fixture();assert.equal((await createJhnOwnerSshEnrollment({adminClient:f.client}).claim(bad)).ok,false);assert.equal(f.getWrites(),0);
 }
 for(const f of [fixture({users:[{id:smoke,email:'smoke@example.org',email_confirmed_at:'today'}]}),
   fixture({users:[{id:uuid,email:'jhr@baronsmariani.org',email_confirmed_at:null}]}),
   fixture({users:[{id:uuid,email:'jhr@baronsmariani.org',email_confirmed_at:'today'},{id:smoke,email:'jhr@baronsmariani.org',email_confirmed_at:'today'}]}),
   fixture({profile:{id:uuid,email:'jhr@baronsmariani.org',role:'user'}}),
   fixture({principal:smoke})]) {
  assert.equal((await createJhnOwnerSshEnrollment({adminClient:f.client}).claim(approved)).ok,false);assert.equal(f.getWrites(),0);
 }
});
