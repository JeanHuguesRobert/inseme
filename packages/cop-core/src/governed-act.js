/**
 * Minimal governed Act chain for JHN usability gate (Inseme #33 / #31 Phase 4).
 *
 * CapabilityInvocation → Act → Trace → Imputation
 *
 * Backend-independent; appends to any store with .append().
 */

import { randomUUID } from "node:crypto";
import { createCopEventEnvelope } from "./cop-event-envelope.js";
import { normalizeResourceAssessments } from "./resource-assessment.js";
import { evaluateMeasuredRisk } from "./measured-risk.js";

/**
 * @typedef {object} GovernedActInput
 * @property {string} principal_ref
 * @property {string} mandate_ref  e.g. mandate:MND-JHN-…@v1
 * @property {string} logical_agent_ref  e.g. agent:jhn
 * @property {string} handler_instance_ref  e.g. handler:openai-reasoner@local
 * @property {string} capability  e.g. coding.reply or repo.read
 * @property {object} [invocation_input]
 * @property {object} [effect] result/evidence after handler runs
 * @property {object[]} [resource_assessments] exact native measurements or explicit non-estimation records
 * @property {string} [topic_id]
 * @property {'ok'|'failed'|'refused'} [outcome]
 */

/**
 * Record a full governed act chain as four append-only COP events.
 * Returns all events + composite receipt.
 *
 * @param {object} store
 * @param {GovernedActInput} input
 */
export function recordGovernedAct(store, input) {
  require(input.principal_ref, "principal_ref");
  require(input.mandate_ref, "mandate_ref");
  require(input.logical_agent_ref, "logical_agent_ref");
  require(input.handler_instance_ref, "handler_instance_ref");
  require(input.capability, "capability");

  const actId = randomUUID();
  const topicId = input.topic_id || `act:${actId}`;
  const outcome = input.outcome || "ok";
  const correlation = `governed-act:${actId}`;
  const recorded = [];

  const base = {
    subject_ref: input.logical_agent_ref,
    actor_ref: input.logical_agent_ref,
    mandate_ref: input.mandate_ref,
    visibility: "restricted",
    correlation_id: correlation,
  };

  const inv = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "declared",
    origin_ref: `capability:${input.capability}`,
    payload: {
      kind: "CapabilityInvocation",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      input: input.invocation_input || {},
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
      measured_risk: input.measured_risk || null,
    },
    idempotency_key: `${correlation}:invocation`,
  });
  recorded.push(inv);

  const act = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "decided",
    origin_ref: inv.event.event_id,
    causation_id: inv.event.event_id,
    payload: {
      kind: "Act",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      outcome,
    },
    idempotency_key: `${correlation}:act`,
  });
  recorded.push(act);

  const trace = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "observed",
    origin_ref: act.event.event_id,
    causation_id: act.event.event_id,
    payload: {
      kind: "Trace",
      act_id: actId,
      effect: input.effect || null,
      outcome,
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
      observed_exposure: input.observed_exposure || null,
    },
    idempotency_key: `${correlation}:trace`,
  });
  recorded.push(trace);

  const imputation = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "normative",
    origin_ref: act.event.event_id,
    causation_id: act.event.event_id,
    payload: {
      kind: "Imputation",
      act_id: actId,
      principal_ref: input.principal_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      // responsibility remains with LogicalAgent under Principal mandate;
      // handler is material executor only
      responsibility: "logical_agent_under_mandate",
      material_executor: input.handler_instance_ref,
      packet_id: input.packet_id || input.packet?.packet_id || null,
      provisional_cost: input.provisional_cost || null,
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
      observed_exposure: input.observed_exposure || null,
    },
    idempotency_key: `${correlation}:imputation`,
  });
  recorded.push(imputation);

  return {
    ok: recorded.every((r) => r.ok),
    act_id: actId,
    topic_id: topicId,
    correlation,
    events: recorded.map((r) => r.event),
    receipt: {
      schema: "cop.governed-act.receipt.v1",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      outcome,
      event_ids: recorded.map((r) => r.event?.event_id).filter(Boolean),
    },
  };
}

/**
 * John delegates to a replaceable handler, then records governed act.
 *
 * @param {object} options
 * @param {object} options.store
 * @param {object} options.handler  { id, invoke(input) => Promise|object }
 * @param {object} options.identity principal/mandate/logical_agent refs
 * @param {string} options.capability
 * @param {object} [options.input]
 */
