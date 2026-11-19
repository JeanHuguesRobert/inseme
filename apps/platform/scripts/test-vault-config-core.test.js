import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstanceVaultConfigCore} from './lib/vault-config-core.js';
import {JHN_VAULT_INSTANCE_ID as ID} from './lib/vault-catalog.js';

const SECRET='AN_ACTUAL_SECRET_IS_NEVER_PART_OF_THE_RECEIPT';
function fakeClient({initial=null,insertConflict=false}={}) {
  let row=initial ? {...initial}:null, inserts=0;
  const operations=[];
  return {
    operations,get inserts(){return inserts;},get row(){return row;},
    from(table) {
      operations.push(table);
      assert.equal(table,'instance_config');
      return {
        select(){return this;},
        eq(field,val) {
          if(field==='instance_id')assert.equal(val,ID);
          if(field==='key')assert.equal(val,'gandi_pat');
          return this;
        },
        async maybeSingle(){return {data:row,error:null};},
        insert(payload){
          inserts++;
          if(insertConflict||row) return {select(){return {single:async()=>({data:null,error:{code:'23505'}})}}};
          row={...payload};
          return {
            select(){
              return {
                single:async()=>({data:{
                  instance_id:row.instance_id,key:row.key,version:row.version,
                  is_secret:row.is_secret,is_public:row.is_public},error:null}),
              };
            },
          };
        },
      };
    },
  };
}
const promote=(backend)=>createInstanceVaultConfigCore({client:backend}).promote({
  key:'gandi_pat',resolveTrustedValue:()=>SECRET,
});
test('create one private key, verify privately and never return secret material',async()=>{
  const db=fakeClient();
  const receipt=await promote(db);
  assert.equal(receipt.status,'created');
  assert.equal(receipt.version,1);
  assert.equal(receipt.values_exposed,false);
  assert.equal(db.row.value,SECRET);
  assert.equal(db.row.is_public,false);
  assert.equal(db.row.is_secret,true);
  assert.equal(db.row.instance_id,ID);
  assert.equal(db.inserts,1);
  assert.equal(JSON.stringify(receipt).includes(SECRET),false);
});
test('idempotent key is no-write and refuses unexpected overwrite',async()=>{
  const old={instance_id:ID,key:'gandi_pat',value:SECRET,
    is_public:false,is_secret:true,version:7};
  const db=fakeClient({initial:old});
  const same=await promote(db);
  assert.equal(same.status,'unchanged');
  assert.equal(same.version,7);
  assert.equal(db.inserts,0);
  const mismatch=fakeClient({initial:{...old,value:'different'}});
  await assert.rejects(promote(mismatch),e=>e.code==='VAULT_CONFLICT');
  assert.equal(mismatch.inserts,0);
  const unsafe=fakeClient({initial:{...old,is_public:true}});
  await assert.rejects(promote(unsafe),e=>e.code==='VAULT_CONFLICT');
});
test('concurrent insert, absent source and tenant mismatch fail closed',async()=>{
  const db=fakeClient({insertConflict:true});
  await assert.rejects(promote(db),e=>e.code==='VAULT_CREATE_CONFLICT_OR_UNAVAILABLE');
  assert.throws(()=>createInstanceVaultConfigCore({client:fakeClient(),
    instanceId:'00000000-0000-0000-0000-000000000002'}),e=>e.code==='VAULT_INSTANCE_SCOPE_INVALID');
  await assert.rejects(createInstanceVaultConfigCore({client:fakeClient()}).promote({
    key:'gandi_pat',resolveTrustedValue:()=>''}),e=>e.code==='VAULT_SOURCE_UNAVAILABLE');
});
