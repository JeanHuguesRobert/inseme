/**
 * Explicit local administrative authority for Agent JHN (Inseme #97, #103).
 *
 * The SQL row `mandate:jhn:runtime:1` is transport ACL for the signed
 * capability gateway. It is not a Principal → LogicalAgent mandate.
 * Normative authority is an append-only MandateDeclaration, plus a separate
 * execution-budget grant. This module writes those events only when an
 * explicit bootstrap, repair, or administrative migration calls it.
 * Conversational startup must not.
 *
 * The active envelope is the human-approved v2 read-only successor
 * (inseme#102 / inseme#103). The v1 five-dimensional predecessor remains
 * reconstructible and is never rewritten. Repair may establish v2 only when
 * no normative Agent JHN authority exists. It does not migrate v1. That
 * transition is `migrateJhnLocalAgentReadAuthority`.
 */

import { recordExecutionBudgetGrant } from "../../../../packages/cop-core/src/execution-budget.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";

export const JHN_TRANSPORT_MANDATE_REF = "mandate:jhn:runtime:1";
export const JHN_TRANSPORT_GRANTEE_REF = "principal:jhn:runtime";
export const JHN_TRANSPORT_ISSUER_REF = "instance:jhn";

export const JHN_AGENT_MANDATE_REF = "mandate:jhn:agent:1";
export const JHN_AGENT_PRINCIPAL_REF = "principal:jhn";
export const JHN_AGENT_LOGICAL_AGENT_REF = "agent:jhn";
export const JHN_AGENT_MANDATE_VERSION = "v2";
export const JHN_AGENT_ALLOWED_CAPABILITIES = Object.freeze(["coding.assist.read"]);

export const JHN_AGENT_BUDGET_ID = "budget:jhn:agent:local:1";
export const JHN_AGENT_BUDGET_AUTHORITY_VERSION = 2;
export const JHN_AGENT_BUDGET_LIMITS = Object.freeze({
  max_steps: 8,
  max_elapsed_ms: 480_000,
});

/** One local read-only handler turn. Inside the sparse grant above. */
export const JHN_AGENT_TURN_DEMAND = Object.freeze({
  max_steps: 1,
  max_elapsed_ms: 60_000,
});

/**
 * Canonical ACP prompt timeout for this local read-only profile.
 * The real Codex handler is not bound here; #98 remains parked.
 */
export const JHN_AGENT_ACP_PROMPT_TIMEOUT_MS = 60_000;

/** Historical #97 predecessor. Not the active envelope. */
export const JHN_AGENT_V1_MANDATE_VERSION = "v1";
export const JHN_AGENT_V1_ALLOWED_CAPABILITIES = Object.freeze(["coding.assist"]);
export const JHN_AGENT_V1_BUDGET_AUTHORITY_VERSION = 1;
export const JHN_AGENT_V1_BUDGET_LIMITS = Object.freeze({
  max_steps: 8,
  max_tool_calls: 0,
  max_subagents: 0,
  max_elapsed_ms: 60_000,
  max_external_effects: 0,
});

const APPROVAL_REF = "inseme#102 human administrative decision";

function sameStringList(left, right) {
  const a = Array.isArray(left) ? [...left].map(String).sort() : [];
  const b = Array.isArray(right) ? [...right].map(String).sort() : [];
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function sameLimits(actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && actual[key] === expected[key])
  );
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

function replay(store) {
  if (!store || typeof store.replay !== "function") {
    throw new TypeError("store.replay is required");
  }
  return store.replay();
}

function declarationShape(payload, { version, allowed }) {
  const allowedActions =
    payload.scope?.allowed_actions ||
    payload.scope?.capabilities ||
    payload.authorized_capabilities;
  const forbidden = payload.scope?.forbidden_actions || payload.forbidden_capabilities || [];
  return (
    payload.mandate_id === JHN_AGENT_MANDATE_REF &&
    principalOf(payload) === JHN_AGENT_PRINCIPAL_REF &&
    agentOf(payload) === JHN_AGENT_LOGICAL_AGENT_REF &&
    payload.status === "active" &&
    String(payload.version) === version &&
    sameStringList(allowedActions, allowed) &&
    Array.isArray(forbidden) &&
    forbidden.length === 0 &&
    (payload.parent_mandate_ref == null || payload.parent_mandate_ref === "")
  );
}

