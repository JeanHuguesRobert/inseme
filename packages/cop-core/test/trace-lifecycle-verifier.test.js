import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  verifyTraceLogConformance,
  parseTraceLog,
  formatTraceConformanceReport,
} from "../src/trace-lifecycle-verifier.js";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "bin", "verify-trace-lifecycle.js");

function createSampleConformingEvents() {
  const t0 = "2026-09-08T10:00:00.000Z";
  const t1 = "2026-09-08T10:05:00.000Z";
  const t2 = "2026-09-08T10:10:00.000Z";
  const t3 = "2026-09-08T10:15:00.000Z";

  return [
    createCopEventEnvelope({
      event_id: "evt:obs-1",
      event_type: "TraceObservation",
      subject_ref: "trace:guidance:signal-1",
      actor_ref: "agent:bob",
      time: { recorded_at: t0 },
      payload: { kind: "TraceObservation", trace_ref: "trace:guidance:signal-1" },
    }),
    createCopEventEnvelope({
      event_id: "evt:imp-1",
      event_type: "Imputation",
      subject_ref: "agent:bob",
      actor_ref: "principal:alice",
      time: { recorded_at: t0 },
      payload: {
        kind: "Imputation",
        logical_agent_ref: "agent:bob",
        responsibility: "logical_agent_under_mandate",
      },
    }),
    createCopEventEnvelope({
      event_id: "evt:erasure-1",
      event_type: "TraceLifecycleErasure",
      subject_ref: "trace:guidance:signal-1",
      actor_ref: "agent:bob",
      time: { recorded_at: t1 },
      causation_id: "evt:obs-1",
      payload: {
        kind: "GovernedErasureReceipt",
        target_trace_ref: "trace:guidance:signal-1",
        authority_ref: "policy:retention:privacy-v1",
        effect: "payload_unavailable",
        non_reconstructive: true,
      },
    }),
    createCopEventEnvelope({
      event_id: "evt:expiry-1",
      event_type: "TraceGuidanceExpired",
      subject_ref: "trace:guidance:signal-1",
      actor_ref: "agent:bob",
      time: { recorded_at: t2 },
      causation_id: "evt:obs-1",
      payload: {
        kind: "TraceGuidanceExpired",
        source_trace_ref: "trace:guidance:signal-1",
        temperature: "cold",
        expires_at: t2,
      },
    }),
    // Refused execution under expired guidance (conforming behavior)
    createCopEventEnvelope({
      event_id: "evt:act-refused-1",
      event_type: "CapabilityInvocation",
      subject_ref: "trace:guidance:signal-1",
      actor_ref: "agent:bob",
      time: { recorded_at: t3 },
      payload: {
        kind: "CapabilityInvocation",
        guidance_ref: "trace:guidance:signal-1",
        outcome: "refused",
        error: "guidance_expired",
      },
    }),
  ];
}

