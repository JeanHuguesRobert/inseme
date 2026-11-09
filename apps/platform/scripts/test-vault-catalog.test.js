import test from 'node:test';
import assert from 'node:assert/strict';
import {projectVaultCatalog, JHN_VAULT_INSTANCE_ID} from './lib/vault-catalog.js';
const secret = 'VERY_SECRET_NEVER_EMIT';
const r = (key, instance_id=JHN_VAULT_INSTANCE_ID) => ({key,instance_id, value:secret,value_json:{secret},
  is_secret:true,is_public:false,version:2,updated_at:'2026-11-09T00:00:00Z'});
test('Vault list/describe are scoped, value-free and bounded',()=>{
 const rows=[r('cloudflare_api_key'),r('github_token')];
 const list=projectVaultCatalog(rows,{prefix:'cloudflare_'});
 assert.equal(list.ok,true); assert.equal(list.count,1);
 assert.equal(list.entries[0].ref,'jhn-vault:cloudflare_api_key');
 assert.equal(JSON.stringify(list).includes(secret),false);
 assert.equal(projectVaultCatalog(rows,{key:'github_token'}).entries.length,1);
 assert.equal(projectVaultCatalog(rows,{limit:1}).has_more,true);
 assert.equal(projectVaultCatalog([r('other_secret','other-twin')]).error,'vault_scope_mismatch');
 assert.equal(projectVaultCatalog(rows,{prefix:'cloudflare_\nvalue'}).error,'invalid_vault_reference');
 assert.equal(projectVaultCatalog(rows,{limit:9999}).error,'invalid_limit');
});
