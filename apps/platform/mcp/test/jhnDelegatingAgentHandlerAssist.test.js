import assert from "node:assert/strict";
import test from "node:test";
import { createJhnDelegatingAgent } from "../cop/jhnDelegatingAgent.js";
import { conversationTopic } from "../cop/jhnConversationState.js";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";

const identity = Object.freeze({
  principal_ref: "principal:jhn",
  mandate_ref: "mandate:jhn:handler-assist",
  logical_agent_ref: "agent:jhn",
});

function decision(selectedPath, suffix = selectedPath) {
  return {
    selected_path: selectedPath,
    alternatives: ["local_only", "handler_assisted"],
    capability_requirement:
      selectedPath === "handler_assisted" ? { capability: "coding.assist" } : null,
    rationale: {
      summary:
        selectedPath === "handler_assisted"
          ? "The request calls for a bounded coding contribution."
          : "The local reasoner can answer without handler assistance.",
      decisive_assertion_refs:
        selectedPath === "handler_assisted"
          ? [`assertion:handler-assist-usefulness:${suffix}`]
          : [],
    },
  };
}

function createReasoner(observed = {}) {
  return {
    async respond(input) {
      observed.input = input;
      return { text: input.handlerAssist || "local response", responseId: "response:test" };
    },
  };
}

function createHandler(observed = {}) {
  return {
    id: "handler:test-coder",
    capability: "coding.assist",
    async invoke(input) {
      observed.input = input;
      return { text: "handler contribution", provider: "test", model: "test-model" };
    },
  };
}

function executionBudget() {
  return {
    budget_id: "budget:jhn:handler-assist",
    limits: {
      max_steps: 2,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 1_000,
      max_external_effects: 0,
    },
    demand: {
      max_steps: 1,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 1_000,
      max_external_effects: 0,
    },
  };
}

function conversationEvents(store, conversationId) {
  return store.listTopic(conversationTopic(conversationId));
}

function recordedDecision(events) {
  return events.find((event) => event.event_type === "HandlerAssistDecisionRecorded");
}

test("A - a reason-bearing local_only decision is durable and uses the local reasoner", async () => {
  const store = createMemoryCopEventStore();
  const handlerObserved = {};
  const reasonerObserved = {};
  const agent = createJhnDelegatingAgent({
    store,
    handler: createHandler(handlerObserved),
    reasoner: createReasoner(reasonerObserved),
    identity,
    decideHandlerAssist: () => decision("local_only"),
  });

  const result = await agent.turn({
    message: "Explain the current state",
    conversationId: "reasoned-local",
    turnId: "turn-a",
  });

  const events = conversationEvents(store, "reasoned-local");
  const recorded = recordedDecision(events);
  assert.equal(result.text, "local response");
  assert.equal(handlerObserved.input, undefined);
  assert.equal(reasonerObserved.input.handlerAssist, null);
  assert.equal(recorded.payload.selected_path, "local_only");
  assert.equal(recorded.payload.rationale.kind, "reasoned");
  assert.equal(recorded.payload.capability_requirement, null);
  assert.equal(
    events.some((event) => event.payload?.kind === "conversation.delegation_refused"),
    false
  );
});

test("B - an unavailable handler is recorded after the unchanged reasoned decision", async () => {
  const store = createMemoryCopEventStore();
  const agent = createJhnDelegatingAgent({
    store,
    reasoner: createReasoner(),
    identity,
    decideHandlerAssist: () => decision("handler_assisted", "unavailable"),
  });

  await agent.turn({
    message: "Implement the bounded change",
    conversationId: "reasoned-unavailable",
    turnId: "turn-b",
  });

  const events = conversationEvents(store, "reasoned-unavailable");
  const recorded = recordedDecision(events);
  const refusal = events.find((event) => event.payload?.kind === "conversation.delegation_refused");
  assert.equal(
    recorded.payload.rationale.summary,
    "The request calls for a bounded coding contribution."
  );
  assert.deepEqual(recorded.payload.rationale.decisive_assertion_refs, [
    "assertion:handler-assist-usefulness:unavailable",
  ]);
  assert.equal(refusal.payload.reason, "required_capability_unavailable");
  assert.ok(recorded.topic.seq < refusal.topic.seq);
});

test("C - Mandate and budget refusals remain downstream from the decision", async (t) => {
  await t.test("inactive Mandate", async () => {
    const store = createMemoryCopEventStore();
    recordMandateDeclaration(store, {
      mandate_id: identity.mandate_ref,
      principal_subject_id: identity.principal_ref,
      representative_subject_id: identity.logical_agent_ref,
      status: "revoked",
      scope: { allowed_capabilities: ["*"] },
    });
    const handlerObserved = {};
    const agent = createJhnDelegatingAgent({
      store,
      handler: createHandler(handlerObserved),
      reasoner: createReasoner(),
      identity,
      decideHandlerAssist: () => decision("handler_assisted", "mandate-refused"),
      execution_budget: executionBudget(),
    });

    await agent.turn({
      message: "Implement this",
      conversationId: "reasoned-mandate-refused",
      turnId: "turn-c1",
    });

    const events = conversationEvents(store, "reasoned-mandate-refused");
    const recorded = recordedDecision(events);
    const refusal = events.find(
      (event) => event.payload?.kind === "conversation.delegation_refused"
    );
    assert.equal(refusal.payload.reason, "mandate_inactive");
    assert.ok(recorded.topic.seq < refusal.topic.seq);
    assert.equal(handlerObserved.input, undefined);
  });

  await t.test("missing bounded budget", async () => {
    const store = createMemoryCopEventStore();
    recordMandateDeclaration(store, {
      mandate_id: identity.mandate_ref,
      principal_subject_id: identity.principal_ref,
      representative_subject_id: identity.logical_agent_ref,
      status: "active",
      scope: { allowed_capabilities: ["*"] },
    });
    const handlerObserved = {};
    const agent = createJhnDelegatingAgent({
      store,
      handler: createHandler(handlerObserved),
      reasoner: createReasoner(),
      identity,
      decideHandlerAssist: () => decision("handler_assisted", "budget-refused"),
    });

    await agent.turn({
      message: "Implement this",
      conversationId: "reasoned-budget-refused",
      turnId: "turn-c2",
    });

    const events = conversationEvents(store, "reasoned-budget-refused");
    const recorded = recordedDecision(events);
    const refusal = events.find(
      (event) => event.payload?.kind === "conversation.delegation_refused"
    );
    assert.equal(refusal.payload.reason, "execution_budget_required");
    assert.ok(recorded.topic.seq < refusal.topic.seq);
    assert.equal(handlerObserved.input, undefined);
  });
});

