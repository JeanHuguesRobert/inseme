import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";
import {
  evaluateMandate,
  recordMandateControl,
  recordMandateDeclaration,
  resolveMandate,
} from "../../../../packages/cop-core/src/governed-act.js";
import {
  bootstrapJhnLocalCopAuthority,
  bootstrapJhnLocalTransportAuthority,
} from "../../scripts/bootstrap-jhn-cop-local.js";
import { repairJhnLocalAgentAuthority } from "../../scripts/repair-jhn-local-agent-authority.js";
import { verifyJhnLocalCopAuthority } from "../../scripts/verify-jhn-cop-local.js";
import {
  JHN_AGENT_BUDGET_ID,
  JHN_AGENT_BUDGET_LIMITS,
  JHN_AGENT_LOGICAL_AGENT_REF,
  JHN_AGENT_MANDATE_REF,
  JHN_AGENT_PRINCIPAL_REF,
  JHN_AGENT_TURN_DEMAND,
  JHN_TRANSPORT_GRANTEE_REF,
  JHN_TRANSPORT_MANDATE_REF,
} from "../cop/jhnLocalAgentAuthority.js";
import { createJhnLocalOperationalAgent } from "../cop/jhnLocalOperationalAgent.js";
import { conversationTopic } from "../cop/jhnConversationState.js";
import { createSqliteCopRuntimeStore } from "../cop/sqliteRuntimeStore.js";

async function temporaryState(label) {
  return mkdtemp(path.join(os.tmpdir(), `jhn-authority-${label}-`));
}

async function removeState(stateDirectory) {
  await rm(stateDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

function withStore(stateDirectory, fn) {
  const database = new DatabaseSync(path.join(stateDirectory, "cop-runtime.sqlite"));
  try {
    return fn(database, createSqliteCopRuntimeStore(database).eventStore);
  } finally {
    database.close();
  }
}

function replay(stateDirectory) {
  return withStore(stateDirectory, (_database, store) => store.replay());
}

function transportRow(stateDirectory) {
  return withStore(stateDirectory, (database) =>
    database
      .prepare(
        "SELECT mandate_ref, version, status, issuer_ref, grantee_ref, permissions FROM cop_mandates WHERE mandate_ref = ?"
      )
      .get(JHN_TRANSPORT_MANDATE_REF)
  );
}

function kindCount(events, kind) {
  return events.filter((event) => event.payload?.kind === kind).length;
}

function decisionEvent(events) {
  return events.find((event) => event.event_type === "HandlerAssistDecisionRecorded");
}

const READ_ONLY_REPOSITORY_MESSAGE = "Please review this repository without changing files";

function codingHandler(capability = "coding.assist") {
  const observed = { called: 0 };
  return {
    observed,
    handler: {
      id: "handler:test-coder",
      capability,
      async invoke() {
        observed.called += 1;
        return { text: "handler contribution", provider: "test", model: "test-model" };
      },
    },
  };
}

function reasoner() {
  return {
    async respond(input) {
      return { text: input.handlerAssist ? `John: ${input.handlerAssist}` : "local response" };
    },
  };
}

test("A - fresh bootstrap keeps transport authority distinct from the Agent JHN mandate", async () => {
  const stateDirectory = await temporaryState("a");
  try {
    const boot = await bootstrapJhnLocalCopAuthority({ stateDirectory });
    assert.equal(boot.mandateRef, JHN_TRANSPORT_MANDATE_REF);
    assert.equal(boot.agentMandateRef, JHN_AGENT_MANDATE_REF);
    assert.notEqual(boot.mandateRef, boot.agentMandateRef);

    const row = transportRow(stateDirectory);
    assert.equal(row.grantee_ref, JHN_TRANSPORT_GRANTEE_REF);
    assert.equal(row.status, "active");
    const permissions = JSON.parse(row.permissions);
    assert.ok(permissions.includes("cop.events.append"));

    const events = replay(stateDirectory);
    const declarations = events.filter((event) => event.payload?.kind === "MandateDeclaration");
    assert.equal(declarations.length, 1);
    assert.equal(declarations[0].payload.mandate_id, JHN_AGENT_MANDATE_REF);
    assert.equal(declarations[0].payload.principal_ref, JHN_AGENT_PRINCIPAL_REF);
    assert.equal(declarations[0].payload.logical_agent_ref, JHN_AGENT_LOGICAL_AGENT_REF);
    assert.equal(declarations[0].payload.status, "active");
    assert.equal(declarations[0].payload.version, "v2");
    assert.deepEqual(declarations[0].payload.scope.allowed_actions, ["coding.assist.read"]);
    assert.equal(declarations[0].payload.scope.allowed_actions.includes("coding.assist"), false);
    assert.equal(
      declarations[0].payload.scope.allowed_actions.includes("cop.events.append"),
      false
    );

    const resolved = withStore(stateDirectory, (_database, store) => {
      const mandate = resolveMandate(store, JHN_AGENT_MANDATE_REF);
      const grant = evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist.read",
      });
      const generic = evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist",
      });
      const transportAsNormative = resolveMandate(store, JHN_TRANSPORT_MANDATE_REF);
      return { mandate, grant, generic, transportAsNormative };
    });
    assert.equal(resolved.mandate.mandate_id, JHN_AGENT_MANDATE_REF);
    assert.equal(resolved.mandate.version, "v2");
    assert.equal(resolved.grant.granted, true);
    assert.equal(resolved.generic.granted, false);
    assert.equal(resolved.generic.error, "capability_out_of_scope");
    assert.equal(resolved.transportAsNormative, null);
    await verifyJhnLocalCopAuthority({ stateDirectory });
  } finally {
    await removeState(stateDirectory);
  }
});

