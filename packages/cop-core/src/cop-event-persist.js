/**
 * Persist pipeline for COP events (Inseme #28).
 *
 * raw delivery → optional artifact externalization → envelope → store.append
 * On store failure → NDJSON spool (degraded mode).
 *
 * Backend-independent: works with memory store + fs/memory artifacts.
 */

import {
  createCopEventEnvelope,
  hashPayload,
  validateCopEventEnvelope,
} from "./cop-event-envelope.js";
import { externalizeRawBody } from "./cop-event-artifacts.js";
import { mapDeliveryToCopEvent } from "./github-ingress.js";
import { fractalogRecordToCopEnvelope, validateFractalogActRecord } from "./fractalog.js";

/**
 * @param {object} options
 * @param {object} options.store - append-only store (memory or compatible)
 * @param {object} [options.spool] - NDJSON spool with enqueue()
 * @param {object} [options.artifacts] - artifact store
 * @param {number} [options.artifact_threshold_bytes]
 */
export function createCopEventPersistPipeline(options) {
  if (!options?.store) throw new Error("store required");
  const store = options.store;
  const spool = options.spool || null;
  const artifacts = options.artifacts || null;
  const threshold = options.artifact_threshold_bytes ?? 8 * 1024;

  return {
    kind: "cop_event_persist_pipeline",

    /**
     * Persist a GitHub-style delivery + raw body into COP events.
     *
     * @param {object} input
     * @param {object} input.delivery - normalized delivery fields
     * @param {object} input.payload - parsed JSON payload
     * @param {string|Buffer} [input.rawBody]
     * @param {object} [input.mapOptions] - mapDeliveryToCopEvent options
     * @param {string} [input.visibility]
     */
    async persistGithubDelivery(input) {
      const delivery = input.delivery || {};
      const payload = input.payload || {};
      const rawBody = input.rawBody != null ? input.rawBody : JSON.stringify(payload);

      let artifact_ref = null;
      let raw_hash = null;
      if (artifacts && rawBody != null) {
        const ext = externalizeRawBody(rawBody, artifacts, {
          threshold_bytes: threshold,
          force: Buffer.byteLength(String(rawBody), "utf8") >= threshold,
          content_type: "application/json",
        });
        raw_hash = ext.payload_hash;
        artifact_ref = ext.artifact_ref;
      } else if (rawBody != null) {
        raw_hash = hashPayload(typeof rawBody === "string" ? { _raw: rawBody } : rawBody);
      }

      const mapped = mapDeliveryToCopEvent(delivery, payload, input.mapOptions || {});
      const idempotency_key =
        input.idempotency_key || `github:${delivery.delivery_id}:${delivery.event_name}`;

      const envelope = createCopEventEnvelope({
        ...mapped,
        visibility: input.visibility || "restricted",
        artifact_ref,
        idempotency_key,
        meta: {
          ...(mapped.meta || {}),
          raw_payload_hash: raw_hash,
          delivery_id: delivery.delivery_id,
        },
      });

      // Prefer raw body hash when externalized for payload_hash of summary payload still valid
      const validation = validateCopEventEnvelope(envelope, {
        requirePositiveSeq: false,
      });
      if (!validation.ok) {
        return {
          ok: false,
          error: "invalid_envelope",
          errors: validation.errors,
          spooled: false,
        };
      }

      const appended = store.append(envelope);
      if (appended.ok) {
        return {
          ok: true,
          duplicate: Boolean(appended.duplicate),
          event: appended.event,
          artifact_ref,
          spooled: false,
        };
      }

      // Degraded: spool for later replay
      if (spool) {
        const q = spool.enqueue(envelope);
        return {
          ok: false,
          error: appended.error || "store_append_failed",
          errors: appended.errors,
          spooled: q.ok,
          spool_error: q.ok ? null : q.error,
          event: envelope,
          artifact_ref,
        };
      }

      return {
        ok: false,
        error: appended.error || "store_append_failed",
        errors: appended.errors,
        spooled: false,
        artifact_ref,
      };
    },

    /**
     * Replay spool into store (operator recovery).
     */
    replaySpool(opts = {}) {
      if (!spool || typeof spool.replayInto !== "function") {
        return { ok: false, error: "no_spool" };
      }
      return spool.replayInto(store, opts);
    },

    /**
     * Persist a COP accounting transaction event with offline spool fallback.
     *
     * @param {object} input
     * @param {object} input.transactionEvent - COP accounting/transaction payload
     * @param {string} [input.idempotency_key]
     * @param {string} [input.visibility="restricted"]
     */
    async persistAccountingEvent(input) {
      const txn = input.transactionEvent || {};
      const idempotency_key =
        input.idempotency_key || txn.idempotency_key || `txn:${txn.transaction_id}`;

      const rawVis = input.visibility || txn.disclosure_class || "restricted";
      const visibility = rawVis === "public" ? "open" : rawVis;

      const envelope = createCopEventEnvelope({
        event_type: txn.eventType || "accounting/transaction",
        topic: { id: "cop/accounting" },
        source: txn.governance?.actor_subject_id || "agent:jhn:main",
        visibility,
        idempotency_key,
        payload: txn,
        meta: txn.metadata || {},
      });

      const validation = validateCopEventEnvelope(envelope, {
        requirePositiveSeq: false,
      });
      if (!validation.ok) {
        return {
          ok: false,
          error: "invalid_envelope",
          errors: validation.errors,
          spooled: false,
        };
      }

      const appended = store.append(envelope);
      if (appended.ok) {
        return {
          ok: true,
          duplicate: Boolean(appended.duplicate),
          event: appended.event,
          spooled: false,
        };
      }

      // Degraded: spool for later replay
      if (spool) {
        const q = spool.enqueue(envelope);
        return {
          ok: false,
          error: appended.error || "store_append_failed",
          errors: appended.errors,
          spooled: q.ok,
          spool_error: q.ok ? null : q.error,
          event: envelope,
        };
      }

      return {
        ok: false,
        error: appended.error || "store_append_failed",
        errors: appended.errors,
        spooled: false,
      };
    },

    /**
     * Persist a FractaLog act record into COP events with offline spool fallback.
     *
     * @param {object} input
     * @param {object} input.record - validated fractalog.act-record/v1 document
     * @param {string} [input.idempotency_key]
     * @param {string} [input.visibility]
     * @param {string} [input.topic_id]
     */
    async persistFractalogRecord(input) {
      const record = input?.record || input;
      const validation = validateFractalogActRecord(record);
      if (!validation.ok) {
        return {
          ok: false,
          error: "invalid_fractalog_record",
          errors: validation.errors,
          spooled: false,
        };
      }

      const envelope = fractalogRecordToCopEnvelope(record, {
        idempotency_key: input?.idempotency_key,
        visibility: input?.visibility,
        topic_id: input?.topic_id,
      });

      const envValidation = validateCopEventEnvelope(envelope, {
        requirePositiveSeq: false,
      });
      if (!envValidation.ok) {
        return {
          ok: false,
          error: "invalid_envelope",
          errors: envValidation.errors,
          spooled: false,
        };
      }

      const appended = store.append(envelope);
      if (appended.ok) {
        return {
          ok: true,
          duplicate: Boolean(appended.duplicate),
          event: appended.event,
          record,
          spooled: false,
        };
      }

      // Degraded: spool for later replay
      if (spool) {
        const q = spool.enqueue(envelope);
        return {
          ok: false,
          error: appended.error || "store_append_failed",
          errors: appended.errors,
          spooled: q.ok,
          spool_error: q.ok ? null : q.error,
          event: envelope,
          record,
        };
      }

      return {
        ok: false,
        error: appended.error || "store_append_failed",
        errors: appended.errors,
        spooled: false,
        record,
      };
    },
  };
}

/**
 * Shape a row suitable for github_webhook_deliveries upsert (no raw body).
 */
export function deliveryRowFromIngress(delivery, rawHash, artifactRef) {
  return {
    delivery_id: delivery.delivery_id,
    event_name: delivery.event_name,
    action: delivery.action ?? null,
    repository_name: delivery.repository_name ?? null,
    installation_id: delivery.installation_id ?? null,
    sender_login: delivery.sender_login ?? null,
    signature_sha256: delivery.signature_sha256 ?? null,
    payload_sha256: rawHash || delivery.payload_sha256 || null,
    raw_artifact_ref: artifactRef,
    processing_state: "received",
    received_at: new Date().toISOString(),
  };
}
