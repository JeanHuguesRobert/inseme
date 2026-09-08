import { describe, expect, it } from "vitest";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";
import {
  evaluateMandate,
  invokeGovernedCapability,
  recordMandateDeclaration,
  recordGovernedAct,
} from "../src/governed-act.js";

const PRINCIPAL = "principal:alice";
const AGENT = "agent:bob";
const CAPABILITY = "trace:reactivate";
const NOW = new Date("2026-09-08T12:00:00.000Z");

function createMemoryCopStore() {
  const events = [];
  return {
    append(envelope) {
      const event = envelope.schema ? envelope : createCopEventEnvelope(envelope);
      events.push(event);
      return { ok: true, event };
    },
    replay() {
      return structuredClone(events);
    },
  };
}

function createMockHandler() {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async invoke() {
      calls += 1;
      return { executed: true };
    },
  };
}

function appendLifecycleFixture(store, eventType, payload, idempotencyKey) {
  return store.append(
    createCopEventEnvelope({
      event_type: eventType,
      topic_id: "trace-lifecycle:fixture",
      actor_ref: AGENT,
      subject_ref: "trace:guidance:source-1",
      visibility: "restricted",
      payload,
      idempotency_key: idempotencyKey,
    })
  ).event;
}

function assessReactivation({ store, guidance, reason, mandateRef, atTime = NOW }) {
  if (!reason) return { ok: false, error: "reactivation_reason_required" };
  if (!guidance.source_trace_ref) return { ok: false, error: "source_trace_ref_required" };

  const grant = evaluateMandate(store, {
    mandate_ref: mandateRef,
    expected_principal_ref: PRINCIPAL,
    expected_actor_ref: AGENT,
    capability: CAPABILITY,
    at_time: atTime,
  });
  if (!grant.granted) return { ok: false, error: grant.error, grant };

  return { ok: true, grant };
}

