// File: scripts/test-interaction-case-projection-schema.js
// Description: Schema smoke test for Packet-Backed Interaction Cases (Inseme #77).

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("==========================================================================");
console.log("    TESTING INTERACTION CASE PACKET-BACKED PROJECTION SCHEMA (#77)       ");
console.log("==========================================================================");

const migrationPath = path.join(
  process.cwd(),
  "apps/platform/supabase/migrations/20260916120000_interaction_cases_packet_backed.sql"
);

assert.ok(fs.existsSync(migrationPath), "Migration SQL file must exist");
const sql = fs.readFileSync(migrationPath, "utf8");

assert.ok(
  sql.includes("CREATE TABLE IF NOT EXISTS public.interaction_cases"),
  "Missing interaction_cases table"
);
assert.ok(
  sql.includes("CREATE TABLE IF NOT EXISTS public.interaction_case_revisions"),
  "Missing interaction_case_revisions table"
);
assert.ok(sql.includes("packet jsonb NOT NULL"), "packet jsonb required");
assert.ok(sql.includes("revision bigint NOT NULL"), "optimistic revision required");
assert.ok(sql.includes("interaction_case_update_projected"), "Missing optimistic update function");
assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "RLS must be enabled");
assert.ok(
  sql.includes("REVOKE ALL ON TABLE public.interaction_cases FROM PUBLIC, anon, authenticated"),
  "anon/authenticated must not have direct table grants"
);
assert.ok(sql.includes("FOR ALL TO service_role"), "service_role policy required");
assert.ok(
  sql.includes("disclosure IN ('D0', 'D1', 'D2', 'D3', 'D4')"),
  "D0–D4 disclosure check required"
);
assert.ok(
  !sql.includes("CREATE POLICY") || !/TO anon/.test(sql),
  "No anonymous read policy should be introduced by this migration"
);

// No premature CRM ontology
for (const forbidden of [
  "CREATE TABLE IF NOT EXISTS public.interaction_actors",
  "CREATE TABLE IF NOT EXISTS public.interaction_probes",
  "CREATE TABLE IF NOT EXISTS public.interaction_artifacts",
]) {
  assert.ok(!sql.includes(forbidden), `Premature normalized table must not exist: ${forbidden}`);
}

console.log("  ✓ interaction_cases + revisions + RLS + optimistic update present");
console.log("  ✓ No premature actor/probe/artifact ontology");
console.log("\nAll schema smoke checks passed.\n");