test("D - governed execution follows the decision without creating usefulness evidence", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    principal_subject_id: identity.principal_ref,
    representative_subject_id: identity.logical_agent_ref,
    status: "active",
    scope: { allowed_capabilities: ["*"] },
  });
  const reasonerObserved = {};
  const agent = createJhnDelegatingAgent({
    store,
    handler: createHandler(),
    reasoner: createReasoner(reasonerObserved),
    identity,
    decideHandlerAssist: () => decision("handler_assisted", "executed"),
    execution_budget: executionBudget(),
  });

  await agent.turn({
    message: "Implement this",
    conversationId: "reasoned-executed",
    turnId: "turn-d",
  });

  const events = conversationEvents(store, "reasoned-executed");
  const recorded = recordedDecision(events);
  const invocation = events.find((event) => event.payload?.kind === "CapabilityInvocation");
  const trace = events.find((event) => event.payload?.kind === "Trace");
  assert.ok(recorded.topic.seq < invocation.topic.seq);
  assert.equal(invocation.payload.handler_instance_ref, "handler:test-coder");
  assert.equal(reasonerObserved.input.handlerAssist, "handler contribution");
  assert.equal(trace.payload.outcome, "ok");
  assert.equal(
    events.some((event) => event.payload?.kind === "EvidenceRelation"),
    false
  );
  assert.equal(Object.hasOwn(trace.payload, "usefulness_resolution"), false);
});

test("E - legacy shouldDelegate booleans preserve choices without invented rationale", async (t) => {
  for (const wantsDelegate of [false, true]) {
    await t.test(String(wantsDelegate), async () => {
      const store = createMemoryCopEventStore();
      const conversationId = `legacy-${wantsDelegate}`;
      const agent = createJhnDelegatingAgent({
        store,
        reasoner: createReasoner(),
        identity,
        shouldDelegate: () => wantsDelegate,
      });

      await agent.turn({ message: "legacy choice", conversationId, turnId: "turn-e" });

      const recorded = recordedDecision(conversationEvents(store, conversationId));
      assert.equal(
        recorded.payload.selected_path,
        wantsDelegate ? "handler_assisted" : "local_only"
      );
      assert.equal(recorded.payload.rationale.kind, "legacy_boolean");
      assert.equal(recorded.payload.rationale.summary, null);
      assert.deepEqual(recorded.payload.rationale.decisive_assertion_refs, []);
    });
  }
});

test("F - the historical default heuristic remains handler-dependent", async (t) => {
  const cases = [
    {
      name: "matching with handler",
      message: "Please review this code",
      handler: createHandler(),
      expected: "handler_assisted",
    },
    {
      name: "non-matching with handler",
      message: "Hello John",
      handler: createHandler(),
      expected: "local_only",
    },
    {
      name: "matching without handler",
      message: "Please fix this code",
      handler: undefined,
      expected: "local_only",
    },
  ];
  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async () => {
      const store = createMemoryCopEventStore();
      const conversationId = `heuristic-${index}`;
      const agent = createJhnDelegatingAgent({
        store,
        handler: item.handler,
        reasoner: createReasoner(),
        identity,
      });

      await agent.turn({ message: item.message, conversationId, turnId: `turn-f${index}` });

      const recorded = recordedDecision(conversationEvents(store, conversationId));
      assert.equal(recorded.payload.selected_path, item.expected);
      assert.equal(recorded.payload.rationale.kind, "legacy_heuristic");
      assert.equal(recorded.payload.rationale.summary, null);
      assert.deepEqual(recorded.payload.rationale.decisive_assertion_refs, []);
    });
  }
});

test("G - decideHandlerAssist takes precedence over shouldDelegate", async () => {
  const store = createMemoryCopEventStore();
  let legacyCalled = false;
  const agent = createJhnDelegatingAgent({
    store,
    handler: createHandler(),
    reasoner: createReasoner(),
    identity,
    decideHandlerAssist: () => decision("local_only"),
    shouldDelegate: () => {
      legacyCalled = true;
      return true;
    },
  });

  await agent.turn({
    message: "Please implement this",
    conversationId: "precedence",
    turnId: "turn-g",
  });

  const recorded = recordedDecision(conversationEvents(store, "precedence"));
  assert.equal(legacyCalled, false);
  assert.equal(recorded.payload.selected_path, "local_only");
  assert.equal(recorded.payload.rationale.kind, "reasoned");
});