function isV1Declaration(payload) {
  return declarationShape(payload, {
    version: JHN_AGENT_V1_MANDATE_VERSION,
    allowed: JHN_AGENT_V1_ALLOWED_CAPABILITIES,
  });
}

function isV2Declaration(payload) {
  return declarationShape(payload, {
    version: JHN_AGENT_MANDATE_VERSION,
    allowed: JHN_AGENT_ALLOWED_CAPABILITIES,
  });
}

function isGrantEvent(event) {
  return (
    event.event_type === "ExecutionBudgetGrant" || event.payload?.kind === "ExecutionBudgetGrant"
  );
}

function grantShape(payload, { authorityVersion, limits }) {
  return (
    payload.budget_id === JHN_AGENT_BUDGET_ID &&
    payload.mandate_ref === JHN_AGENT_MANDATE_REF &&
    payload.principal_ref === JHN_AGENT_PRINCIPAL_REF &&
    payload.authority_version === authorityVersion &&
    sameLimits(payload.limits, limits)
  );
}

function isV1Grant(payload) {
  return grantShape(payload, {
    authorityVersion: JHN_AGENT_V1_BUDGET_AUTHORITY_VERSION,
    limits: JHN_AGENT_V1_BUDGET_LIMITS,
  });
}

function isV2Grant(payload) {
  return grantShape(payload, {
    authorityVersion: JHN_AGENT_BUDGET_AUTHORITY_VERSION,
    limits: JHN_AGENT_BUDGET_LIMITS,
  });
}

function canonicalMetadata(provenance, supersedesVersion) {
  const metadata = {
    provenance,
    authority_role: "principal-to-logical-agent",
    distinct_from_transport_mandate: JHN_TRANSPORT_MANDATE_REF,
    approved_by: JHN_AGENT_PRINCIPAL_REF,
    approval_ref: APPROVAL_REF,
  };
  if (supersedesVersion) metadata.supersedes_version = supersedesVersion;
  return metadata;
}

function eventIdOf(recorded) {
  return recorded?.event?.event_id || recorded?.receipt?.event_id || null;
}

/**
 * Classify local Agent JHN normative authority without writing.
 *
 * @param {object} store append-only COP event store
 * @returns {{ shape: string, conflicts: string[], v1Declarations: object[], v2Declarations: object[], v1Grants: object[], v2Grants: object[] }}
 */
