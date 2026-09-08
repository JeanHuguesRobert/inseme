/**
 * packages/cop-core/src/fractalog-spool.js
 *
 * Degraded Fallback Spool Monitor & Forwarder for FractaLog and COP Events.
 * Conforms to COP Core Offline Durability & Ingress Recovery Specification (Inseme #74).
 *
 * Provides:
 * - inspectFractalogSpool(spoolTarget, options): Audits pending spooled records, age, and integrity.
 * - drainFractalogSpool(spoolTarget, ingressClient, options): Forwards spooled records idempotently,
 *   quarantines corrupted entries, and purges or archives successfully transferred records.
 * - formatSpoolInspectionReport(report): Formats human-readable inspection diagnostics.
 * - formatSpoolDrainReport(report): Formats human-readable drain diagnostics.
 */

import fs from "node:fs";
import path from "node:path";
import {
  validateFractalogActRecord,
  fractalogRecordToCopEnvelope,
  copEnvelopeToFractalogRecord,
} from "./fractalog.js";
import { validateCopEventEnvelope, createCopEventEnvelope } from "./cop-event-envelope.js";

const DEFAULT_SPOOL_DIR = ".cop-spool";
const FRACTALOG_SCHEMA = "fractalog.act-record/v1";
const COP_EVENT_SCHEMA = "cop.event/v1";

/**
 * Format duration in milliseconds into human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms) || ms < 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSec}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return `${hours}h ${remMin}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

/**
 * Normalizes and validates a parsed raw JSON object from spool.
 * @param {any} raw
 * @param {object} loc - { file: string, line?: number }
 * @returns {object} normalized record entry
 */
export function normalizeSpoolItem(raw, loc = {}) {
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      errors: ["item_not_object"],
      raw,
      file: loc.file,
      line: loc.line || 1,
    };
  }

  // Case 1: cop.event/v1 envelope
  if (raw.schema === COP_EVENT_SCHEMA) {
    const envVal = validateCopEventEnvelope(raw, { requirePositiveSeq: false });
    if (!envVal.ok) {
      return {
        valid: false,
        errors: envVal.errors.map((e) => `cop_envelope:${e}`),
        raw,
        file: loc.file,
        line: loc.line || 1,
      };
    }

    let record = null;
    let actPhase = raw.meta?.act_phase || "unknown";
    let actId = raw.meta?.act_id || raw.topic?.id || "unknown";
    let recordId = raw.meta?.record_id || raw.event_id;

    if (raw.payload?.schema === FRACTALOG_SCHEMA) {
      const recVal = validateFractalogActRecord(raw.payload);
      if (!recVal.ok) {
        return {
          valid: false,
          errors: recVal.errors.map((e) => `fractalog_record:${e}`),
          raw,
          file: loc.file,
          line: loc.line || 1,
        };
      }
      record = raw.payload;
      actPhase = record.act_phase;
      actId = record.act_id;
      recordId = record.record_id;
    }

    const recordedAt = raw.time?.recorded_at || raw.time?.occurred_at || new Date().toISOString();

    return {
      valid: true,
      kind: "cop_envelope",
      record_id: recordId,
      act_id: actId,
      act_phase: actPhase,
      idempotency_key: raw.idempotency_key || null,
      recorded_at: recordedAt,
      document_hash: raw.meta?.document_hash || raw.payload_hash,
      envelope: raw,
      record,
      file: loc.file,
      line: loc.line || 1,
      raw,
    };
  }

  // Case 2: fractalog.act-record/v1 document
  if (raw.schema === FRACTALOG_SCHEMA) {
    const recVal = validateFractalogActRecord(raw);
    if (!recVal.ok) {
      return {
        valid: false,
        errors: recVal.errors.map((e) => `fractalog_record:${e}`),
        raw,
        file: loc.file,
        line: loc.line || 1,
      };
    }

    let envelope = null;
    try {
      envelope = fractalogRecordToCopEnvelope(raw);
    } catch (err) {
      return {
        valid: false,
        errors: [`envelope_conversion_failed:${err.message}`],
        raw,
        file: loc.file,
        line: loc.line || 1,
      };
    }

    return {
      valid: true,
      kind: "fractalog_record",
      record_id: raw.record_id,
      act_id: raw.act_id,
      act_phase: raw.act_phase,
      idempotency_key: raw.idempotency_key || `fractalog:${raw.record_id}`,
      recorded_at: raw.time?.recorded_at || new Date().toISOString(),
      document_hash: raw.integrity?.document_hash,
      envelope,
      record: raw,
      file: loc.file,
      line: loc.line || 1,
      raw,
    };
  }

  return {
    valid: false,
    errors: [`unrecognized_schema:${raw.schema || "missing"}`],
    raw,
    file: loc.file,
    line: loc.line || 1,
  };
}

