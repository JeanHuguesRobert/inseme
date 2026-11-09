#!/usr/bin/env node
/** Trusted, private-read Vault metadata projection; NEVER query secret values. */
import { createSupabaseClient } from './lib/config.js';
import { JHN_VAULT_INSTANCE_ID, projectVaultCatalog } from './lib/vault-catalog.js';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const at = args.indexOf(name);
  return at < 0 ? fallback : (args[at + 1] || '');
};
const command = args[0] || 'list';
if (!['list', 'describe'].includes(command) || !args.includes('--json') ||
    arg('--instance', 'jhn') !== 'jhn') {
  console.log(JSON.stringify({ok:false,error:'invalid_vault_catalog_request'}));
  process.exitCode = 2;
} else {
  const prefix = arg('--prefix');
  const key = command === 'describe' ? arg('--key') : '';
  const limit = command === 'describe' ? 1 : Number(arg('--limit', '100'));
  const preflight = projectVaultCatalog([], {prefix, key, limit});
  if (!preflight.ok || (command === 'describe' && !key)) {
    console.log(JSON.stringify({ok:false,error:preflight.error || 'vault_key_required'}));
    process.exitCode = 2;
  } else {
    try {
      const client = createSupabaseClient();
      const {data, error} = await client.from('instance_config')
        .select('instance_id,key,is_secret,is_public,version,updated_at')
        .eq('instance_id', JHN_VAULT_INSTANCE_ID).order('key');
      if (error) throw new Error('vault_catalog_query_failed');
      console.log(JSON.stringify(projectVaultCatalog(data, {prefix, key, limit})));
    } catch {
      console.log(JSON.stringify({ok:false,error:'vault_catalog_unavailable'}));
      process.exitCode = 1;
    }
  }
}
