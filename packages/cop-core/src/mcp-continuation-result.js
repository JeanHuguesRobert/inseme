/**
 * Direct MCP result ingress for Inseme #113 / Cogentia #330.
 *
 * A pure adapter, not a privileged resolve endpoint. Admission must be
 * independently performed by the MCP/COP host. An accepted candidate is
 * still only evidence for observeContinuationResult(), not completion.
 */
import { hashPayload } from "./cop-event-envelope.js";
import { observeContinuationResult } from "./continuation-result.js";

export const MCP_RESULT_SUBMISSION_PROTOCOL = "cop.continuation-result-submit/v0";
const STATUSES = new Set(["answered", "declined", "failed", "needs_input"]);
const STEP_SCHEMAS = new Set(["cogentia.step_result/v1", "cogentia.step-result/v1"]);

const nonempty = (v) => typeof v === "string" && v.trim().length > 0;
const fail = (reason) => ({ ok: false, reason });

/**
 * @param {object} submission An untrusted result submitted by a model.
 * @param {object} control Independent COP admission data resolved by host.
 * @param {string} control.authenticated_actor Server-authenticated MCP actor.
 * @param {boolean} control.mandate_valid Explicit result-return authority.
 * @param {boolean} control.budget_admitted Reservation/budget gate.
 * @param {boolean} control.claim_valid Valid current worker claim.
 * @param {boolean} control.channel_permitted Terms/permission gate.
 * @param {object} control.continuation Current authoritative snapshot.
 * @param {object} [control.previous] Persisted earlier receipt for same idempotency key.
 *
 * This function does NOT persist and MUST NOT be used as authorization itself.
 */
export function prepareMcpContinuationResult(submission, control = {}) {
  if (!submission || typeof submission !== "object" || Array.isArray(submission))
    return fail("invalid_submission");
  if (submission.protocol !== MCP_RESULT_SUBMISSION_PROTOCOL)
    return fail("unsupported_submission_protocol");
  if (!nonempty(control.authenticated_actor)) return fail("unauthenticated_actor");
  for (const key of ["continuation_id", "attempt_id", "execution_binding_ref",
    "continuation_version", "idempotency_key"])
    if (!nonempty(submission[key])) return fail("missing_" + key);

  // A previously persisted receipt is replayable even if the claim has since
  // expired or the continuation has become terminal. Authenticate the caller
  // and verify the exact actor/scope/digest before consulting active admission.
  // The store MUST look up the receipt atomically by a scoped key.
  const result = submission.step_result;
  if (!result || typeof result !== "object" || Array.isArray(result))
    return fail("invalid_step_result");
  if (!STEP_SCHEMAS.has(result.protocol)) return fail("invalid_step_protocol");
  if (!STATUSES.has(result.status)) return fail("invalid_step_status");
  if (result.status === "answered" && !nonempty(result.result?.answer))
    return fail("missing_answer");
  const digest = hashPayload(result);
  if (submission.result_digest != null && submission.result_digest !== digest)
    return fail("digest_mismatch");
  const previous = control.previous;
  if (previous) {
    if (control.receipt_read_authorized !== true) return fail("receipt_read_not_authorized");
    if (previous.idempotency_key !== submission.idempotency_key ||
        previous.continuation_id !== submission.continuation_id ||
        previous.attempt_id !== submission.attempt_id ||
        previous.authenticated_actor !== control.authenticated_actor)
      return fail("previous_receipt_scope_mismatch");
    if (previous.result_digest !== digest) return fail("idempotency_conflict");
    if (!nonempty(previous.receipt_ref)) return fail("previous_receipt_unconfirmed");
    return { ok: true, duplicate: true, result_digest: digest,
      receipt_ref: previous.receipt_ref, event: null };
  }
  if (control.channel_permitted !== true) return fail("channel_not_permitted");
  if (control.mandate_valid !== true) return fail("mandate_not_valid");
  if (control.budget_admitted !== true) return fail("budget_not_admitted");
  if (control.claim_valid !== true) return fail("claim_not_valid");

  const continuation = control.continuation;
  if (!continuation || continuation.continuation_id !== submission.continuation_id)
    return fail("unknown_continuation");
  if (String(continuation.version ?? "") !== submission.continuation_version)
    return fail("stale_continuation_version");
  if (continuation.execution_binding_ref !== submission.execution_binding_ref)
    return fail("binding_mismatch");
  if (continuation.attempt_id !== submission.attempt_id)
    return fail("attempt_mismatch");
  if (["returned", "resolved", "assimilated", "cancelled", "aborted"].includes(
    continuation.lifecycle ?? continuation.status))
    return fail("terminal_continuation");

  // Challenge is correlation evidence, not an authorization credential.
  // The client must provide it: never synthesize a successful proof of return.
  if (!nonempty(result.challenge) || !nonempty(result.continuation_id) ||
      result.continuation_id !== submission.continuation_id)
    return fail("missing_or_wrong_correlation");

  const observationId = `mcp:${submission.continuation_id}:${submission.attempt_id}:${submission.idempotency_key}`;
  const event = {
    event_type: "cop.event/v1",
    topic_id: `continuation:${submission.continuation_id}`,
    actor_id: control.authenticated_actor,
    origin_ref: `mcp:submission:${observationId}`,
    idempotency_key: `mcp-result:${observationId}`,
    visibility: control.visibility || "restricted",
    epistemic_status: "observed",
    payload: {
      surface: "mcp",
      observation_id: observationId,
      candidate_result: result,
      execution_binding_ref: submission.execution_binding_ref,
      attempt_id: submission.attempt_id,
      result_digest: digest,
      usage_observation: submission.usage_observation || null,
    },
    meta: { transport: "mcp", producer_verification: "not_inferred" },
  };
  return { ok: true, duplicate: false, result_digest: digest, event };
}

/**
 * Preview recognition, without writing or accepting any lifecycle transition.
 * The caller must persist the source event durably and enforce CAS/version and
 * unique-index constraints on the storage layer before acknowledging delivery.
 */
export function previewMcpContinuationResult(submission, control, context) {
  const prepared = prepareMcpContinuationResult(submission, control);
  if (!prepared.ok || prepared.duplicate) return prepared;
  return { ...prepared, recognition: observeContinuationResult(prepared.event, context) };
}