export async function jhnDelegateToHandler(options) {
  const { store, handler, identity, capability, input } = options;
  if (!handler || typeof handler.invoke !== "function") {
    throw new TypeError("handler.invoke required");
  }
  require(identity?.principal_ref, "identity.principal_ref");
  require(identity?.mandate_ref, "identity.mandate_ref");
  require(identity?.logical_agent_ref, "identity.logical_agent_ref");

  let effect = null;
  let outcome = "ok";
  if (!isMandateActive(store, identity.mandate_ref)) {
    outcome = "refused";
    effect = { error: "mandate_inactive_before_handler_invoke" };
  } else {
    try {
      effect = await handler.invoke(input || {});
    } catch (err) {
      outcome = "failed";
      effect = { error: String(err.message || err) };
    }
  }

  // Token usage alone does not prove a monetary cost. This matters for
  // subscription- and quota-backed providers, whose marginal price may be
  // unknowable. Callers may provide an explicit, source-bounded valuation;
  // otherwise retain native measurements or a not_estimated assessment.
  const provisional_cost = options.provisional_cost || null;
  const resource_assessments = normalizeResourceAssessments(
    options.resource_assessments || effect?.resource_assessments || []
  );
  const packet_id = options.packet_id || options.packet?.packet_id || null;

  return recordGovernedAct(store, {
    principal_ref: identity.principal_ref,
    mandate_ref: identity.mandate_ref,
    logical_agent_ref: identity.logical_agent_ref,
    handler_instance_ref: handler.id || "handler:anonymous",
    capability,
    invocation_input: input || {},
    effect,
    outcome,
    topic_id: identity.topic_id,
    packet_id,
    provisional_cost,
    resource_assessments,
  });
}

/**
 * Generic governed capability invocation closing the audit & TOCTOU gap (Issue #68).
 *
 * Enforces:
 * 1. Mandate active pre-check
 * 2. Authority-bound budget reservation
 * 3. Immediate pre-call TOCTOU re-check (revocation before effect prevents call)
 * 4. Handler invocation (consequential effect)
 * 5. Settlement or release of budget based on verified provider outcome
 * 6. Attributable governed act chain recording (Invocation, Act, Trace, Imputation)
 *
 * @param {object} options
 * @param {object} options.store - Append-only COP store
 * @param {object} [options.ledger] - ExecutionBudget ledger (event-sourced or memory)
 * @param {object} options.handler - Handler { id, invoke(input) => Promise<effect> }
 * @param {object} options.identity - { principal_ref, mandate_ref, logical_agent_ref, topic_id }
 * @param {string} options.capability - Capability string, e.g. "reasoning.code"
 * @param {object} [options.input] - Input payload passed to handler
 * @param {object} [options.demand] - Budget demand for reservation
 * @param {string} [options.idempotency_key] - Idempotency key for reservation and act
 * @param {object[]} [options.forecasts] - Optional risk/resource forecasts
 * @param {string|null} [options.provisional_cost] - Optional provisional cost
 * @param {object[]} [options.resource_assessments] - Optional external assessments
 * @param {string|null} [options.packet_id] - Associated packet ID
 * @returns {Promise<object>} Result receipt and effect
 */
