import { describe, it, expect } from "vitest";
import { hashPayload } from "../src/cop-event-envelope.js";
import { commitMcpContinuationResult } from "../src/mcp-continuation-result-commit.js";
import { MCP_RESULT_SUBMISSION_PROTOCOL } from "../src/mcp-continuation-result.js";

function specimen(answer = "One") {
  const step_result = {
    protocol: "cogentia.step_result/v1", continuation_id: "ctn_demo",
    challenge: "challenge", status: "answered", result: { answer },
  };
  return {
    protocol: MCP_RESULT_SUBMISSION_PROTOCOL, continuation_id: "ctn_demo",
    attempt_id: "attempt_1", execution_binding_ref: "binding_1",
    continuation_version: "3", idempotency_key: "attempt_1:result:0",
    step_result, result_digest: hashPayload(step_result),
  };
}
function admitted() {
  return {
    authenticated_actor: "mcp:worker:test",
    receipt_read_authorized: true,
    channel_permitted: true, mandate_valid: true,
    budget_admitted: true, claim_valid: true,
    continuation: { continuation_id: "ctn_demo", version: 3,
      attempt_id: "attempt_1", execution_binding_ref: "binding_1",
      lifecycle: "suspended" },
  };
}
/** An atomic, in-memory test double. Not a durable production implementation. */
function fakeHost(control = admitted()) {
  const receipts = new Map();
  const events = new Map();
  let confirmed = true;
  const store = {
    async readReceipt(key) { return receipts.get(key) || null; },
    async appendUnique(key, event, record) {
      if (receipts.has(key)) return { inserted: false };
      receipts.set(key, structuredClone(record));
      events.set(key, structuredClone(event));
      return { inserted: true };
    },
    async readConfirmedReceipt(key) {
      return confirmed ? receipts.get(key) || null : null;
    },
  };
  return {
    admit: async () => control, store, receipts, events,
    setConfirmed: (value) => { confirmed = value; },
  };
}
describe("MCP result durable-ack port — simulation, not deployed persistence", () => {
  it("returns a receipt only after confirmed persisted read", async () => {
    const host = fakeHost();
    const first = await commitMcpContinuationResult(specimen(), host);
    expect(first).toMatchObject({
      ok: true, duplicate: false, candidate_status: "observed",
      continuation_status: "not_yet_resolved",
    });
    expect(first.receipt_ref).toMatch(/^cop:event:/);
    expect(host.events.size).toBe(1);
  });
  it("replays lost ack after terminal status, expired claim and budget", async () => {
    const control = admitted();
    const host = fakeHost(control);
    host.setConfirmed(false);
    expect((await commitMcpContinuationResult(specimen(), host)).reason)
      .toBe("receipt_not_durably_confirmed");
    expect(host.events.size).toBe(1);
    control.continuation.lifecycle = "resolved";
    control.claim_valid = false;
    control.budget_admitted = false;
    control.mandate_valid = false;
    host.setConfirmed(true);
    const retry = await commitMcpContinuationResult(specimen(), host);
    expect(retry).toMatchObject({ ok: true, duplicate: true });
    expect(host.events.size).toBe(1);
  });
  it("two concurrent copies cannot duplicate the persisted event", async () => {
    const host = fakeHost();
    const [a, b] = await Promise.all([
      commitMcpContinuationResult(specimen(), host),
      commitMcpContinuationResult(specimen(), host),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
    expect(host.events.size).toBe(1);
    expect(a.receipt_ref).toBe(b.receipt_ref);
  });
  it("rejects same key with different result digest", async () => {
    const host = fakeHost();
    expect((await commitMcpContinuationResult(specimen(), host)).ok).toBe(true);
    expect((await commitMcpContinuationResult(specimen("Two"), host)).reason)
      .toBe("idempotency_conflict");
    expect(host.events.size).toBe(1);
  });
  it("rejects a foreign actor attempting to replay a receipt", async () => {
    const control = admitted();
    const host = fakeHost(control);
    expect((await commitMcpContinuationResult(specimen(), host)).ok).toBe(true);
    control.authenticated_actor = "mcp:worker:other";
    control.claim_valid = false;
    expect((await commitMcpContinuationResult(specimen(), host)).ok).toBe(false);
  });
  it("does not acknowledge an uncertain storage failure", async () => {
    const host = fakeHost();
    host.store.appendUnique = async () => { throw new Error("disk_unavailable"); };
    const r = await commitMcpContinuationResult(specimen(), host);
    expect(r).toMatchObject({ ok: false, reason: "storage_outcome_uncertain" });
    expect(r.receipt_ref).toBeUndefined();
  });
  it("requires a durable storage interface", async () => {
    expect((await commitMcpContinuationResult(specimen(), {
      admit: async () => admitted(), store: {},
    })).reason).toBe("durable_host_contract_required");
  });
});
