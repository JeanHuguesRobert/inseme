#!/usr/bin/env node
/**
 * Apply #77 interaction_cases migration to Agent JHN Supabase only,
 * then run a bounded Reality Test (import 3 fixtures + projected write).
 *
 * Safety: refuses any SUPABASE_URL that is not the JHN ref ndiysuhzmztatpxbkezn.
 * Does not touch Pertitellu / Survey.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  applyProjectedUpdate,
  importPacket,
  parsePacketYaml,
} from "../packages/cop-kernel/src/projections/interactionCase.js";

const JHN_REF = "ndiysuhzmztatpxbkezn";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env"), quiet: true });

function assertJhnTarget() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url.includes(JHN_REF)) {
    throw new Error(
      `REFUSING: SUPABASE_URL is not Agent JHN (${JHN_REF}). Got host marker absent.`
    );
  }
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL / DATABASE_URL missing");
  }
  if (postgresUrl.includes("opnotbjrbphwcezaqgim") || postgresUrl.includes("pertitellu")) {
    throw new Error("REFUSING: POSTGRES_URL looks like Pertitellu, not JHN");
  }
  return {
    supabaseUrl: url,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    postgresUrl,
  };
}

function applyMigration(postgresUrl) {
  const migrationPath = path.join(
    root,
    "apps/platform/supabase/migrations/20260916120000_interaction_cases_packet_backed.sql"
  );
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration missing: ${migrationPath}`);
  }
  const psqlCandidates = [
    process.env.PSQL_PATH,
    "C:\\Users\\admin\\scoop\\apps\\postgresql\\18.4-2\\pgsql\\bin\\psql.exe",
    "psql",
  ].filter(Boolean);
  const psqlBin = psqlCandidates.find((p) => p === "psql" || fs.existsSync(p));
  if (!psqlBin) {
    throw new Error("psql executable not found");
  }
  console.log("Applying migration via", psqlBin);
  const out = execFileSync(psqlBin, [postgresUrl, "-v", "ON_ERROR_STOP=1", "-f", migrationPath], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (out && out.trim()) console.log(out.trim());
  console.log("Migration applied.");
}

function serviceClient(env) {
  return createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function loadFixture(name) {
  const filePath = path.join(root, "packages/cop-kernel/test/fixtures/interaction-packets", name);
  const yamlText = fs.readFileSync(filePath, "utf8");
  return { name, yamlText, packet: parsePacketYaml(yamlText) };
}

function rowToInsert(row) {
  return {
    packet_id: row.packet_id,
    status: row.status,
    disclosure: row.disclosure,
    subject: row.subject,
    primary_channel: row.primary_channel,
    counterparty_label: row.counterparty_label,
    created_at: row.created_at,
    last_updated_at: row.last_updated_at,
    next_followup_at: row.next_followup_at,
    superseded_by: row.superseded_by,
    revision: row.revision,
    projection_version: row.projection_version,
    packet: row.packet,
    packet_schema_version: row.packet_schema_version,
    packet_hash: row.packet_hash,
    source_ref: row.source_ref,
    source_revision: row.source_revision,
    projected_at: row.projected_at,
    field_bindings: row.field_bindings || {},
  };
}

async function realityTest(sb) {
  const fixtures = [
    "2026-08-08-la-gaude-old-at0045.yaml",
    "2026-05-04-session_marenostrum.yaml",
    "2026-07-21-relance_gelenbe_cpn.yaml",
  ].map(loadFixture);

  const richPacket = {
    ...fixtures[0].packet,
    future_extension: {
      deliberately_unknown_to_projection: true,
      nested: { value: "must survive jhn live" },
    },
  };
  const richRow = importPacket(richPacket, {
    repository: "JeanHuguesRobert/JeanHuguesRobert",
    path: `interaction_packets/packets/2026/${fixtures[0].name}`,
    gitRef: "main",
  });
  richRow.source_ref.content_hash = `sha256:${createHash("sha256")
    .update(fixtures[0].yamlText, "utf8")
    .digest("hex")}`;

  const simpleRow = importPacket(fixtures[1].yamlText, {
    repository: "JeanHuguesRobert/JeanHuguesRobert",
    path: `interaction_packets/packets/2026/${fixtures[1].name}`,
    gitRef: "main",
  });
  const midRow = importPacket(fixtures[2].yamlText, {
    repository: "JeanHuguesRobert/JeanHuguesRobert",
    path: `interaction_packets/packets/2026/${fixtures[2].name}`,
    gitRef: "main",
  });

  const rows = [richRow, simpleRow, midRow];
  for (const row of rows) {
    const { error } = await sb
      .from("interaction_cases")
      .upsert(rowToInsert(row), { onConflict: "packet_id" });
    if (error) throw new Error(`upsert ${row.packet_id}: ${error.message}`);
    console.log("Imported", row.packet_id, {
      status: row.status,
      disclosure: row.disclosure,
    });
  }

  const { data: stored, error: readErr } = await sb
    .from("interaction_cases")
    .select("*")
    .eq("packet_id", richRow.packet_id)
    .single();
  if (readErr) throw new Error(`read stored: ${readErr.message}`);

  const update = applyProjectedUpdate(
    {
      ...stored,
      field_bindings: stored.field_bindings || richRow.field_bindings,
    },
    { status: "waiting_reply" },
    {
      expectedRevision: Number(stored.revision),
      changedBy: "agent:jhn-reality-test-#77",
      actRef: "act:inseme-77-jhn-live",
    }
  );
  if (!update.ok) throw new Error(`merge failed: ${update.reason}`);

  const { data: live, error: updErr } = await sb.rpc("interaction_case_update_projected", {
    p_packet_id: update.row.packet_id,
    p_expected_revision: Number(stored.revision),
    p_patch: { status: "waiting_reply" },
    p_merged_packet: update.row.packet,
    p_changed_by: "agent:jhn-reality-test-#77",
    p_act_ref: "act:inseme-77-jhn-live",
    p_packet_hash: update.row.packet_hash,
    p_field_bindings: update.row.field_bindings,
  });
  if (updErr) throw new Error(`rpc update: ${updErr.message}`);

  const liveRow = Array.isArray(live) ? live[0] : live;
  const unknownSurvived =
    liveRow.packet?.future_extension?.nested?.value === "must survive jhn live";
  console.log("Projected update:", {
    packet_id: liveRow.packet_id,
    status: liveRow.status,
    revision: liveRow.revision,
    unknown_survived: unknownSurvived,
  });
  if (!unknownSurvived) {
    throw new Error("unknown future_extension did not survive live write");
  }

  // Prefer direct SQL for the stale-revision check: PostgREST RPC can time out
  // on conflict exceptions even when the DB correctly rejects the write.
  let staleRejected = false;
  let staleDetail = null;
  try {
    const { error: staleErr } = await sb.rpc("interaction_case_update_projected", {
      p_packet_id: liveRow.packet_id,
      p_expected_revision: Number(stored.revision),
      p_patch: { status: "should_fail" },
      p_merged_packet: liveRow.packet,
      p_changed_by: "agent:stale",
      p_act_ref: null,
      p_packet_hash: liveRow.packet_hash,
      p_field_bindings: liveRow.field_bindings,
    });
    staleRejected = !!staleErr && /revision_mismatch/i.test(staleErr.message || "");
    staleDetail = staleErr?.message || null;
  } catch (err) {
    staleDetail = err.message;
  }
  if (!staleRejected) {
    const verifySql = path.join(root, "tmp", "issue77-stale-check.sql");
    fs.writeFileSync(
      verifySql,
      `
DO $$
BEGIN
  PERFORM public.interaction_case_update_projected(
    '${liveRow.packet_id}',
    ${Number(stored.revision)},
    '{"status":"should_fail"}'::jsonb,
    (SELECT packet FROM interaction_cases WHERE packet_id = '${liveRow.packet_id}'),
    'agent:stale', NULL, NULL, NULL
  );
  RAISE EXCEPTION 'stale_write_was_not_rejected';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%revision_mismatch%' THEN
    RAISE NOTICE 'stale_rejected_ok';
  ELSE
    RAISE;
  END IF;
END $$;
`
    );
    const psqlBin =
      process.env.PSQL_PATH ||
      "C:\\Users\\admin\\scoop\\apps\\postgresql\\18.4-2\\pgsql\\bin\\psql.exe";
    const out = execFileSync(
      psqlBin,
      [
        process.env.POSTGRES_URL || process.env.DATABASE_URL,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        verifySql,
      ],
      { encoding: "utf8" }
    );
    staleRejected = /stale_rejected_ok/i.test(out);
    staleDetail = out.trim();
  }
  console.log("Stale write rejected:", staleRejected, staleDetail);
  if (!staleRejected) {
    throw new Error("expected stale revision write to fail");
  }

  const { data: history, error: histErr } = await sb
    .from("interaction_case_revisions")
    .select("case_id, revision, previous_revision, changed_by, act_ref")
    .eq("case_id", liveRow.packet_id)
    .order("revision");
  if (histErr) throw new Error(`history: ${histErr.message}`);
  console.log("Row-local history:", history);

  const { count, error: countErr } = await sb
    .from("interaction_cases")
    .select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`count: ${countErr.message}`);

  return {
    imported: rows.map((r) => r.packet_id),
    updated: {
      packet_id: liveRow.packet_id,
      status: liveRow.status,
      revision: Number(liveRow.revision),
      unknown_survived: unknownSurvived,
    },
    staleRejected,
    history,
    count,
  };
}

async function privacyProbe(env) {
  const anon = createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.from("interaction_cases").select("packet_id").limit(1);
  const blocked = !!error || !data || data.length === 0;
  console.log("Anon probe:", {
    error: error ? { code: error.code, message: error.message } : null,
    rows: data?.length ?? null,
    private_ok: blocked,
  });
  return {
    error: error ? { code: error.code, message: error.message } : null,
    rows: data?.length ?? 0,
    private_ok: blocked,
  };
}

async function main() {
  const env = assertJhnTarget();
  console.log("=== Inseme #77 → Agent JHN live apply ===");
  console.log("Target ref:", JHN_REF);

  applyMigration(env.postgresUrl);
  const sb = serviceClient(env);

  // Confirm tables visible to service role
  const { error: probeErr } = await sb
    .from("interaction_cases")
    .select("packet_id", { head: true, count: "exact" });
  if (probeErr) {
    throw new Error(
      `service_role cannot see interaction_cases after migration: ${probeErr.message}`
    );
  }

  const evidence = await realityTest(sb);
  const privacy = await privacyProbe(env);

  const report = {
    jhn_supabase_touched: true,
    project_ref: JHN_REF,
    role: "Agent JHN personal instance",
    other_projects_touched: "none",
    migration_applied: true,
    runtime_tested: true,
    evidence,
    privacy,
  };
  const outPath = path.join(root, "tmp", "issue77-jhn-live-evidence.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("Evidence written:", outPath);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
