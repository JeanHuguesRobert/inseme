/**
 * SQLite backing adapter for direct MCP candidate-result receipts.
 * Reuses the existing transactional COP event store (no second DB/table).
 *
 * This adapter provides atomic uniqueness + durable readback of the observed
 * event. It does NOT yet implement continuation claim/version CAS in the same
 * transaction, so only use for isolated Reality Tests until #121 is wired.
 */
import { createCopEventEnvelope } from "./cop-event-envelope.js";

const receiptOf = (event) => {
  if (!event) return null;
  const body = event.payload || {};
  if (body.surface !== "mcp" || !body.result_digest ||
      !body.candidate_result || !event.idempotency_key) return null;
  return {
    idempotency_key: body.submission_idempotency_key,
    continuation_id: body.candidate_result.continuation_id,
    attempt_id: body.attempt_id,
    authenticated_actor: event.actor_ref,
    result_digest: body.result_digest,
    receipt_ref: "cop:event:" + event.event_id,
  };
};

export function createSqliteMcpResultReceiptStore(copStore) {
  if (!copStore || copStore.kind !== "sqlite" ||
      typeof copStore.append !== "function" ||
      typeof copStore.eventByIdempotency !== "function")
    throw new TypeError("requires existing sqlite COP event store");
  const read = (key) => receiptOf(copStore.eventByIdempotency(key));
  return {
    async readReceipt(key) { return read(key); },
    async readConfirmedReceipt(key) { return read(key); },
    async appendUnique(key, event, proposedReceipt) {
      if (event?.payload?.surface !== "mcp")
        throw new Error("mcp_candidate_required");
      const decorated = createCopEventEnvelope({
        ...event,
        idempotency_key: key,
        payload: {
          ...event.payload,
          submission_idempotency_key: proposedReceipt.idempotency_key,
        },
      });
      const outcome = copStore.append(decorated);
      if (!outcome?.ok) throw new Error(outcome?.error || "cop_append_failed");
      const persisted = receiptOf(outcome.event);
      if (!persisted || persisted.authenticated_actor !== proposedReceipt.authenticated_actor ||
          persisted.continuation_id !== proposedReceipt.continuation_id ||
          persisted.attempt_id !== proposedReceipt.attempt_id ||
          persisted.idempotency_key !== proposedReceipt.idempotency_key ||
          persisted.result_digest !== proposedReceipt.result_digest)
        throw new Error("idempotency_conflict");
      return { inserted: !outcome.duplicate };
    },
  };
}