export function inspectJhnLocalAgentAuthority(store) {
  const events = replay(store);
  const conflicts = [];
  const agentDeclarations = [];
  const grants = [];
  let budgetActivity = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const payload = event.payload || {};
    if (payload.kind === "MandateDeclaration") {
      const mandateId = mandateIdOf(event);
      if (mandateId === JHN_AGENT_MANDATE_REF) {
        agentDeclarations.push({ event, index });
      } else if (
        principalOf(payload) === JHN_AGENT_PRINCIPAL_REF &&
        agentOf(payload) === JHN_AGENT_LOGICAL_AGENT_REF
      ) {
        conflicts.push(
          mandateId === JHN_TRANSPORT_MANDATE_REF
            ? "mandate:jhn:runtime:1 is already recorded as a Principal→Agent JHN MandateDeclaration"
            : "another MandateDeclaration already binds principal:jhn to agent:jhn under a different id"
        );
      }
    }
    if (
      payload.kind === "MandateControl" &&
      (payload.mandate_ref === JHN_AGENT_MANDATE_REF || event.mandate_ref === JHN_AGENT_MANDATE_REF)
    ) {
      conflicts.push(
        "MandateControl already exists for mandate:jhn:agent:1; authority migration will not override it"
      );
    }
    if (isGrantEvent(event) && payload.budget_id === JHN_AGENT_BUDGET_ID) {
      grants.push({ event, index });
    } else if (payload.budget_id === JHN_AGENT_BUDGET_ID) {
      budgetActivity += 1;
    }
  }

  const v1Declarations = agentDeclarations.filter((entry) => isV1Declaration(entry.event.payload));
  const v2Declarations = agentDeclarations.filter((entry) => isV2Declaration(entry.event.payload));
  const otherDeclarations = agentDeclarations.filter(
    (entry) => !isV1Declaration(entry.event.payload) && !isV2Declaration(entry.event.payload)
  );
  if (otherDeclarations.length > 0) {
    conflicts.push(
      "a mandate:jhn:agent:1 declaration does not match the canonical v1 predecessor or the canonical v2 envelope"
    );
  }
  if (v1Declarations.length > 1) {
    conflicts.push("multiple canonical v1 MandateDeclaration events exist for mandate:jhn:agent:1");
  }
  if (v2Declarations.length > 1) {
    conflicts.push("multiple canonical v2 MandateDeclaration events exist for mandate:jhn:agent:1");
  }
  if (
    v1Declarations.length === 1 &&
    v2Declarations.length === 1 &&
    v2Declarations[0].index < v1Declarations[0].index
  ) {
    conflicts.push("the v2 MandateDeclaration precedes its v1 predecessor");
  }

  const v1Grants = grants.filter((entry) => isV1Grant(entry.event.payload));
  const v2Grants = grants.filter((entry) => isV2Grant(entry.event.payload));
  const otherGrants = grants.filter(
    (entry) => !isV1Grant(entry.event.payload) && !isV2Grant(entry.event.payload)
  );
  if (otherGrants.length > 0) {
    conflicts.push(
      "an execution budget grant for budget:jhn:agent:local:1 does not match the canonical v1 predecessor or the canonical v2 envelope"
    );
  }
  if (v1Grants.length > 1) {
    conflicts.push(
      "multiple canonical v1 ExecutionBudgetGrant events exist for budget:jhn:agent:local:1"
    );
  }
  if (v2Grants.length > 1) {
    conflicts.push(
      "multiple canonical v2 ExecutionBudgetGrant events exist for budget:jhn:agent:local:1"
    );
  }
  if (v1Grants.length === 1 && v2Grants.length === 1 && v2Grants[0].index < v1Grants[0].index) {
    conflicts.push("the v2 ExecutionBudgetGrant precedes its v1 predecessor");
  }
  if (v2Grants.length === 0 && budgetActivity > 0) {
    conflicts.push(
      "the predecessor execution budget already has reservation, settlement, or release events; a sparse successor cannot replay that five-dimensional consumption"
    );
  }

  let shape = "conflict";
  if (conflicts.length === 0) {
    const d1 = v1Declarations.length;
    const d2 = v2Declarations.length;
    const g1 = v1Grants.length;
    const g2 = v2Grants.length;
    if (d1 === 0 && d2 === 0 && g1 === 0 && g2 === 0) shape = "absent";
    else if (d1 === 1 && d2 === 0 && g1 === 1 && g2 === 0) shape = "canonical_v1";
    else if (d1 === 0 && d2 === 1 && g1 === 0 && g2 === 1) shape = "canonical_v2";
    else if (d1 === 1 && d2 === 1 && g1 === 1 && g2 === 1) shape = "canonical_lineage";
    else {
      conflicts.push("normative Agent JHN authority is partial or internally inconsistent");
    }
  }

  return {
    shape,
    conflicts,
    v1Declarations: v1Declarations.map((entry) => entry.event),
    v2Declarations: v2Declarations.map((entry) => entry.event),
    v1Grants: v1Grants.map((entry) => entry.event),
    v2Grants: v2Grants.map((entry) => entry.event),
  };
}

function authorityResult(inspection, { changed, mandateAction, budgetAction }) {
  const declaration = inspection.v2Declarations[0] || null;
  const grant = inspection.v2Grants[0] || null;
  return {
    ok: true,
    changed,
    shape: inspection.shape,
    normative_mandate: {
      mandate_ref: JHN_AGENT_MANDATE_REF,
      principal_ref: JHN_AGENT_PRINCIPAL_REF,
      logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
      version: JHN_AGENT_MANDATE_VERSION,
      action: mandateAction,
      event_id: declaration?.event_id || null,
    },
    budget: {
      budget_id: JHN_AGENT_BUDGET_ID,
      mandate_ref: JHN_AGENT_MANDATE_REF,
      authority_version: JHN_AGENT_BUDGET_AUTHORITY_VERSION,
      action: budgetAction,
      event_id: grant?.event_id || null,
      limits: { ...JHN_AGENT_BUDGET_LIMITS },
    },
  };
}

