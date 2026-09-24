import assert from "node:assert/strict";
import test from "node:test";
import { createJhnDelegatingAgent } from "../cop/jhnDelegatingAgent.js";
import { conversationTopic } from "../cop/jhnConversationState.js";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";

const identity = Object.freeze({
  principal_ref: "principal:jhn",
  mandate_ref: "mandate:jhn:capability-requirement",
  logical_agent_ref: "agent:jhn",
});

function createReasoner(observed = {}) {
  return {
    async respond(input) {
      observed.input = input;
      return { text: input.handlerAssist || "local response", responseId: "response:test" };
    },
  };
}

function createHandler(capability, observed = {}) {
  return {
    id: `handler:test:${capability}`,
    capability,
    async invoke(input) {
      observed.called = true;
      observed.input = input;
      return { text: "handler contribution", provider: "test", model: "test-model" };
    },
  };
}

function executionBudget() {
  return {
    budget_id: "budget:jhn:capability-requirement",
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

function refusal(events) {
  return events.find((event) => event.payload?.kind === "conversation.delegation_refused");
}

function invocation(events) {
  return events.find((event) => event.payload?.kind === "CapabilityInvocation");
}

function decisionFor(capability) {
  return {
    selected_path: "handler_assisted",
    alternatives: ["local_only", "handler_assisted"],
    capability_requirement: { capability },
    rationale: {
      summary: `The request calls for ${capability}.`,
      decisive_assertion_refs: [],
    },
  };
}

test("A - a matching coding.assist.read requirement proceeds to the Mandate gate", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    principal_subject_id: identity.principal_ref,
    representative_subject_id: identity.logical_agent_ref,
    status: "active",
    scope: { allowed_actions: ["coding.assist"] },
  });
  const handlerObserved = {};
  const agent = createJhnDelegatingAgent({
    store,
    handler: createHandler("coding.assist.read", handlerObserved),
    reasoner: createReasoner(),
    identity,
    decideHandlerAssist: () => decisionFor("coding.assist.read"),
    execution_budget: executionBudget(),
  });

  await agent.turn({
    message: "Review this repository code and explain the bug without changing files.",
    conversationId: "req-a",
    turnId: "turn-a",
  });

  const events = conversationEvents(store, "req-a");
  const recorded = recordedDecision(events);
  const refused = refusal(events);
  assert.equal(recorded.payload.capability_requirement.capability, "coding.assist.read");
  assert.equal(handlerObserved.called, undefined);
  assert.equal(invocation(events), undefined);
  assert.equal(refused.payload.reason, "capability_out_of_scope");
  assert.equal(refused.payload.capability, "coding.assist.read");
  assert.notEqual(refused.payload.reason, "capability_requirement_mismatch");
  assert.notEqual(refused.payload.reason, "mandate_inactive");
  assert.ok(recorded.topic.seq < refused.topic.seq);
});

test("B - a mismatching handler is refused before governed invocation", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    principal_subject_id: identity.principal_ref,
    representative_subject_id: identity.logical_agent_ref,
    status: "active",
    scope: { allowed_actions: ["coding.assist"] },
  });
  const handlerObserved = {};
  const agent = createJhnDelegatingAgent({
    store,
    handler: createHandler("coding.assist.read", handlerObserved),
    reasoner: createReasoner(),
    identity,
    decideHandlerAssist: () => decisionFor("coding.assist"),
    execution_budget: executionBudget(),
  });

  await agent.turn({
    message: "Implement this change and commit it.",
    conversationId: "req-b",
    turnId: "turn-b",
  });

  const events = conversationEvents(store, "req-b");
  const recorded = recordedDecision(events);
  const refused = refusal(events);
  assert.equal(recorded.payload.capability_requirement.capability, "coding.assist");
  assert.equal(recorded.payload.rationale.summary, "The request calls for coding.assist.");
  assert.equal(handlerObserved.called, undefined);
  assert.equal(invocation(events), undefined);
  assert.equal(refused.payload.reason, "capability_requirement_mismatch");
  assert.equal(refused.payload.capability, "coding.assist");
  assert.equal(refused.payload.handler_capability, "coding.assist.read");
  assert.notEqual(refused.payload.reason, "mandate_inactive");
  assert.notEqual(refused.payload.reason, "budget_exhausted");
  assert.notEqual(refused.payload.reason, "required_capability_unavailable");
  assert.ok(recorded.topic.seq < refused.topic.seq);
});

