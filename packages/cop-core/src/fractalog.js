/**
 * FractaLog act-record profile.
 *
 * A FractaLog document is the durable complete account of one semantic Act
 * phase. SQL columns are deliberately treated as projections of this document.
 */

import { createCopEventEnvelope, COP_EVENT_SCHEMA, hashPayload } from "./cop-event-envelope.js";

export const FRACTALOG_ACT_RECORD_SCHEMA = "fractalog.act-record/v1";

const ACT_PHASES = new Set(["attempt", "committed", "failed", "refused", "observed"]);
const ACT_PHASE_TO_EPISTEMIC = {
  attempt: "declared",
  committed: "decided",
  failed: "decided",
  refused: "decided",
  observed: "observed",
};

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
    owner_instance_id: input.owner_instance_id || null,
    on_behalf_of_instance_id: input.on_behalf_of_instance_id || null,
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
    owner_instance_id: record.owner_instance_id,
    on_behalf_of_instance_id: record.on_behalf_of_instance_id,
    recorded_at: record.time.recorded_at,
    idempotency_key: record.idempotency_key || null,
    correlation_id: record.correlation_id || null,
    visibility: record.visibility || "restricted",
  };
}

/**
 * Transforms a canonical FractaLog document into a cop.event/v1 envelope.
 * Preserves the canonical document inside envelope.payload and binds its
 * document_hash as payload_hash.
 *
 * @param {object} record - validated FractaLog document
 * @param {object} [options]
 * @returns {object} COP event envelope
 */
export function fractalogRecordToCopEnvelope(record, options = {}) {
  const validation = validateFractalogActRecord(record);
  if (!validation.ok) {
    throw new TypeError(`invalid_fractalog_record:${validation.errors.join(",")}`);
  }

  const epistemicStatus =
    options.epistemic_status ||
    options.epistemicStatus ||
    ACT_PHASE_TO_EPISTEMIC[record.act_phase] ||
    "observed";

  const topicId =
    options.topic_id ||
    options.topicId ||
    (record.act_id.startsWith("act:") ? record.act_id : `act:${record.act_id}`);

  return createCopEventEnvelope({
    event_type: options.event_type || options.eventType || FRACTALOG_ACT_RECORD_SCHEMA,
    topic: { id: topicId },
    epistemic_status: epistemicStatus,
    origin_ref: options.origin_ref || options.originRef || record.record_id,
    subject_ref:
      options.subject_ref ||
      options.subjectRef ||
      record.governed_chain?.logical_agent_ref ||
      record.owner_instance_ref,
    actor_ref:
      options.actor_ref ||
      options.actorRef ||
      record.governed_chain?.logical_agent_ref ||
      record.owner_instance_ref,
    mandate_ref:
      options.mandate_ref || options.mandateRef || record.governed_chain?.mandate_ref || null,
    correlation_id:
      options.correlation_id ||
      options.correlationId ||
      record.correlation_id ||
      `act:${record.act_id}`,
    causation_id: options.causation_id || options.causationId || null,
    visibility: record.visibility || options.visibility || "restricted",
    time: {
      occurred_at: record.time?.recorded_at || null,
      recorded_at: record.time?.recorded_at || new Date().toISOString(),
    },
    payload: structuredClone(record),
    payload_hash: hashPayload(record),
    idempotency_key:
      record.idempotency_key || options.idempotency_key || `fractalog:${record.record_id}`,
    meta: {
      fractalog_schema: record.schema,
      document_hash: record.integrity.document_hash,
      record_id: record.record_id,
      act_id: record.act_id,
      act_kind: record.act_kind,
      act_phase: record.act_phase,
      owner_instance_ref: record.owner_instance_ref,
      on_behalf_of_instance_ref: record.on_behalf_of_instance_ref || null,
      owner_instance_id: record.owner_instance_id || null,
      on_behalf_of_instance_id: record.on_behalf_of_instance_id || null,
      ...(options.meta || {}),
    },
  });
}

/**
 * Extracts and validates a canonical FractaLog document from a COP event envelope.
 *
 * @param {object} envelope
 * @returns {object} canonical FractaLog document
 */
export function copEnvelopeToFractalogRecord(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new TypeError("envelope must be an object");
  }
  const candidate =
    envelope.payload?.schema === FRACTALOG_ACT_RECORD_SCHEMA
      ? envelope.payload
      : envelope.payload &&
          typeof envelope.payload === "object" &&
          envelope.payload.record_id &&
          envelope.payload.schema
        ? envelope.payload
        : null;

  if (!candidate) {
    throw new TypeError("envelope does not contain a FractaLog act record in payload");
  }

  const validation = validateFractalogActRecord(candidate);
  if (!validation.ok) {
    throw new TypeError(`invalid_fractalog_record:${validation.errors.join(",")}`);
  }
  return candidate;
}

/**
 * Derives versioned FractaLog Act documents for each semantic phase of a governed Act chain
 * (CapabilityInvocation -> Act -> Trace -> Imputation).
 *
 * @param {object} governedActResult - return value of recordGovernedAct
 * @param {object} [context] - optional contextual overrides (owner_instance_id, on_behalf_of_instance_id, etc.)
 * @returns {{ attempt: object, decided: object, observed: object | null, records: object[] }}
 */
