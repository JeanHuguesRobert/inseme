#!/usr/bin/env node
/**
 * Refresh Agent JHN interaction_cases from public JHR Git/YAML packets (#77 quality).
 *
 * - Applies projection v2 migration
 * - Imports all packets/2026/*.yaml from JeanHuguesRobert
 * - On duplicate packet_id, prefers non-superseded current packet; reports skipped historical twin
 * - Re-projects from Git (resets prior Reality-Test column drift such as waiting_reply)
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  PROJECTION_VERSION,
  importPacket,
  parsePacketYaml,
} from "../packages/cop-kernel/src/projections/interactionCase.js";

const JHN_REF = "ndiysuhzmztatpxbkezn";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const jhrPacketsDir = path.resolve(
  root,
  "..",
  "JeanHuguesRobert",
  "interaction_packets",
  "packets",
  "2026"
);

dotenv.config({ path: path.join(root, ".env") });

function assertJhn() {
  const url = process.env.SUPABASE_URL || "";
  if (!url.includes(JHN_REF)) {
    throw new Error(`REFUSING: not JHN (${JHN_REF})`);
  }
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!postgresUrl) throw new Error("POSTGRES_URL missing");
  if (postgresUrl.includes("opnotbjrbphwcezaqgim")) {
    throw new Error("REFUSING: Pertitellu POSTGRES_URL");
  }
  return {
    supabaseUrl: url,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    postgresUrl,
  };
}

function psqlBin() {
  const candidates = [
    process.env.PSQL_PATH,
    "C:\\Users\\admin\\scoop\\apps\\postgresql\\18.4-2\\pgsql\\bin\\psql.exe",
    "psql",
  ].filter(Boolean);
  const found = candidates.find((p) => p === "psql" || fs.existsSync(p));
  if (!found) throw new Error("psql not found");
  return found;
}

function applySqlFile(postgresUrl, relPath) {
  const full = path.join(root, relPath);
  console.log("Applying", relPath);
  const out = execFileSync(psqlBin(), [postgresUrl, "-v", "ON_ERROR_STOP=1", "-f", full], {
    encoding: "utf8",
  });
  if (out.trim()) console.log(out.trim());
}

function listYamlFiles() {
  if (!fs.existsSync(jhrPacketsDir)) {
    throw new Error(`JHR packets dir missing: ${jhrPacketsDir}`);
  }
  const parsed = [];
  const parseFailures = [];
  for (const name of fs
    .readdirSync(jhrPacketsDir)
    .filter((n) => n.endsWith(".yaml"))
    .sort()) {
    const filePath = path.join(jhrPacketsDir, name);
    const yamlText = fs.readFileSync(filePath, "utf8");
    try {
      const packet = parsePacketYaml(yamlText);
      parsed.push({
        name,
        filePath,
        yamlText,
        packet,
        packetId: packet?.id ? String(packet.id) : null,
        isSuperseded:
          packet?.status === "superseded" ||
          Boolean(packet?.superseded_by) ||
          packet?.statut === "superseded",
      });
    } catch (err) {
      // Reality may contain historically heterogeneous / invalid YAML.
      // Do not rewrite source packets merely to ingest; report and continue.
      parseFailures.push({
        reason: "yaml_parse_error",
        file: name,
        error: String(err.message || err).split("\n")[0],
      });
    }
  }
  return { parsed, parseFailures };
}

/**
 * Current-state projection keeps one row per packet_id.
 * When two YAML files share an id, prefer the non-superseded consolidated packet.
 */
function resolveCurrentPackets(files) {
  const byId = new Map();
  const skipped = [];
  const collisions = [];

  for (const file of files) {
    if (!file.packetId) {
      skipped.push({ reason: "missing_id", file: file.name });
      continue;
    }
    const existing = byId.get(file.packetId);
    if (!existing) {
      byId.set(file.packetId, file);
      continue;
    }
    collisions.push({
      packet_id: file.packetId,
      a: existing.name,
      b: file.name,
    });
    // Prefer non-superseded.
    if (existing.isSuperseded && !file.isSuperseded) {
      skipped.push({
        reason: "superseded_twin",
        file: existing.name,
        kept: file.name,
        packet_id: file.packetId,
      });
      byId.set(file.packetId, file);
    } else if (!existing.isSuperseded && file.isSuperseded) {
      skipped.push({
        reason: "superseded_twin",
        file: file.name,
        kept: existing.name,
        packet_id: file.packetId,
      });
    } else {
      // Both current or both superseded: keep lexicographically later filename as
      // a deterministic choice and report ambiguity.
      const keep = existing.name >= file.name ? existing : file;
      const drop = keep === existing ? file : existing;
      skipped.push({
        reason: "ambiguous_duplicate_id",
        file: drop.name,
        kept: keep.name,
        packet_id: file.packetId,
      });
      byId.set(file.packetId, keep);
    }
  }

  return { current: [...byId.values()], skipped, collisions };
}