test("C - no handler remains ordinary unavailability, distinct from mismatch", async () => {
  const store = createMemoryCopEventStore();
  const agent = createJhnDelegatingAgent({
    store,
    reasoner: createReasoner(),
    identity,
    decideHandlerAssist: () => decisionFor("coding.assist.read"),
  });

  await agent.turn({
    message: "Review this repository code.",
    conversationId: "req-c",
    turnId: "turn-c",
  });

  const events = conversationEvents(store, "req-c");
  const recorded = recordedDecision(events);
  const refused = refusal(events);
  assert.equal(recorded.payload.capability_requirement.capability, "coding.assist.read");
  assert.equal(refused.payload.reason, "required_capability_unavailable");
  assert.notEqual(refused.payload.reason, "capability_requirement_mismatch");
  assert.equal(invocation(events), undefined);
  assert.ok(recorded.topic.seq < refused.topic.seq);
});

test("G - matching requirement leaves Mandate and budget as independent gates", async (t) => {
  await t.test("inactive Mandate after a match", async () => {
    const store = createMemoryCopEventStore();
    recordMandateDeclaration(store, {
      mandate_id: identity.mandate_ref,
      principal_subject_id: identity.principal_ref,
      representative_subject_id: identity.logical_agent_ref,
      status: "revoked",
      scope: { allowed_actions: ["coding.assist.read"] },
    });
    const handlerObserved = {};
    const agent = createJhnDelegatingAgent({
      store,
      handler: createHandler("coding.assist.read", handlerObserved),
      reasoner: createReasoner(),
      identity,
      decideHandlerAssist: () => decisionFor("coding.assist.read"),
      execution_budget: executionBudget(),
    });

    await agent.turn({
      message: "Review this repository code.",
      conversationId: "req-g-mandate",
      turnId: "turn-g1",
    });

    const events = conversationEvents(store, "req-g-mandate");
    assert.equal(handlerObserved.called, undefined);
    assert.equal(invocation(events), undefined);
    assert.equal(refusal(events).payload.reason, "mandate_inactive");
    assert.equal(refusal(events).payload.capability, "coding.assist.read");
  });

  await t.test("missing budget after a match", async () => {
    const store = createMemoryCopEventStore();
    recordMandateDeclaration(store, {
      mandate_id: identity.mandate_ref,
      principal_subject_id: identity.principal_ref,
      representative_subject_id: identity.logical_agent_ref,
      status: "active",
      scope: { allowed_actions: ["coding.assist.read"] },
    });
    const handlerObserved = {};
    const agent = createJhnDelegatingAgent({
      store,
      handler: createHandler("coding.assist.read", handlerObserved),
      reasoner: createReasoner(),
      identity,
      decideHandlerAssist: () => decisionFor("coding.assist.read"),
    });

    await agent.turn({
      message: "Review this repository code.",
      conversationId: "req-g-budget",
      turnId: "turn-g2",
    });

    const events = conversationEvents(store, "req-g-budget");
    assert.equal(handlerObserved.called, undefined);
    assert.equal(invocation(events), undefined);
    assert.equal(refusal(events).payload.reason, "execution_budget_required");
    assert.equal(refusal(events).payload.capability, "coding.assist.read");
  });

  await t.test("matching coding.assist still reaches governed invocation", async () => {
    const store = createMemoryCopEventStore();
    recordMandateDeclaration(store, {
      mandate_id: identity.mandate_ref,
      principal_subject_id: identity.principal_ref,
      representative_subject_id: identity.logical_agent_ref,
      status: "active",
      scope: { allowed_actions: ["coding.assist"] },
    });
    const handlerObserved = {};
    const reasonerObserved = {};
    const agent = createJhnDelegatingAgent({
      store,
      handler: createHandler("coding.assist", handlerObserved),
      reasoner: createReasoner(reasonerObserved),
      identity,
      decideHandlerAssist: () => decisionFor("coding.assist"),
      execution_budget: executionBudget(),
    });

    await agent.turn({
      message: "Implement this change and commit it.",
      conversationId: "req-g-invoke",
      turnId: "turn-g3",
    });

    const events = conversationEvents(store, "req-g-invoke");
    assert.equal(handlerObserved.called, true);
    assert.equal(invocation(events).payload.capability, "coding.assist");
    assert.equal(reasonerObserved.input.handlerAssist, "handler contribution");
    assert.equal(
      events.some((event) => event.payload?.kind === "conversation.delegation_refused"),
      false
    );
  });
});
