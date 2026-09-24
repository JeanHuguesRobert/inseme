import { describe, it, expect } from "vitest";
import {
  evaluateMandate,
  recordMandateDeclaration,
  resolveMandate,
  recordMandateControl,
  isMandateActive,
  invokeGovernedCapability,
  createPortableCapabilityBundle,
  rebindPortableAuthority,
  recordGovernedAct,
} from "../src/governed-act.js";
import {
  createEventSourcedExecutionBudgetLedger,
  recordExecutionBudgetGrant,
} from "../src/execution-budget.js";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

/**
 * In-memory append-only COP event store fixture.
 */
function createMemoryCopStore() {
  const events = [];
  return {
    append(envelope) {
      const e = envelope.schema ? envelope : createCopEventEnvelope(envelope);
      events.push(e);
      return { ok: true, event: e };
    },
    replay() {
      return structuredClone(events);
    },
    listTopic(topicId) {
      return structuredClone(
        events.filter((e) => e.topic?.id === topicId || e.topic_id === topicId)
      );
    },
    get raw() {
      return events;
    },
  };
}

/**
 * Mock provider handler.
 */
function createMockHandler({ result = { executed: true }, failWith = null } = {}) {
  let callCount = 0;
  const calls = [];
  return {
    get callCount() {
      return callCount;
    },
    get calls() {
      return calls;
    },
    async invoke(input) {
      callCount += 1;
      calls.push(input);
      if (failWith) throw failWith;
      return result;
    },
  };
}

