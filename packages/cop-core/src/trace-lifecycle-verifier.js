/**
 * packages/cop-core/src/trace-lifecycle-verifier.js
 *
 * Mechanical conformance verification engine for COP Trace Lifecycle invariants:
 * 1. Append-Only History (no in-place mutation, duplicate collision checks, temporal monotonicity)
 * 2. Governed Erasure Receipts (opaque, non-reconstructive, explicit authority, preserves history)
 * 3. Expired Guidance Refusal (cooling/expired guidance cannot authorize capability execution)
 * 4. Attributable Reactivation (explicit rationale, active mandate, causal link to expiry)
 * 5. Routing vs Imputation Decoupling (cooling affects routing influence, never historical occurrence or past imputations)
 *
 * Implements Inseme Issue #73 (Trace Lifecycle Conformance Engine).
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * Deterministic JSON stringify with sorted keys.
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Parse input into an array of COP event envelopes.
 * Supports:
 * - Array of objects
 * - Object with .replay() method
 * - JSON string (single object or array)
 * - JSON Lines (JSONL) string
 *
 * @param {unknown} input
 * @returns {Array<object>}
 */
export function parseTraceLog(input) {
  if (!input) return [];

  // 1. Store with .replay()
  if (typeof input === "object" && typeof input.replay === "function") {
    return input.replay();
  }

  // 2. Already an array
  if (Array.isArray(input)) {
    return input;
  }

  // 3. String (JSON or JSONL)
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];

    // Try full JSON parse first
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fall back to line-by-line parsing
      }
    }

    // Line-by-line JSONL
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => JSON.parse(line));
  }

  throw new TypeError("parseTraceLog: expected Array, Store with .replay(), or JSON/JSONL string");
}

/**
 * Verify a trace log against the 5 COP Trace Lifecycle conformance invariants.
 *
 * @param {unknown} eventsInput - Array, Store, or JSON/JSONL string
 * @param {object} [options]
 * @param {Date|string} [options.now] - Effective reference time (defaults to Date.now())
 * @param {boolean} [options.allowIdempotentDuplicates=true] - Allow identical deduplicated event IDs
 * @param {string[]} [options.forbidSensitiveKeywords] - Sensitive terms forbidden in erasure receipts
 * @returns {TraceConformanceReport}
 */