export async function invokeGovernedCapability(options) {
  const {
    store,
    ledger,
    handler,
    identity,
    capability,
    input = {},
    demand,
    idempotency_key,
    forecasts = [],
    provisional_cost = null,
    resource_assessments = [],
    packet_id = null,
    portable_bundle = null,
    measured_risk = null,
    risk_profile = null,
    exposure = null,
    observed_prior_exposure = null,
    observed_exposure = null,
  } = options;

  if (!store || typeof store.append !== "function") throw new TypeError("store.append is required");
  if (!handler || typeof handler.invoke !== "function")
    throw new TypeError("handler.invoke is required");
  require(identity?.principal_ref, "identity.principal_ref");
  require(identity?.mandate_ref, "identity.mandate_ref");
  require(identity?.logical_agent_ref, "identity.logical_agent_ref");
  require(capability, "capability");

  const topicId = identity.topic_id || `governed:${randomUUID()}`;
  const keyBase = idempotency_key || `gov-inv:${randomUUID()}`;
  const effectiveRisk =
    measured_risk || risk_profile || identity.measured_risk || identity.risk_profile || null;
  const effectiveExposure = exposure || identity.exposure || null;
  const priorExposure = observed_prior_exposure || identity.observed_prior_exposure || null;

  // 0. Portable bundle rebinding check
  const bundle = portable_bundle || input?._portable_bundle;
  if (bundle && !bundle.bound) {
    return {
      ok: false,
      error: "unbound_portable_authority",
      reason: "imported state requires explicit local authority rebinding before execution",
      called_provider: false,
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
      act_id: null,
      receipt: null,
    };
  }

  // 1. Mandate Authority Evaluation
  const grant = evaluateMandate(store, {
    mandate: identity.mandate,
    mandate_ref: identity.mandate_ref,
    version_pin:
      identity.version_pin ||
      (identity.mandate_ref?.includes("@") ? identity.mandate_ref.split("@")[1] : null),
    expected_principal_ref: identity.principal_ref,
    expected_actor_ref: identity.logical_agent_ref,
    capability,
    action_category: identity.action_category || "mandate",
    demand,
    parent_mandate: identity.parent_mandate,
    measured_risk: effectiveRisk,
    exposure: effectiveExposure,
    observed_prior_exposure: priorExposure,
  });

  if (!grant.granted) {
    return {
      ok: false,
      error: grant.error || "authority_refused",
      reason: grant.reason,
      called_provider: false,
      diagnostic: grant.diagnostic,
      act_id: null,
      receipt: null,
    };
  }

  // 1b. Legacy authorized_capabilities check (if explicitly provided on identity)
  if (
    Array.isArray(identity.authorized_capabilities) &&
    identity.authorized_capabilities.length > 0 &&
    !identity.authorized_capabilities.includes(capability)
  ) {
    return {
      ok: false,
      error: "capability_unauthorized",
      reason: `capability '${capability}' is not authorized under mandate '${identity.mandate_ref}'`,
      called_provider: false,
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
      act_id: null,
      receipt: null,
    };
  }

  // 2. Budget reservation if ledger provided
  let reservation = null;
  if (ledger) {
    const snap = ledger.snapshot();
    if (snap.mandate_ref && snap.mandate_ref !== identity.mandate_ref) {
      return {
        ok: false,
        error: "mandate_budget_mismatch",
        reason: `budget belongs to ${snap.mandate_ref} but invocation is under ${identity.mandate_ref}`,
        called_provider: false,
        diagnostic: {
          discovered: true,
          reachable: true,
          healthy: true,
          admissible: true,
          selected_or_funded: false,
          authorized: false,
          invoked: false,
          committed: false,
        },
        act_id: null,
        receipt: null,
      };
    }
    const reserveKey = `${keyBase}:reserve`;
    const resResult = ledger.reserve({
      idempotency_key: reserveKey,
      expected_version: snap.version,
      demand: demand || snap.limits,
      forecasts,
    });
    if (!resResult.ok) {
      return {
        ok: false,
        error: resResult.error,
        dimension: resResult.dimension,
        snapshot: resResult.snapshot,
        called_provider: false,
        diagnostic: {
          discovered: true,
          reachable: true,
          healthy: true,
          admissible: true,
          selected_or_funded: false,
          authorized: true,
          invoked: false,
          committed: false,
        },
        act_id: null,
        receipt: null,
      };
    }
    reservation = resResult.reservation;
  }

  // 3. TOCTOU Pre-check: Verify mandate is STILL active & fresh immediately before external effect boundary!
  const preCallGrant = evaluateMandate(store, {
    mandate: identity.mandate,
    mandate_ref: identity.mandate_ref,
    version_pin:
      identity.version_pin ||
      (identity.mandate_ref?.includes("@") ? identity.mandate_ref.split("@")[1] : null),
    expected_principal_ref: identity.principal_ref,
    expected_actor_ref: identity.logical_agent_ref,
    capability,
    action_category: identity.action_category || "mandate",
    demand,
    parent_mandate: identity.parent_mandate,
    measured_risk: effectiveRisk,
    exposure: effectiveExposure,
    observed_prior_exposure: priorExposure,
  });

  if (!preCallGrant.granted) {
    if (ledger && reservation) {
      ledger.release({
        reservation_id: reservation.reservation_id,
        expected_version: ledger.snapshot().version,
        idempotency_key: `${keyBase}:toctou-release`,
      });
    }
    const toctouError =
      preCallGrant.error === "mandate_version_stale"
        ? "mandate_version_stale"
        : "mandate_revoked_before_effect";
    return {
      ok: false,
      error: toctouError,
      reason:
        preCallGrant.reason || "mandate was revoked, suspended or updated before provider call",
      called_provider: false,
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: true,
        authorized: false,
        invoked: false,
        committed: false,
      },
      act_id: null,
      receipt: null,
    };
  }

  // 4. Consequential Effect Boundary (Provider Execution)
  let effect = null;
  let outcome = "ok";
  let handlerError = null;
  try {
    effect = await handler.invoke(input);
  } catch (err) {
    outcome = "failed";
    handlerError = err;
    effect = { error: String(err?.message || err) };
  }

  // 5. Settlement / Release
  let settlement = null;
  if (ledger && reservation) {
    const snap = ledger.snapshot();
    if (outcome === "failed" || outcome === "refused") {
      settlement = ledger.release({
        reservation_id: reservation.reservation_id,
        expected_version: snap.version,
        idempotency_key: `${keyBase}:release`,
      });
    } else {
      const usage = effect?.execution_usage || effect?.usage || reservation.demand;
      settlement = ledger.settle({
        reservation_id: reservation.reservation_id,
        expected_version: snap.version,
        usage,
        idempotency_key: `${keyBase}:settle`,
      });
    }
  }

  // 6. Attributable COP Act Trace Imputation Recording
  const combinedAssessments = normalizeResourceAssessments([
    ...resource_assessments,
    ...(effect?.resource_assessments || []),
  ]);

  const actResult = recordGovernedAct(store, {
    principal_ref: identity.principal_ref,
    mandate_ref: identity.mandate_ref,
    logical_agent_ref: identity.logical_agent_ref,
    handler_instance_ref: handler.id || "handler:anonymous",
    capability,
    invocation_input: input,
    effect,
    outcome,
    topic_id: topicId,
    packet_id,
    provisional_cost,
    resource_assessments: combinedAssessments,
    measured_risk: effectiveRisk,
    observed_exposure: observed_exposure || effect?.observed_exposure || null,
  });

  return {
    ok: outcome === "ok",
    outcome,
    called_provider: true,
    effect,
    act_id: actResult.act_id,
    receipt: actResult.receipt,
    events: actResult.events,
    reservation,
    settlement,
    snapshot: ledger ? ledger.snapshot() : null,
    diagnostic: {
      discovered: true,
      reachable: true,
      healthy: outcome !== "failed",
      admissible: true,
      selected_or_funded: true,
      authorized: true,
      invoked: true,
      committed: outcome === "ok",
    },
    error: handlerError ? String(handlerError?.message || handlerError) : null,
  };
}