describe("Mandated Agent Authority & Security Enforcement (Issue #55)", () => {
  const PRINCIPAL_ALICE = "principal:alice";
  const AGENT_BOB = "agent:bob";
  const MANDATE_ID = "mandate:mnd-alice-bob";

  // Acceptance Criterion 1
  it("AC1: nonexistent mandate -> refuse (mandate_not_found)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    // Direct evaluator
    const grant = evaluateMandate(store, {
      mandate_ref: "mandate:non-existent@v1",
      expected_principal_ref: PRINCIPAL_ALICE,
      expected_actor_ref: AGENT_BOB,
      capability: "tool:search",
    });

    expect(grant.granted).toBe(false);
    expect(grant.error).toBe("mandate_not_found");
    expect(grant.diagnostic.admissible).toBe(false);

    // Governed invocation boundary
    const result = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: "mandate:non-existent@v1",
        logical_agent_ref: AGENT_BOB,
      },
      capability: "tool:search",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("mandate_not_found");
    expect(result.called_provider).toBe(false);
    expect(handler.callCount).toBe(0);
  });

  // Acceptance Criterion 2
  it("AC2: expired mandate -> refuse (mandate_expired) and not-yet-valid", () => {
    const store = createMemoryCopStore();
    const pastDate = "2026-01-01T00:00:00.000Z";
    const futureDate = "2026-12-31T23:59:59.000Z";
    const evalDate = new Date("2026-09-06T12:00:00.000Z");

    recordMandateDeclaration(store, {
      mandate_id: "mandate:expired@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      valid_from: "2025-01-01T00:00:00.000Z",
      valid_until: pastDate,
      scope: { allowed_actions: ["tool:search"] },
    });

    // Evaluation on expired mandate
    const grantExpired = evaluateMandate(store, {
      mandate_ref: "mandate:expired@v1",
      expected_principal_ref: PRINCIPAL_ALICE,
      expected_actor_ref: AGENT_BOB,
      capability: "tool:search",
      at_time: evalDate,
    });
    expect(grantExpired.granted).toBe(false);
    expect(grantExpired.error).toBe("mandate_expired");

    // Evaluation on not-yet-valid mandate
    recordMandateDeclaration(store, {
      mandate_id: "mandate:future@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      valid_from: futureDate,
      scope: { allowed_actions: ["tool:search"] },
    });
    const grantFuture = evaluateMandate(store, {
      mandate_ref: "mandate:future@v1",
      expected_principal_ref: PRINCIPAL_ALICE,
      expected_actor_ref: AGENT_BOB,
      capability: "tool:search",
      at_time: evalDate,
    });
    expect(grantFuture.granted).toBe(false);
    expect(grantFuture.error).toBe("mandate_not_yet_valid");
  });

  // Acceptance Criterion 3
  it("AC3: capability outside scope -> refuse (capability_out_of_scope and capability_forbidden)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: {
        allowed_actions: ["repo:read", "search:web"],
        forbidden_actions: ["repo:delete", "exec:rm"],
      },
    });

    // Test out of scope
    const outOfScopeRes = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:write",
    });
    expect(outOfScopeRes.ok).toBe(false);
    expect(outOfScopeRes.error).toBe("capability_out_of_scope");
    expect(handler.callCount).toBe(0);

    // Test explicitly forbidden
    const forbiddenRes = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:delete",
    });
    expect(forbiddenRes.ok).toBe(false);
    expect(forbiddenRes.error).toBe("capability_forbidden");
    expect(handler.callCount).toBe(0);
  });

  // Acceptance Criterion 4
  it("AC4: request above mandate budget ceiling -> refuse (budget_ceiling_exceeded)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: {
        allowed_actions: ["tool:compute"],
        budget_ceiling: {
          max_steps: 5,
          max_tool_calls: 2,
        },
      },
    });

    // Request exceeding ceiling
    const result = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "tool:compute",
      demand: {
        max_steps: 10,
        max_tool_calls: 1,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("budget_ceiling_exceeded");
    expect(result.called_provider).toBe(false);
    expect(handler.callCount).toBe(0);
  });

  // Acceptance Criterion 5
  it("AC5: child authority wider than parent -> refuse (child_authority_exceeds_parent)", () => {
    const store = createMemoryCopStore();
    const evaluationTime = new Date("2026-09-06T12:00:00.000Z");
    const parentMandate = {
      mandate_id: "mandate:parent@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      valid_until: "2026-10-01T00:00:00.000Z",
      scope: {
        allowed_actions: ["tool:read", "tool:search"],
        budget_ceiling: { max_steps: 10 },
      },
    };

    // Subcase 5a: child capability outside parent
    const childExcessCap = {
      mandate_id: "mandate:child-cap@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: "agent:child",
      parent_mandate_ref: "mandate:parent@v1",
      scope: {
        allowed_actions: ["tool:read", "tool:write"], // tool:write not in parent!
      },
    };
    const grantCap = evaluateMandate(store, {
      mandate: childExcessCap,
      parent_mandate: parentMandate,
      capability: "tool:read",
      at_time: evaluationTime,
    });
    expect(grantCap.granted).toBe(false);
    expect(grantCap.error).toBe("child_authority_exceeds_parent");

    // Subcase 5b: child validity longer than parent
    const childExcessTime = {
      mandate_id: "mandate:child-time@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: "agent:child",
      parent_mandate_ref: "mandate:parent@v1",
      valid_until: "2026-12-31T00:00:00.000Z", // later than parent!
      scope: {
        allowed_actions: ["tool:read"],
      },
    };
    const grantTime = evaluateMandate(store, {
      mandate: childExcessTime,
      parent_mandate: parentMandate,
      capability: "tool:read",
      at_time: evaluationTime,
    });
    expect(grantTime.granted).toBe(false);
    expect(grantTime.error).toBe("child_authority_exceeds_parent");

    // Subcase 5c: child budget ceiling exceeds parent
    const childExcessBudget = {
      mandate_id: "mandate:child-bgt@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: "agent:child",
      parent_mandate_ref: "mandate:parent@v1",
      scope: {
        allowed_actions: ["tool:read"],
        budget_ceiling: { max_steps: 25 }, // parent has 10!
      },
    };
    const grantBudget = evaluateMandate(store, {
      mandate: childExcessBudget,
      parent_mandate: parentMandate,
      capability: "tool:read",
      at_time: evaluationTime,
    });
    expect(grantBudget.granted).toBe(false);
    expect(grantBudget.error).toBe("child_authority_exceeds_parent");

    // Subcase 5d: attenuated child is strictly narrower -> granted
    const childValid = {
      mandate_id: "mandate:child-valid@v1",
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: "agent:child",
      parent_mandate_ref: "mandate:parent@v1",
      valid_until: "2026-09-20T00:00:00.000Z",
      scope: {
        allowed_actions: ["tool:read"],
        budget_ceiling: { max_steps: 5 },
      },
    };
    const grantValid = evaluateMandate(store, {
      mandate: childValid,
      parent_mandate: parentMandate,
      capability: "tool:read",
      demand: { max_steps: 3 },
      at_time: evaluationTime,
    });
    expect(grantValid.granted).toBe(true);
    expect(grantValid.decision).toBe("granted");
  });

  // Acceptance Criterion 6
  it("AC6: recommendation without mandate -> refuse (recommendation_without_mandate)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    const result = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
        action_category: "recommendation",
      },
      capability: "tool:search",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("recommendation_without_mandate");
    expect(result.called_provider).toBe(false);
    expect(handler.callCount).toBe(0);
  });

  // Acceptance Criterion 7
  it("AC7: mandate valid at planning then revoked before effect -> effect prevented (mandate_revoked_before_effect)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();
    const budgetId = "bgt-ac7";

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["tool:search"] },
    });

    const limits = {
      max_steps: 5,
      max_tool_calls: 5,
      max_subagents: 0,
      max_elapsed_ms: 1000,
      max_external_effects: 1,
    };
    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: `${MANDATE_ID}@v1`,
      principal_ref: PRINCIPAL_ALICE,
      limits,
    });

    const baseLedger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits,
    });

    // Simulate TOCTOU race: an adversary or principal revokes the mandate precisely between reservation and execution!
    const toctouLedger = {
      ...baseLedger,
      reserve(params) {
        const res = baseLedger.reserve(params);
        // Revoke mandate in store concurrently during reservation step!
        recordMandateControl(store, {
          principal_ref: PRINCIPAL_ALICE,
          mandate_ref: `${MANDATE_ID}@v1`,
          action: "revoke",
          reason: "Emergency shutdown during planning window",
        });
        return res;
      },
    };

    const result = await invokeGovernedCapability({
      store,
      ledger: toctouLedger,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "tool:search",
      demand: {
        max_steps: 1,
        max_tool_calls: 0,
        max_subagents: 0,
        max_elapsed_ms: 50,
        max_external_effects: 0,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("mandate_revoked_before_effect");
    expect(result.called_provider).toBe(false);
    expect(handler.callCount).toBe(0);

    // Ledger reservation was released cleanly (no budget leaked)
    const snap = baseLedger.snapshot();
    expect(snap.reserved.max_steps).toBe(0);
  });

  // Acceptance Criterion 8
  it("AC8: mandate v1 replaced by v2 -> v1 authority grant is stale and refused (mandate_version_stale)", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    // Declare v1
    recordMandateDeclaration(store, {
      mandate_id: MANDATE_ID,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["tool:search"] },
    });

    // Supercede with v2
    recordMandateDeclaration(store, {
      mandate_id: MANDATE_ID,
      version: "v2",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["tool:search", "tool:execute"] },
    });

    // Attempt invocation under stale v1
    const resultV1 = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
        version_pin: "v1",
      },
      capability: "tool:search",
    });

    expect(resultV1.ok).toBe(false);
    expect(resultV1.error).toBe("mandate_version_stale");
    expect(handler.callCount).toBe(0);

    // Invocation under fresh v2 succeeds
    const resultV2 = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v2`,
        logical_agent_ref: AGENT_BOB,
        version_pin: "v2",
      },
      capability: "tool:search",
    });

    expect(resultV2.ok).toBe(true);
    expect(handler.callCount).toBe(1);
  });

  // Acceptance Criterion 9
  it("AC9: authorised principal can suspend future authority; unauthorized is refused", () => {
    const store = createMemoryCopStore();

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["tool:read"] },
    });

    // Unauthorized party attempts to revoke
    const unauthorizedCtrl = recordMandateControl(store, {
      principal_ref: "principal:mallory",
      mandate_ref: `${MANDATE_ID}@v1`,
      action: "revoke",
      reason: "Hostile attempt to revoke Alice's mandate",
    });

    expect(unauthorizedCtrl.ok).toBe(false);
    expect(unauthorizedCtrl.error).toBe("unauthorized_principal_control");
    expect(isMandateActive(store, `${MANDATE_ID}@v1`)).toBe(true);

    // Authorized principal suspends
    const authorizedCtrl = recordMandateControl(store, {
      principal_ref: PRINCIPAL_ALICE,
      mandate_ref: `${MANDATE_ID}@v1`,
      action: "suspend",
      reason: "Maintenance window",
    });

    expect(authorizedCtrl.ok).toBe(true);
    expect(isMandateActive(store, `${MANDATE_ID}@v1`)).toBe(false);
  });

  // Acceptance Criterion 10
  it("AC10: revocation does not erase prior effects/traces", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler({ result: { output: "prior work done" } });

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["tool:read"] },
    });

    // Act 1 while active
    const res1 = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "tool:read",
    });
    expect(res1.ok).toBe(true);
    const priorEventCount = store.replay().length;
    expect(priorEventCount).toBeGreaterThan(1); // includes declaration, invocation, act, trace, imputation

    // Principal revokes mandate
    recordMandateControl(store, {
      principal_ref: PRINCIPAL_ALICE,
      mandate_ref: `${MANDATE_ID}@v1`,
      action: "revoke",
    });

    // All prior events are still present and unaltered!
    const eventsAfterRevocation = store.replay();
    expect(eventsAfterRevocation.length).toBe(priorEventCount + 1);
    const actEvent = eventsAfterRevocation.find((e) => e.payload?.kind === "Act");
    expect(actEvent).toBeDefined();
    expect(actEvent.payload.outcome).toBe("ok");

    // Subsequent act is blocked
    const res2 = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "tool:read",
    });
    expect(res2.ok).toBe(false);
    expect(res2.error).toBe("mandate_inactive");
  });

  // Acceptance Criterion 11
  it("AC11: portable continuation preserves authority lineage", () => {
    const bundle = createPortableCapabilityBundle({
      continuation_id: "cont-step-42",
      required_capability: "repo:commit",
      authority_lineage: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      state: { file: "test.js", diff: "+line" },
    });

    expect(bundle.schema).toBe("cop.portable-capability-bundle/v1");
    expect(bundle.continuation_id).toBe("cont-step-42");
    expect(bundle.bound).toBe(false);
    expect(bundle.local_binding).toBeNull();
    expect(bundle.authority_lineage.principal_ref).toBe(PRINCIPAL_ALICE);
    expect(bundle.authority_lineage.mandate_ref).toBe(`${MANDATE_ID}@v1`);
    expect(bundle.authority_lineage.logical_agent_ref).toBe(AGENT_BOB);
  });

  // Acceptance Criterion 12
  it("AC12: imported state without local rebinding -> refuse; after explicit rebinding -> resume", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler({ result: { committed: true } });

    recordMandateDeclaration(store, {
      mandate_id: `${MANDATE_ID}@v1`,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: { allowed_actions: ["repo:commit"] },
    });

    const unboundBundle = createPortableCapabilityBundle({
      continuation_id: "cont-step-99",
      required_capability: "repo:commit",
      authority_lineage: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      state: { staged: ["patch.diff"] },
    });

    // 1. Invocation without rebinding is refused
    const refuseRes = await invokeGovernedCapability({
      store,
      handler,
      portable_bundle: unboundBundle,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:commit",
    });

    expect(refuseRes.ok).toBe(false);
    expect(refuseRes.error).toBe("unbound_portable_authority");
    expect(handler.callCount).toBe(0);

    // 2. Local decision grant evaluation
    const grant = evaluateMandate(store, {
      mandate_ref: `${MANDATE_ID}@v1`,
      expected_principal_ref: PRINCIPAL_ALICE,
      expected_actor_ref: AGENT_BOB,
      capability: "repo:commit",
    });
    expect(grant.granted).toBe(true);

    // 3. Explicit local rebinding
    const reboundBundle = rebindPortableAuthority(unboundBundle, grant);
    expect(reboundBundle.bound).toBe(true);
    expect(reboundBundle.local_binding).toBeDefined();
    expect(reboundBundle.local_binding.mandate_ref).toBe(`${MANDATE_ID}@v1`);

    // 4. Invocation with rebound bundle proceeds and succeeds
    const successRes = await invokeGovernedCapability({
      store,
      handler,
      portable_bundle: reboundBundle,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: `${MANDATE_ID}@v1`,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:commit",
    });

    expect(successRes.ok).toBe(true);
    expect(handler.callCount).toBe(1);
    expect(successRes.effect).toEqual({ committed: true });
  });
});
