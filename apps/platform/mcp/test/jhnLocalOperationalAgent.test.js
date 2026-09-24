import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { bootstrapJhnLocalCopAuthority } from "../../scripts/bootstrap-jhn-cop-local.js";
import { createJhnLocalOperationalAgent } from "../cop/jhnLocalOperationalAgent.js";
import { readJhnConversationState, conversationTopic } from "../cop/jhnConversationState.js";
import { createSqliteCopRuntimeStore } from "../cop/sqliteRuntimeStore.js";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";
import {
  JHN_AGENT_LOGICAL_AGENT_REF,
  JHN_AGENT_MANDATE_REF,
  JHN_AGENT_PRINCIPAL_REF,
} from "../cop/jhnLocalAgentAuthority.js";

// Injected-store cases declare this normative id themselves. They do not use
// the transport ACL row `mandate:jhn:runtime:1`.
const identity = Object.freeze({
  principal_ref: JHN_AGENT_PRINCIPAL_REF,
  mandate_ref: JHN_AGENT_MANDATE_REF,
  logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
});

function recordedEvents(stateDirectory, conversationId) {
  const database = new DatabaseSync(path.join(stateDirectory, "cop-runtime.sqlite"));
  try {
    return createSqliteCopRuntimeStore(database).eventStore.listTopic(
      conversationTopic(conversationId)
    );
  } finally {
    database.close();
  }
}

function decisionEvent(events) {
  return events.find((event) => event.event_type === "HandlerAssistDecisionRecorded");
}

test("A - local-only turn is durable, reason-bearing, and restart-safe", async () => {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), "jhn-op-agent-a-"));
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const reasonerObserved = [];
    const reasoner = {
      async respond(input) {
        reasonerObserved.push(input);
        return { text: `John: ${input.message}`, responseId: `resp-${reasonerObserved.length}` };
      },
    };

    const agent1 = createJhnLocalOperationalAgent({ stateDirectory, reasoner });
    const result = await agent1.turn({ message: "Bonjour John", conversationId: "op-a" });
    assert.equal(result.text, "John: Bonjour John");
    assert.equal(reasonerObserved[0].handlerAssist, null);
    agent1.close();

    const decision = decisionEvent(recordedEvents(stateDirectory, "op-a"));
    assert.equal(decision.payload.selected_path, "local_only");
    assert.equal(decision.payload.rationale.kind, "reasoned");
    assert.ok(decision.payload.rationale.summary);
    assert.equal(decision.payload.capability_requirement, null);

    const beforeRestart = readJhnConversationState({ stateDirectory, conversationId: "op-a" });
    assert.equal(beforeRestart.history.length, 2);
    assert.equal(beforeRestart.history[0].role, "user");
    assert.equal(beforeRestart.history[1].role, "assistant");

    // Simulate a restart: a fresh operational agent instance against the same durable state.
    const agent2 = createJhnLocalOperationalAgent({ stateDirectory, reasoner });
    await agent2.turn({ message: "Tu te souviens ?", conversationId: "op-a" });
    agent2.close();
    assert.equal(reasonerObserved[1].history.length, 2);

    const afterRestart = readJhnConversationState({ stateDirectory, conversationId: "op-a" });
    assert.equal(afterRestart.history.length, 4);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
});

test("B - handler-assisted decision without a configured handler stays safe and durable", async () => {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), "jhn-op-agent-b-"));
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const reasoner = {
      async respond({ handlerAssist }) {
        return { text: handlerAssist || "local fallback", responseId: "resp-b" };
      },
    };

    const agent = createJhnLocalOperationalAgent({ stateDirectory, reasoner });
    const result = await agent.turn({
      message: "Please fix this repository bug",
      conversationId: "op-b",
    });
    agent.close();

    assert.equal(result.text, "local fallback");
    const events = recordedEvents(stateDirectory, "op-b");
    const decision = decisionEvent(events);
    assert.equal(decision.payload.selected_path, "handler_assisted");
    assert.equal(decision.payload.rationale.kind, "reasoned");
    assert.ok(decision.payload.rationale.summary);
    const refusal = events.find(
      (event) => event.payload?.kind === "conversation.delegation_refused"
    );
    assert.equal(refusal.payload.reason, "required_capability_unavailable");
    assert.ok(decision.topic.seq < refusal.topic.seq);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
});

function executionBudget() {
  return {
    budget_id: "budget:jhn:op-agent",
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

test("C - governance refusal leaves the earlier decision unchanged", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    principal_subject_id: identity.principal_ref,
    representative_subject_id: identity.logical_agent_ref,
    status: "revoked",
    scope: { allowed_capabilities: ["*"] },
  });
  const handlerObserved = {};
  const agent = createJhnLocalOperationalAgent({
    store,
    identity,
    reasoner: {
      async respond() {
        return { text: "local response" };
      },
    },
    handler: {
      id: "handler:test-coder",
      capability: "coding.assist",
      async invoke(input) {
        handlerObserved.input = input;
        return { text: "must not run" };
      },
    },
    execution_budget: executionBudget(),
  });

  const result = await agent.turn({
    message: "Please implement this repository change",
    conversationId: "op-c",
    history: [],
  });

  assert.equal(result.text, "local response");
  assert.equal(handlerObserved.input, undefined);
  const events = store.listTopic(conversationTopic("op-c"));
  const decision = decisionEvent(events);
  const refusal = events.find((event) => event.payload?.kind === "conversation.delegation_refused");
  assert.equal(decision.payload.selected_path, "handler_assisted");
  assert.equal(refusal.payload.reason, "mandate_inactive");
  assert.ok(decision.topic.seq < refusal.topic.seq);
});

test("D - governed assistance succeeds without fabricating usefulness evidence", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: identity.mandate_ref,
    principal_subject_id: identity.principal_ref,
    representative_subject_id: identity.logical_agent_ref,
    status: "active",
    scope: { allowed_capabilities: ["*"] },
  });
  const reasonerObserved = {};
  const agent = createJhnLocalOperationalAgent({
    store,
    identity,
    reasoner: {
      async respond(input) {
        reasonerObserved.input = input;
        return { text: `John: ${input.handlerAssist}` };
      },
    },
    handler: {
      id: "handler:test-coder",
      capability: "coding.assist",
      async invoke() {
        return { text: "handler contribution", provider: "test", model: "test-model" };
      },
    },
    execution_budget: executionBudget(),
  });

  const result = await agent.turn({
    message: "Please implement this repository change",
    conversationId: "op-d",
    history: [],
  });

  assert.equal(result.text, "John: handler contribution");
  assert.equal(result.handler_instance_ref, "handler:test-coder");
  assert.ok(result.governed_act);
  const events = store.listTopic(conversationTopic("op-d"));
  const decision = decisionEvent(events);
  const invocation = events.find((event) => event.payload?.kind === "CapabilityInvocation");
  assert.ok(decision.topic.seq < invocation.topic.seq);
  assert.equal(
    events.some((event) => event.payload?.kind === "EvidenceRelation"),
    false
  );
});

test("E - chat, repl and console share the same operational turn runner", async () => {
  const scriptsDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "scripts"
  );
  for (const script of [
    "run-jhn-local-chat.js",
    "run-jhn-local-repl.js",
    "run-jhn-local-console.js",
  ]) {
    const source = await readFile(path.join(scriptsDirectory, script), "utf8");
    assert.match(
      source,
      /from ["']\.\.\/mcp\/cop\/jhnLocalOperationalAgent\.js["']/,
      `${script} must use the shared jhnLocalOperationalAgent factory`
    );
  }
});