test("B - repair adds one normative declaration to old local state and is idempotent", async () => {
  const stateDirectory = await temporaryState("b");
  try {
    await bootstrapJhnLocalTransportAuthority({ stateDirectory });
    const privateBefore = await readFile(path.join(stateDirectory, "cop-capability-private.jwk"));
    const before = replay(stateDirectory);
    assert.equal(kindCount(before, "MandateDeclaration"), 0);
    assert.equal(kindCount(before, "ExecutionBudgetGrant"), 0);

    const first = await repairJhnLocalAgentAuthority({ stateDirectory });
    assert.equal(first.ok, true);
    assert.equal(first.changed, true);
    assert.equal(first.normative_mandate.action, "declared");
    assert.equal(first.budget.action, "granted");
    assert.equal(first.keys_preserved, true);
    assert.equal(first.transport.grantee_ref, JHN_TRANSPORT_GRANTEE_REF);

    const after = replay(stateDirectory);
    assert.equal(kindCount(after, "MandateDeclaration"), 1);
    assert.equal(kindCount(after, "ExecutionBudgetGrant"), 1);
    assert.equal(
      after.find((event) => event.payload?.kind === "MandateDeclaration").payload.version,
      "v2"
    );
    assert.deepEqual(
      after.find((event) => event.payload?.kind === "ExecutionBudgetGrant").payload.limits,
      { max_steps: 8, max_elapsed_ms: 480_000 }
    );
    const bootstrapAuditCount = withStore(
      stateDirectory,
      (database) =>
        database
          .prepare("SELECT count(*) AS count FROM cop_events WHERE type = ?")
          .get("authority.local_bootstrapped").count
    );
    assert.equal(bootstrapAuditCount, 1);

    const second = await repairJhnLocalAgentAuthority({ stateDirectory });
    assert.equal(second.ok, true);
    assert.equal(second.changed, false);
    assert.equal(second.normative_mandate.action, "already_present");
    assert.equal(second.budget.action, "already_present");
    const twice = replay(stateDirectory);
    assert.equal(kindCount(twice, "MandateDeclaration"), 1);
    assert.equal(kindCount(twice, "ExecutionBudgetGrant"), 1);
    const privateAfter = await readFile(path.join(stateDirectory, "cop-capability-private.jwk"));
    assert.equal(Buffer.compare(privateBefore, privateAfter), 0);
    assert.equal(transportRow(stateDirectory).grantee_ref, JHN_TRANSPORT_GRANTEE_REF);
  } finally {
    await removeState(stateDirectory);
  }
});