export function createFractalogRecordsFromGovernedAct(governedActResult, context = {}) {
  if (!governedActResult || typeof governedActResult !== "object") {
    throw new TypeError("governedActResult is required");
  }
  const { act_id, correlation, receipt, events = [] } = governedActResult;
  const actId = act_id || receipt?.act_id;
  if (!actId) throw new TypeError("governedActResult must contain an act_id");

  const invEvent = events.find((e) => e?.payload?.kind === "CapabilityInvocation");
  const actEvent = events.find((e) => e?.payload?.kind === "Act");
  const traceEvent = events.find((e) => e?.payload?.kind === "Trace");
  const imputationEvent = events.find((e) => e?.payload?.kind === "Imputation");

  const outcome = receipt?.outcome || actEvent?.payload?.outcome || "ok";
  const decidedPhase =
    outcome === "ok" ? "committed" : outcome === "refused" ? "refused" : "failed";

  const ownerRef = context.owner_instance_ref || "instance:jhn";
  const onBehalfRef = context.on_behalf_of_instance_ref || null;
  const ownerId = context.owner_instance_id || null;
  const onBehalfId = context.on_behalf_of_instance_id || null;

  const governedChain = {
    principal_ref: receipt?.principal_ref || invEvent?.payload?.principal_ref || "twin:jhn",
    owner_instance_id: ownerId,
    on_behalf_of_instance_id: onBehalfId,
    logical_agent_ref:
      receipt?.logical_agent_ref || invEvent?.payload?.logical_agent_ref || "agent:jhn",
    handler_instance_ref:
      receipt?.handler_instance_ref || invEvent?.payload?.handler_instance_ref || "handler:unknown",
    mandate_ref: receipt?.mandate_ref || invEvent?.payload?.mandate_ref || "mandate:default",
    capability: receipt?.capability || invEvent?.payload?.capability || "unknown.capability",
  };

  const records = [];

  // 1. Attempt phase
  const attemptRecord = createFractalogActRecord({
    record_id: `flr:${actId}:attempt`,
    act_id: actId,
    act_kind: governedChain.capability,
    act_phase: "attempt",
    owner_instance_ref: ownerRef,
    on_behalf_of_instance_ref: onBehalfRef,
    owner_instance_id: ownerId,
    on_behalf_of_instance_id: onBehalfId,
    correlation_id: correlation || `act:${actId}`,
    idempotency_key: `${correlation || `act:${actId}`}:flr:attempt`,
    visibility: invEvent?.visibility || "restricted",
    time: {
      recorded_at: invEvent?.time?.recorded_at || new Date().toISOString(),
    },
    governed_chain: governedChain,
    trace: {
      source: "governed-act",
      event_id: invEvent?.event_id || null,
      invocation_input: invEvent?.payload?.input || {},
      resource_assessments: invEvent?.payload?.resource_assessments || [],
      measured_risk: invEvent?.payload?.measured_risk || null,
    },
  });
  records.push(attemptRecord);

  // 2. Decided phase (committed, refused, or failed)
  const decidedRecord = createFractalogActRecord({
    record_id: `flr:${actId}:${decidedPhase}`,
    act_id: actId,
    act_kind: governedChain.capability,
    act_phase: decidedPhase,
    owner_instance_ref: ownerRef,
    on_behalf_of_instance_ref: onBehalfRef,
    owner_instance_id: ownerId,
    on_behalf_of_instance_id: onBehalfId,
    correlation_id: correlation || `act:${actId}`,
    idempotency_key: `${correlation || `act:${actId}`}:flr:${decidedPhase}`,
    visibility: actEvent?.visibility || "restricted",
    time: {
      recorded_at: actEvent?.time?.recorded_at || new Date().toISOString(),
    },
    governed_chain: governedChain,
    effect: traceEvent?.payload?.effect || {},
    trace: {
      event_id: actEvent?.event_id || null,
      outcome,
    },
    links: [{ ref: attemptRecord.record_id, rel: "attempt" }],
  });
  records.push(decidedRecord);

  // 3. Observed phase (if trace observation exists)
  let observedRecord = null;
  if (traceEvent) {
    observedRecord = createFractalogActRecord({
      record_id: `flr:${actId}:observed`,
      act_id: actId,
      act_kind: governedChain.capability,
      act_phase: "observed",
      owner_instance_ref: ownerRef,
      on_behalf_of_instance_ref: onBehalfRef,
      owner_instance_id: ownerId,
      on_behalf_of_instance_id: onBehalfId,
      correlation_id: correlation || `act:${actId}`,
      idempotency_key: `${correlation || `act:${actId}`}:flr:observed`,
      visibility: traceEvent?.visibility || "restricted",
      time: {
        recorded_at: traceEvent?.time?.recorded_at || new Date().toISOString(),
      },
      governed_chain: governedChain,
      effect: traceEvent?.payload?.effect || {},
      trace: {
        event_id: traceEvent?.event_id || null,
        imputation_event_id: imputationEvent?.event_id || null,
        observed_exposure: traceEvent?.payload?.observed_exposure || null,
        resource_assessments: traceEvent?.payload?.resource_assessments || [],
      },
      links: [{ ref: decidedRecord.record_id, rel: decidedPhase }],
    });
    records.push(observedRecord);
  }

  return {
    attempt: attemptRecord,
    decided: decidedRecord,
    observed: observedRecord,
    records,
  };
}
