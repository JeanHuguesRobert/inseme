#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditConfigHygiene } from "./lib/config-hygiene-audit.js";
import { createJhnConfigPolicyRegistry } from "./lib/config-policy-registry.js";
import { createSupabaseClient, ENV_KEY_MAPPING } from "./lib/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
const args = new Set(process.argv.slice(2));
const instanceIndex = process.argv.indexOf("--instance");
const instance = instanceIndex >= 0 ? process.argv[instanceIndex + 1] : "jhn";
// The registry and local caches below belong to the JHN root instance only.
// A multi-tenant query would leak other tenants into this projection and
// falsely report their legitimate identity keys as unregistered JHN keys.
const JHN_ROOT_INSTANCE_ID = "00000000-0000-0000-0000-000000000001";
if (instance !== "jhn") {
  console.error("BLOCKED: this hygiene audit supports the JHN root instance only");
  process.exit(2);
}

if (!args.has("--json")) {
  console.error("Usage: node scripts/config-hygiene-audit.js --instance jhn --json");
  process.exit(2);
}

function parseEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const targets = [
  { id: "inseme/.env", values: parseEnv(path.join(monorepoRoot, ".env")) },
  { id: "apps/platform/.env", values: parseEnv(path.join(monorepoRoot, "apps/platform/.env")) },
];

const supabase = createSupabaseClient();
const { data: vaultRows, error } = await supabase
  .from("instance_config")
  .select("key,value,value_json,is_secret,is_public,version,updated_at")
  .eq("instance_id", JHN_ROOT_INSTANCE_ID)
  .order("key");

if (error) {
  console.log(
    JSON.stringify({
      schema: "cogentia.config_hygiene_audit.v0",
      instance,
      read_only: true,
      ok: false,
      error: "vault_query_failed",
    })
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      ...auditConfigHygiene({
        instance,
        vaultRows,
        cacheTargets: targets,
        envKeyMapping: ENV_KEY_MAPPING,
        policyRegistry: createJhnConfigPolicyRegistry(ENV_KEY_MAPPING),
      }),
    },
    null,
    2
  )
);
