/**
 * Read-only, value-free projection of JHN Vault references. A Vault reference
 * is NOT a capability or an execution authorization. This module never reads
 * row.value/value_json nor returns a fingerprint/length of secret material.
 */
const SAFE_KEY = /^[a-z][a-z0-9_]{0,127}$/;
export const JHN_VAULT_INSTANCE_ID = '00000000-0000-0000-0000-000000000001';

export function projectVaultCatalog(rows, { prefix = '', key = '', limit = 100 } = {}) {
  if (typeof prefix !== 'string' || (prefix && !SAFE_KEY.test(prefix)) ||
      typeof key !== 'string' || (key && !SAFE_KEY.test(key)))
    return { ok: false, error: 'invalid_vault_reference' };
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
    return { ok: false, error: 'invalid_limit' };
  // The trusted loader MUST filter by instance_id. Defensive scope check here
  // prevents a future multi-instance caller accidentally exposing other twins.
  if (!Array.isArray(rows) || rows.some(r => r.instance_id !== JHN_VAULT_INSTANCE_ID))
    return { ok: false, error: 'vault_scope_mismatch' };
  const filtered = rows.filter(r => (!prefix || r.key.startsWith(prefix)) && (!key || r.key === key))
    .sort((a, b) => a.key.localeCompare(b.key));
  const entries = filtered.slice(0, limit).map(r => ({
    ref: `jhn-vault:${r.key}`,
    key: r.key,
    configured: true, // metadata row exists; not proof of a usable secret value
    is_secret: r.is_secret === true,
    is_public: r.is_public === true,
    version: Number.isSafeInteger(r.version) ? r.version : null,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : null,
  }));
  return { ok: true, schema: 'cogentia.vault_catalog.v1', instance: 'jhn', read_only: true,
    entries, count: entries.length, has_more: filtered.length > entries.length,
    authority: 'none', values_exposed: false };
}