describe("Trace Lifecycle Verifier Engine (Issue #73)", () => {
  it("validates a clean, fully conforming trace log with 0 violations across all 5 invariants", () => {
    const events = createSampleConformingEvents();
    const report = verifyTraceLogConformance(events);

    expect(report.ok).toBe(true);
    expect(report.total_events).toBe(5);
    expect(report.violations).toHaveLength(0);
    expect(report.invariants.append_only.ok).toBe(true);
    expect(report.invariants.erasure_receipts.ok).toBe(true);
    expect(report.invariants.expired_guidance_refusal.ok).toBe(true);
    expect(report.invariants.attributable_reactivation.ok).toBe(true);
    expect(report.invariants.routing_imputation_decoupling.ok).toBe(true);
  });

  describe("Invariant 1: Append-Only History & Immutability", () => {
    it("flags in-place mutation when an event_id is redefined with different content", () => {
      const events = createSampleConformingEvents();
      // Tamper: duplicate event_id with altered payload
      events.push(
        createCopEventEnvelope({
          event_id: "evt:obs-1",
          event_type: "TraceObservation",
          payload: { kind: "AlteredPayload" },
        })
      );

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.append_only.ok).toBe(false);
      expect(report.invariants.append_only.violations[0]).toContain("In-place mutation forbidden");
    });

    it("flags causal inversion when a child event is recorded before its parent", () => {
      const events = [
        createCopEventEnvelope({
          event_id: "evt:parent",
          time: { recorded_at: "2026-09-08T12:00:00.000Z" },
          payload: { text: "parent" },
        }),
        createCopEventEnvelope({
          event_id: "evt:child",
          causation_id: "evt:parent",
          time: { recorded_at: "2026-09-08T11:59:00.000Z" }, // earlier than parent!
          payload: { text: "child" },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.append_only.ok).toBe(false);
      expect(report.invariants.append_only.violations[0]).toContain("Causal inversion detected");
    });
  });

  describe("Invariant 2: Governed Erasure Receipts", () => {
    it("flags missing non_reconstructive or authority_ref in erasure receipts", () => {
      const events = [
        createCopEventEnvelope({
          event_id: "evt:bad-erasure",
          event_type: "TraceLifecycleErasure",
          payload: {
            kind: "GovernedErasureReceipt",
            target_trace_ref: "trace:target-1",
            // missing authority_ref, effect, non_reconstructive
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.erasure_receipts.ok).toBe(false);
      expect(report.invariants.erasure_receipts.violations.length).toBeGreaterThanOrEqual(3);
    });

    it("flags sensitive payload leakage inside an erasure receipt", () => {
      const events = [
        createCopEventEnvelope({
          event_id: "evt:leaky-erasure",
          event_type: "TraceLifecycleErasure",
          payload: {
            kind: "GovernedErasureReceipt",
            target_trace_ref: "trace:target-1",
            authority_ref: "policy:retention:privacy-v1",
            effect: "payload_unavailable",
            non_reconstructive: true,
            leak: "raw-sensitive-payload: secret user message",
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.erasure_receipts.ok).toBe(false);
      expect(report.invariants.erasure_receipts.violations[0]).toContain(
        "contains forbidden sensitive keyword"
      );
    });
  });

  describe("Invariant 3: Expired Guidance Signal Refusal", () => {
    it("flags successful act execution performed under expired guidance without reactivation", () => {
      const tExpired = "2026-09-08T10:00:00.000Z";
      const tExecution = "2026-09-08T10:05:00.000Z";

      const events = [
        createCopEventEnvelope({
          event_id: "evt:expiry",
          event_type: "TraceGuidanceExpired",
          payload: {
            source_trace_ref: "trace:stale-guidance",
            expires_at: tExpired,
          },
        }),
        // Act executed successfully without refusal or reactivation!
        createCopEventEnvelope({
          event_id: "evt:illegal-act",
          event_type: "CapabilityInvocation",
          time: { recorded_at: tExecution },
          payload: {
            guidance_ref: "trace:stale-guidance",
            outcome: "ok",
            executed: true,
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.expired_guidance_refusal.ok).toBe(false);
      expect(report.invariants.expired_guidance_refusal.violations[0]).toContain(
        "succeeded under expired guidance"
      );
    });
  });

  describe("Invariant 4: Attributable Reactivation", () => {
    it("flags reactivation attempts lacking reason, mandate_ref, or prior_expiry_event_id", () => {
      const events = [
        createCopEventEnvelope({
          event_id: "evt:expiry-prior",
          event_type: "TraceGuidanceExpired",
          payload: { source_trace_ref: "trace:g1" },
        }),
        createCopEventEnvelope({
          event_id: "evt:bad-reactivation",
          event_type: "TraceGuidanceReactivated",
          payload: {
            source_trace_ref: "trace:g1",
            // missing reason, mandate_ref, prior_expiry_event_id
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.attributable_reactivation.ok).toBe(false);
      expect(report.invariants.attributable_reactivation.violations.length).toBe(3);
    });

    it("accepts valid attributable reactivation and subsequently permits act execution", () => {
      const t0 = "2026-09-08T10:00:00.000Z";
      const t1 = "2026-09-08T10:05:00.000Z";
      const t2 = "2026-09-08T10:10:00.000Z";

      const events = [
        createCopEventEnvelope({
          event_id: "evt:expiry-prior",
          event_type: "TraceGuidanceExpired",
          time: { recorded_at: t0 },
          payload: { source_trace_ref: "trace:g1", expires_at: t0 },
        }),
        createCopEventEnvelope({
          event_id: "evt:valid-reactivation",
          event_type: "TraceGuidanceReactivated",
          time: { recorded_at: t1 },
          payload: {
            source_trace_ref: "trace:g1",
            reason: "Mission parameters require prior historical route",
            mandate_ref: "mandate:mnd-active@v1",
            prior_expiry_event_id: "evt:expiry-prior",
          },
        }),
        // Now execution is permitted
        createCopEventEnvelope({
          event_id: "evt:permitted-act",
          event_type: "CapabilityInvocation",
          time: { recorded_at: t2 },
          payload: {
            guidance_ref: "trace:g1",
            outcome: "ok",
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(true);
      expect(report.invariants.attributable_reactivation.ok).toBe(true);
      expect(report.invariants.expired_guidance_refusal.ok).toBe(true);
    });
  });

  describe("Invariant 5: Routing vs Imputation Decoupling", () => {
    it("flags attempted retroactive repudiation or voiding of past imputations", () => {
      const events = [
        createCopEventEnvelope({
          event_id: "evt:historical-imputation",
          event_type: "Imputation",
          payload: {
            kind: "Imputation",
            logical_agent_ref: "agent:bob",
            responsibility: "logical_agent_under_mandate",
          },
        }),
        createCopEventEnvelope({
          event_id: "evt:repudiation-attempt",
          event_type: "TraceLifecycleTamper",
          payload: {
            repudiate_imputation_id: "evt:historical-imputation",
          },
        }),
      ];

      const report = verifyTraceLogConformance(events);
      expect(report.ok).toBe(false);
      expect(report.invariants.routing_imputation_decoupling.ok).toBe(false);
      expect(report.invariants.routing_imputation_decoupling.violations[0]).toContain(
        "attempted retroactive repudiation of past Imputation"
      );
    });
  });

  describe("CLI and Parsing Support", () => {
    it("parses JSONL formatted trace streams", () => {
      const e1 = { event_id: "e1", event_type: "TraceObservation", payload: {} };
      const e2 = { event_id: "e2", event_type: "TraceObservation", payload: {} };
      const jsonl = `${JSON.stringify(e1)}\n${JSON.stringify(e2)}\n`;

      const parsed = parseTraceLog(jsonl);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].event_id).toBe("e1");
    });

    it("formats human-readable diagnostic report", () => {
      const report = verifyTraceLogConformance(createSampleConformingEvents());
      const formatted = formatTraceConformanceReport(report);
      expect(formatted).toContain("✓ Trace lifecycle conformance: all 5 invariants passed");
      expect(formatted).toContain("1. Append-Only History");
      expect(formatted).toContain("2. Governed Erasure Receipts");
      expect(formatted).toContain("3. Expired Guidance Refusal");
      expect(formatted).toContain("4. Attributable Reactivation");
      expect(formatted).toContain("5. Routing vs Imputation Decoupling");
    });

    it("invokes the CLI runner via subprocess", () => {
      const events = createSampleConformingEvents();
      const jsonl = events.map((e) => JSON.stringify(e)).join("\n");

      const stdout = execFileSync(process.execPath, [CLI, "--json"], {
        input: jsonl,
        encoding: "utf8",
      });

      const parsed = JSON.parse(stdout);
      expect(parsed.ok).toBe(true);
      expect(parsed.total_events).toBe(5);
    });
  });
});