describe("COP trace lifecycle conformance fixtures (Issue #72)", () => {
  it("keeps causal history append-only while a governed erasure leaves only a non-reconstructive receipt", () => {
    const store = createMemoryCopStore();
    const source = appendLifecycleFixture(
      store,
      "TraceObservation",
      {
        kind: "TraceObservation",
        trace_ref: "trace:guidance:source-1",
        payload_ref: "vault:opaque:payload-1",
      },
      "trace-observation:source-1"
    );
    const erasure = appendLifecycleFixture(
      store,
      "TraceLifecycleErasure",
      {
        kind: "GovernedErasureReceipt",
        target_trace_ref: "trace:guidance:source-1",
        authority_ref: "policy:retention:privacy-v1",
        effect: "payload_unavailable",
        payload_ref: "vault:opaque:payload-1",
        non_reconstructive: true,
      },
      "trace-erasure:source-1"
    );

    const history = store.replay();
    expect(history).toHaveLength(2);
    expect(history[0].event_id).toBe(source.event_id);
    expect(history[1].event_id).toBe(erasure.event_id);
    expect(history[1].payload).toMatchObject({
      kind: "GovernedErasureReceipt",
      non_reconstructive: true,
    });
    expect(JSON.stringify(history)).not.toContain("raw-sensitive-payload");
  });

  it("refuses a cold, expired guidance signal before the consequential effect boundary", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();
    const mandateRef = "mandate:guidance-expired@v1";

    recordMandateDeclaration(store, {
      mandate_id: mandateRef,
      version: "v1",
      principal_ref: PRINCIPAL,
      logical_agent_ref: AGENT,
      valid_from: "2026-09-01T00:00:00.000Z",
      valid_until: "2026-09-07T00:00:00.000Z",
      scope: { allowed_actions: [CAPABILITY] },
    });
    appendLifecycleFixture(
      store,
      "TraceGuidanceExpired",
      {
        kind: "TraceGuidanceExpired",
        source_trace_ref: "trace:guidance:source-1",
        temperature: "cold",
        expires_at: "2026-09-07T00:00:00.000Z",
      },
      "trace-guidance-expired:source-1"
    );

    const result = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL,
        mandate_ref: mandateRef,
        logical_agent_ref: AGENT,
      },
      capability: CAPABILITY,
      at_time: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("mandate_expired");
    expect(handler.calls).toBe(0);
  });

  it("refuses guidance reactivation without an active mandate and a present reason", () => {
    const store = createMemoryCopStore();
    const guidance = {
      source_trace_ref: "trace:guidance:source-1",
      temperature: "frozen",
    };

    expect(
      assessReactivation({
        store,
        guidance,
        reason: "current mission needs a fresh comparison",
        mandateRef: "mandate:missing@v1",
      })
    ).toMatchObject({ ok: false, error: "mandate_not_found" });
    expect(assessReactivation({ store, guidance, mandateRef: "mandate:missing@v1" })).toMatchObject(
      {
        ok: false,
        error: "reactivation_reason_required",
      }
    );
  });

  it("records an attributable reactivation and replays source, expiry, and reactivation separately", () => {
    const store = createMemoryCopStore();
    const mandateRef = "mandate:guidance-active@v1";
    recordMandateDeclaration(store, {
      mandate_id: mandateRef,
      version: "v1",
      principal_ref: PRINCIPAL,
      logical_agent_ref: AGENT,
      valid_from: "2026-09-01T00:00:00.000Z",
      valid_until: "2026-09-09T00:00:00.000Z",
      scope: { allowed_actions: [CAPABILITY] },
    });
    const source = appendLifecycleFixture(
      store,
      "TraceObservation",
      { kind: "TraceObservation", trace_ref: "trace:guidance:source-1" },
      "trace-observation:reactivation-source"
    );
    const expiry = appendLifecycleFixture(
      store,
      "TraceGuidanceExpired",
      { kind: "TraceGuidanceExpired", source_trace_ref: "trace:guidance:source-1" },
      "trace-guidance-expired:reactivation-source"
    );

    const assessment = assessReactivation({
      store,
      guidance: { source_trace_ref: "trace:guidance:source-1", temperature: "cold" },
      reason: "new evidence makes the prior route relevant again",
      mandateRef,
    });
    expect(assessment.ok).toBe(true);

    const reactivation = appendLifecycleFixture(
      store,
      "TraceGuidanceReactivated",
      {
        kind: "TraceGuidanceReactivated",
        source_trace_ref: "trace:guidance:source-1",
        prior_expiry_event_id: expiry.event_id,
        reason: "new evidence makes the prior route relevant again",
        mandate_ref: mandateRef,
      },
      "trace-guidance-reactivated:source-1"
    );
    const lifecycle = store
      .replay()
      .filter((event) => event.subject_ref === "trace:guidance:source-1");

    expect(lifecycle.map((event) => event.event_type)).toEqual([
      "TraceObservation",
      "TraceGuidanceExpired",
      "TraceGuidanceReactivated",
    ]);
    expect(lifecycle[0].event_id).toBe(source.event_id);
    expect(lifecycle[2].event_id).toBe(reactivation.event_id);
    expect(lifecycle[2].payload).toMatchObject({
      source_trace_ref: "trace:guidance:source-1",
      mandate_ref: mandateRef,
    });
  });

  it("demonstrates that cooling and expiry affect routing influence without altering historical occurrence or past imputations", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();
    const historicalMandateRef = "mandate:prior-routing@v1";

    // 1. Prior historical act when guidance was active and mandate valid
    recordMandateDeclaration(store, {
      mandate_id: historicalMandateRef,
      version: "v1",
      principal_ref: PRINCIPAL,
      logical_agent_ref: AGENT,
      valid_from: "2026-09-01T00:00:00.000Z",
      valid_until: "2026-09-06T00:00:00.000Z",
      scope: { allowed_actions: [CAPABILITY] },
    });

    const historicalAct = recordGovernedAct(store, {
      principal_ref: PRINCIPAL,
      mandate_ref: historicalMandateRef,
      logical_agent_ref: AGENT,
      handler_instance_ref: "handler:prior@local",
      capability: CAPABILITY,
      invocation_input: { target: "resource:1" },
      effect: { updated: true },
      outcome: "ok",
    });
    expect(historicalAct.ok).toBe(true);

    const historicalEvents = store.replay();
    const priorImputation = historicalEvents.find((e) => e?.payload?.kind === "Imputation");
    expect(priorImputation).toBeDefined();
    expect(priorImputation.payload.responsibility).toBe("logical_agent_under_mandate");
    expect(priorImputation.payload.logical_agent_ref).toBe(AGENT);

    // 2. Guidance subsequently cools down and expires
    appendLifecycleFixture(
      store,
      "TraceGuidanceExpired",
      {
        kind: "TraceGuidanceExpired",
        source_trace_ref: "trace:guidance:source-1",
        temperature: "frozen",
        expired_at: "2026-09-06T00:00:01.000Z",
      },
      "trace-guidance-expired:cooling-test"
    );

    // 3. New attempt to invoke using the expired/cooled guidance is refused before effect boundary
    const freshAttempt = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL,
        mandate_ref: historicalMandateRef,
        logical_agent_ref: AGENT,
      },
      capability: CAPABILITY,
      at_time: NOW,
    });
    expect(freshAttempt.ok).toBe(false);
    expect(freshAttempt.error).toBe("mandate_expired");
    expect(handler.calls).toBe(0); // Routing influence severed before handler

    // 4. Invariant: Historical occurrence and prior imputation remain intact and unmutated
    const replayedAfterExpiry = store.replay();
    const retainedImputation = replayedAfterExpiry.find(
      (e) => e.event_id === priorImputation.event_id
    );
    expect(retainedImputation).toBeDefined();
    expect(retainedImputation.payload.responsibility).toBe("logical_agent_under_mandate");
    expect(retainedImputation.payload.logical_agent_ref).toBe(AGENT);
    expect(retainedImputation.time.recorded_at).toBe(priorImputation.time.recorded_at);
  });
});
