/**
 * Explicit local administrative authority for Agent JHN (Inseme #97).
 *
 * The SQL row `mandate:jhn:runtime:1` is transport ACL for the signed
 * capability gateway. It is not a Principal → LogicalAgent mandate.
 * Normative authority is an append-only MandateDeclaration, plus a separate
 * execution-budget grant. This module writes those events only when an
 * explicit bootstrap or repair calls it. Conversational startup must not.
 */

import { recordExecutionBudgetGrant } from "../../../../packages/cop-core/src/execution-budget.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";

export const JHN_TRANSPORT_MANDATE_REF = "mandate:jhn:runtime:1";
export const JHN_TRANSPORT_GRANTEE_REF = "principal:jhn:runtime";
export const JHN_TRANSPORT_ISSUER_REF = "instance:jhn";

export const JHN_AGENT_MANDATE_REF = "mandate:jhn:agent:1";
export const JHN_AGENT_PRINCIPAL_REF = "principal:jhn";
export const JHN_AGENT_LOGICAL_AGENT_REF = "agent:jhn";
export const JHN_AGENT_MANDATE_VERSION = "v1";
export const JHN_AGENT_ALLOWED_CAPABILITIES = Object.freeze(["coding.assist"]);

export const JHN_AGENT_BUDGET_ID = "budget:jhn:agent:local:1";
export const JHN_AGENT_BUDGET_LIMITS = Object.freeze({
  max_steps: 8,
  max_tool_calls: 0,
  max_subagents: 0,
  max_elapsed_ms: 60_000,
  max_external_effects: 0,
});

/** One local handler turn. Deliberately inside the grant above. */
export const JHN_AGENT_TURN_DEMAND = Object.freeze({
  max_steps: 1,
  max_tool_calls: 0,
  max_subagents: 0,
  max_elapsed_ms: 1_000,
  max_external_effects: 0,
});