/**
 * Finds all active spool files in a target directory or file.
 * Excludes quarantine and archive directories.
 * @param {string} targetPath
 * @param {object} options
 * @returns {string[]} absolute file paths
 */
export function findSpoolFiles(targetPath, options = {}) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    return [];
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return [resolved];
  }

  const quarantineName = options.quarantineDirName || "quarantine";
  const archiveName = options.archiveDirName || "archive";
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === quarantineName || ent.name === archiveName) {
          continue;
        }
        walk(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (ext === ".ndjson" || ext === ".jsonl" || ext === ".json") {
          files.push(full);
        }
      }
    }
  }

  walk(resolved);
  return files.sort();
}

/**
 * Reads and parses records from a single spool file.
 * @param {string} filePath
 * @returns {{ items: object[], file_bytes: number, file_type: string }}
 */
export function parseSpoolFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const items = [];

  if (ext === ".ndjson" || ext === ".jsonl") {
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const lineNum = idx + 1;
      try {
        const obj = JSON.parse(trimmed);
        items.push(normalizeSpoolItem(obj, { file: filePath, line: lineNum }));
      } catch (err) {
        items.push({
          valid: false,
          errors: [`json_syntax_error:${err.message}`],
          raw: trimmed,
          file: filePath,
          line: lineNum,
        });
      }
    });
    return { items, file_bytes: stat.size, file_type: "ndjson" };
  }

  // Standard JSON file
  const trimmed = content.trim();
  if (!trimmed) {
    return { items: [], file_bytes: stat.size, file_type: "json" };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      parsed.forEach((obj, idx) => {
        items.push(normalizeSpoolItem(obj, { file: filePath, line: idx + 1 }));
      });
    } else {
      items.push(normalizeSpoolItem(parsed, { file: filePath, line: 1 }));
    }
  } catch (err) {
    items.push({
      valid: false,
      errors: [`json_syntax_error:${err.message}`],
      raw: trimmed,
      file: filePath,
      line: 1,
    });
  }

  return { items, file_bytes: stat.size, file_type: "json" };
}

/**
 * Inspects a FractaLog / COP degraded fallback spool directory or file.
 *
 * @param {string} [spoolTarget] - Directory or file path. Defaults to '.cop-spool'
 * @param {object} [options]
 * @param {Date} [options.now] - Current reference date for age calculations
 * @returns {object} Inspection report
 */
