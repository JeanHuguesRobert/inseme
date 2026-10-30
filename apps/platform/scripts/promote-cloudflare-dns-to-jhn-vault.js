#!/usr/bin/env node
/**
 * Promote all CLOUDFLARE_* configuration entries from the trusted workstation's
 * inseme/.env to Agent JHN's Supabase public.instance_config vault.
 *
 * Includes DNS API credentials and R2 keys/endpoint/account metadata.
 * Default is read-only. Explicit --apply writes only CLOUDFLARE_* keys.
 * No credential is printed or recorded in logs. Never run this in CI.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const here = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(here, '../../../.env')
const apply = process.argv.includes('--apply')
const unexpected = process.argv.slice(2).filter(arg => arg !== '--apply')
if (unexpected.length) {
  console.error('Usage: node apps/platform/scripts/promote-cloudflare-dns-to-jhn-vault.js [--apply]')
  process.exit(2)
}

if (!fs.existsSync(envPath)) {
  console.error('BLOCKED: trusted inseme/.env source not found')
  process.exit(2)
}
const env = dotenv.parse(fs.readFileSync(envPath))
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const expectedHost = 'ndiysuhzmztatpxbkezn.supabase.co'
if (!supabaseUrl || !serviceRole || new URL(supabaseUrl).hostname !== expectedHost) {
  console.error('BLOCKED: JHN Supabase target or service-role credentials missing/mismatched')
  process.exit(2)
}

// Canonical mapping is deterministic: CLOUDFLARE_X -> cloudflare_x.
// Never copy unrelated provider secrets; keep the set open for future
// Cloudflare capabilities (DNS, R2, tunnels, Workers, account metadata).
const entries = Object.keys(env)
  .filter(key => /^CLOUDFLARE_[A-Z0-9_]+$/.test(key))
  .filter(key => typeof env[key] === 'string' && env[key].trim().length > 0)
  .sort()
  .map(key => [key, key.toLowerCase()])

if (entries.length === 0) {
  console.error('BLOCKED: no non-empty CLOUDFLARE_* values in inseme/.env')
  process.exit(2)
}
console.log(`SOURCE: ${entries.length} Cloudflare configuration entries selected`)
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const rootId = '00000000-0000-0000-0000-000000000001'

try {
  const planned = []
  for (const [source, key] of entries) {
    const { data, error } = await supabase.from('instance_config')
      .select('id,value,is_secret,is_public')
      .eq('instance_id', rootId).eq('key', key).limit(2)
    if (error) throw new Error(`Vault lookup failed for ${key}: ${error.code || 'unknown'}`)
    if (data.length > 1) throw new Error(`Duplicate JHN slot for ${key}`)
    const old = data[0]
    const value = env[source].trim()
    if (old?.value && old.value !== value) {
      throw new Error(`CONFLICT: existing JHN ${key} differs; refusing overwrite`)
    }
    planned.push({ key, value, unchanged: old?.value === value && old.is_secret === true && old.is_public === false })
    if (!apply) console.log(`DRY-RUN: ${key}: ${old?.value === value ? 'already synchronized' : 'would create'}`)
  }
  // All rows were checked for conflicts before any mutation.
  if (!apply) console.log('No mutation. Repeat with --apply to promote these CLOUDFLARE_* entries only.')
  for (const item of apply ? planned : []) {
    if (item.unchanged) { console.log(`UNCHANGED: ${item.key}`); continue }
    const { error: writeError } = await supabase.from('instance_config').upsert({
      instance_id: rootId, key: item.key, value: item.value,
      category: 'secrets', is_secret: true, is_public: false,
    }, { onConflict: 'instance_id,key' })
    if (writeError) throw new Error(`Vault promotion failed for ${item.key}: ${writeError.code || 'unknown'}`)
    console.log(`PROMOTED: ${item.key} (value hidden)`)
    const { data: verified, error: verifyError } = await supabase.from('instance_config')
      .select('value,is_secret,is_public')
      .eq('instance_id', rootId).eq('key', item.key).single()
    if (verifyError || verified?.value !== item.value ||
        verified.is_secret !== true || verified.is_public !== false) {
      throw new Error(`Vault verification failed for ${item.key}`)
    }
    console.log(`VERIFIED: ${item.key} (value hidden)`)
  }
} catch (error) {
  console.error('BLOCKED:', error.message)
  process.exitCode = 1
}