function sameStringList(left, right) {
  const a = Array.isArray(left) ? [...left].map(String).sort() : [];
  const b = Array.isArray(right) ? [...right].map(String).sort() : [];
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function mandateIdOf(event) {
  return event?.payload?.mandate_id || event?.mandate_ref || null;
}

function principalOf(payload = {}) {
  return payload.principal_ref || payload.principal_subject_id || null;
}

function agentOf(payload = {}) {
  return payload.logical_agent_ref || payload.representative_subject_id || null;
}

function declarationMatches(payload) {
  const allowed =
    payload.scope?.allowed_actions ||
    payload.scope?.capabilities ||
    payload.authorized_capabilities;
  const forbidden = payload.scope?.forbidden_actions || payload.forbidden_capabilities || [];
  return (
    payload.mandate_id === JHN_AGENT_MANDATE_REF &&
    principalOf(payload) === JHN_AGENT_PRINCIPAL_REF &&
    agentOf(payload) === JHN_AGENT_LOGICAL_AGENT_REF &&
    payload.status === "active" &&
    String(payload.version) === JHN_AGENT_MANDATE_VERSION &&
    sameStringList(allowed, JHN_AGENT_ALLOWED_CAPABILITIES) &&
    forbidden.length === 0 &&
    (payload.parent_mandate_ref == null || payload.parent_mandate_ref === "")
  );
}

function grantMatches(payload) {
  const limits = payload.limits || {};
  const limitsMatch = Object.entries(JHN_AGENT_BUDGET_LIMITS).every(
    ([dimension, amount]) => limits[dimension] === amount
  );
  return (
    payload.budget_id === JHN_AGENT_BUDGET_ID &&
    payload.mandate_ref === JHN_AGENT_MANDATE_REF &&
    payload.principal_ref === JHN_AGENT_PRINCIPAL_REF &&
    (payload.authority_version == null || payload.authority_version === 1) &&
    limitsMatch
  );
}

function replay(store) {
  if (!store || typeof store.replay !== "function") {
    throw new TypeError("store.replay is required");
  }
  return store.replay();
}

/**
 * Inspect the event log and append the canonical local Agent JHN mandate and
 * budget grant when both are absent. Refuses mismatched or ambiguous authority
 * without writing.
 *
 * @param {object} store append-only COP event store
 * @param {{ provenance?: string }} [options]
 */
export function ensureJhnLocalAgentAuthority(store, { provenance = "local-admin-repair" } = {}) {
  const events = replay(store);
  const declarations = events.filter((event) => event.payload?.kind === "MandateDeclaration");
  const forAgentMandate = declarations.filter(
    (event) => mandateIdOf(event) === JHN_AGENT_MANDATE_REF
  );
  const otherJohnBindings = declarations.filter((event) => {
    if (mandateIdOf(event) === JHN_AGENT_MANDATE_REF) return false;
    return (
      principalOf(event.payload) === JHN_AGENT_PRINCIPAL_REF &&
      agentOf(event.payload) === JHN_AGENT_LOGICAL_AGENT_REF
    );
  });
  const transportUsedAsNormative = declarations.filter(
    (event) =>
      mandateIdOf(event) === JHN_TRANSPORT_MANDATE_REF &&
      principalOf(event.payload) === JHN_AGENT_PRINCIPAL_REF &&
      agentOf(event.payload) === JHN_AGENT_LOGICAL_AGENT_REF
  );
  const controls = events.filter(
    (event) =>
      event.payload?.kind === "MandateControl" &&
      (event.payload.mandate_ref === JHN_AGENT_MANDATE_REF ||
        event.mandate_ref === JHN_AGENT_MANDATE_REF)
  );
  const grants = events.filter(
    (event) =>
      event.payload?.kind === "ExecutionBudgetGrant" &&
      event.payload.budget_id === JHN_AGENT_BUDGET_ID
  );

  const conflicts = [];
  if (forAgentMandate.length > 1) {
    conflicts.push("multiple MandateDeclaration events exist for mandate:jhn:agent:1");
  }
  if (forAgentMandate.length === 1 && !declarationMatches(forAgentMandate[0].payload)) {
    conflicts.push(
      "existing mandate:jhn:agent:1 declaration does not match the canonical local Agent JHN mandate"
    );
  }
  if (otherJohnBindings.length > 0) {
    conflicts.push(
      "another MandateDeclaration already binds principal:jhn to agent:jhn under a different id"
    );
  }
  if (transportUsedAsNormative.length > 0) {
    conflicts.push(
      "mandate:jhn:runtime:1 is already recorded as a Principal→Agent JHN MandateDeclaration"
    );
  }
  if (controls.length > 0) {
    conflicts.push(
      "MandateControl already exists for mandate:jhn:agent:1; repair will not override it"
    );
  }
  if (grants.length > 1) {
    conflicts.push("multiple ExecutionBudgetGrant events exist for budget:jhn:agent:local:1");
  }
  if (grants.length === 1 && !grantMatches(grants[0].payload)) {
    conflicts.push(
      "existing execution budget grant does not match the canonical local Agent JHN budget"
    );
  }
  if (conflicts.length > 0) {
    return {
      ok: false,
      changed: false,
      error: "normative_authority_conflict",
      conflicts,
    };
  }

  const existingDeclaration = forAgentMandate[0] || null;
  const existingGrant = grants[0] || null;
  let mandateAction = "already_present";
  let mandateEventId = existingDeclaration?.event_id || null;
  let budgetAction = "already_present";
  let budgetEventId = existingGrant?.event_id || null;

  if (!existingDeclaration) {
    const recorded = recordMandateDeclaration(store, {
      mandate_id: JHN_AGENT_MANDATE_REF,
      version: JHN_AGENT_MANDATE_VERSION,
      principal_ref: JHN_AGENT_PRINCIPAL_REF,
      logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
      representative_kind: "agent",
      status: "active",
      scope: {
        allowed_actions: [...JHN_AGENT_ALLOWED_CAPABILITIES],
        forbidden_actions: [],
        budget_ceiling: null,
      },
      metadata: {
        provenance,
        authority_role: "principal-to-logical-agent",
        distinct_from_transport_mandate: JHN_TRANSPORT_MANDATE_REF,
      },
    });
    mandateAction = "declared";
    mandateEventId = recorded.event?.event_id || recorded.receipt?.event_id || null;
  }

  if (!existingGrant) {
    const recorded = recordExecutionBudgetGrant(store, {
      budget_id: JHN_AGENT_BUDGET_ID,
      mandate_ref: JHN_AGENT_MANDATE_REF,
      principal_ref: JHN_AGENT_PRINCIPAL_REF,
      limits: { ...JHN_AGENT_BUDGET_LIMITS },
      authority_version: 1,
      reason:
        "Bounded local handler turns for agent:jhn. Separate from the transport ACL and from the mandate scope.",
    });
    budgetAction = "granted";
    budgetEventId = recorded.event?.event_id || null;
  }

  return {
    ok: true,
    changed: mandateAction === "declared" || budgetAction === "granted",
    normative_mandate: {
      mandate_ref: JHN_AGENT_MANDATE_REF,
      principal_ref: JHN_AGENT_PRINCIPAL_REF,
      logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
      action: mandateAction,
      event_id: mandateEventId,
    },
    budget: {
      budget_id: JHN_AGENT_BUDGET_ID,
      mandate_ref: JHN_AGENT_MANDATE_REF,
      action: budgetAction,
      event_id: budgetEventId,
      limits: { ...JHN_AGENT_BUDGET_LIMITS },
    },
  };
}
