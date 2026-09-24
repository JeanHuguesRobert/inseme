const HANDLER_ASSIST_PATHS = Object.freeze(["local_only", "handler_assisted"]);

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value.trim();
}

function normalizeAssertionRefs(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("rationale.decisive_assertion_refs must be an array");
  }
  return value.map((ref, index) => requireText(ref, `rationale.decisive_assertion_refs[${index}]`));
}

function normalizeAlternatives(value) {
  const alternatives = value == null ? [...HANDLER_ASSIST_PATHS] : value;
  if (!Array.isArray(alternatives) || alternatives.length !== HANDLER_ASSIST_PATHS.length) {
    throw new TypeError("alternatives must contain local_only and handler_assisted exactly once");
  }
  const normalized = alternatives.map((path, index) => requireText(path, `alternatives[${index}]`));
  if (
    new Set(normalized).size !== HANDLER_ASSIST_PATHS.length ||
    HANDLER_ASSIST_PATHS.some((path) => !normalized.includes(path))
  ) {
    throw new TypeError("alternatives must contain local_only and handler_assisted exactly once");
  }
  return normalized;
}

function freezeDecision(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeDecision(nested);
  return Object.freeze(value);
}

function normalizeCapabilityRequirement(value, selectedPath) {
  if (selectedPath === "local_only") {
    if (value != null) {
      throw new TypeError("capability_requirement must be null for local_only");
    }
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("capability_requirement is required for handler_assisted");
  }
  const normalized = structuredClone(value);
  normalized.capability = requireText(value.capability, "capability_requirement.capability");
  return normalized;
}

function decisionBase({ decisionId, selectedPath, capabilityRequirement, decidedAt }) {
  if (!HANDLER_ASSIST_PATHS.includes(selectedPath)) {
    throw new TypeError(`selected_path must be one of: ${HANDLER_ASSIST_PATHS.join(", ")}`);
  }
  return {
    kind: "handler_assist.decision",
    decision_id: requireText(decisionId, "decision_id"),
    selected_path: selectedPath,
    alternatives: normalizeAlternatives(),
    capability_requirement: normalizeCapabilityRequirement(capabilityRequirement, selectedPath),
    decided_at: requireText(decidedAt, "decided_at"),
  };
}

/** Normalize the reason-bearing contract without adding authority or execution facts. */
export function normalizeReasonedHandlerAssistDecision(value, { decisionId, decidedAt } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("decideHandlerAssist must return a decision object");
  }
  const selectedPath = value.selected_path;
  const decision = decisionBase({
    decisionId: value.decision_id || decisionId,
    selectedPath,
    capabilityRequirement: value.capability_requirement ?? null,
    decidedAt: value.decided_at || decidedAt,
  });
  decision.alternatives = normalizeAlternatives(value.alternatives);
  decision.rationale = {
    kind: "reasoned",
    summary: requireText(value.rationale?.summary, "rationale.summary"),
    decisive_assertion_refs: normalizeAssertionRefs(value.rationale?.decisive_assertion_refs),
  };
  return freezeDecision(decision);
}

/** Preserve a legacy selection while refusing to invent a reason or Assertion. */
export function normalizeLegacyHandlerAssistDecision({
  decisionId,
  wantsDelegate,
  capability,
  decidedAt,
  rationaleKind = "legacy_boolean",
} = {}) {
  if (typeof wantsDelegate !== "boolean") {
    throw new TypeError("wantsDelegate must be a boolean");
  }
  const selectedPath = wantsDelegate ? "handler_assisted" : "local_only";
  const decision = decisionBase({
    decisionId,
    selectedPath,
    capabilityRequirement: wantsDelegate ? { capability } : null,
    decidedAt,
  });
  decision.rationale = {
    kind: requireText(rationaleKind, "rationaleKind"),
    summary: null,
    decisive_assertion_refs: [],
  };
  return freezeDecision(decision);
}

/** Append the decision before any availability, Mandate, budget, or invocation branch. */
export function recordHandlerAssistDecision({
  store,
  decision,
  topicId,
  actorRef,
  subjectRef,
  idempotencyKey,
} = {}) {
  if (!store || typeof store.append !== "function") {
    throw new TypeError("store.append is required");
  }
  if (decision?.kind !== "handler_assist.decision") {
    throw new TypeError("decision must be a handler_assist.decision");
  }
  const result = store.append({
    event_type: "HandlerAssistDecisionRecorded",
    topic_id: requireText(topicId, "topicId"),
    epistemic_status: "decided",
    actor_ref: requireText(actorRef, "actorRef"),
    subject_ref: requireText(subjectRef, "subjectRef"),
    visibility: "restricted",
    payload: structuredClone(decision),
    idempotency_key: requireText(idempotencyKey, "idempotencyKey"),
  });
  if (!result.ok) {
    throw new Error(result.errors?.join(", ") || result.error || "decision_append_failed");
  }
  return result.event;
}
