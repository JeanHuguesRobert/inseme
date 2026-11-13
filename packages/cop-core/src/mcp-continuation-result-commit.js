/**
 * Direct MCP result commit port (Inseme #113, Cogentia #330).
 *
 * Adapter-independent commit boundary. The injected store must provide an
 * atomic unique append and a durable read-after-write. No in-memory Map is
 * acceptable in production. This is not an MCP network endpoint.
 */
import { prepareMcpContinuationResult } from "./mcp-continuation-result.js";
import { createCopEventEnvelope } from "./cop-event-envelope.js";

const error = (reason) => ({ ok: false, reason });
const keyFor = (s, actor) =>
  JSON.stringify(["mcp-result", actor, s.continuation_id, s.attempt_id, s.idempotency_key]);

/**
 * @param {object} submission Untrusted model-supplied result.
 * @param {object} host
 * @param {(submission:object)=>Promise<object>} host.admit Trusted control-plane lookup.
 *   Must authenticate actor, verify mandate, channel permission and budget.
 * @param {object} host.store
 * @param {(key:string)=>Promise<object|null>} host.store.readReceipt Durable lookup.
 * @param {(key:string,event:object,record:object)=>Promise<object>} host.store.appendUnique
 *   Atomic (key, event, receipt-record) insert, returning {inserted:boolean}.
 *   Conflict must not mutate existing record. Ensure DB CAS for continuation
 *   version/claim at the same commit boundary.
 * @param {(key:string)=>Promise<object|null>} host.store.readConfirmedReceipt
 *   Read authoritative durable receipt AFTER append; must be committed, not
 *   an in-memory cache.
 */
export async function commitMcpContinuationResult(submission, host) {
  if (!host || typeof host.admit !== "function" ||
      typeof host.store?.readReceipt !== "function" ||
      typeof host.store?.appendUnique !== "function" ||
      typeof host.store?.readConfirmedReceipt !== "function")
    return error("durable_host_contract_required");
  // Never infer actor, authorization, or budget from submission.
  const control = await host.admit(submission);
  if (!control || typeof control.authenticated_actor !== "string" ||
      !control.authenticated_actor.trim())
    return error("unauthenticated_actor");
  const key = keyFor(submission, control.authenticated_actor);
  const prior = await host.store.readReceipt(key);
  const prepared = prepareMcpContinuationResult(submission, {
    ...control, previous: prior || null,
  });
  if (!prepared.ok) return prepared;
  if (prepared.duplicate) {
    const verified = await host.store.readConfirmedReceipt(key);
    if (!verified || verified.receipt_ref !== prepared.receipt_ref)
      return error("receipt_not_durably_confirmed");
    return { ok: true, duplicate: true, receipt_ref: verified.receipt_ref,
      candidate_status: "observed", continuation_status: "not_yet_resolved" };
  }
  const event = createCopEventEnvelope(prepared.event);
  const receipt = {
    idempotency_key: submission.idempotency_key,
    continuation_id: submission.continuation_id,
    attempt_id: submission.attempt_id,
    authenticated_actor: control.authenticated_actor,
    result_digest: prepared.result_digest,
    receipt_ref: "cop:event:" + event.event_id,
    claim: control.claim || null,
  };
  // appendUnique MUST reject a changed claim/version inside its atomic
  // transaction. In-memory admission alone is susceptible to a TOCTOU race.
  let committed;
  try {
    committed = await host.store.appendUnique(key, event, receipt);
  } catch (cause) {
    // Distinguish a real idempotency conflict from uncertain storage errors.
    // A caller may retry a transient failure using the SAME key and digest.
    const known = new Set(["idempotency_conflict", "claim_fence_required",
      "claim_packet_mismatch", "stale_packet_generation", "stale_claim"]);
    return error(known.has(cause?.message)
      ? cause.message : "storage_outcome_uncertain");
  }
  if (!committed || (committed.inserted !== true && committed.inserted !== false))
    return error("append_unconfirmed");
  const verified = await host.store.readConfirmedReceipt(key);
  if (!verified || !verified.receipt_ref)
    return error("receipt_not_durably_confirmed");
  if (verified.result_digest !== prepared.result_digest)
    return error("idempotency_conflict");
  if (verified.authenticated_actor !== control.authenticated_actor ||
      verified.continuation_id !== submission.continuation_id ||
      verified.attempt_id !== submission.attempt_id)
    return error("receipt_scope_mismatch");
  return {
    ok: true, duplicate: !committed.inserted,
    receipt_ref: verified.receipt_ref,
    candidate_status: "observed",
    continuation_status: "not_yet_resolved",
  };
}