export function inspectFractalogSpool(spoolTarget = DEFAULT_SPOOL_DIR, options = {}) {
  const resolvedTarget = path.resolve(spoolTarget);
  const now = options.now instanceof Date ? options.now : new Date();

  if (!fs.existsSync(resolvedTarget)) {
    return {
      spool_target: resolvedTarget,
      exists: false,
      total_files: 0,
      total_bytes: 0,
      total_records: 0,
      valid_count: 0,
      corrupted_count: 0,
      oldest_record: null,
      newest_record: null,
      phase_counts: {},
      records: [],
      corrupted: [],
    };
  }

  const files = findSpoolFiles(resolvedTarget, options);
  let totalBytes = 0;
  const allItems = [];

  for (const file of files) {
    const { items, file_bytes } = parseSpoolFile(file);
    totalBytes += file_bytes;
    allItems.push(...items);
  }

  const validRecords = [];
  const corruptedRecords = [];
  const phaseCounts = {
    attempt: 0,
    committed: 0,
    observed: 0,
    failed: 0,
    refused: 0,
    unknown: 0,
  };

  for (const item of allItems) {
    if (item.valid) {
      const recTime = Date.parse(item.recorded_at);
      const ageMs = !Number.isNaN(recTime) ? Math.max(0, now.getTime() - recTime) : 0;
      const enriched = {
        record_id: item.record_id,
        act_id: item.act_id,
        act_phase: item.act_phase,
        recorded_at: item.recorded_at,
        age_ms: ageMs,
        age_human: formatDuration(ageMs),
        document_hash: item.document_hash,
        idempotency_key: item.idempotency_key,
        file: item.file,
        line: item.line,
        _item: item,
      };
      validRecords.push(enriched);

      const p = item.act_phase?.toLowerCase() || "unknown";
      if (Object.prototype.hasOwnProperty.call(phaseCounts, p)) {
        phaseCounts[p] += 1;
      } else {
        phaseCounts.unknown += 1;
      }
    } else {
      corruptedRecords.push({
        file: item.file,
        line: item.line,
        errors: item.errors,
        raw_preview:
          typeof item.raw === "string"
            ? item.raw.slice(0, 120)
            : JSON.stringify(item.raw || {}).slice(0, 120),
        _item: item,
      });
    }
  }

  // Sort valid records chronologically
  validRecords.sort((a, b) => {
    const ta = Date.parse(a.recorded_at) || 0;
    const tb = Date.parse(b.recorded_at) || 0;
    return ta - tb;
  });

  const oldest = validRecords.length > 0 ? validRecords[0] : null;
  const newest = validRecords.length > 0 ? validRecords[validRecords.length - 1] : null;

  return {
    spool_target: resolvedTarget,
    exists: true,
    total_files: files.length,
    total_bytes: totalBytes,
    total_records: allItems.length,
    valid_count: validRecords.length,
    corrupted_count: corruptedRecords.length,
    oldest_record: oldest
      ? {
          record_id: oldest.record_id,
          recorded_at: oldest.recorded_at,
          age_ms: oldest.age_ms,
          age_human: oldest.age_human,
        }
      : null,
    newest_record: newest
      ? {
          record_id: newest.record_id,
          recorded_at: newest.recorded_at,
          age_ms: newest.age_ms,
          age_human: newest.age_human,
        }
      : null,
    phase_counts: phaseCounts,
    records: validRecords.map(({ _item, ...rest }) => rest),
    corrupted: corruptedRecords.map(({ _item, ...rest }) => rest),
    _raw_items: allItems,
    _files: files,
  };
}

/**
 * Forwards spooled records to ingress, quarantines corrupted files/lines, and cleans up.
 *
 * @param {string} spoolTarget - Path to spool directory or file
 * @param {object|Function} ingressClient - Destination store, pipeline, function, or HTTP config
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - If true, simulates forward without dispatching or purging
 * @param {boolean} [options.purge=true] - Remove successfully forwarded files/lines
 * @param {boolean} [options.quarantine=true] - Isolate corrupted records into quarantine directory
 * @param {string} [options.quarantineDir] - Quarantine directory path
 * @param {string} [options.archiveDir] - Archive directory path (if specified, archives instead of unlinking)
 * @param {number} [options.batchSize=Infinity] - Max records to forward in this invocation
 * @param {number} [options.maxErrors=10] - Stop after this many consecutive ingress errors
 * @returns {Promise<object>} Drain summary report
 */
