import assert from "node:assert/strict";
import test from "node:test";

import { auditConfigHygiene } from "./lib/config-hygiene-audit.js";
import { createJhnConfigPolicyRegistry } from "./lib/config-policy-registry.js";

const mapping = { openai_api_key: ["OPENAI_API_KEY"] };

test("configuration hygiene audit reports statuses without values", () => {
  const policyRegistry = createJhnConfigPolicyRegistry(mapping);
  const report = auditConfigHygiene({
    instance: "jhn",
    envKeyMapping: mapping,
    vaultRows: [
      {
        key: "openai_api_key",
        value: "same",
        is_secret: true,
        is_public: false,
        version: 4,
        updated_at: "2026-08-11T00:00:00Z",
      },
      {
        key: "unclassified",
        value: "value",
        is_secret: null,
        is_public: null,
        version: 1,
        updated_at: "2026-08-11T00:00:00Z",
      },
    ],
    cacheTargets: [
      {
        id: "inseme/.env",
        values: {
          OPENAI_API_KEY: "same",
          UNKNOWN_TOKEN: "local-only",
          SUPABASE_SERVICE_ROLE_KEY: "super-secret-bootstrap",
          HTTP_PROXY: "machine-only",
        },
      },
    ],
    policyRegistry,
  });

  assert.equal(report.read_only, true);
  assert.equal(report.summary.matches_vault, 1);
  assert.equal(report.summary.local_policy_review_required, 0);
  assert.equal(report.summary.unmapped_local_key, 1);
  assert.equal(report.summary.bootstrap_excluded, 1);
  assert.equal(report.summary.workstation_only_excluded, 1);
  assert.equal(report.summary.unclassified_vault_keys, 0);
  assert.equal(report.summary.registry_missing, 1);
  assert.equal(JSON.stringify(report).includes("same"), false);
  assert.equal(JSON.stringify(report).includes("local-only"), false);
  assert.equal(JSON.stringify(report).includes("super-secret-bootstrap"), false);
});

test("policy registry classifies a local pending key without promoting it", () => {
  const registry = createJhnConfigPolicyRegistry({});
  const report = auditConfigHygiene({
    instance: "jhn",
    envKeyMapping: {},
    vaultRows: [],
    cacheTargets: [{ id: "inseme/.env", values: { COGENTIA_BLACKBOARD_UPSERT_TOKEN: "local" } }],
    policyRegistry: registry,
  });
  assert.equal(report.summary.local_policy_review_required, 1);
  assert.equal(report.summary.missing_in_vault, 0);
  assert.equal(JSON.stringify(report).includes('local"'), false);
});

test("policy registry reports required Vault configuration without exposing it", () => {
  const registry = createJhnConfigPolicyRegistry({});
  const report = auditConfigHygiene({
    instance: "jhn",
    envKeyMapping: {},
    vaultRows: [{ key: "github_webhook_secret", value: "", is_secret: true, is_public: false }],
    cacheTargets: [],
    policyRegistry: registry,
  });
  assert.equal(report.summary.required_vault_issues, 2);
  assert.equal(
    report.required_vault_issues.some((issue) => issue.status === "required_vault_value_missing"),
    true
  );
  assert.equal(
    report.required_vault_issues.some((issue) => issue.status === "required_vault_key_missing"),
    true
  );
});


test("Cloudflare DNS/R2 Vault slots are governed secrets even without local .env mappings", () => {
  // The workstation promotion script creates these keys directly in Vault;
  // absence from ENV_KEY_MAPPING must not turn them into undocumented slots.
  const keys = ["cloudflare_account_id", "cloudflare_api_key", "cloudflare_s3_access_key_id", "cloudflare_s3_api_endpoint", "cloudflare_s3_secret_access_key"];
  const registry = createJhnConfigPolicyRegistry({});
  for (const key of keys) {
    const policy = registry.entries.get(key);
    assert.equal(policy?.classification, "instance_secret", key);
    assert.deepEqual(policy.expected, { is_secret: true, is_public: false });
    assert.equal(policy.required, false, "an optional Cloudflare provider must not break unrelated instances");
  }
  const report = auditConfigHygiene({
    instance: "jhn",
    vaultRows: keys.map(key => ({ key, value: `CONFIDENTIAL-${key}`, is_secret: true, is_public: false })),
    cacheTargets: [], envKeyMapping: {}, policyRegistry: registry,
  });
  assert.equal(report.summary.registry_missing, 0);
  assert.equal(report.summary.metadata_policy_mismatches, 0);
  assert.equal(report.summary.required_vault_issues, 2); // preexisting required GitHub slots
  assert.equal(JSON.stringify(report).includes("CONFIDENTIAL"), false);
});


test("JHN session HMAC key and PostgreSQL URL are server-only secrets", () => {
  const keys = ["oleole_session_secret", "postgres_url"];
  const registry = createJhnConfigPolicyRegistry({
    oleole_session_secret: ["OLEOLE_SESSION_SECRET"],
    postgres_url: ["POSTGRES_URL"],
  });
  const report = auditConfigHygiene({
    instance: "jhn", policyRegistry: registry, cacheTargets: [], envKeyMapping: {},
    vaultRows: keys.map(key => ({ key, value: `PRIVATE_${key}`, is_secret: true, is_public: false })),
  });
  for (const key of keys) {
    assert.equal(registry.entries.get(key)?.classification, "instance_secret");
    assert.deepEqual(registry.entries.get(key)?.expected, { is_secret: true, is_public: false });
  }
  assert.equal(report.summary.metadata_policy_mismatches, 0);
  assert.equal(JSON.stringify(report).includes("PRIVATE_"), false);
});

// This real query is intentionally root-scoped. In August 2026 it became
// multi-tenant; auditing every tenant as if it were JHN produced seven false
// registry alerts and could invite unsafe edits to another twin's config.
test("live audit query cannot mix another twin's Vault rows into JHN", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const source = await readFile(fileURLToPath(new URL("./config-hygiene-audit.js", import.meta.url)), "utf8");
  assert.match(source, /instance !== "jhn"/);
  assert.match(source, /\.eq\("instance_id", JHN_ROOT_INSTANCE_ID\)/);
});
