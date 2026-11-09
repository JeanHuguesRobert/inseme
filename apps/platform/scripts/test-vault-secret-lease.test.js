import test from 'node:test';
import assert from 'node:assert/strict';
import {createJhnVaultSecretLease} from './lib/vault-secret-lease.js';
import {JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';
const secret = 'TEST_PRIVATE_CREDENTIAL_NEVER_PRINT';
const record = {instance_id:JHN_VAULT_INSTANCE_ID,key:'example_token',value:secret,is_secret:true,is_public:false};
function fakeClient(row = record) {
  const seen = [];
  const query = {
    eq(a, b) { seen.push(['eq', a, b]); return this; },
    async single() { return { data: row, error: null }; },
  };
  return {
    seen,
    from(table) {
      seen.push(['from', table]);
      return { select(fields) { seen.push(['select', fields]); return query; } };
    },
  };
}

test('in-process lease uses exact JHN key and gives secret only to callback',async()=>{
 const client=fakeClient();let observed;
 const lease=createJhnVaultSecretLease({client});
 const receipt=await lease.withSecret('jhn-vault:example_token',async value=>{observed=value;return {ok:true}});
 assert.equal(observed,secret);assert.deepEqual(receipt,{ok:true});
 assert.deepEqual(client.seen,[['from','instance_config'],['select','instance_id,key,value,is_secret,is_public'],['eq','instance_id',JHN_VAULT_INSTANCE_ID],['eq','key','example_token']]);
});
test('fail closed on malformed ref, tenant mismatch, nonsecret metadata and provider exception',async()=>{
 const ok=createJhnVaultSecretLease({client:fakeClient()});
 await assert.rejects(ok.withSecret('other:example_token',async()=>{}),e=>e.code==='VAULT_REF_INVALID');
 await assert.rejects(ok.withSecret('jhn-vault:example_token/other',async()=>{}),e=>e.code==='VAULT_REF_INVALID');
 await assert.rejects(createJhnVaultSecretLease({client:fakeClient({...record,instance_id:'other'})}).withSecret('jhn-vault:example_token',async()=>{}),e=>e.code==='VAULT_SECRET_UNAVAILABLE');
 await assert.rejects(createJhnVaultSecretLease({client:fakeClient({...record,is_public:true})}).withSecret('jhn-vault:example_token',async()=>{}),e=>e.code==='VAULT_SECRET_UNAVAILABLE');
 await assert.rejects(ok.withSecret('jhn-vault:example_token',async()=>{throw Error(secret)}),e=>e.code==='VAULT_CONSUMER_FAILED'&&!JSON.stringify(e).includes(secret));
});
