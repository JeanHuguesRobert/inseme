/**
 * Packet-Backed Projection for Interaction Cases (Inseme #77).
 *
 * SQL columns are a small current-state projection; the richer Interaction Packet
 * is retained losslessly. Writers that understand only projected columns must not
 * destroy unknown Packet fields.
 *
 * Pattern: cogentia/patterns/packet-backed-projection (commit 211194d…)
 *
 * @module projections/interactionCase
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Projection logic version embedded on every projected row. */
export const PROJECTION_VERSION = "interaction_case.v1";

/**
 * Explicit deletion marker for write-back.
 * Distinct from SQL NULL and from property absence.
 */
export const PACKET_DELETE = Object.freeze({ __packet_delete__: true });

export function isPacketDelete(value) {
  return value !== null && typeof value === "object" && value.__packet_delete__ === true;
}

/** Keys promoted into SQL columns (usage-driven; deliberately small). */
export const PROJECTED_PACKET_KEYS = Object.freeze({
  packet_id: ["id"],
  status: ["status"],
  disclosure: ["disclosure", "niveau_divulgation"],
  subject: ["sujet", "subject"],
  primary_channel: ["canal", "primary_channel"],
  counterparty_label: ["interlocuteur", "counterparty_label"],
  created_at: ["created", "created_at"],
  last_updated_at: ["last_updated", "last_updated_at"],
  // next_followup_at / superseded_by: columns exist for future pressure; not
  // auto-derived from next_watch[] / narrative fields in this first slice.
  next_followup_at: ["next_followup_at"],
  superseded_by: ["superseded_by"],
});

/**
 * Pick the first present Packet property among aliases.
 * Returns { key, value } or { key: null, value: undefined } when absent.
 */
export function pickPacketField(packet, aliases) {
  if (!packet || typeof packet !== "object") {
    return { key: null, value: undefined, present: false };
  }
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(packet, key)) {
      return { key, value: packet[key], present: true };
    }
  }
  return { key: null, value: undefined, present: false };
}

/**
 * Normalize disclosure to D0–D4 when recognizable; otherwise pass through.
 */
export function normalizeDisclosure(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const text = String(raw).trim();
  const match = text.match(/\b(D[0-4])\b/i);
  if (match) return match[1].toUpperCase();
  return text;
}

/**
 * Parse a Packet date-ish value into ISO date (YYYY-MM-DD) or null.
 * Does not invent timestamps; preserves date-only Reality of existing packets.
 */
export function coerceProjectedDate(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) {
    return raw.toISOString().slice(0, 10);
  }
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
}