export function verifyTraceLogConformance(eventsInput, options = {}) {
  const events = parseTraceLog(eventsInput);
  const now = options.now ? new Date(options.now).getTime() : Date.now();
  const allowIdempotentDuplicates = options.allowIdempotentDuplicates !== false;
  const forbidSensitive = options.forbidSensitiveKeywords || [
    "raw-sensitive-payload",
    "confidential_secret",
    "password",
    "token_private",
  ];

  const violations = [];
  const appendOnlyViolations = [];
  const erasureViolations = [];
  const expiredGuidanceViolations = [];
  const reactivationViolations = [];
  const imputationViolations = [];

  const seenEventMap = new Map(); // event_id -> { canonicalJson, index, time }
  const guidanceStateMap = new Map(); // signalRef -> { state: "active"|"expired", expiredAt, expiryEventId, lastReactivatedAt }
  const pastImputations = new Map(); // imputationEventId -> { event, index }

  // Scan events chronologically
  for (let idx = 0; idx < events.length; idx++) {
    const event = events[idx];
    const eventId = event.event_id || event.eventId || `event-index-${idx}`;
    const eventType = event.event_type || event.eventType || "";
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    const recordedAt = event.time?.recorded_at || event.recorded_at || null;
    const recordedTime = recordedAt ? new Date(recordedAt).getTime() : null;

    // =========================================================================
    // INVARIANT 1: Append-Only History & Immutability
    // =========================================================================
    const canonical = stableStringify(event);
    if (seenEventMap.has(eventId)) {
      const prior = seenEventMap.get(eventId);
      if (prior.canonicalJson !== canonical) {
        const msg = `Invariant 1 violation: Event ID '${eventId}' redefined with divergent content at index ${idx} (prior at ${prior.index}). In-place mutation forbidden.`;
        appendOnlyViolations.push(msg);
        violations.push(msg);
      } else if (!allowIdempotentDuplicates) {
        const msg = `Invariant 1 violation: Duplicate Event ID '${eventId}' detected at index ${idx}.`;
        appendOnlyViolations.push(msg);
        violations.push(msg);
      }
    } else {
      seenEventMap.set(eventId, { canonicalJson: canonical, index: idx, time: recordedTime });
    }

    // Causal time monotonicity: if event references a prior event in this log, child cannot precede parent
    const causalParentId =
      event.causation_id || event.parent_event_id || payload.prior_expiry_event_id;
    if (causalParentId && seenEventMap.has(causalParentId)) {
      const parent = seenEventMap.get(causalParentId);
      if (parent.time && recordedTime && recordedTime < parent.time) {
        const msg = `Invariant 1 violation: Causal inversion detected. Event '${eventId}' (${recordedAt}) recorded before parent '${causalParentId}' (${new Date(parent.time).toISOString()}).`;
        appendOnlyViolations.push(msg);
        violations.push(msg);
      }
    }

    // =========================================================================
    // INVARIANT 2: Governed Erasure Receipts
    // =========================================================================
    const isErasure =
      eventType === "TraceLifecycleErasure" ||
      payload.kind === "GovernedErasureReceipt" ||
      payload.kind === "TraceLifecycleErasure" ||
      payload.effect === "payload_unavailable";

    if (isErasure) {
      const targetRef = payload.target_trace_ref || payload.target_event_id || event.subject_ref;
      if (!targetRef) {
        const msg = `Invariant 2 violation: Governed erasure receipt '${eventId}' missing 'target_trace_ref' or 'target_event_id'.`;
        erasureViolations.push(msg);
        violations.push(msg);
      }

      if (!payload.authority_ref) {
        const msg = `Invariant 2 violation: Governed erasure receipt '${eventId}' missing 'authority_ref' (mandate, legal rule, or retention policy).`;
        erasureViolations.push(msg);
        violations.push(msg);
      }

      if (!payload.effect) {
        const msg = `Invariant 2 violation: Governed erasure receipt '${eventId}' missing 'effect' declaration.`;
        erasureViolations.push(msg);
        violations.push(msg);
      }

      if (payload.non_reconstructive !== true) {
        const msg = `Invariant 2 violation: Governed erasure receipt '${eventId}' must explicitly declare 'non_reconstructive: true'.`;
        erasureViolations.push(msg);
        violations.push(msg);
      }

      // Check for raw sensitive payload leakage
      const serializedPayload = JSON.stringify(payload);
      for (const kw of forbidSensitive) {
        if (serializedPayload.includes(kw)) {
          const msg = `Invariant 2 violation: Governed erasure receipt '${eventId}' contains forbidden sensitive keyword '${kw}'.`;
          erasureViolations.push(msg);
          violations.push(msg);
        }
      }
    }

    // =========================================================================
    // INVARIANT 3: Expired Guidance Signal Refusal
    // =========================================================================
    const isGuidanceExpired =
      eventType === "TraceGuidanceExpired" ||
      payload.kind === "TraceGuidanceExpired" ||
      ((payload.temperature === "cold" || payload.temperature === "frozen") &&
        (payload.expires_at || payload.expired_at));

    if (isGuidanceExpired) {
      const signalRef = payload.source_trace_ref || event.subject_ref || eventId;
      const expiryStr = payload.expires_at || payload.expired_at || recordedAt;
      const expiryTime = expiryStr ? new Date(expiryStr).getTime() : now;

      guidanceStateMap.set(signalRef, {
        state: "expired",
        expiredAt: expiryTime,
        expiryEventId: eventId,
        lastReactivatedAt: null,
      });
    }

    // Check if an Act or CapabilityInvocation occurs using an expired signal
    const isInvocation =
      eventType === "CapabilityInvocation" ||
      payload.kind === "CapabilityInvocation" ||
      payload.kind === "Act" ||
      eventType.startsWith("Act");

    if (isInvocation) {
      const citedSignal = payload.guidance_ref || payload.source_trace_ref || event.subject_ref;
      if (citedSignal && guidanceStateMap.has(citedSignal)) {
        const state = guidanceStateMap.get(citedSignal);
        if (state.state === "expired") {
          const invocationTime = recordedTime || now;
          if (invocationTime >= state.expiredAt) {
            // Must have been refused!
            const outcome = event.outcome || payload.outcome || "";
            const isRefused =
              outcome === "refused" ||
              outcome === "failed" ||
              payload.error === "guidance_expired" ||
              payload.error === "mandate_expired" ||
              payload.executed === false;

            if (!isRefused) {
              const msg = `Invariant 3 violation: Capability invocation '${eventId}' succeeded under expired guidance '${citedSignal}' without required refusal or reactivation.`;
              expiredGuidanceViolations.push(msg);
              violations.push(msg);
            }
          }
        }
      }
    }

    // =========================================================================
    // INVARIANT 4: Attributable Reactivation
    // =========================================================================
    const isReactivation =
      eventType === "TraceGuidanceReactivated" || payload.kind === "TraceGuidanceReactivated";

    if (isReactivation) {
      const signalRef = payload.source_trace_ref || payload.guidance_ref || event.subject_ref;
      if (!signalRef) {
        const msg = `Invariant 4 violation: Reactivation event '${eventId}' missing 'source_trace_ref'.`;
        reactivationViolations.push(msg);
        violations.push(msg);
      }

      if (!payload.reason || typeof payload.reason !== "string" || !payload.reason.trim()) {
        const msg = `Invariant 4 violation: Reactivation event '${eventId}' missing non-empty 'reason'.`;
        reactivationViolations.push(msg);
        violations.push(msg);
      }

      if (
        !payload.mandate_ref ||
        typeof payload.mandate_ref !== "string" ||
        !payload.mandate_ref.trim()
      ) {
        const msg = `Invariant 4 violation: Reactivation event '${eventId}' missing 'mandate_ref'.`;
        reactivationViolations.push(msg);
        violations.push(msg);
      }

      if (!payload.prior_expiry_event_id || typeof payload.prior_expiry_event_id !== "string") {
        const msg = `Invariant 4 violation: Reactivation event '${eventId}' missing causal link 'prior_expiry_event_id'.`;
        reactivationViolations.push(msg);
        violations.push(msg);
      } else if (!seenEventMap.has(payload.prior_expiry_event_id)) {
        // If prior expiry was not found in prior events
        const msg = `Invariant 4 violation: Reactivation event '${eventId}' references prior expiry '${payload.prior_expiry_event_id}' not found in earlier log.`;
        reactivationViolations.push(msg);
        violations.push(msg);
      }

      if (signalRef) {
        guidanceStateMap.set(signalRef, {
          state: "active",
          expiredAt: null,
          expiryEventId: null,
          lastReactivatedAt: recordedTime || now,
        });
      }
    }

    // =========================================================================
    // INVARIANT 5: Routing vs Imputation Decoupling
    // =========================================================================
    const isImputation = payload.kind === "Imputation" || eventType === "Imputation";
    if (isImputation) {
      const agentRef = payload.logical_agent_ref || event.actor_ref || event.subject_ref;
      if (!agentRef) {
        const msg = `Invariant 5 violation: Imputation event '${eventId}' missing 'logical_agent_ref'.`;
        imputationViolations.push(msg);
        violations.push(msg);
      }
      if (!payload.responsibility) {
        const msg = `Invariant 5 violation: Imputation event '${eventId}' missing 'responsibility' declaration.`;
        imputationViolations.push(msg);
        violations.push(msg);
      }
      pastImputations.set(eventId, { event, index: idx });
    }

    // Check if an event attempts to retroactively delete or repudiate an imputation
    if (payload.repudiate_imputation_id || payload.retract_imputation_id) {
      const targetImp = payload.repudiate_imputation_id || payload.retract_imputation_id;
      if (pastImputations.has(targetImp)) {
        const msg = `Invariant 5 violation: Event '${eventId}' attempted retroactive repudiation of past Imputation '${targetImp}'. Imputations remain causally indelible.`;
        imputationViolations.push(msg);
        violations.push(msg);
      }
    }
  }

  const ok = violations.length === 0;
  const summary = ok
    ? `Trace lifecycle conformance: all 5 invariants passed (${events.length} events verified).`
    : `Trace lifecycle conformance: ${violations.length} violation(s) detected across ${events.length} events.`;

  return {
    ok,
    total_events: events.length,
    invariants: {
      append_only: {
        ok: appendOnlyViolations.length === 0,
        violations: appendOnlyViolations,
      },
      erasure_receipts: {
        ok: erasureViolations.length === 0,
        violations: erasureViolations,
      },
      expired_guidance_refusal: {
        ok: expiredGuidanceViolations.length === 0,
        violations: expiredGuidanceViolations,
      },
      attributable_reactivation: {
        ok: reactivationViolations.length === 0,
        violations: reactivationViolations,
      },
      routing_imputation_decoupling: {
        ok: imputationViolations.length === 0,
        violations: imputationViolations,
      },
    },
    violations,
    summary,
  };
}

