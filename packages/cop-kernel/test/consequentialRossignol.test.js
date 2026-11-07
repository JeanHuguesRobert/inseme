import test from "node:test";
import assert from "node:assert/strict";

import {
  createEventSourcedExecutionBudgetLedger,
  recordExecutionBudgetGrant,
  invokeGovernedCapability,
  recordMandateControl,
  recordMandateDeclaration,
  createCopEventEnvelope,
} from "@inseme/cop-core";

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
  };
}

function createFakeProvider({ id = "handler:kernel-test-attestor@local", steps = 2 } = {}) {
  let callCount = 0;
  return {
    id,
    capability: "reasoning.code",
    get callCount() {
      return callCount;
    },
    async invoke(input) {
      callCount += 1;
      return {
        reply: `ok for ${JSON.stringify(input)}`,
        execution_usage: {
          max_steps: steps,
          max_tool_calls: 0,
          max_subagents: 0,
          max_elapsed_ms: 25,
          max_external_effects: 0,
        },
        resource_assessments: [
          {
            status: "measured",
            resource_type: "compute/llm_tokens",
            quantity: { coefficient: "250", scale: 0, unit: "tokens" },
            evidence_ref: `receipt:${id}`,
          },
        ],
      };
    },
  };
}

test("cop-kernel integration: Consequential Rossignol R1–R5 adversarial suite", async () => {
  const store = createMemoryCopStore();
  const identity = {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:mnd-kernel-rossignol@v1",
    logical_agent_ref: "agent:jhn",
    topic_id: "topic:kernel-rossignol-session",
  };

  const limits = {
    max_steps: 5,
    max_tool_calls: 2,
    max_subagents: 1,
    max_elapsed_ms: 10000,
    max_external_effects: 1,
  };

  const budgetId = "bgt-kernel-rossignol";

  // A budget grant is NOT an authorization to act. Since COP now requires
  // independently recorded mandates, seed an explicit fixture declaration
  // before issuing the distinct budget grant (cop-core #55 invariant).
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    version: "v1",
    principal_ref: identity.principal_ref,
    logical_agent_ref: identity.logical_agent_ref,
    scope: { allowed_actions: ["reasoning.code"] },
  });

  // 1. Authoritative Budget Grant (separate from the mandate)
  recordExecutionBudgetGrant(store, {
    budget_id: budgetId,
    mandate_ref: identity.mandate_ref,
    principal_ref: identity.principal_ref,
    limits,
    authority_version: 1,
  });

  const ledger = createEventSourcedExecutionBudgetLedger({
    store,
    budget_id: budgetId,
    limits,
  });

  const provider = createFakeProvider({ steps: 2 });

  // R1: Exceeded capacity attempt (demand 10 when limit is 5)
  const r1 = await invokeGovernedCapability({
    store,
    ledger,
    handler: provider,
    identity,
    capability: "reasoning.code",
    demand: { ...limits, max_steps: 10 },
    input: { test: "r1" },
    idempotency_key: "k-r1",
  });
  assert.equal(r1.ok, false);
  assert.equal(r1.error, "budget_exhausted");
  assert.equal(r1.called_provider, false);
  assert.equal(provider.callCount, 0);

  // Normal call consumes 2 steps
  const call1 = await invokeGovernedCapability({
    store,
    ledger,
    handler: provider,
    identity,
    capability: "reasoning.code",
    demand: { ...limits, max_steps: 2, max_elapsed_ms: 100 },
    input: { test: "c1" },
    idempotency_key: "k-c1",
  });
  assert.equal(call1.ok, true);
  assert.equal(call1.called_provider, true);
  assert.equal(provider.callCount, 1);
  assert.equal(ledger.snapshot().available.max_steps, 3);

  // R4: Provider Rebinding under same budget
  const altProvider = createFakeProvider({ id: "handler:alt-provider@cloud", steps: 3 });
  const call2 = await invokeGovernedCapability({
    store,
    ledger,
    handler: altProvider,
    identity,
    capability: "reasoning.code",
    demand: { ...limits, max_steps: 3, max_elapsed_ms: 100 },
    input: { test: "c2" },
    idempotency_key: "k-c2",
  });
  assert.equal(call2.ok, true);
  assert.equal(altProvider.callCount, 1);
  assert.equal(ledger.snapshot().available.max_steps, 0);

  // R5: TOCTOU Revocation Race check
  recordMandateControl(store, {
    principal_ref: identity.principal_ref,
    mandate_ref: identity.mandate_ref,
    action: "revoke",
    reason: "Mandate revoked before effect",
  });

  const toctouCall = await invokeGovernedCapability({
    store,
    ledger,
    handler: provider,
    identity,
    capability: "reasoning.code",
    demand: { ...limits, max_steps: 1 },
    input: { test: "toctou" },
    idempotency_key: "k-toctou",
  });
  assert.equal(toctouCall.ok, false);
  assert.equal(toctouCall.called_provider, false);
  assert.equal(toctouCall.error, "mandate_inactive");
  assert.equal(provider.callCount, 1); // Provider never called again!
});
