import test from "node:test";
import assert from "node:assert/strict";
import { createJhnDelegatingAgent } from "../cop/jhnDelegatingAgent.js";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import { recordMandateDeclaration } from "../../../../packages/cop-core/src/governed-act.js";

test("JHN Delegating Agent Governed Delegation & Packet Tracing (#33, #31)", async (t) => {
  await t.test(
    "delegates under mandate and attaches packet_id and provisional_cost to Imputation",
    async () => {
      const store = createMemoryCopEventStore();
      recordMandateDeclaration(store, {
        mandate_id: "mandate:jhn:active-001",
        principal_subject_id: "principal:jhn",
        representative_subject_id: "agent:jhn",
        status: "active",
        scope: {
          allowed_capabilities: ["*"],
        },
      });

      // Mock handler returning completion result with token usage
      const mockHandler = {
        id: "handler:openai-reasoner@local",
        capability: "coding.assist",
        async invoke(input) {
          return {
            text: "Here is the refactored code implementation.",
            provider: "openai",
            model: "gpt-5.4-nano",
            usage: {
              prompt_tokens: 1_000,
              completion_tokens: 500,
            },
            context_inheritance: "ambient-host",
          };
        },
      };

      const agent = createJhnDelegatingAgent({
        store,
        handler: mockHandler,
        reasoner: {
          async respond({ message, handlerAssist }) {
            return { text: `John Response: ${handlerAssist}`, responseId: "resp-123" };
          },
        },
        identity: {
          principal_ref: "principal:jhn",
          mandate_ref: "mandate:jhn:active-001",
          logical_agent_ref: "agent:jhn",
        },
        shouldDelegate: () => true,
        execution_budget: {
          budget_id: "budget:jhn:test",
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
        },
      });

      const result = await agent.turn({
        message: "Please write a governed delegation module",
        conversationId: "test-conv-1",
      });

      assert.equal(result.conversational_identity, "John");
      assert.equal(result.handler_instance_ref, "handler:openai-reasoner@local");
      assert.ok(result.governed_act);

      // Verify events recorded in store (user_message, CapabilityInvocation, Act, Trace, Imputation, assistant_message)
      const events = store.replay();
      assert.ok(events.length >= 5);

      const imputationEvent = events.find((e) => e.payload?.kind === "Imputation");
      assert.ok(imputationEvent);
      assert.equal(imputationEvent.payload.principal_ref, "principal:jhn");
      assert.equal(imputationEvent.payload.logical_agent_ref, "agent:jhn");
      assert.equal(imputationEvent.payload.material_executor, "handler:openai-reasoner@local");

      const traceEvent = events.find((e) => e.payload?.kind === "Trace");
      assert.equal(traceEvent.payload.effect.context_inheritance, "ambient-host");

      // Token usage alone is not a reliable price for subscription-backed
      // handlers; no USD amount is fabricated without an explicit valuation.
      assert.equal(imputationEvent.payload.provisional_cost, null);
      assert.deepEqual(imputationEvent.payload.resource_assessments, []);
      assert.deepEqual(
        store.listTopic("execution-budget:budget:jhn:test").map((event) => event.event_type),
        ["ExecutionBudgetReservation", "ExecutionBudgetSettlement"]
      );
    }
  );
});

test("JHN delegation fails closed without a bounded execution budget", async () => {
  const store = createMemoryCopEventStore();
  let invoked = false;
  const agent = createJhnDelegatingAgent({
    store,
    handler: {
      id: "handler:test",
      async invoke() {
        invoked = true;
        return { text: "must not run" };
      },
    },
    reasoner: {
      async respond() {
        return { text: "John response" };
      },
    },
    identity: {
      principal_ref: "principal:jhn",
      mandate_ref: "mandate:jhn:active-001",
      logical_agent_ref: "agent:jhn",
    },
    shouldDelegate: () => true,
  });

  await agent.turn({ message: "delegate", conversationId: "budget-gate", turnId: "turn-1" });
  assert.equal(invoked, false);
  assert.equal(
    store.replay().find((event) => event.payload?.kind === "conversation.delegation_refused")
      ?.payload.reason,
    "execution_budget_required"
  );
});

test("JHN delegation releases its reservation when the handler fails", async () => {
  const store = createMemoryCopEventStore();
  recordMandateDeclaration(store, {
    mandate_id: "mandate:jhn:active-001",
    principal_subject_id: "principal:jhn",
    representative_subject_id: "agent:jhn",
    status: "active",
    scope: {
      allowed_capabilities: ["*"],
    },
  });
  const agent = createJhnDelegatingAgent({
    store,
    handler: {
      id: "handler:failing-test",
      async invoke() {
        throw new Error("handler unavailable");
      },
    },
    reasoner: {
      async respond() {
        return { text: "John response" };
      },
    },
    identity: {
      principal_ref: "principal:jhn",
      mandate_ref: "mandate:jhn:active-001",
      logical_agent_ref: "agent:jhn",
    },
    shouldDelegate: () => true,
    execution_budget: {
      budget_id: "budget:jhn:failure",
      limits: {
        max_steps: 1,
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
    },
  });

  await agent.turn({ message: "delegate", conversationId: "budget-failure", turnId: "turn-1" });
  assert.deepEqual(
    store.listTopic("execution-budget:budget:jhn:failure").map((event) => event.event_type),
    ["ExecutionBudgetReservation", "ExecutionBudgetRelease"]
  );
});
