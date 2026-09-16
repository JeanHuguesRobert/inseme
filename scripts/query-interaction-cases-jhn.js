#!/usr/bin/env node
/**
 * Thin read-only query over Agent JHN interaction_cases_desk (Inseme #77).
 *
 * Usage:
 *   node scripts/query-interaction-cases-jhn.js list [--open] [--limit N] [--json]
 *   node scripts/query-interaction-cases-jhn.js get <packet_id> [--json]
 *
 * Safety: refuses non-JHN Supabase refs. Service-role only; no writes.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const JHN_REF = "ndiysuhzmztatpxbkezn";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env"), quiet: true });

function parseArgs(argv) {
  const args = {
    cmd: argv[0] || "list",
    packetId: null,
    openOnly: false,
    limit: 50,
    json: false,
  };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--open") args.openOnly = true;
    else if (a === "--limit") args.limit = Math.max(1, Number(argv[++i] || 50));
    else if (!a.startsWith("-") && args.cmd === "get" && !args.packetId) {
      args.packetId = a;
    }
  }
  return args;
}

function assertJhn() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url.includes(JHN_REF)) {
    throw new Error(`REFUSING: SUPABASE_URL is not Agent JHN (${JHN_REF})`);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return { url, key };
}

function client(env) {
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listCases(sb, { openOnly, limit }) {
  let q = sb
    .from("interaction_cases_desk")
    .select(
      "packet_id,status,status_label,status_display,disclosure,channel_kind,counterparty_label,subject,created_at,last_updated_at,next_watch_count,is_open,revision,projected_at"
    )
    .order("packet_id")
    .limit(limit);
  if (openOnly) q = q.eq("is_open", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    schema: "inseme.jhn_interaction_cases_list.v1",
    read_only: true,
    twin: "twin:jhn",
    supabase_project_ref: JHN_REF,
    open_only: openOnly,
    count: data.length,
    cases: data,
  };
}

async function getCase(sb, packetId) {
  const { data: desk, error: deskErr } = await sb
    .from("interaction_cases_desk")
    .select("*")
    .eq("packet_id", packetId)
    .maybeSingle();
  if (deskErr) throw new Error(deskErr.message);
  if (!desk) {
    return {
      schema: "inseme.jhn_interaction_cases_get.v1",
      read_only: true,
      twin: "twin:jhn",
      ok: false,
      error: "not_found",
      packet_id: packetId,
    };
  }
  const { data: full, error: fullErr } = await sb
    .from("interaction_cases")
    .select(
      "packet_id,status,status_label,disclosure,subject,primary_channel,channel_kind,counterparty_label,created_at,last_updated_at,next_followup_at,next_watch_count,superseded_by,revision,projection_version,packet_hash,source_ref,projected_at,field_bindings,packet"
    )
    .eq("packet_id", packetId)
    .single();
  if (fullErr) throw new Error(fullErr.message);
  return {
    schema: "inseme.jhn_interaction_cases_get.v1",
    read_only: true,
    twin: "twin:jhn",
    ok: true,
    desk,
    case: full,
  };
}

function formatList(report) {
  const lines = [
    `JHN interaction desk: ${report.count} case(s)${report.open_only ? " (open only)" : ""}`,
  ];
  for (const c of report.cases) {
    lines.push(
      `- ${c.packet_id} | ${c.is_open ? "open" : "closed"} | ${c.status_display || "-"} | D=${c.disclosure || "-"} | watch=${c.next_watch_count ?? "-"} | ${(c.counterparty_label || "").slice(0, 40)} | ${(c.subject || "").slice(0, 50)}`
    );
  }
  return lines.join("\n");
}

function formatGet(report) {
  if (!report.ok) return `Not found: ${report.packet_id}`;
  const d = report.desk;
  return [
    `packet_id: ${d.packet_id}`,
    `status_display: ${d.status_display}`,
    `disclosure: ${d.disclosure}`,
    `is_open: ${d.is_open}`,
    `channel_kind: ${d.channel_kind}`,
    `counterparty: ${d.counterparty_label}`,
    `subject: ${d.subject}`,
    `next_watch_count: ${d.next_watch_count}`,
    `revision: ${d.revision}`,
    `source: ${report.case?.source_ref?.path || "-"}`,
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!["list", "get"].includes(args.cmd)) {
    throw new Error(
      "Usage: query-interaction-cases-jhn.js list|get <packet_id> [--open] [--limit N] [--json]"
    );
  }
  if (args.cmd === "get" && !args.packetId) {
    throw new Error("get requires <packet_id>");
  }

  const env = assertJhn();
  const sb = client(env);
  const report = args.cmd === "list" ? await listCases(sb, args) : await getCase(sb, args.packetId);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${args.cmd === "list" ? formatList(report) : formatGet(report)}\n`);
  }
}

main().catch((err) => {
  const payload = {
    schema: "inseme.jhn_interaction_cases_error.v1",
    ok: false,
    error: err.message,
  };
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    console.error("FAILED:", err.message);
  }
  process.exit(1);
});
