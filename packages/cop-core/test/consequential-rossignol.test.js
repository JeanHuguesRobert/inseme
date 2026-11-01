import { describe, it, expect } from "vitest";
import {
  createEventSourcedExecutionBudgetLedger,
  recordExecutionBudgetGrant,
  DIMENSIONS,
} from "../src/execution-budget.js";
import {
  invokeGovernedCapability,
  recordMandateDeclaration,
  recordMandateControl,
  isMandateActive,
} from "../src/governed-act.js";
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
 * Fake provider/handler fixture tracking invocation calls and returning simulated measurements.
 * Stops before any real paid call!
 */
function createFakeAttestedProvider({
  id = "handler:fake-provider-attestor@local",
  capability = "reasoning.code",
  perStepUsage = 1,
  failWith = null,
} = {}) {
  let callCount = 0;
  const invocations = [];

  return {
    id,
    capability,
    get callCount() {
      return callCount;
    },
    get invocations() {
      return invocations;
    },
    async invoke(input) {
      callCount += 1;
      invocations.push(structuredClone(input));
      if (failWith) {
        throw new Error(failWith);
      }
      const steps = input.steps || perStepUsage;
      return {
        output: `simulated response for ${JSON.stringify(input)}`,
        execution_usage: {
          max_steps: steps,
          max_tool_calls: 0,
          max_subagents: 0,
          max_elapsed_ms: 45,
          max_external_effects: 0,
        },
        resource_assessments: [
          {
            status: "measured",
            resource_type: "compute/llm_tokens",
            quantity: { coefficient: String(steps * 150), scale: 0, unit: "tokens" },
            evidence_ref: `receipt:${id}`,
          },
        ],
      };
    },
  };
}

