#!/usr/bin/env node
/**
 * Update an Agent JHN interaction case via optimistic projected write (Inseme #36).
 *
 * Usage:
 *   node scripts/update-interaction-case-jhn.js <packet_id> [options]
 *
 * Options:
 *   --status <status>            Set machine status (active, closed, prepared, superseded, ...)
 *   --status-label <label>       Set narrative status label
 *   --add-watch <item>           Append an item to next_watch[]
 *   --remove-watch <item>        Remove an item from next_watch[]
 *   --followup <YYYY-MM-DD>      Set next_followup_at date
 *   --act-ref <ref>              Optional Act reference for cross-case correlation
 *   --expected-revision <rev>    Explicit expected revision (defaults to current)
 *   --writeback                  Write updated packet back to YAML file in Git
 *   --json                       Output result in JSON format
 *
 * Safety:
 *   Refuses non-JHN Supabase refs. Enforces optimistic concurrency via revision.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import YAML from "yaml";

import {
  applyProjectedUpdate,
  exportPacket,
  hashPacket,
} from "../packages/cop-kernel/src/projections/interactionCase.js";

const JHN_REF = "ndiysuhzmztatpxbkezn";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const jhrPacketsRoot = path.resolve(
  root,
  "..",
  "JeanHuguesRobert",
  "interaction_packets",
  "packets"
);

dotenv.config({ path: path.join(root, ".env"), quiet: true });

function parseArgs(argv) {
  const args = {
    packetId: null,
    status: undefined,
    statusLabel: undefined,
    addWatch: [],
    removeWatch: [],
    followup: undefined,
    actRef: null,
    expectedRevision: null,
    writeback: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") {
      args.json = true;
    } else if (a === "--writeback") {
      args.writeback = true;
    } else if (a === "--status" && argv[i + 1]) {
      args.status = argv[++i];
    } else if (a === "--status-label" && argv[i + 1]) {
      args.statusLabel = argv[++i];
    } else if (a === "--add-watch" && argv[i + 1]) {
      args.addWatch.push(argv[++i]);
    } else if (a === "--remove-watch" && argv[i + 1]) {
      args.removeWatch.push(argv[++i]);
    } else if (a === "--followup" && argv[i + 1]) {
      args.followup = argv[++i];
    } else if (a === "--act-ref" && argv[i + 1]) {
      args.actRef = argv[++i];
    } else if (a === "--expected-revision" && argv[i + 1]) {
      args.expectedRevision = Number(argv[++i]);
    } else if (!a.startsWith("-") && !args.packetId) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.packetId) {
    console.error("Usage: node scripts/update-interaction-case-jhn.js <packet_id> [options]");
    process.exit(1);
  }

  const env = assertJhn();
  const sb = client(env);

  // 1. Fetch current case
  const { data: currentCase, error: fetchErr } = await sb
    .from("interaction_cases")
    .select("*")
    .eq("packet_id", args.packetId)
    .maybeSingle();

  if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
  if (!currentCase) {
    throw new Error(`Interaction case not found: ${args.packetId}`);
  }

  const expectedRev =
    args.expectedRevision !== null ? args.expectedRevision : Number(currentCase.revision);
  if (Number(currentCase.revision) !== expectedRev) {
    throw new Error(
      `Revision mismatch: expected ${expectedRev}, current is ${currentCase.revision}`
    );
  }

  // 2. Prepare changes
  const changedColumns = {};
  if (args.status !== undefined) changedColumns.status = args.status;
  if (args.statusLabel !== undefined) changedColumns.status_label = args.statusLabel;
  if (args.followup !== undefined) changedColumns.next_followup_at = args.followup;

  // Packet-level mutations (e.g. next_watch)
  const currentPacket = currentCase.packet || {};
  let nextWatch = Array.isArray(currentPacket.next_watch) ? [...currentPacket.next_watch] : [];
  let watchModified = false;

  for (const item of args.addWatch) {
    if (!nextWatch.includes(item)) {
      nextWatch.push(item);
      watchModified = true;
    }
  }

  for (const item of args.removeWatch) {
    const idx = nextWatch.indexOf(item);
    if (idx !== -1) {
      nextWatch.splice(idx, 1);
      watchModified = true;
    } else {
      const num = Number(item);
      if (!Number.isNaN(num) && num >= 0 && num < nextWatch.length) {
        nextWatch.splice(num, 1);
        watchModified = true;
      }
    }
  }

  const workingRow = {
    ...currentCase,
    packet: {
      ...currentPacket,
      ...(watchModified ? { next_watch: nextWatch } : {}),
    },
  };

  const updateResult = applyProjectedUpdate(workingRow, changedColumns, {
    expectedRevision: expectedRev,
    changedBy: "cli:update-interaction-case-jhn",
    actRef: args.actRef,
  });

  if (!updateResult.ok) {
    throw new Error(`applyProjectedUpdate failed: ${updateResult.reason}`);
  }

  const mergedPacket = updateResult.row.packet;
  mergedPacket.last_updated = new Date().toISOString().slice(0, 10);

  const sqlPatch = {
    ...changedColumns,
    last_updated_at: mergedPacket.last_updated,
    ...(watchModified ? { next_watch_count: nextWatch.length } : {}),
  };

  // 3. Call SQL function via RPC
  const { data: updatedCase, error: rpcErr } = await sb.rpc("interaction_case_update_projected", {
    p_packet_id: args.packetId,
    p_expected_revision: expectedRev,
    p_patch: sqlPatch,
    p_merged_packet: mergedPacket,
    p_changed_by: "cli:update-interaction-case-jhn",
    p_act_ref: args.actRef,
    p_field_bindings: currentCase.field_bindings,
  });

  if (rpcErr) {
    throw new Error(`RPC update failed: ${rpcErr.message}`);
  }

  // 4. Optional write-back to YAML file in Git
  let writebackResult = null;
  if (args.writeback) {
    const sourceRef = currentCase.source_ref;
    if (!sourceRef || !sourceRef.path) {
      writebackResult = { ok: false, reason: "no_source_ref_path" };
    } else {
      const relativePath = sourceRef.path;
      const targetYaml = path.resolve(root, "..", "JeanHuguesRobert", relativePath);
      if (!fs.existsSync(targetYaml)) {
        writebackResult = { ok: false, reason: "target_file_not_found", targetYaml };
      } else {
        const exported = exportPacket(updateResult.row);
        const yamlString = YAML.stringify(exported);
        fs.writeFileSync(targetYaml, yamlString, "utf8");
        writebackResult = { ok: true, targetYaml };
      }
    }
  }

  // 5. Query updated desk row
  const { data: deskRow } = await sb
    .from("interaction_cases_desk")
    .select("*")
    .eq("packet_id", args.packetId)
    .single();

  const output = {
    schema: "inseme.jhn_interaction_case_update.v1",
    ok: true,
    packet_id: args.packetId,
    previous_revision: expectedRev,
    revision: updatedCase?.revision || expectedRev + 1,
    desk: deskRow,
    writeback: writebackResult,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Updated interaction case: ${args.packetId}`);
    console.log(`  Revision: ${expectedRev} -> ${output.revision}`);
    console.log(`  Status: ${deskRow?.status_display || "—"}`);
    console.log(`  Next watch count: ${deskRow?.next_watch_count ?? "—"}`);
    if (writebackResult) {
      console.log(
        `  Writeback: ${writebackResult.ok ? `saved to ${writebackResult.targetYaml}` : `failed (${writebackResult.reason})`}`
      );
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