export async function drainFractalogSpool(
  spoolTarget = DEFAULT_SPOOL_DIR,
  ingressClient,
  options = {}
) {
  const inspection = inspectFractalogSpool(spoolTarget, options);
  const dryRun = Boolean(options.dryRun);
  const purge = options.purge !== false;
  const quarantineEnabled = options.quarantine !== false;
  const batchSize =
    Number.isInteger(options.batchSize) && options.batchSize > 0 ? options.batchSize : Infinity;
  const maxErrors =
    Number.isInteger(options.maxErrors) && options.maxErrors > 0 ? options.maxErrors : 10;

  const targetDir =
    fs.existsSync(inspection.spool_target) && fs.statSync(inspection.spool_target).isDirectory()
      ? inspection.spool_target
      : path.dirname(inspection.spool_target);

  const quarantineDir = options.quarantineDir
    ? path.resolve(options.quarantineDir)
    : path.join(targetDir, "quarantine");

  const archiveDir = options.archiveDir ? path.resolve(options.archiveDir) : null;

  if (archiveDir && !dryRun) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const result = {
    spool_target: inspection.spool_target,
    dry_run: dryRun,
    total_spooled: inspection.total_records,
    forwarded: 0,
    duplicates: 0,
    failed: 0,
    quarantined: 0,
    remaining: 0,
    receipts: [],
    errors: [],
    quarantined_entries: [],
  };

  if (!inspection.exists || inspection.total_records === 0) {
    return { ...result, ok: true };
  }

  // Handle quarantine for corrupted entries
  const corruptedItems = (inspection._raw_items || []).filter((it) => !it.valid);
  if (corruptedItems.length > 0 && quarantineEnabled && !dryRun) {
    fs.mkdirSync(quarantineDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantineFile = path.join(quarantineDir, `corrupt-${timestamp}.ndjson`);
    const lines = corruptedItems.map((ci) =>
      JSON.stringify({
        quarantined_at: new Date().toISOString(),
        file: ci.file,
        line: ci.line,
        errors: ci.errors,
        raw: ci.raw,
      })
    );
    fs.appendFileSync(quarantineFile, lines.join("\n") + "\n", "utf8");
    result.quarantined = corruptedItems.length;
    result.quarantined_entries = corruptedItems.map((ci) => ({
      file: ci.file,
      line: ci.line,
      errors: ci.errors,
    }));
  }

  // Forward valid records
  const validItems = (inspection._raw_items || []).filter((it) => it.valid);
  const toProcess = validItems.slice(0, batchSize);

  // Group items by file for partial-drain rewrites
  const fileItemsMap = new Map();
  for (const item of inspection._raw_items || []) {
    if (!fileItemsMap.has(item.file)) {
      fileItemsMap.set(item.file, []);
    }
    fileItemsMap.get(item.file).push(item);
  }

  const succeededItemIds = new Set();
  let consecutiveErrors = 0;

  for (const item of toProcess) {
    if (consecutiveErrors >= maxErrors) {
      result.errors.push(`max_consecutive_errors_reached (${maxErrors})`);
      break;
    }

    if (dryRun) {
      result.forwarded += 1;
      succeededItemIds.add(item);
      continue;
    }

    try {
      const forwardRes = await dispatchToIngress(ingressClient, item);
      if (forwardRes.ok) {
        consecutiveErrors = 0;
        result.forwarded += 1;
        if (forwardRes.duplicate) {
          result.duplicates += 1;
        }
        succeededItemIds.add(item);
        if (forwardRes.receipt) {
          result.receipts.push(forwardRes.receipt);
        }
      } else {
        consecutiveErrors += 1;
        result.failed += 1;
        result.errors.push({
          record_id: item.record_id,
          file: item.file,
          line: item.line,
          error: forwardRes.error || "forward_failed",
          errors: forwardRes.errors,
        });
      }
    } catch (err) {
      consecutiveErrors += 1;
      result.failed += 1;
      result.errors.push({
        record_id: item.record_id,
        file: item.file,
        line: item.line,
        error: `exception:${err.message}`,
      });
    }
  }

  // File synchronization (purge / rewrite remaining / archive)
  if (!dryRun) {
    for (const [filePath, items] of fileItemsMap.entries()) {
      const ext = path.extname(filePath).toLowerCase();
      const isNdjson = ext === ".ndjson" || ext === ".jsonl";

      // Determine items in this file that must remain
      const itemsToKeep = items.filter((item) => {
        if (!item.valid) {
          // If quarantined, remove from file. If quarantine disabled, keep.
          return !quarantineEnabled;
        }
        // Valid item: keep if NOT succeeded
        return !succeededItemIds.has(item);
      });

      if (itemsToKeep.length === 0) {
        // All items in file succeeded or quarantined!
        if (archiveDir) {
          const base = path.basename(filePath);
          const dest = path.join(archiveDir, `${Date.now()}-${base}`);
          try {
            fs.renameSync(filePath, dest);
          } catch {
            fs.copyFileSync(filePath, dest);
            fs.unlinkSync(filePath);
          }
        } else if (purge) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } else {
        // Partial success: rewrite file with only remaining items
        if (isNdjson) {
          const lines = itemsToKeep.map((it) => {
            return typeof it.raw === "string" ? it.raw : JSON.stringify(it.raw);
          });
          fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
        } else {
          // JSON file: rewrite array or single object
          if (itemsToKeep.length === 1 && !Array.isArray(itemRawOriginal(filePath))) {
            fs.writeFileSync(filePath, JSON.stringify(itemsToKeep[0].raw, null, 2), "utf8");
          } else {
            fs.writeFileSync(
              filePath,
              JSON.stringify(
                itemsToKeep.map((it) => it.raw),
                null,
                2
              ),
              "utf8"
            );
          }
        }
      }
    }
  }

  result.remaining =
    validItems.length - succeededItemIds.size + (quarantineEnabled ? 0 : corruptedItems.length);
  result.ok = result.failed === 0 && result.errors.length === 0;

  return result;
}

function itemRawOriginal(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Dispatches an item to the ingress client depending on its interface.
 * @param {object|Function} client
 * @param {object} item
 * @returns {Promise<{ ok: boolean, duplicate?: boolean, error?: string, errors?: string[], receipt?: any }>}
 */
async function dispatchToIngress(client, item) {
  if (!client) {
    return { ok: false, error: "no_ingress_client_provided" };
  }

  // 1. Direct function
  if (typeof client === "function") {
    const res = await client(item.envelope || item.record || item.raw);
    return normalizeIngressResult(res);
  }

  // 2. persistFractalogRecord pipeline
  if (typeof client.persistFractalogRecord === "function") {
    const res = await client.persistFractalogRecord({
      record:
        item.record || (item.envelope ? copEnvelopeToFractalogRecord(item.envelope) : item.raw),
      idempotency_key: item.idempotency_key,
    });
    return normalizeIngressResult(res);
  }

  // 3. append store
  if (typeof client.append === "function") {
    const envelope = item.envelope || fractalogRecordToCopEnvelope(item.record);
    const res = await client.append(envelope);
    return normalizeIngressResult(res);
  }

  // 4. forward method
  if (typeof client.forward === "function") {
    const res = await client.forward(item.envelope || item.record || item.raw);
    return normalizeIngressResult(res);
  }

  // 5. HTTP target endpoint
  if (typeof client.url === "string") {
    const url = client.url;
    const body = JSON.stringify(item.envelope || item.record || item.raw);
    const headers = {
      "Content-Type": "application/json",
      ...(client.headers || {}),
    };
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        ok: false,
        error: `http_${response.status}`,
        errors: [errText || response.statusText],
      };
    }
    const data = await response.json().catch(() => ({ ok: true }));
    return normalizeIngressResult(data);
  }

  return { ok: false, error: "unsupported_ingress_client_interface" };
}