/**
 * Verify a trace log file from disk.
 * Supports .json and .jsonl files.
 *
 * @param {string} filePath
 * @param {object} [options]
 * @returns {TraceConformanceReport}
 */
export function verifyTraceLogFile(filePath, options = {}) {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf8");
  return verifyTraceLogConformance(content, options);
}

/**
 * Format a human-readable CLI diagnostic report from conformance results.
 * @param {object} report
 * @returns {string}
 */
export function formatTraceConformanceReport(report) {
  const lines = [];
  const symbol = report.ok ? "✓" : "✗";
  lines.push(`${symbol} ${report.summary}`);
  lines.push("");

  const invariantNames = [
    ["append_only", "1. Append-Only History & Immutability"],
    ["erasure_receipts", "2. Governed Erasure Receipts"],
    ["expired_guidance_refusal", "3. Expired Guidance Refusal"],
    ["attributable_reactivation", "4. Attributable Reactivation"],
    ["routing_imputation_decoupling", "5. Routing vs Imputation Decoupling"],
  ];

  for (const [key, label] of invariantNames) {
    const inv = report.invariants[key];
    const s = inv.ok ? "✓" : "✗";
    lines.push(`  ${s} ${label}`);
    for (const v of inv.violations) {
      lines.push(`      ERROR: ${v}`);
    }
  }

  return lines.join("\n");
}