function appendOne(store, partial) {
  const envelope = createCopEventEnvelope(partial);
  const result = store.append(envelope);
  if (!result.ok) {
    throw new Error(`governed_act_append_failed:${result.error}`);
  }
  return result;
}

function require(value, name) {
  if (value == null || value === "") throw new TypeError(`${name} is required`);
}

/**
 * Record an explicit Mandate Declaration in the append-only store (Issue #55).
 *
 * @param {object} store
 * @param {object} mandate
 */
export function recordMandateDeclaration(store, mandate) {
  if (!store || typeof store.append !== "function") throw new TypeError("store.append is required");
  require(mandate?.mandate_id || mandate?.mandate_ref, "mandate.mandate_id");
  const mandateId = mandate.mandate_id || mandate.mandate_ref;
  const principalRef = mandate.principal_ref || mandate.principal_subject_id;
  const logicalAgentRef = mandate.logical_agent_ref || mandate.representative_subject_id;
  require(principalRef, "mandate.principal_ref");
  require(logicalAgentRef, "mandate.logical_agent_ref");

  const version = mandate.version || "v1";
  const topicId = mandate.topic_id || `mandate:${mandateId}`;
  const envelope = createCopEventEnvelope({
    topic_id: topicId,
    epistemic_status: "normative",
    actor_ref: principalRef,
    subject_ref: logicalAgentRef,
    mandate_ref: mandateId,
    visibility: "restricted",
    payload: {
      kind: "MandateDeclaration",
      artifactType: "identity/mandate",
      mandate_id: mandateId,
      version,
      principal_ref: principalRef,
      principal_subject_id: principalRef,
      logical_agent_ref: logicalAgentRef,
      representative_subject_id: logicalAgentRef,
      representative_kind: mandate.representative_kind || "agent",
      parent_mandate_ref: mandate.parent_mandate_ref || null,
      status: mandate.status || "active",
      valid_from: mandate.valid_from || null,
      valid_until: mandate.valid_until || null,
      scope: mandate.scope || {
        allowed_actions: mandate.authorized_capabilities || [],
        forbidden_actions: mandate.forbidden_capabilities || [],
        budget_ceiling: mandate.budget_ceiling || null,
      },
      metadata: mandate.metadata || {},
    },
    idempotency_key: `mandate-declaration:${mandateId}:${version}`,
  });

  const result = store.append(envelope);
  if (!result.ok) throw new Error(`mandate_declaration_append_failed:${result.error}`);
  return {
    ok: true,
    mandate_id: mandateId,
    version,
    event: result.event,
    receipt: {
      schema: "cop.mandate-declaration.receipt.v1",
      mandate_id: mandateId,
      version,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      event_id: result.event.event_id,
    },
  };
}

/**
 * Resolve a mandate object from the append-only store.
 *
 * @param {object} store
 * @param {string} mandateRef
 * @returns {object|null}
 */
export function resolveMandate(store, mandateRef) {
  if (!store || !mandateRef) return null;
  const events =
    typeof store.replay === "function" ? store.replay() : Array.isArray(store) ? store : [];
  const baseRef = mandateRef.split("@")[0];
  const version = mandateRef.includes("@") ? mandateRef.split("@")[1] : null;

  // 1. Check for explicit MandateDeclaration
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (
      e.payload?.kind === "MandateDeclaration" ||
      e.payload?.artifactType === "identity/mandate"
    ) {
      const mid = e.payload.mandate_id || e.mandate_ref;
      if (mid === mandateRef || mid === baseRef) {
        if (version && e.payload.version && e.payload.version !== version) continue;
        return e.payload;
      }
    }
  }

  // 2. Check for MandateGranted
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "MandateGranted" || e.payload?.kind === "MandateGranted") {
      const mid = e.payload?.mandate_ref || e.mandate_ref;
      if (mid === mandateRef || mid === baseRef) {
        return {
          mandate_id: mid,
          version: version || "v1",
          principal_ref: e.actor_ref || e.payload?.principal_ref,
          logical_agent_ref:
            e.payload?.logical_agent_ref ||
            (e.subject_ref && !e.subject_ref.startsWith("mandate:") ? e.subject_ref : null),
          status: e.payload?.status || "active",
          scope: e.payload?.scope || {
            allowed_actions: e.payload?.authorized_capabilities || [],
          },
        };
      }
    }
  }

  // 3. Check for ExecutionBudgetGrant
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "ExecutionBudgetGrant" || e.payload?.kind === "ExecutionBudgetGrant") {
      const mid = e.payload?.mandate_ref || e.mandate_ref;
      if (mid === mandateRef || mid === baseRef) {
        const agent =
          e.payload?.logical_agent_ref ||
          (e.subject_ref && !e.subject_ref.startsWith("mandate:") ? e.subject_ref : null);
        return {
          mandate_id: mid,
          version: version || "v1",
          principal_ref: e.payload?.principal_ref || e.actor_ref,
          logical_agent_ref: agent,
          status: "active",
          scope: {},
        };
      }
    }
  }

  return null;
}