function normalizeIngressResult(res) {
  if (res === true) return { ok: true };
  if (res === false) return { ok: false, error: "ingress_rejected" };
  if (!res || typeof res !== "object") {
    return { ok: false, error: "invalid_ingress_response" };
  }
  return {
    ok: Boolean(res.ok),
    duplicate: Boolean(res.duplicate),
    error: res.error || null,
    errors: res.errors || [],
    receipt: res.event || res.receipt || res.record || null,
  };
}

/**
 * Formats a human-readable text inspection report.
 * @param {object} report
 * @returns {string}
 */
export function formatSpoolInspectionReport(report) {
  const lines = [];
  lines.push("================================================================================");
  lines.push("              FRACTALOG DEGRADED FALLBACK SPOOL STATUS                          ");
  lines.push("================================================================================");
  lines.push(`Target Spool:    ${report.spool_target}`);
  lines.push(`Exists:          ${report.exists ? "yes" : "no (spool directory empty/absent)"}`);

  if (!report.exists || report.total_records === 0) {
    lines.push("Pending Records: 0 (spool clean, no offline records pending)");
    lines.push("================================================================================");
    return lines.join("\n");
  }

  lines.push(`Active Files:    ${report.total_files}`);
  lines.push(
    `Storage Size:    ${(report.total_bytes / 1024).toFixed(2)} KB (${report.total_bytes} bytes)`
  );
  lines.push(`Total Records:   ${report.total_records}`);
  lines.push(`  ✓ Valid:       ${report.valid_count}`);
  lines.push(`  ✗ Corrupted:   ${report.corrupted_count}`);

  if (report.oldest_record) {
    lines.push(
      `Oldest Pending:  ${report.oldest_record.record_id} (${report.oldest_record.age_human} ago @ ${report.oldest_record.recorded_at})`
    );
  }
  if (report.newest_record) {
    lines.push(
      `Newest Pending:  ${report.newest_record.record_id} (${report.newest_record.age_human} ago @ ${report.newest_record.recorded_at})`
    );
  }

  lines.push("");
  lines.push("Semantic Phase Breakdown:");
  for (const [phase, cnt] of Object.entries(report.phase_counts || {})) {
    if (cnt > 0) {
      lines.push(`  - ${phase.padEnd(12)}: ${cnt}`);
    }
  }

  if (report.records && report.records.length > 0) {
    lines.push("");
    lines.push("Pending Queue Samples (up to 5):");
    report.records.slice(0, 5).forEach((rec, idx) => {
      lines.push(
        `  [${idx + 1}] ${rec.record_id} | ${rec.act_phase} | age: ${rec.age_human} | file: ${path.basename(rec.file)}:${rec.line}`
      );
    });
    if (report.records.length > 5) {
      lines.push(`  ... and ${report.records.length - 5} more pending records`);
    }
  }

  if (report.corrupted && report.corrupted.length > 0) {
    lines.push("");
    lines.push("⚠️ Corrupted Entries Detected:");
    report.corrupted.forEach((c, idx) => {
      lines.push(`  [${idx + 1}] ${path.basename(c.file)}:${c.line} -> ${c.errors.join(", ")}`);
      lines.push(`      preview: ${c.raw_preview}`);
    });
  }

  lines.push("================================================================================");
  return lines.join("\n");
}

