/**
 * Trusted, per-instance Vault value access for an already authorized in-process
 * provider adapter. This is NOT an MCP/CLI API. No generic value retrieval or
 * caller-provided HTTP destination is provided. Value only enters the callback.
 */
import { JHN_VAULT_INSTANCE_ID } from './vault-catalog.js';
const KEY = /^[a-z][a-z0-9_]{0,127}$/;
const fail = code => Object.assign(new Error('Vault access refused'), { code });

export function createJhnVaultSecretLease({ client } = {}) {
  return Object.freeze({
    async withSecret(ref, consume) {
      const key = typeof ref === 'string' && ref.startsWith('jhn-vault:') ? ref.slice(10) : '';
      if (!KEY.test(key)) throw fail('VAULT_REF_INVALID');
      if (!client || typeof client.from !== 'function' || typeof consume !== 'function')
        throw fail('VAULT_BACKEND_UNAVAILABLE');
      let row;
      try {
        const { data, error } = await client.from('instance_config')
          .select('instance_id,key,value,is_secret,is_public')
          .eq('instance_id', JHN_VAULT_INSTANCE_ID).eq('key', key).single();
        if (error) throw fail('VAULT_LOOKUP_FAILED');
        row = data;
      } catch { throw fail('VAULT_LOOKUP_FAILED'); }
      if (!row || row.instance_id !== JHN_VAULT_INSTANCE_ID || row.key !== key ||
          row.is_secret !== true || row.is_public !== false ||
          typeof row.value !== 'string' || !row.value.trim())
        throw fail('VAULT_SECRET_UNAVAILABLE');
      try {
        return await consume(row.value);
      } catch {
        // Provider failures can contain HTTP Authorization header or secret.
        // Never forward the callback's error message into an agent boundary.
        throw fail('VAULT_CONSUMER_FAILED');
      }
    }
  });
}