test("B - repair fails closed on conflicting or ambiguous normative authority", async () => {
  const mismatched = await temporaryState("b-mismatch");
  const ambiguous = await temporaryState("b-ambiguous");
  const brokenTransport = await temporaryState("b-transport");
  try {
    await bootstrapJhnLocalTransportAuthority({ stateDirectory: mismatched });
    withStore(mismatched, (_database, store) => {
      recordMandateDeclaration(store, {
        mandate_id: JHN_AGENT_MANDATE_REF,
        principal_ref: JHN_AGENT_PRINCIPAL_REF,
        logical_agent_ref: "agent:not-jhn",
        status: "active",
        version: "v1",
        scope: { allowed_actions: ["coding.assist"] },
      });
    });
    const beforeMismatch = replay(mismatched).length;
    const mismatch = await repairJhnLocalAgentAuthority({ stateDirectory: mismatched });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.error, "normative_authority_conflict");
    assert.equal(mismatch.changed, false);
    assert.equal(replay(mismatched).length, beforeMismatch);
    assert.equal(kindCount(replay(mismatched), "ExecutionBudgetGrant"), 0);

    await bootstrapJhnLocalTransportAuthority({ stateDirectory: ambiguous });
    withStore(ambiguous, (_database, store) => {
      recordMandateDeclaration(store, {
        mandate_id: "mandate:jhn:other:1",
        principal_ref: JHN_AGENT_PRINCIPAL_REF,
        logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        status: "active",
        version: "v1",
        scope: { allowed_actions: ["coding.assist"] },
      });
    });
    const beforeAmbiguous = replay(ambiguous).length;
    const ambiguity = await repairJhnLocalAgentAuthority({ stateDirectory: ambiguous });
    assert.equal(ambiguity.ok, false);
    assert.equal(ambiguity.changed, false);
    assert.match(ambiguity.conflicts.join("\n"), /different id/);
    assert.equal(replay(ambiguous).length, beforeAmbiguous);

    await bootstrapJhnLocalTransportAuthority({ stateDirectory: brokenTransport });
    withStore(brokenTransport, (database) => {
      database
        .prepare("UPDATE cop_mandates SET grantee_ref = ? WHERE mandate_ref = ?")
        .run("principal:someone-else", JHN_TRANSPORT_MANDATE_REF);
    });
    const beforeBroken = replay(brokenTransport).length;
    const broken = await repairJhnLocalAgentAuthority({ stateDirectory: brokenTransport });
    assert.equal(broken.ok, false);
    assert.equal(broken.error, "transport_mandate_invalid");
    assert.equal(replay(brokenTransport).length, beforeBroken);
  } finally {
    await removeState(mismatched);
    await removeState(ambiguous);
    await removeState(brokenTransport);
  }
});

test("C - real SQLite mandate revocation and wrong scope refuse the handler", async () => {
  const revokedDirectory = await temporaryState("c-revoke");
  const scopedDirectory = await temporaryState("c-scope");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory: revokedDirectory });
    withStore(revokedDirectory, (_database, store) => {
      const control = recordMandateControl(store, {
        principal_ref: JHN_AGENT_PRINCIPAL_REF,
        mandate_ref: JHN_AGENT_MANDATE_REF,
        logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        action: "revoke",
        reason: "reality-test",
      });
      assert.equal(control.ok, true);
    });
    const revokedHandler = codingHandler();
    const revokedAgent = createJhnLocalOperationalAgent({
      stateDirectory: revokedDirectory,
      reasoner: reasoner(),
      handler: revokedHandler.handler,
    });
    const revoked = await revokedAgent.turn({
      message: "Please implement this repository change",
      conversationId: "auth-c-revoke",
      history: [],
    });
    revokedAgent.close();
    assert.equal(revoked.text, "local response");
    assert.equal(revokedHandler.observed.called, 0);
    const revokedEvents = withStore(revokedDirectory, (_database, store) =>
      store.listTopic(conversationTopic("auth-c-revoke"))
    );
    const revokedDecision = decisionEvent(revokedEvents);
    const revokedRefusal = revokedEvents.find(
      (event) => event.payload?.kind === "conversation.delegation_refused"
    );
    assert.equal(revokedDecision.payload.selected_path, "handler_assisted");
    assert.equal(revokedRefusal.payload.reason, "mandate_inactive");
    assert.ok(revokedDecision.topic.seq < revokedRefusal.topic.seq);

    await bootstrapJhnLocalTransportAuthority({ stateDirectory: scopedDirectory });
    withStore(scopedDirectory, (_database, store) => {
      recordMandateDeclaration(store, {
        mandate_id: JHN_AGENT_MANDATE_REF,
        principal_ref: JHN_AGENT_PRINCIPAL_REF,
        logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        status: "active",
        version: "v1",
        scope: { allowed_actions: ["other.capability"], forbidden_actions: [] },
      });
    });
    const scopedHandler = codingHandler();
    const scopedAgent = createJhnLocalOperationalAgent({
      stateDirectory: scopedDirectory,
      reasoner: reasoner(),
      handler: scopedHandler.handler,
    });
    const scoped = await scopedAgent.turn({
      message: "Please implement this repository change",
      conversationId: "auth-c-scope",
      history: [],
    });
    scopedAgent.close();
    assert.equal(scopedHandler.observed.called, 0);
    const scopedEvents = withStore(scopedDirectory, (_database, store) =>
      store.listTopic(conversationTopic("auth-c-scope"))
    );
    const scopedDecision = decisionEvent(scopedEvents);
    const scopedRefusal = scopedEvents.find(
      (event) => event.payload?.kind === "conversation.delegation_refused"
    );
    assert.equal(scopedDecision.payload.selected_path, "handler_assisted");
    assert.equal(scopedRefusal.payload.reason, "capability_out_of_scope");
    assert.ok(scopedDecision.topic.seq < scopedRefusal.topic.seq);
  } finally {
    await removeState(revokedDirectory);
    await removeState(scopedDirectory);
  }
});