function rowToInsert(row) {
  return {
    packet_id: row.packet_id,
    status: row.status,
    status_label: row.status_label,
    disclosure: row.disclosure,
    subject: row.subject,
    primary_channel: row.primary_channel,
    channel_kind: row.channel_kind,
    counterparty_label: row.counterparty_label,
    created_at: row.created_at,
    last_updated_at: row.last_updated_at,
    next_followup_at: row.next_followup_at,
    next_watch_count: row.next_watch_count,
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

async function main() {
  const env = assertJhn();
  console.log("=== #77 quality refresh → Agent JHN ===");
  console.log("Projection version:", PROJECTION_VERSION);
  console.log("Packets dir:", jhrPacketsDir);

  applySqlFile(
    env.postgresUrl,
    "apps/platform/supabase/migrations/20260916220000_interaction_cases_projection_v2.sql"
  );

  const { parsed: files, parseFailures } = listYamlFiles();
  const { current, skipped, collisions } = resolveCurrentPackets(files);
  const allSkipped = [...parseFailures, ...skipped];
  console.log("YAML files readable:", files.length);
  console.log("YAML parse failures:", parseFailures.length);
  console.log("Current-state rows to upsert:", current.length);
  console.log("Skipped:", JSON.stringify(allSkipped, null, 2));
  if (collisions.length) {
    console.log("ID collisions observed:", JSON.stringify(collisions, null, 2));
  }

  const sb = createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const imported = [];
  for (const file of current) {
    const relPath = `interaction_packets/packets/2026/${file.name}`;
    const contentHash = `sha256:${createHash("sha256")
      .update(file.yamlText, "utf8")
      .digest("hex")}`;
    const row = importPacket(file.yamlText, {
      repository: "JeanHuguesRobert/JeanHuguesRobert",
      path: relPath,
      gitRef: "main",
      contentHash,
      revision: 1,
    });

    // If a row already exists, preserve revision counter but refresh packet/projection
    // from Git (documentary source for this refresh). Record a revision entry when hash changes.
    const { data: existing } = await sb
      .from("interaction_cases")
      .select("packet_id, revision, packet_hash")
      .eq("packet_id", row.packet_id)
      .maybeSingle();

    if (existing && existing.packet_hash === row.packet_hash) {
      // Still refresh projected columns for v2 upgrade even if packet bytes unchanged.
      const { error } = await sb
        .from("interaction_cases")
        .update({
          status: row.status,
          status_label: row.status_label,
          disclosure: row.disclosure,
          subject: row.subject,
          primary_channel: row.primary_channel,
          channel_kind: row.channel_kind,
          counterparty_label: row.counterparty_label,
          created_at: row.created_at,
          last_updated_at: row.last_updated_at,
          next_followup_at: row.next_followup_at,
          next_watch_count: row.next_watch_count,
          superseded_by: row.superseded_by,
          projection_version: row.projection_version,
          field_bindings: row.field_bindings,
          source_ref: row.source_ref,
          source_revision: row.source_revision,
          projected_at: row.projected_at,
        })
        .eq("packet_id", row.packet_id);
      if (error) throw new Error(`update columns ${row.packet_id}: ${error.message}`);
      imported.push({
        packet_id: row.packet_id,
        file: file.name,
        action: "reprojected_v2_same_hash",
        revision: existing.revision,
      });
      continue;
    }

    const nextRevision = existing ? Number(existing.revision) + 1 : 1;
    const insert = rowToInsert({ ...row, revision: nextRevision });
    const { error } = await sb
      .from("interaction_cases")
      .upsert(insert, { onConflict: "packet_id" });
    if (error) throw new Error(`upsert ${row.packet_id}: ${error.message}`);

    if (existing) {
      const { error: histErr } = await sb.from("interaction_case_revisions").insert({
        case_id: row.packet_id,
        revision: nextRevision,
        previous_revision: Number(existing.revision),
        changed_by: "agent:jhn-git-refresh-#77",
        act_ref: "act:inseme-77-quality-refresh",
        patch: {
          kind: "git_yaml_refresh",
          path: relPath,
          from_hash: existing.packet_hash,
          to_hash: row.packet_hash,
        },
        packet_hash: row.packet_hash,
        source_ref: row.source_ref,
      });
      if (histErr) throw new Error(`history ${row.packet_id}: ${histErr.message}`);
    }

    imported.push({
      packet_id: row.packet_id,
      file: file.name,
      action: existing ? "refreshed_from_git" : "inserted",
      revision: nextRevision,
      status: row.status,
      status_label: row.status_label,
      channel_kind: row.channel_kind,
      next_watch_count: row.next_watch_count,
    });
  }

  const { data: desk, error: deskErr } = await sb
    .from("interaction_cases_desk")
    .select(
      "packet_id,status,status_label,status_display,disclosure,channel_kind,counterparty_label,subject,created_at,next_watch_count,is_open,revision"
    )
    .order("packet_id");
  if (deskErr) throw new Error(`desk view: ${deskErr.message}`);

  const report = {
    projection_version: PROJECTION_VERSION,
    yaml_files_readable: files.length,
    yaml_parse_failures: parseFailures,
    current_rows: desk.length,
    skipped: allSkipped,
    collisions,
    imported,
    desk,
  };
  const outPath = path.join(root, "tmp", "issue77-jhn-quality-refresh.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("Evidence:", outPath);
  console.log(JSON.stringify({ current_rows: desk.length, skipped, desk }, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
