/**
 * SQLite backing adapter for direct MCP candidate-result receipts.
 * Reuses the existing transactional COP event store (no second DB/table).
 *
 * This adapter provides atomic uniqueness + durable readback of the observed
 * event. New observations require current claim/epoch/generation fencing in
 * the SAME SQLite BEGIN IMMEDIATE transaction as the COP event append.
 */
import { createCopEventEnvelope } from "./cop-event-envelope.js";
import { projectPacketCoordination, validateCurrentPacketClaim } from "./packet-coordination.js";

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
      typeof copStore.eventByIdempotency !== "function" ||
      typeof copStore.transaction !== "function")
    throw new TypeError("requires existing sqlite COP event store");
  const read = (key) => receiptOf(copStore.eventByIdempotency(key));
  return {
    async readReceipt(key) { return read(key); },
    async readConfirmedReceipt(key) { return read(key); },
    async appendUnique(key, event, proposedReceipt) {
      if (event?.payload?.surface !== "mcp")
        throw new Error("mcp_candidate_required");
      // Rehash after decorating the payload; never inherit the prior hash.
      const { payload_hash: _oldPayloadHash, ...unhashedEvent } = event;
      const decorated = createCopEventEnvelope({
        ...unhashedEvent,
        idempotency_key: key,
        payload: {
          ...event.payload,
          submission_idempotency_key: proposedReceipt.idempotency_key,
        },
      });
      const witness = proposedReceipt.claim;
      if (!witness || typeof witness.packet_ref !== "string" ||
          !witness.packet_ref || typeof witness.claim_id !== "string" ||
          !witness.claim_id || typeof witness.handler_ref !== "string" ||
          !witness.handler_ref || !Number.isInteger(witness.epoch) ||
          !Number.isInteger(witness.expected_generation))
        throw new Error("claim_fence_required");
      // Prevent unrelated continuation writes under a claim on another packet.
      if (witness.packet_ref !== proposedReceipt.continuation_id)
        throw new Error("claim_packet_mismatch");
      // All coordination writers and result writers must use this same store.
      const committed = copStore.transaction((tx) => {
        const existing = tx.eventByIdempotency(key);
        // Existing receipts are checked even after takeover; duplicates cannot
        // cause a new append and conflicting digests remain a hard error.
        if (existing) return { ok: true, duplicate: true, event: existing };
        const projection = projectPacketCoordination(
          tx.listTopic(`packet-coordination:${witness.packet_ref}`)
            .map(e => e.payload?.packet_coordination_event)
            .filter(Boolean),
        );
        if (projection.generation !== witness.expected_generation)
          throw new Error("stale_packet_generation");
        const valid = validateCurrentPacketClaim(projection, {
          claimId: witness.claim_id, handlerRef: witness.handler_ref,
          epoch: witness.epoch, now: new Date(),
        });
        if (!valid.ok) throw new Error("stale_claim");
        const appended = tx.append(decorated);
        if (!appended?.ok) throw new Error(appended?.error || "cop_append_failed");
        return appended;
      });
      if (!committed.ok) throw new Error(committed.error);
      const outcome = committed.value;
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