test("D - governed fake handler succeeds against the bootstrapped SQLite event store", async () => {
  const stateDirectory = await temporaryState("d");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const { handler, observed } = codingHandler("coding.assist.read");
    const agent = createJhnLocalOperationalAgent({
      stateDirectory,
      reasoner: reasoner(),
      handler,
    });
    assert.equal(agent.identity.conversational, "John");
    assert.equal(agent.identity.principal_ref, JHN_AGENT_PRINCIPAL_REF);
    assert.equal(agent.identity.logical_agent_ref, JHN_AGENT_LOGICAL_AGENT_REF);
    assert.equal(agent.identity.mandate_ref, JHN_AGENT_MANDATE_REF);

    const result = await agent.turn({
      message: READ_ONLY_REPOSITORY_MESSAGE,
      conversationId: "auth-d",
      history: [],
    });
    agent.close();

    assert.equal(observed.called, 1);
    assert.equal(result.text, "John: handler contribution");
    assert.equal(result.handler_instance_ref, "handler:test-coder");
    assert.equal(result.governed_act.mandate_ref, JHN_AGENT_MANDATE_REF);
    assert.equal(result.governed_act.principal_ref, JHN_AGENT_PRINCIPAL_REF);
    assert.equal(result.governed_act.logical_agent_ref, JHN_AGENT_LOGICAL_AGENT_REF);

    const events = withStore(stateDirectory, (_database, store) =>
      store.listTopic(conversationTopic("auth-d"))
    );
    const decision = decisionEvent(events);
    const invocation = events.find((event) => event.payload?.kind === "CapabilityInvocation");
    for (const kind of ["CapabilityInvocation", "Act", "Trace", "Imputation"]) {
      assert.equal(
        events.some((event) => event.payload?.kind === kind),
        true,
        kind
      );
    }
    assert.ok(decision.topic.seq < invocation.topic.seq);
    assert.equal(invocation.mandate_ref, JHN_AGENT_MANDATE_REF);
    assert.equal(
      events.some((event) => event.payload?.kind === "EvidenceRelation"),
      false
    );
    assert.equal(
      events.some((event) => String(event.schema || "").includes("assertion")),
      false
    );

    const budget = withStore(stateDirectory, (_database, store) =>
      createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: JHN_AGENT_BUDGET_ID,
        require_authority_grant: true,
      }).snapshot()
    );
    assert.equal(budget.has_grant, true);
    assert.equal(budget.mandate_ref, JHN_AGENT_MANDATE_REF);
    assert.equal(budget.settled.max_steps, JHN_AGENT_TURN_DEMAND.max_steps);
    assert.equal(
      budget.available.max_steps,
      JHN_AGENT_BUDGET_LIMITS.max_steps - JHN_AGENT_TURN_DEMAND.max_steps
    );
  } finally {
    await removeState(stateDirectory);
  }
});

