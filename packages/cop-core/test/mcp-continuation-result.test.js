import { describe, it, expect } from "vitest";
import { hashPayload } from "../src/cop-event-envelope.js";
import { prepareMcpContinuationResult, previewMcpContinuationResult,
  MCP_RESULT_SUBMISSION_PROTOCOL } from "../src/mcp-continuation-result.js";

const result = { protocol: "cogentia.step_result/v1",
  continuation_id: "ctn_1", challenge: "challenge-1", status: "answered",
  result: { answer: "A" } };
const submission = () => ({
  protocol: MCP_RESULT_SUBMISSION_PROTOCOL,
  continuation_id: "ctn_1", attempt_id: "attempt_1",
  execution_binding_ref: "binding_1", continuation_version: "7",
  idempotency_key: "attempt_1:result:0", result_digest: hashPayload(result),
  step_result: structuredClone(result),
});
const control = () => ({
  authenticated_actor: "mcp:worker:1", receipt_read_authorized: true, channel_permitted: true,
  mandate_valid: true, budget_admitted: true, claim_valid: true,
  continuation: { continuation_id: "ctn_1", version: 7,
    execution_binding_ref: "binding_1", attempt_id: "attempt_1",
    lifecycle: "suspended" },
});
const context = () => ({
  continuations: { ctn_1: { continuation_id: "ctn_1",
    correlation: { challenge: "challenge-1" },
    expected_result: { schema: "cogentia.step_result/v1" },
    lifecycle: "suspended" } },
});
describe("direct MCP continuation result adapter", () => {
  it("normalizes direct submission without resolving continuation", () => {
    const r = previewMcpContinuationResult(submission(), control(), context());
    expect(r.ok).toBe(true);
    expect(r.recognition.progression).toBe("returned");
    expect(r.event.payload.surface).toBe("mcp");
    expect(r.recognition.proposed_events.every(e =>
      e.event_type !== "cop.continuation.resume")).toBe(true);
  });
  it("requires independent admission", () => {
    for (const name of ["channel_permitted", "mandate_valid", "budget_admitted", "claim_valid"]) {
      const c = control(); c[name] = false;
      expect(prepareMcpContinuationResult(submission(), c).ok).toBe(false);
    }
  });
  it("rejects stale, foreign binding or attempt", () => {
    const c = control(); c.continuation.version = 8;
    expect(prepareMcpContinuationResult(submission(), c).reason)
      .toBe("stale_continuation_version");
    const b = control(); b.continuation.execution_binding_ref = "other";
    expect(prepareMcpContinuationResult(submission(), b).reason)
      .toBe("binding_mismatch");
    const a = control(); a.continuation.attempt_id = "other";
    expect(prepareMcpContinuationResult(submission(), a).reason)
      .toBe("attempt_mismatch");
  });
  it("recognizes prior durable receipt and rejects changed payload", () => {
    const s = submission();
    const c = control();
    c.previous = { idempotency_key: s.idempotency_key,
      continuation_id: s.continuation_id, attempt_id: s.attempt_id,
      result_digest: s.result_digest, receipt_ref: "receipt:1", authenticated_actor: "mcp:worker:1" };
    const duplicate = prepareMcpContinuationResult(s, c);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.receipt_ref).toBe("receipt:1");
    const changed = submission();
    changed.step_result.result.answer = "B";
    changed.result_digest = hashPayload(changed.step_result);
    expect(prepareMcpContinuationResult(changed, c).reason).toBe("idempotency_conflict");
  });
  it("permits exact receipt replay after claim, budget and continuation expiry", () => {
    const s = submission(); const c = control();
    c.claim_valid = false; c.budget_admitted = false; c.mandate_valid = false;
    c.continuation.lifecycle = "resolved";
    c.previous = { idempotency_key: s.idempotency_key,
      continuation_id: s.continuation_id, attempt_id: s.attempt_id,
      result_digest: s.result_digest, receipt_ref: "receipt:1",
      authenticated_actor: c.authenticated_actor };
    expect(prepareMcpContinuationResult(s, c).duplicate).toBe(true);
    c.receipt_read_authorized = false;
    expect(prepareMcpContinuationResult(s, c).reason).toBe("receipt_read_not_authorized");
  });
  it("rejects mismatched digests and malformed results", () => {
    const s = submission(); s.result_digest = "sha256:wrong";
    expect(prepareMcpContinuationResult(s, control()).reason).toBe("digest_mismatch");
    const s2 = submission(); s2.step_result.challenge = "";
    s2.result_digest = hashPayload(s2.step_result);
    expect(prepareMcpContinuationResult(s2, control()).reason).toBe("missing_or_wrong_correlation");
  });
  it("does not authenticate claimed model provenance", () => {
    const r = previewMcpContinuationResult(submission(), control(), context());
    expect(r.recognition.provenance.cognitive_producer_verified).toBe(false);
  });
});
