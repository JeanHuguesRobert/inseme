/**
 * FractaLog act-record profile.
 *
 * A FractaLog document is the durable complete account of one semantic Act
 * phase. SQL columns are deliberately treated as projections of this document.
 */

import { hashPayload } from "./cop-event-envelope.js";

export const FRACTALOG_ACT_RECORD_SCHEMA = "fractalog.act-record/v1";

const ACT_PHASES = new Set(["attempt", "committed", "failed", "refused", "observed"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

function cloneWithoutDocumentHash(record) {
  const copy = structuredClone(record);
  if (isObject(copy.integrity)) delete copy.integrity.document_hash;
  return copy;
}

/**
 * Hashes the canonical document while excluding its self-referential hash.
 * @param {object} record
 * @returns {string}
 */
export function hashFractalogActRecord(record) {
  if (!isObject(record)) throw new TypeError("record must be an object");
  return hashPayload(cloneWithoutDocumentHash(record));
}

/**
 * Creates a versioned FractaLog document. The caller may add fields not yet
 * projected by a store; they are retained and covered by `document_hash`.
 */
export function createFractalogActRecord(input = {}) {
  const now = new Date().toISOString();
  const record = {
    ...structuredClone(input),
    schema: input.schema || FRACTALOG_ACT_RECORD_SCHEMA,
    record_id: requireText(input.record_id, "record_id"),
    act_id: requireText(input.act_id, "act_id"),
    act_kind: requireText(input.act_kind, "act_kind"),
    act_phase: input.act_phase || "observed",
    owner_instance_ref: requireText(input.owner_instance_ref, "owner_instance_ref"),
    on_behalf_of_instance_ref: input.on_behalf_of_instance_ref || null,
    time: {
      ...structuredClone(input.time || {}),
      recorded_at: input.time?.recorded_at || now,
    },
    governed_chain: structuredClone(input.governed_chain || {}),
    trace: structuredClone(input.trace || {}),
    effect: structuredClone(input.effect || {}),
    authority: structuredClone(input.authority || {}),
    links: Array.isArray(input.links) ? structuredClone(input.links) : [],
    integrity: {
      ...structuredClone(input.integrity || {}),
    },
  };

  if (!ACT_PHASES.has(record.act_phase)) {
    throw new TypeError("act_phase must be attempt, committed, failed, refused, or observed");
  }
  record.integrity.document_hash = hashFractalogActRecord(record);
  return record;
}

/**
 * Validates the structural and integrity invariants without discarding unknown
 * fields. Unknown fields are intentional: later projections may use them.
 */
export function validateFractalogActRecord(value) {
  const errors = [];
  if (!isObject(value)) return { ok: false, errors: ["record_must_be_object"] };
  if (value.schema !== FRACTALOG_ACT_RECORD_SCHEMA) {
    errors.push(`schema_must_be_${FRACTALOG_ACT_RECORD_SCHEMA}`);
  }
  for (const field of ["record_id", "act_id", "act_kind", "owner_instance_ref"]) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      errors.push(`${field}_required`);
    }
  }
  if (!ACT_PHASES.has(value.act_phase)) errors.push("act_phase_invalid");
  if (!isObject(value.time) || typeof value.time.recorded_at !== "string") {
    errors.push("time.recorded_at_required");
  } else if (Number.isNaN(Date.parse(value.time.recorded_at))) {
    errors.push("time.recorded_at_invalid");
  }
  if (!isObject(value.integrity) || typeof value.integrity.document_hash !== "string") {
    errors.push("integrity.document_hash_required");
  } else if (value.integrity.document_hash !== hashFractalogActRecord(value)) {
    errors.push("integrity.document_hash_mismatch");
  }
  return errors.length ? { ok: false, errors } : { ok: true, record: value };
}

export function fractalogProjection(record) {
  const validation = validateFractalogActRecord(record);
  if (!validation.ok) {
    throw new TypeError(`invalid_fractalog_record:${validation.errors.join(",")}`);
  }
  return {
    record_id: record.record_id,
    document_schema: record.schema,
    document_hash: record.integrity.document_hash,
    act_id: record.act_id,
    act_kind: record.act_kind,
    act_phase: record.act_phase,
    owner_instance_ref: record.owner_instance_ref,
    on_behalf_of_instance_ref: record.on_behalf_of_instance_ref,
    recorded_at: record.time.recorded_at,
    idempotency_key: record.idempotency_key || null,
    correlation_id: record.correlation_id || null,
    visibility: record.visibility || "restricted",
  };
}