describe("Consequential Rossignol Reality Test Suite (Issue #68)", () => {
  const IDENTITY = {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:mnd-jhn-rossignol@v1",
    logical_agent_ref: "agent:jhn",
    topic_id: "topic:jhn-governed-session",
  };

  // An execution budget is not a mandate. All governed tests need an
  // explicit, independently recorded authority declaration first.
  function declareFixtureMandate(store) {
    recordMandateDeclaration(store, {
      mandate_id: IDENTITY.mandate_ref,
      version: "v1",
      principal_ref: IDENTITY.principal_ref,
      logical_agent_ref: IDENTITY.logical_agent_ref,
      scope: { allowed_actions: ["reasoning.code"] },
    });
  }

  const BASE_LIMITS = {
    max_steps: 10,
    max_tool_calls: 5,
    max_subagents: 2,
    max_elapsed_ms: 60000,
    max_external_effects: 5,
  };

  function stepDemand(steps) {
    return {
      max_steps: steps,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 100,
      max_external_effects: 0,
    };
  }

  it("R1 — Exceeded capacity: requests exceeding limits are refused and budget is untouched", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r1-test";

    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
    });

    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const provider = createFakeAttestedProvider();

    // Attempt to invoke with 15 steps (limit is 10)
    const result = await invokeGovernedCapability({
      store,
      ledger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(15),
      input: { task: "overflow_attempt" },
      idempotency_key: "r1:inv-01",
    });

    // Invariant: Refused immediately
    expect(result.ok).toBe(false);
    expect(result.error).toBe("budget_exhausted");
    expect(result.dimension).toBe("max_steps");
    expect(result.called_provider).toBe(false);

    // Invariant: Provider was never reached
    expect(provider.callCount).toBe(0);

    // Invariant: Budget state remains at initial 10 available
    const snapshot = ledger.snapshot();
    expect(snapshot.settled.max_steps).toBe(0);
    expect(snapshot.reserved.max_steps).toBe(0);
    expect(snapshot.available.max_steps).toBe(10);
  });

  it("R2 — Packet restart/fork: consumed capacity survives across packets and restarts", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r2-test";

    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
    });

    const ledger1 = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const provider = createFakeAttestedProvider();

    // Packet 1 consumes 4 steps
    const result1 = await invokeGovernedCapability({
      store,
      ledger: ledger1,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(4),
      input: { steps: 4 },
      idempotency_key: "r2:packet-1:inv-01",
      packet_id: "packet:p1-parent",
    });

    expect(result1.ok).toBe(true);
    expect(result1.called_provider).toBe(true);
    expect(provider.callCount).toBe(1);
    expect(ledger1.snapshot().available.max_steps).toBe(6);

    // Fork / restart: Packet 2 initializes fresh in-memory ledger instance pointing to the same store
    const ledger2 = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    // Invariant: New packet immediately perceives previously settled capacity
    expect(ledger2.snapshot().settled.max_steps).toBe(4);
    expect(ledger2.snapshot().available.max_steps).toBe(6);

    // Attempting to consume 7 steps in Packet 2 is refused
    const result2Refused = await invokeGovernedCapability({
      store,
      ledger: ledger2,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(7),
      input: { steps: 7 },
      idempotency_key: "r2:packet-2:inv-refused",
      packet_id: "packet:p2-child",
    });

    expect(result2Refused.ok).toBe(false);
    expect(result2Refused.error).toBe("budget_exhausted");
    expect(result2Refused.called_provider).toBe(false);
    expect(provider.callCount).toBe(1);

    // Consuming remaining 6 steps succeeds
    const result2Success = await invokeGovernedCapability({
      store,
      ledger: ledger2,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(6),
      input: { steps: 6 },
      idempotency_key: "r2:packet-2:inv-success",
      packet_id: "packet:p2-child",
    });

    expect(result2Success.ok).toBe(true);
    expect(result2Success.called_provider).toBe(true);
    expect(provider.callCount).toBe(2);
    expect(ledger2.snapshot().available.max_steps).toBe(0);
  });

  it("R3 — New local ledger: local construction cannot forge capacity; store grant binds or fails closed", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r3-test";

    // Store has authoritative grant of 10 steps
    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: { ...BASE_LIMITS, max_steps: 10 },
      authority_version: 1,
    });

    // Attacker constructs a local ledger claiming 1,000,000 steps
    const forgedLimits = { ...BASE_LIMITS, max_steps: 1000000 };
    const attackerLedger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: forgedLimits,
    });

    // Invariant: The store's authoritative grant TRUMPS the attacker's limits!
    const snapshot = attackerLedger.snapshot();
    expect(snapshot.limits.max_steps).toBe(10);
    expect(snapshot.available.max_steps).toBe(10);

    const provider = createFakeAttestedProvider();

    // Attacker tries to consume 50 steps
    const result = await invokeGovernedCapability({
      store,
      ledger: attackerLedger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(50),
      input: { steps: 50 },
      idempotency_key: "r3:forged-call",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("budget_exhausted");
    expect(provider.callCount).toBe(0);

    // Test fail-closed on ungranted budget with require_authority_grant
    const ungrantedLedger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: "bgt-non-existent-authority",
      limits: forgedLimits,
      require_authority_grant: true,
    });

    expect(ungrantedLedger.snapshot().has_grant).toBe(false);
    expect(ungrantedLedger.snapshot().available.max_steps).toBe(0);

    const ungrantedResult = await invokeGovernedCapability({
      store,
      ledger: ungrantedLedger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(1),
      input: { steps: 1 },
      idempotency_key: "r3:ungranted-call",
    });

    expect(ungrantedResult.ok).toBe(false);
    expect(ungrantedResult.error).toBe("budget_not_authorized");
    expect(provider.callCount).toBe(0);
  });

  it("R4 — Provider rebinding: changing execution machinery does not reset consequence", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r4-test";

    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
    });

    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const providerOpenAI = createFakeAttestedProvider({
      id: "handler:openai-gpt4o@cloud",
    });
    const providerAnthropic = createFakeAttestedProvider({
      id: "handler:anthropic-claude-3-7-sonnet@cloud",
    });

    // 1. First invocation through OpenAI consumes 4 steps
    const res1 = await invokeGovernedCapability({
      store,
      ledger,
      handler: providerOpenAI,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(4),
      input: { steps: 4 },
      idempotency_key: "r4:openai-01",
    });

    expect(res1.ok).toBe(true);
    expect(providerOpenAI.callCount).toBe(1);
    expect(ledger.snapshot().available.max_steps).toBe(6);

    // 2. Rebind capability to Anthropic under the same mandate/ledger
    // Attempting 7 steps fails
    const res2Fail = await invokeGovernedCapability({
      store,
      ledger,
      handler: providerAnthropic,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(7),
      input: { steps: 7 },
      idempotency_key: "r4:anthropic-overflow",
    });

    expect(res2Fail.ok).toBe(false);
    expect(res2Fail.error).toBe("budget_exhausted");
    expect(providerAnthropic.callCount).toBe(0);

    // 3. Invocation with 3 steps through Anthropic succeeds
    const res2Success = await invokeGovernedCapability({
      store,
      ledger,
      handler: providerAnthropic,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(3),
      input: { steps: 3 },
      idempotency_key: "r4:anthropic-success",
    });

    expect(res2Success.ok).toBe(true);
    expect(providerAnthropic.callCount).toBe(1);
    expect(ledger.snapshot().available.max_steps).toBe(3);
    expect(ledger.snapshot().settled.max_steps).toBe(7);
  });

  it("R5 — Revocation race (TOCTOU): revocation before effect prevents provider call and releases reservation", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r5-test";

    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
    });

    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const provider = createFakeAttestedProvider();

    // Revoke the mandate
    recordMandateControl(store, {
      principal_ref: IDENTITY.principal_ref,
      mandate_ref: IDENTITY.mandate_ref,
      action: "revoke",
      reason: "Security audit TOCTOU test",
    });

    expect(isMandateActive(store, IDENTITY.mandate_ref)).toBe(false);

    // Attempt governed invocation under revoked mandate
    const result = await invokeGovernedCapability({
      store,
      ledger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(3),
      input: { steps: 3 },
      idempotency_key: "r5:toctou-inv",
    });

    // Invariant: Call rejected before provider invocation
    expect(result.ok).toBe(false);
    expect(result.called_provider).toBe(false);
    expect(result.error).toBe("mandate_inactive");
    expect(provider.callCount).toBe(0);

    // Invariant: Budget reservation was never left dangling
    expect(ledger.snapshot().reserved.max_steps).toBe(0);
    expect(ledger.snapshot().settled.max_steps).toBe(0);
  });

  it("R6 — Explicit new authority: new grant is distinguishable and preserves past attributable consumption", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-r6-test";

    // 1. Initial Grant v1 with 10 steps
    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
      reason: "Initial period authority",
    });

    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const provider = createFakeAttestedProvider();

    // Consume all 10 steps
    const res1 = await invokeGovernedCapability({
      store,
      ledger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(10),
      input: { steps: 10 },
      idempotency_key: "r6:consume-all",
    });

    expect(res1.ok).toBe(true);
    expect(ledger.snapshot().available.max_steps).toBe(0);
    expect(ledger.snapshot().settled.max_steps).toBe(10);
    expect(ledger.snapshot().authority_version).toBe(1);

    // 2. Explicit new authority: Principal issues Grant v2 with 25 steps
    const grantV2Limits = { ...BASE_LIMITS, max_steps: 25 };
    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: grantV2Limits,
      authority_version: 2,
      reason: "Authorized replenishment for Period 2",
    });

    // Invariant: Ledger immediately reflects new authority version
    const snapV2 = ledger.snapshot();
    expect(snapV2.authority_version).toBe(2);
    expect(snapV2.limits.max_steps).toBe(25);

    // Invariant: Old consumption remains intact (10 steps)
    expect(snapV2.settled.max_steps).toBe(10);

    // Invariant: New available capacity is 25 - 10 = 15
    expect(snapV2.available.max_steps).toBe(15);

    // 3. Invocation under new authority succeeds for 8 steps
    const res2 = await invokeGovernedCapability({
      store,
      ledger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(8),
      input: { steps: 8 },
      idempotency_key: "r6:period-2-call",
    });

    expect(res2.ok).toBe(true);
    expect(provider.callCount).toBe(2);
    expect(ledger.snapshot().settled.max_steps).toBe(18);
    expect(ledger.snapshot().available.max_steps).toBe(7);
  });

  it("produces full attributable governed act receipts and events", async () => {
    const store = createMemoryCopStore();
    declareFixtureMandate(store);
    const budgetId = "bgt-receipt-test";

    recordExecutionBudgetGrant(store, {
      budget_id: budgetId,
      mandate_ref: IDENTITY.mandate_ref,
      principal_ref: IDENTITY.principal_ref,
      limits: BASE_LIMITS,
      authority_version: 1,
    });

    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: BASE_LIMITS,
    });

    const provider = createFakeAttestedProvider({
      id: "handler:test-attestor@local",
    });

    const result = await invokeGovernedCapability({
      store,
      ledger,
      handler: provider,
      identity: IDENTITY,
      capability: "reasoning.code",
      demand: stepDemand(2),
      input: { steps: 2, question: "Calculate trajectory" },
      idempotency_key: "receipt:inv-01",
    });

    expect(result.ok).toBe(true);
    expect(result.receipt.schema).toBe("cop.governed-act.receipt.v1");
    expect(result.receipt.principal_ref).toBe(IDENTITY.principal_ref);
    expect(result.receipt.mandate_ref).toBe(IDENTITY.mandate_ref);
    expect(result.receipt.logical_agent_ref).toBe(IDENTITY.logical_agent_ref);
    expect(result.receipt.handler_instance_ref).toBe("handler:test-attestor@local");
    expect(result.events).toHaveLength(4);

    const [invEvent, actEvent, traceEvent, impEvent] = result.events;
    expect(invEvent.payload.kind).toBe("CapabilityInvocation");
    expect(actEvent.payload.kind).toBe("Act");
    expect(traceEvent.payload.kind).toBe("Trace");
    expect(impEvent.payload.kind).toBe("Imputation");

    // Imputation responsibility remains with LogicalAgent under Principal mandate
    expect(impEvent.payload.responsibility).toBe("logical_agent_under_mandate");
    expect(impEvent.payload.material_executor).toBe("handler:test-attestor@local");
    expect(impEvent.payload.resource_assessments[0].quantity.coefficient).toBe("300");
  });
});
