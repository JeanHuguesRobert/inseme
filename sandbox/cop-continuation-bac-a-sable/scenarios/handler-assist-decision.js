import { pathToFileURL } from "node:url";
import { createMemoryCopEventStore } from "../../../packages/cop-core/src/cop-event-spool.js";

const PATHS = Object.freeze(["local_only", "handler_assisted"]);

function requireNonEmptyText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value.trim();
}

function normalizeAssertionRefs(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError("decisive_assertion_refs must be an array");
  return value.map((ref, index) =>
    requireNonEmptyText(ref, `decisive_assertion_refs[${index}]`)
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/**
 * Sandbox-only reason-bearing value for the higher-level choice between a
 * local response and requesting handler assistance.
 *
 * The value deliberately contains no availability, provider, HandlerInstance,
 * Mandate, budget, authorization, execution, or usefulness-result fields.
 */
export function createHandlerAssistDecision({
  decision_id,
  selected_path,
  rationale_summary,
  capability_requirement = null,
  decisive_assertion_refs = [],
  decided_at = new Date().toISOString(),
} = {}) {
  requireNonEmptyText(decision_id, "decision_id");
  if (!PATHS.includes(selected_path)) {
    throw new TypeError(`selected_path must be one of: ${PATHS.join(", ")}`);
  }

  const summary = requireNonEmptyText(rationale_summary, "rationale_summary");
  const assertionRefs = normalizeAssertionRefs(decisive_assertion_refs);

  if (selected_path === "handler_assisted") {
    requireNonEmptyText(capability_requirement?.capability, "capability_requirement.capability");
  } else if (capability_requirement !== null) {
    throw new TypeError("capability_requirement must be null for local_only");
  }

  return Object.freeze({
    kind: "handler_assist.decision",
    decision_id,
    selected_path,
    alternatives: PATHS,
    capability_requirement:
      capability_requirement === null
        ? null
        : deepFreeze(structuredClone(capability_requirement)),
    rationale: Object.freeze({
      kind: "reasoned",
      summary,
      decisive_assertion_refs: Object.freeze(assertionRefs),
    }),
    decided_at: requireNonEmptyText(decided_at, "decided_at"),
  });
}

/**
 * Compatibility projection for the current shouldDelegate(): boolean contract.
 * It preserves the choice while refusing to invent a reason or Assertion.
 */
export function projectLegacyHandlerAssistDecision({
  decision_id,
  wants_delegate,
  capability_requirement = { capability: "reasoning.assist" },
  decided_at = new Date().toISOString(),
} = {}) {
  requireNonEmptyText(decision_id, "decision_id");
  if (typeof wants_delegate !== "boolean") {
    throw new TypeError("wants_delegate must be a boolean");
  }
  if (wants_delegate) {
    requireNonEmptyText(capability_requirement?.capability, "capability_requirement.capability");
  }

  return Object.freeze({
    kind: "handler_assist.decision",
    decision_id,
    selected_path: wants_delegate ? "handler_assisted" : "local_only",
    alternatives: PATHS,
    capability_requirement: wants_delegate
      ? deepFreeze(structuredClone(capability_requirement))
      : null,
    rationale: Object.freeze({
      kind: "legacy_boolean",
      summary: null,
      decisive_assertion_refs: Object.freeze([]),
    }),
    decided_at: requireNonEmptyText(decided_at, "decided_at"),
  });
}

export function recordHandlerAssistDecision({
  store,
  decision,
  topic_id,
  actor_ref,
  visibility = "restricted",
} = {}) {
  if (!store || typeof store.append !== "function") {
    throw new TypeError("store.append is required");
  }
  if (decision?.kind !== "handler_assist.decision") {
    throw new TypeError("decision must be a handler_assist.decision");
  }

  const result = store.append({
    event_type: "HandlerAssistDecisionRecorded",
    topic_id: requireNonEmptyText(topic_id, "topic_id"),
    epistemic_status: "decided",
    actor_ref: requireNonEmptyText(actor_ref, "actor_ref"),
    visibility,
    payload: structuredClone(decision),
    idempotency_key: `handler-assist-decision:${decision.decision_id}`,
  });
  if (!result.ok) throw new Error(result.errors?.join(", ") || result.error);
  return result.event;
}

function appendDownstreamFact(store, decisionEvent, kind, payload = {}) {
  const result = store.append({
    event_type: kind,
    topic_id: decisionEvent.topic.id,
    epistemic_status: "observed",
    actor_ref: "logical-agent:jhn",
    visibility: decisionEvent.visibility,
    causation_id: decisionEvent.event_id,
    parent_event_ids: [decisionEvent.event_id],
    payload: {
      kind,
      decision_ref: decisionEvent.payload.decision_id,
      ...payload,
    },
  });
  if (!result.ok) throw new Error(result.errors?.join(", ") || result.error);
  return result.event;
}

/**
 * Bounded Reality test for A-D. This is not the production runtime.
 */
export function runHandlerAssistSandbox({
  decision,
  handler_available = false,
  refusal = null,
  execute = false,
} = {}) {
  const store = createMemoryCopEventStore();
  const decisionEvent = recordHandlerAssistDecision({
    store,
    decision,
    topic_id: `sandbox:${decision.decision_id}`,
    actor_ref: "logical-agent:jhn",
  });

  if (decision.selected_path === "local_only") {
    return { decision_event: decisionEvent, events: store.replay() };
  }

  if (!handler_available) {
    appendDownstreamFact(store, decisionEvent, "HandlerAssistUnavailable", {
      reason: "required_capability_unavailable",
    });
    return { decision_event: decisionEvent, events: store.replay() };
  }

  appendDownstreamFact(store, decisionEvent, "CapabilityAvailable", {
    capability_requirement: decision.capability_requirement,
  });

  if (refusal) {
    appendDownstreamFact(store, decisionEvent, "HandlerAssistRefused", {
      refusal_stage: refusal,
      reason: `${refusal}_refused`,
    });
    return { decision_event: decisionEvent, events: store.replay() };
  }

  if (execute) {
    const resolution = appendDownstreamFact(store, decisionEvent, "CapabilityResolved", {
      handler_instance_ref: "handler-instance:coding-sandbox-1",
    });
    const invocation = appendDownstreamFact(store, decisionEvent, "CapabilityInvocation", {
      handler_instance_ref: resolution.payload.handler_instance_ref,
    });
    const act = appendDownstreamFact(store, decisionEvent, "Act", {
      capability_invocation_ref: invocation.event_id,
      status: "completed",
    });
    appendDownstreamFact(store, decisionEvent, "Trace", {
      act_ref: act.event_id,
      execution_outcome: "success",
      usefulness_resolution: null,
    });
  }

  return { decision_event: decisionEvent, events: store.replay() };
}

function main() {
  const decision = createHandlerAssistDecision({
    decision_id: "decision:handler-assist:demo",
    selected_path: "handler_assisted",
    rationale_summary: "The message requests implementation work.",
    capability_requirement: { capability: "coding.assist" },
    decisive_assertion_refs: ["assertion:handler-assist-usefulness:demo"],
  });
  process.stdout.write(`${JSON.stringify(runHandlerAssistSandbox({
    decision,
    handler_available: true,
    execute: true,
  }), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