test("D - the event-sourced grant caps caller-supplied limits", async () => {
  const stateDirectory = await temporaryState("d-cap");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const { handler, observed } = codingHandler("coding.assist.read");
    const database = new DatabaseSync(path.join(stateDirectory, "cop-runtime.sqlite"));
    try {
      const store = createSqliteCopRuntimeStore(database).eventStore;
      const agent = createJhnLocalOperationalAgent({
        store,
        reasoner: reasoner(),
        handler,
        execution_budget: {
          budget_id: JHN_AGENT_BUDGET_ID,
          demand: { ...JHN_AGENT_TURN_DEMAND, max_steps: 100 },
          ledger: createEventSourcedExecutionBudgetLedger({
            store,
            budget_id: JHN_AGENT_BUDGET_ID,
            limits: {
              max_steps: 10_000,
              max_elapsed_ms: 10_000_000,
            },
            require_authority_grant: true,
          }),
        },
      });
      const result = await agent.turn({
        message: READ_ONLY_REPOSITORY_MESSAGE,
        conversationId: "auth-d-cap",
        history: [],
      });
      assert.equal(result.text, "local response");
      assert.equal(observed.called, 0);
      const events = store.listTopic(conversationTopic("auth-d-cap"));
      const refusal = events.find(
        (event) => event.payload?.kind === "conversation.delegation_refused"
      );
      assert.equal(refusal.payload.reason, "budget_exhausted");
      const decision = decisionEvent(events);
      assert.ok(decision.topic.seq < refusal.topic.seq);
    } finally {
      database.close();
    }
  } finally {
    await removeState(stateDirectory);
  }
});

test("E - restart reopens the normative mandate and the governed trace", async () => {
  const stateDirectory = await temporaryState("e");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const agent = createJhnLocalOperationalAgent({
      stateDirectory,
      reasoner: reasoner(),
      handler: codingHandler("coding.assist.read").handler,
    });
    await agent.turn({
      message: READ_ONLY_REPOSITORY_MESSAGE,
      conversationId: "auth-e",
      history: [],
    });
    agent.close();

    const reopened = withStore(stateDirectory, (_database, store) => {
      const mandate = resolveMandate(store, JHN_AGENT_MANDATE_REF);
      const grant = evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist.read",
      });
      const topic = store.listTopic(conversationTopic("auth-e"));
      return { mandate, grant, topic };
    });
    assert.equal(reopened.mandate.status, "active");
    assert.equal(reopened.grant.granted, true);
    for (const kind of ["CapabilityInvocation", "Act", "Trace", "Imputation"]) {
      assert.equal(
        reopened.topic.some((event) => event.payload?.kind === kind),
        true,
        kind
      );
    }
  } finally {
    await removeState(stateDirectory);
  }
});

test("startup does not self-grant normative authority", async () => {
  const stateDirectory = await temporaryState("self");
  try {
    await bootstrapJhnLocalTransportAuthority({ stateDirectory });
    const source = await readFile(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "cop",
        "jhnLocalOperationalAgent.js"
      ),
      "utf8"
    );
    assert.equal(source.includes("recordMandateDeclaration"), false);
    assert.equal(source.includes("recordExecutionBudgetGrant"), false);
    assert.equal(source.includes("repairJhnLocalAgentAuthority"), false);
    assert.equal(source.includes("migrateJhnLocalAgentReadAuthority"), false);

    const { handler, observed } = codingHandler();
    const agent = createJhnLocalOperationalAgent({
      stateDirectory,
      reasoner: reasoner(),
      handler,
    });
    await agent.turn({ message: "Bonjour John", conversationId: "auth-self-local", history: [] });
    const refused = await agent.turn({
      message: "Please implement this repository change",
      conversationId: "auth-self-handler",
      history: [],
    });
    agent.close();
    assert.equal(refused.text, "local response");
    assert.equal(observed.called, 0);
    const events = replay(stateDirectory);
    assert.equal(kindCount(events, "MandateDeclaration"), 0);
    assert.equal(kindCount(events, "ExecutionBudgetGrant"), 0);
  } finally {
    await removeState(stateDirectory);
  }
});