function refusal(error, conflicts) {
  return {
    ok: false,
    changed: false,
    error,
    conflicts,
  };
}

function appendCanonicalV2(store, { provenance, supersedesVersion = null }) {
  const recordedMandate = recordMandateDeclaration(store, {
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
    metadata: canonicalMetadata(provenance, supersedesVersion),
  });
  const recordedGrant = recordExecutionBudgetGrant(store, {
    budget_id: JHN_AGENT_BUDGET_ID,
    mandate_ref: JHN_AGENT_MANDATE_REF,
    principal_ref: JHN_AGENT_PRINCIPAL_REF,
    limits: { ...JHN_AGENT_BUDGET_LIMITS },
    authority_version: JHN_AGENT_BUDGET_AUTHORITY_VERSION,
    reason:
      "Bounded local read-only handler turns for agent:jhn. Hard dimensions are only max_steps and max_elapsed_ms. Omitted dimensions are outside this budget and do not authorize effects.",
  });
  return {
    mandateEventId: eventIdOf(recordedMandate),
    budgetEventId: eventIdOf(recordedGrant),
  };
}

function establishCanonicalV2(store, { provenance, supersedesVersion = null }) {
  appendCanonicalV2(store, { provenance, supersedesVersion });
  const inspection = inspectJhnLocalAgentAuthority(store);
  if (inspection.shape !== "canonical_v2" && inspection.shape !== "canonical_lineage") {
    return refusal(
      "normative_authority_conflict",
      inspection.conflicts.length > 0
        ? inspection.conflicts
        : ["canonical v2 authority was not established"]
    );
  }
  return authorityResult(inspection, {
    changed: true,
    mandateAction: "declared",
    budgetAction: "granted",
  });
}

/**
 * Establish the current canonical v2 envelope when normative Agent JHN
 * authority is absent. Accept an exact v2 state, including a v1→v2 lineage,
 * without appending. Refuse an exact v1 predecessor and every divergent state.
 *
 * @param {object} store append-only COP event store
 * @param {{ provenance?: string }} [options]
 */
export function ensureJhnLocalAgentAuthority(store, { provenance = "local-admin-repair" } = {}) {
  const inspection = inspectJhnLocalAgentAuthority(store);
  if (inspection.shape === "absent") {
    return establishCanonicalV2(store, { provenance });
  }
  if (inspection.shape === "canonical_v2" || inspection.shape === "canonical_lineage") {
    return authorityResult(inspection, {
      changed: false,
      mandateAction: "already_present",
      budgetAction: "already_present",
    });
  }
  if (inspection.shape === "canonical_v1") {
    return refusal("predecessor_requires_explicit_migration", [
      "exact canonical v1 predecessor is present; repair does not migrate it",
    ]);
  }
  return refusal("normative_authority_conflict", inspection.conflicts);
}

/**
 * Append-only administrative migration from the exact #97 v1 predecessor to
 * the approved v2 read-only envelope. Idempotent when v2 is already canonical.
 * Appends nothing for absent, partial, revoked, or divergent authority.
 *
 * @param {object} store append-only COP event store
 * @param {{ provenance?: string }} [options]
 */
export function migrateJhnLocalAgentReadAuthority(
  store,
  { provenance = "local-admin-migration" } = {}
) {
  const inspection = inspectJhnLocalAgentAuthority(store);
  if (inspection.shape === "canonical_v1") {
    return establishCanonicalV2(store, {
      provenance,
      supersedesVersion: JHN_AGENT_V1_MANDATE_VERSION,
    });
  }
  if (inspection.shape === "canonical_v2" || inspection.shape === "canonical_lineage") {
    return authorityResult(inspection, {
      changed: false,
      mandateAction: "already_present",
      budgetAction: "already_present",
    });
  }
  if (inspection.shape === "absent") {
    return refusal("normative_authority_absent", [
      "no canonical v1 predecessor is present; migration will not bootstrap authority",
    ]);
  }
  return refusal("normative_authority_conflict", inspection.conflicts);
}