export function hashPacket(packet) {
  const canonical = canonicalJson(packet);
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${digest}`;
}

function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(value[key]);
    }
    return out;
  }
  return value;
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * project(packet) -> columns (+ retained packet snapshot metadata)
 *
 * Reality notes baked into mapping:
 * - Prefer machine `status` over narrative French `statut` (not projected).
 * - Prefer `sujet` then English `subject`.
 * - Prefer `disclosure` then `niveau_divulgation`.
 * - Do not invent next_followup_at from next_watch[].
 */
export function project(packet, options = {}) {
  if (!packet || typeof packet !== "object") {
    throw new TypeError("project(packet): packet must be an object");
  }

  const packetId = pickPacketField(packet, PROJECTED_PACKET_KEYS.packet_id);
  const status = pickPacketField(packet, PROJECTED_PACKET_KEYS.status);
  const disclosure = pickPacketField(packet, PROJECTED_PACKET_KEYS.disclosure);
  const subject = pickPacketField(packet, PROJECTED_PACKET_KEYS.subject);
  const channel = pickPacketField(packet, PROJECTED_PACKET_KEYS.primary_channel);
  const counterparty = pickPacketField(packet, PROJECTED_PACKET_KEYS.counterparty_label);
  const created = pickPacketField(packet, PROJECTED_PACKET_KEYS.created_at);
  const updated = pickPacketField(packet, PROJECTED_PACKET_KEYS.last_updated_at);
  const nextFollowup = pickPacketField(packet, PROJECTED_PACKET_KEYS.next_followup_at);
  const supersededBy = pickPacketField(packet, PROJECTED_PACKET_KEYS.superseded_by);

  const ambiguities = [];
  if (!status.present && Object.prototype.hasOwnProperty.call(packet, "statut")) {
    ambiguities.push({
      field: "status",
      note: "Packet has narrative `statut` but no machine `status`; left SQL status NULL",
      observed: packet.statut,
    });
  }

  const retained = deepClone(packet);
  const projectedAt = options.projectedAt || new Date().toISOString();

  return {
    packet_id: packetId.present ? String(packetId.value) : null,
    status: status.present && status.value !== "" ? String(status.value) : null,
    disclosure: disclosure.present ? normalizeDisclosure(disclosure.value) : null,
    subject: subject.present && subject.value !== "" ? String(subject.value) : null,
    primary_channel: channel.present && channel.value !== "" ? String(channel.value) : null,
    counterparty_label:
      counterparty.present && counterparty.value !== "" ? String(counterparty.value) : null,
    created_at: created.present ? coerceProjectedDate(created.value) : null,
    last_updated_at: updated.present ? coerceProjectedDate(updated.value) : null,
    next_followup_at: nextFollowup.present ? coerceProjectedDate(nextFollowup.value) : null,
    superseded_by:
      supersededBy.present && supersededBy.value !== "" ? String(supersededBy.value) : null,
    revision: options.revision ?? 1,
    projection_version: PROJECTION_VERSION,
    packet: retained,
    packet_schema_version: packet.packet_schema_version ?? packet.schema_version ?? null,
    packet_hash: hashPacket(retained),
    source_ref: options.sourceRef ?? null,
    source_revision: options.sourceRevision ?? null,
    projected_at: projectedAt,
    field_bindings: {
      status: status.key,
      disclosure: disclosure.key,
      subject: subject.key,
      primary_channel: channel.key,
      counterparty_label: counterparty.key,
      created_at: created.key,
      last_updated_at: updated.key,
      next_followup_at: nextFollowup.key,
      superseded_by: supersededBy.key,
    },
    ambiguities,
  };
}

/**
 * inflate(changed_columns) -> PartialPacket
 *
 * Only keys present on `changedColumns` are inflated.
 * - omitted key => absent (no Packet change)
 * - null => PartialPacket value null (merge will NOT delete by default)
 * - PACKET_DELETE => explicit deletion request
 *
 * `fieldBindings` remembers which Packet keys were used at import so write-back
 * updates `sujet` rather than inventing parallel `subject` when that was Reality.
 */
export function inflate(changedColumns, options = {}) {
  if (!changedColumns || typeof changedColumns !== "object") {
    throw new TypeError("inflate(changedColumns): expected object");
  }

  const bindings = {
    status: "status",
    disclosure: "disclosure",
    subject: "sujet",
    primary_channel: "canal",
    counterparty_label: "interlocuteur",
    created_at: "created",
    last_updated_at: "last_updated",
    next_followup_at: "next_followup_at",
    superseded_by: "superseded_by",
    ...(options.fieldBindings || {}),
  };

  const partial = {};
  const meta = { null_fields: [], deleted_fields: [], set_fields: [] };

  const mapScalar = (column, packetKey, transform) => {
    if (!Object.prototype.hasOwnProperty.call(changedColumns, column)) return;
    const raw = changedColumns[column];
    if (isPacketDelete(raw)) {
      partial[packetKey] = PACKET_DELETE;
      meta.deleted_fields.push(packetKey);
      return;
    }
    if (raw === null) {
      // SQL NULL ≠ delete. Record as explicit null in PartialPacket; merge
      // preserves existing Packet property unless nullPolicy === "write_null".
      partial[packetKey] = null;
      meta.null_fields.push(packetKey);
      return;
    }
    const value = transform ? transform(raw) : raw;
    partial[packetKey] = value;
    meta.set_fields.push(packetKey);
  };

  mapScalar("status", bindings.status || "status", (v) => String(v));
  mapScalar("disclosure", bindings.disclosure || "disclosure", normalizeDisclosure);
  mapScalar("subject", bindings.subject || "sujet", (v) => String(v));
  mapScalar("primary_channel", bindings.primary_channel || "canal", (v) => String(v));
  mapScalar("counterparty_label", bindings.counterparty_label || "interlocuteur", (v) => String(v));
  mapScalar("created_at", bindings.created_at || "created", coerceProjectedDate);
  mapScalar("last_updated_at", bindings.last_updated_at || "last_updated", coerceProjectedDate);
  mapScalar(
    "next_followup_at",
    bindings.next_followup_at || "next_followup_at",
    coerceProjectedDate
  );
  mapScalar("superseded_by", bindings.superseded_by || "superseded_by", (v) => String(v));

  return { partial, meta };
}

/**
 * merge_preserving_unknown(stored_packet, partial_packet) -> updated_packet
 *
 * - unknown / non-projected fields always survive
 * - PACKET_DELETE removes a property
 * - null: by default does NOT erase an existing property (SQL NULL ≠ delete)
 *   pass nullPolicy: "write_null" to store JSON null explicitly
 */
export function mergePreservingUnknown(storedPacket, partialPacket, options = {}) {
  if (!storedPacket || typeof storedPacket !== "object") {
    throw new TypeError("mergePreservingUnknown: storedPacket must be an object");
  }
  if (!partialPacket || typeof partialPacket !== "object") {
    throw new TypeError("mergePreservingUnknown: partialPacket must be an object");
  }

  const nullPolicy = options.nullPolicy || "preserve"; // preserve | write_null
  const result = deepClone(storedPacket);

  for (const [key, value] of Object.entries(partialPacket)) {
    if (isPacketDelete(value)) {
      delete result[key];
      continue;
    }
    if (value === null) {
      if (nullPolicy === "write_null") {
        result[key] = null;
      }
      // else: SQL NULL / inflate(null) → leave existing Packet property alone
      continue;
    }
    result[key] = deepClone(value);
  }

  return result;
}

/**
 * Apply a projected-column write against a stored row snapshot.
 * Returns { ok, row, previous, patch, reason }.
 */
export function applyProjectedUpdate(storedRow, changedColumns, options = {}) {
  if (!storedRow || typeof storedRow !== "object") {
    throw new TypeError("applyProjectedUpdate: storedRow required");
  }
  const expectedRevision = options.expectedRevision;
  if (
    expectedRevision !== undefined &&
    expectedRevision !== null &&
    Number(storedRow.revision) !== Number(expectedRevision)
  ) {
    return {
      ok: false,
      reason: "revision_mismatch",
      row: storedRow,
      expectedRevision,
      actualRevision: storedRow.revision,
    };
  }

  const { partial, meta } = inflate(changedColumns, {
    fieldBindings: storedRow.field_bindings || options.fieldBindings,
  });

  const previousPacket = deepClone(storedRow.packet);
  const nextPacket = mergePreservingUnknown(previousPacket, partial, {
    nullPolicy: options.nullPolicy,
  });
  const nextColumns = project(nextPacket, {
    revision: Number(storedRow.revision || 1) + 1,
    projectedAt: options.changedAt || new Date().toISOString(),
    sourceRef: storedRow.source_ref,
    sourceRevision: storedRow.source_revision,
  });

  // Preserve provenance + bindings from prior import when project() re-derives them.
  nextColumns.field_bindings = {
    ...(storedRow.field_bindings || {}),
    ...nextColumns.field_bindings,
  };
  nextColumns.source_ref = storedRow.source_ref ?? nextColumns.source_ref;
  nextColumns.source_revision = storedRow.source_revision ?? nextColumns.source_revision;

  const revisionEntry = {
    case_id: storedRow.packet_id,
    revision: nextColumns.revision,
    previous_revision: storedRow.revision,
    changed_at: nextColumns.projected_at,
    changed_by: options.changedBy || null,
    patch: {
      columns: changedColumns,
      inflate_meta: meta,
      partial,
    },
    packet_hash: nextColumns.packet_hash,
    source_ref: storedRow.source_ref || null,
    act_ref: options.actRef || null,
  };

  return {
    ok: true,
    row: nextColumns,
    previous: storedRow,
    revisionEntry,
    partial,
    meta,
  };
}

/**
 * Export a portable Packet object from a projected row (semantic, not YAML bytes).
 */
export function exportPacket(row) {
  if (!row || typeof row !== "object" || !row.packet) {
    throw new TypeError("exportPacket: row.packet required");
  }
  return deepClone(row.packet);
}

/**
 * Build durable Git provenance for an imported YAML packet.
 */
export function buildGitSourceRef({
  repository,
  path,
  gitRef = null,
  contentHash = null,
  importedAt = null,
}) {
  return {
    kind: "git_yaml_packet",
    repository: repository || null,
    path: path || null,
    git_ref: gitRef,
    content_hash: contentHash,
    imported_at: importedAt || new Date().toISOString(),
  };
}

/**
 * Import path: YAML text or Packet object → projected row.
 */
export function importPacket(packetOrYaml, options = {}) {
  let packet = packetOrYaml;
  if (typeof packetOrYaml === "string") {
    packet = parsePacketYaml(packetOrYaml);
  }
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    throw new TypeError("importPacket: expected Packet object or YAML string");
  }

  const sourceRef =
    options.sourceRef || (options.repository || options.path ? buildGitSourceRef(options) : null);

  const contentHash =
    options.contentHash ||
    (typeof packetOrYaml === "string"
      ? `sha256:${createHash("sha256").update(packetOrYaml, "utf8").digest("hex")}`
      : null);

  if (sourceRef && contentHash && !sourceRef.content_hash) {
    sourceRef.content_hash = contentHash;
  }

  return project(packet, {
    revision: options.revision ?? 1,
    projectedAt: options.projectedAt,
    sourceRef,
    sourceRevision: options.sourceRevision ?? options.gitRef ?? null,
  });
}

let yamlParse = null;

/**
 * Lazy YAML parse — requires `yaml` dependency on @inseme/cop-kernel.
 */
export function parsePacketYaml(text) {
  if (typeof text !== "string") {
    throw new TypeError("parsePacketYaml: text must be a string");
  }
  if (!yamlParse) {
    try {
      yamlParse = require("yaml").parse;
    } catch (err) {
      throw new Error(`parsePacketYaml: cannot load yaml parser (${err.message})`);
    }
  }
  const parsed = yamlParse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("parsePacketYaml: YAML root must be a mapping");
  }
  return parsed;
}