/**
 * Canonical Mandate Authority Evaluator (Issue #55 P0a).
 *
 * Resolves and validates mandate existence, active status, validity window, principal/actor matching,
 * capability scope, budget ceilings, and parent mandate attenuation.
 * Returns an immutable, inspectable AuthorityGrant.
 *
 * @param {object} store
 * @param {object} options
 * @returns {object} AuthorityGrant
 */
export function evaluateMandate(store, options) {
  if (!options) throw new TypeError("options are required");
  const {
    mandate: directMandate = null,
    mandate_ref: rawMandateRef = null,
    version_pin = null,
    expected_principal_ref = null,
    expected_actor_ref = null,
    capability = null,
    action_category = "mandate",
    demand = null,
    parent_mandate = null,
    measured_risk = null,
    risk_profile = null,
    exposure = null,
    observed_prior_exposure = null,
    at_time = new Date(),
  } = options;

  const nowTime = at_time instanceof Date ? at_time : new Date(at_time);

  // 1. Action category check (suggestion/recommendation cannot produce consequential effects without mandate)
  if (action_category === "suggestion" || action_category === "recommendation") {
    return {
      granted: false,
      decision: "refused",
      error: "recommendation_without_mandate",
      reason: `action category '${action_category}' cannot produce consequential effects without an explicit mandate`,
      mandate_ref: rawMandateRef,
      mandate_version: null,
      principal_ref: null,
      logical_agent_ref: null,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // 2. Resolve mandate
  const mandateRef = rawMandateRef || directMandate?.mandate_id || directMandate?.mandate_ref;
  if (!mandateRef && !directMandate) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_not_found",
      reason: "no mandate or mandate_ref was provided",
      mandate_ref: null,
      mandate_version: null,
      principal_ref: null,
      logical_agent_ref: null,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: false,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  const resolvedMandate = directMandate || resolveMandate(store, mandateRef);
  if (!resolvedMandate && !directMandate) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_not_found",
      reason: `mandate '${mandateRef}' could not be resolved from store`,
      mandate_ref: mandateRef,
      mandate_version: null,
      principal_ref: null,
      logical_agent_ref: null,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: false,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  const mandate = resolvedMandate || directMandate;
  const principalRef =
    mandate.principal_ref || mandate.principal_subject_id || expected_principal_ref;
  const logicalAgentRef =
    mandate.logical_agent_ref || mandate.representative_subject_id || expected_actor_ref;
  const mandateVersion =
    mandate.version || (mandateRef?.includes("@") ? mandateRef.split("@")[1] : null);

  // 3. Version pinning & freshness
  const expectedPin =
    version_pin || (rawMandateRef?.includes("@") ? rawMandateRef.split("@")[1] : null);
  if (expectedPin && mandateVersion && expectedPin !== mandateVersion) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_version_mismatch",
      reason: `requested version pin '${expectedPin}' does not match mandate version '${mandateVersion}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // Check if mandate version is stale (e.g. v1 was superseded by v2 in store)
  if (store && mandateRef) {
    const events =
      typeof store.replay === "function" ? store.replay() : Array.isArray(store) ? store : [];
    const baseId = mandateRef.split("@")[0];
    const declarations = events.filter(
      (e) =>
        e.payload?.kind === "MandateDeclaration" &&
        (e.payload.mandate_id === baseId || e.mandate_ref === baseId)
    );
    if (declarations.length > 0) {
      const latest = declarations[declarations.length - 1].payload;
      if (expectedPin && latest.version && latest.version !== expectedPin) {
        return {
          granted: false,
          decision: "refused",
          error: "mandate_version_stale",
          reason: `mandate version '${expectedPin}' is stale; current active version is '${latest.version}'`,
          mandate_ref: mandateRef,
          mandate_version: expectedPin,
          principal_ref: principalRef,
          logical_agent_ref: logicalAgentRef,
          capability,
          evaluated_at: nowTime.toISOString(),
          diagnostic: {
            discovered: true,
            reachable: true,
            healthy: true,
            admissible: true,
            selected_or_funded: false,
            authorized: false,
            invoked: false,
            committed: false,
          },
        };
      }
    }
  }

  // 4. Status and active checks
  if (mandate.status && mandate.status !== "active") {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_inactive",
      reason: `mandate declared status is '${mandate.status}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  if (store && mandateRef && !isMandateActive(store, mandateRef)) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_inactive",
      reason: "mandate has been suspended or revoked via MandateControl",
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // 5. Validity Window (valid_from, valid_until)
  if (mandate.valid_from && new Date(mandate.valid_from) > nowTime) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_not_yet_valid",
      reason: `mandate validity begins at '${mandate.valid_from}', current evaluation time is '${nowTime.toISOString()}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  if (mandate.valid_until && new Date(mandate.valid_until) < nowTime) {
    return {
      granted: false,
      decision: "refused",
      error: "mandate_expired",
      reason: `mandate validity expired at '${mandate.valid_until}', current evaluation time is '${nowTime.toISOString()}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // 6. Expected Principal and Actor
  if (expected_principal_ref && principalRef && expected_principal_ref !== principalRef) {
    return {
      granted: false,
      decision: "refused",
      error: "principal_mismatch",
      reason: `expected principal '${expected_principal_ref}' does not match mandate principal '${principalRef}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  if (expected_actor_ref && logicalAgentRef && expected_actor_ref !== logicalAgentRef) {
    return {
      granted: false,
      decision: "refused",
      error: "actor_mismatch",
      reason: `expected actor '${expected_actor_ref}' does not match mandate representative '${logicalAgentRef}'`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // 7. Capability scope
  const scope = mandate.scope || {};
  const forbidden = scope.forbidden_actions || mandate.forbidden_capabilities || [];
  if (capability && forbidden.includes(capability)) {
    return {
      granted: false,
      decision: "refused",
      error: "capability_forbidden",
      reason: `capability '${capability}' is explicitly forbidden by mandate scope`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  const allowed = scope.allowed_actions || scope.capabilities || mandate.authorized_capabilities;
  if (
    capability &&
    Array.isArray(allowed) &&
    allowed.length > 0 &&
    !allowed.includes(capability) &&
    !allowed.includes("*")
  ) {
    return {
      granted: false,
      decision: "refused",
      error: "capability_out_of_scope",
      reason: `capability '${capability}' is not within authorized capabilities [${allowed.join(", ")}]`,
      mandate_ref: mandateRef,
      mandate_version: mandateVersion,
      principal_ref: principalRef,
      logical_agent_ref: logicalAgentRef,
      capability,
      evaluated_at: nowTime.toISOString(),
      diagnostic: {
        discovered: true,
        reachable: true,
        healthy: true,
        admissible: true,
        selected_or_funded: false,
        authorized: false,
        invoked: false,
        committed: false,
      },
    };
  }

  // 8. Budget Ceiling check
  const ceiling = scope.budget_ceiling || mandate.budget_ceiling;
  if (demand && ceiling) {
    for (const [dim, requestedAmount] of Object.entries(demand)) {
      if (ceiling[dim] != null && requestedAmount > ceiling[dim]) {
        return {
          granted: false,
          decision: "refused",
          error: "budget_ceiling_exceeded",
          reason: `demand on dimension '${dim}' (${requestedAmount}) exceeds mandate ceiling (${ceiling[dim]})`,
          mandate_ref: mandateRef,
          mandate_version: mandateVersion,
          principal_ref: principalRef,
          logical_agent_ref: logicalAgentRef,
          capability,
          evaluated_at: nowTime.toISOString(),
          diagnostic: {
            discovered: true,
            reachable: true,
            healthy: true,
            admissible: true,
            selected_or_funded: false,
            authorized: false,
            invoked: false,
            committed: false,
          },
        };
      }
    }
  }

  // 9. Parent Mandate Attenuation (Authority(child) <= Authority(parent))
  const parent =
    parent_mandate ||
    (mandate.parent_mandate_ref ? resolveMandate(store, mandate.parent_mandate_ref) : null);
  if (parent) {
    const parentScope = parent.scope || {};
    const parentAllowed =
      parentScope.allowed_actions || parentScope.capabilities || parent.authorized_capabilities;
    if (Array.isArray(allowed) && Array.isArray(parentAllowed)) {
      for (const cap of allowed) {
        if (!parentAllowed.includes(cap) && !parentAllowed.includes("*")) {
          return {
            granted: false,
            decision: "refused",
            error: "child_authority_exceeds_parent",
            reason: `child capability '${cap}' exceeds parent authorized scope [${parentAllowed.join(", ")}]`,
            mandate_ref: mandateRef,
            mandate_version: mandateVersion,
            principal_ref: principalRef,
            logical_agent_ref: logicalAgentRef,
            capability,
            evaluated_at: nowTime.toISOString(),
            diagnostic: {
              discovered: true,
              reachable: true,
              healthy: true,
              admissible: true,
              selected_or_funded: false,
              authorized: false,
              invoked: false,
              committed: false,
            },
          };
        }
      }
    }
    if (
      mandate.valid_until &&
      parent.valid_until &&
      new Date(mandate.valid_until) > new Date(parent.valid_until)
    ) {
      return {
        granted: false,
        decision: "refused",
        error: "child_authority_exceeds_parent",
        reason: `child validity '${mandate.valid_until}' extends beyond parent validity '${parent.valid_until}'`,
        mandate_ref: mandateRef,
        mandate_version: mandateVersion,
        principal_ref: principalRef,
        logical_agent_ref: logicalAgentRef,
        capability,
        evaluated_at: nowTime.toISOString(),
        diagnostic: {
          discovered: true,
          reachable: true,
          healthy: true,
          admissible: true,
          selected_or_funded: false,
          authorized: false,
          invoked: false,
          committed: false,
        },
      };
    }
    const parentCeiling = parentScope.budget_ceiling || parent.budget_ceiling;
    if (ceiling && parentCeiling) {
      for (const [dim, childLimit] of Object.entries(ceiling)) {
        if (parentCeiling[dim] != null && childLimit > parentCeiling[dim]) {
          return {
            granted: false,
            decision: "refused",
            error: "child_authority_exceeds_parent",
            reason: `child budget ceiling for '${dim}' (${childLimit}) exceeds parent ceiling (${parentCeiling[dim]})`,
            mandate_ref: mandateRef,
            mandate_version: mandateVersion,
            principal_ref: principalRef,
            logical_agent_ref: logicalAgentRef,
            capability,
            evaluated_at: nowTime.toISOString(),
            diagnostic: {
              discovered: true,
              reachable: true,
              healthy: true,
              admissible: true,
              selected_or_funded: false,
              authorized: false,
              invoked: false,
              committed: false,
            },
          };
        }
      }
    }
  }

  // 9b. Measured Risk and Exposure Evaluation (Issue #51)
  const effectiveRisk = measured_risk || risk_profile;
  if (effectiveRisk) {
    const riskEval = evaluateMeasuredRisk({
      mandate,
      measured_risk: effectiveRisk,
      observed_prior_exposure,
      capability,
      at_time: nowTime,
    });
    if (!riskEval.admissible) {
      return {
        granted: false,
        decision: "refused",
        error: riskEval.error || "measured_risk_inadmissible",
        reason: riskEval.reason,
        mandate_ref: mandateRef,
        mandate_version: mandateVersion,
        principal_ref: principalRef,
        logical_agent_ref: logicalAgentRef,
        capability,
        evaluated_at: nowTime.toISOString(),
        diagnostic: {
          discovered: true,
          reachable: true,
          healthy: true,
          admissible: false,
          selected_or_funded: false,
          authorized: false,
          invoked: false,
          committed: false,
        },
        risk_evaluation: riskEval,
      };
    }
  } else if (exposure) {
    const expObj =
      typeof exposure === "object"
        ? exposure
        : { max_cost: exposure, scope: "sandbox", external_effects: "none" };
    const dummyRisk = {
      objective: { kind: "routine", expected_value: "exposure_check" },
      risk: { class: "routine", uncertainty: "low", tail: "bounded" },
      exposure: expObj,
      recovery: {
        state_reversal: "full",
        compensation: "available",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: { loss_bearer_principal_ref: principalRef },
    };
    const riskEval = evaluateMeasuredRisk({
      mandate,
      measured_risk: dummyRisk,
      observed_prior_exposure,
      capability,
      at_time: nowTime,
    });
    if (!riskEval.admissible) {
      return {
        granted: false,
        decision: "refused",
        error: riskEval.error || "exposure_inadmissible",
        reason: riskEval.reason,
        mandate_ref: mandateRef,
        mandate_version: mandateVersion,
        principal_ref: principalRef,
        logical_agent_ref: logicalAgentRef,
        capability,
        evaluated_at: nowTime.toISOString(),
        diagnostic: {
          discovered: true,
          reachable: true,
          healthy: true,
          admissible: false,
          selected_or_funded: false,
          authorized: false,
          invoked: false,
          committed: false,
        },
        risk_evaluation: riskEval,
      };
    }
  }

  // 10. All checks pass -> Granted
  return {
    granted: true,
    decision: "granted",
    reason: null,
    mandate_ref: mandateRef,
    mandate_version: mandateVersion,
    principal_ref: principalRef,
    logical_agent_ref: logicalAgentRef,
    capability,
    constraints: scope,
    evaluated_at: nowTime.toISOString(),
    diagnostic: {
      discovered: true,
      reachable: true,
      healthy: true,
      admissible: true,
      selected_or_funded: true,
      authorized: true,
      invoked: false,
      committed: false,
    },
  };
}

/**
 * Create a portable capability bundle requiring local authority rebinding.
 */
export function createPortableCapabilityBundle(options) {
  require(options.continuation_id, "continuation_id");
  require(options.required_capability, "required_capability");
  require(options.authority_lineage?.principal_ref, "authority_lineage.principal_ref");
  require(options.authority_lineage?.mandate_ref, "authority_lineage.mandate_ref");
  require(options.authority_lineage?.logical_agent_ref, "authority_lineage.logical_agent_ref");

  return {
    schema: "cop.portable-capability-bundle/v1",
    continuation_id: options.continuation_id,
    state: options.state || {},
    required_capability: options.required_capability,
    authority_lineage: {
      principal_ref: options.authority_lineage.principal_ref,
      mandate_ref: options.authority_lineage.mandate_ref,
      logical_agent_ref: options.authority_lineage.logical_agent_ref,
    },
    bound: false,
    local_binding: null,
  };
}

/**
 * Rebind a portable capability bundle to an authorized local decision grant.
 */
export function rebindPortableAuthority(bundle, authorityGrant) {
  if (!bundle) throw new TypeError("bundle is required");
  if (!authorityGrant || !authorityGrant.granted) {
    throw new Error("Cannot rebind portable bundle without a granted authority decision");
  }
  return {
    ...bundle,
    bound: true,
    local_binding: {
      rebound_at: new Date().toISOString(),
      mandate_ref: authorityGrant.mandate_ref,
      mandate_version: authorityGrant.mandate_version,
      principal_ref: authorityGrant.principal_ref,
      logical_agent_ref: authorityGrant.logical_agent_ref,
      capability: authorityGrant.capability,
    },
  };
}

/**
 * Record mandate or handler suspension/revocation before further Acts.
 * Stale results remain in the log; callers must check isMandateActive.
 * Enforces authority check on caller principal (Issue #55).
 *
 * @param {object} store
 * @param {object} input
 * @param {string} input.principal_ref
 * @param {string} input.mandate_ref
 * @param {string} [input.logical_agent_ref]
 * @param {string} [input.handler_instance_ref]
 * @param {'suspend'|'revoke'} input.action
 * @param {string} [input.reason]
 * @param {string} [input.topic_id]
 */
export function recordMandateControl(store, input) {
  require(input.principal_ref, "principal_ref");
  require(input.mandate_ref, "mandate_ref");

  // Authority check: verify principal_ref is authorized for this mandate
  const declaredMandate = input.mandate || resolveMandate(store, input.mandate_ref);
  if (declaredMandate) {
    const expectedPrincipal = declaredMandate.principal_ref || declaredMandate.principal_subject_id;
    if (expectedPrincipal && expectedPrincipal !== input.principal_ref) {
      return {
        ok: false,
        error: "unauthorized_principal_control",
        reason: `caller '${input.principal_ref}' is not the authorized principal '${expectedPrincipal}' of mandate '${input.mandate_ref}'`,
      };
    }
  }

  const action = input.action === "suspend" ? "suspend" : "revoke";
  const controlId = randomUUID();
  const topicId = input.topic_id || `mandate-control:${input.mandate_ref}`;

  const result = store.append(
    createCopEventEnvelope({
      topic_id: topicId,
      epistemic_status: "normative",
      actor_ref: input.principal_ref,
      subject_ref: input.logical_agent_ref || input.mandate_ref,
      mandate_ref: input.mandate_ref,
      visibility: "restricted",
      payload: {
        kind: "MandateControl",
        control_id: controlId,
        action,
        principal_ref: input.principal_ref,
        mandate_ref: input.mandate_ref,
        logical_agent_ref: input.logical_agent_ref || null,
        handler_instance_ref: input.handler_instance_ref || null,
        reason: input.reason || null,
        effective_at: new Date().toISOString(),
      },
      idempotency_key: `mandate-control:${input.mandate_ref}:${action}:${controlId}`,
    })
  );

  if (!result.ok) {
    throw new Error(`mandate_control_append_failed:${result.error}`);
  }

  return {
    ok: true,
    control_id: controlId,
    action,
    mandate_ref: input.mandate_ref,
    event: result.event,
    receipt: {
      schema: "cop.mandate-control.receipt.v1",
      control_id: controlId,
      action,
      mandate_ref: input.mandate_ref,
      principal_ref: input.principal_ref,
      event_id: result.event.event_id,
    },
  };
}

/**
 * Whether a mandate is still active given append-only control events.
 * Latest MandateControl for the mandate_ref wins (revoke/suspend → inactive).
 *
 * @param {object} store
 * @param {string} mandateRef
 */
export function isMandateActive(store, mandateRef) {
  require(mandateRef, "mandateRef");
  const events =
    typeof store.replay === "function" ? store.replay() : Array.isArray(store) ? store : [];
  const controls = events
    .filter(
      (e) =>
        e.payload?.kind === "MandateControl" &&
        (e.payload.mandate_ref === mandateRef || e.mandate_ref === mandateRef)
    )
    .sort((a, b) => {
      const ta = a.time?.recorded_at || a.payload?.effective_at || "";
      const tb = b.time?.recorded_at || b.payload?.effective_at || "";
      return ta.localeCompare(tb);
    });
  if (controls.length === 0) return true;
  const last = controls[controls.length - 1];
  const action = last.payload?.action;
  return action !== "revoke" && action !== "suspend";
}

/**
 * Refuse to record a governed Act if mandate is suspended/revoked.
 */
export function recordGovernedActIfActive(store, input) {
  if (!isMandateActive(store, input.mandate_ref)) {
    return {
      ok: false,
      error: "mandate_inactive",
      act_id: null,
      events: [],
      receipt: null,
    };
  }
  return recordGovernedAct(store, input);
}