/**
 * Formats a human-readable text drain report.
 * @param {object} report
 * @returns {string}
 */
export function formatSpoolDrainReport(report) {
  const lines = [];
  lines.push("================================================================================");
  lines.push(`              FRACTALOG SPOOL DRAIN REPORT ${report.dry_run ? "(DRY RUN)" : ""}`);
  lines.push("================================================================================");
  lines.push(`Target Spool:    ${report.spool_target}`);
  lines.push(`Status:          ${report.ok ? "✓ SUCCESS" : "✗ COMPLETED WITH ERRORS"}`);
  lines.push(`Total Spooled:   ${report.total_spooled}`);
  lines.push(
    `  ✓ Forwarded:   ${report.forwarded} (duplicates acknowledged: ${report.duplicates})`
  );
  lines.push(`  ✗ Failed:      ${report.failed}`);
  lines.push(`  ⚠️ Quarantined: ${report.quarantined}`);
  lines.push(`  Remaining:     ${report.remaining}`);

  if (report.errors && report.errors.length > 0) {
    lines.push("");
    lines.push("Errors Encountered:");
    report.errors.forEach((err, idx) => {
      if (typeof err === "string") {
        lines.push(`  [${idx + 1}] ${err}`);
      } else {
        lines.push(
          `  [${idx + 1}] Record ${err.record_id || "unknown"} (${path.basename(err.file || "")}:${err.line}): ${err.error}`
        );
      }
    });
  }

  lines.push("================================================================================");
  return lines.join("\n");
}
