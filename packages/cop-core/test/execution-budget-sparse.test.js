import { describe, it, expect } from "vitest";
import {
  createEventSourcedExecutionBudgetLedger,
  createMemoryExecutionBudgetLedger,
  recordExecutionBudgetGrant,
} from "../src/execution-budget.js";
import { invokeGovernedCapability, recordMandateControl } from "../src/governed-act.js";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

const FULL = {
  max_steps: 8,
  max_tool_calls: 4,
  max_subagents: 1,
  max_elapsed_ms: 60000,
  max_external_effects: 2,
};

const SPARSE = { max_steps: 8, max_elapsed_ms: 60000 };

function createMemoryCopStore() {
  const events = [];
  return {
    append(envelope) {
      const event = envelope.schema ? envelope : createCopEventEnvelope(envelope);
      events.push(event);
      return { ok: true, event };
    },
    replay() {
      return structuredClone(events);
    },
    listTopic(topicId) {
      return structuredClone(
        events.filter((event) => event.topic?.id === topicId || event.topic_id === topicId)
      );
    },
    get raw() {
      return events;
    },
  };
}

function identity() {
  return {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:sparse-budget@v1",
    logical_agent_ref: "agent:jhn",
    topic_id: "topic:sparse-budget",
  };
}

function grant(store, budgetId, limits) {
  const who = identity();
  recordExecutionBudgetGrant(store, {
    budget_id: budgetId,
    mandate_ref: who.mandate_ref,
    principal_ref: who.principal_ref,
    limits,
    authority_version: 1,
  });
}

describe("execution budgets use enforceable dimensions only (#102)", () => {
  it("A — a legacy five-dimensional grant still reserves and settles", () => {
    const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:full", limits: FULL });
    const demand = {
      max_steps: 2,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 1000,
      max_external_effects: 0,
    };
    const reserved = ledger.reserve({
      idempotency_key: "full",
      expected_version: ledger.snapshot().version,
      demand,
    });
    const settled = ledger.settle({
      reservation_id: reserved.reservation.reservation_id,
      expected_version: reserved.snapshot.version,
      usage: { ...demand, max_steps: 1, max_elapsed_ms: 200 },
    });
    expect(settled.ok).toBe(true);
    expect(settled.snapshot.settled).toEqual({
      max_steps: 1,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 200,
      max_external_effects: 0,
    });
    expect(settled.snapshot.available.max_steps).toBe(7);
  });

  it("B — a two-dimensional ledger reserves, settles, replays, and stays idempotent", () => {
    const store = createMemoryCopStore();
    const budgetId = "budget:sparse";
    grant(store, budgetId, SPARSE);
    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: SPARSE,
    });
    const demand = { max_steps: 1, max_elapsed_ms: 50000 };
    const usage = { max_steps: 1, max_elapsed_ms: 34000 };
    const reserved = ledger.reserve({
      idempotency_key: "turn-b",
      expected_version: ledger.snapshot().version,
      demand,
    });
    expect(reserved.ok).toBe(true);
    expect(reserved.duplicate).toBe(false);
    expect(reserved.snapshot.reserved).toEqual(demand);
    expect(reserved.snapshot.limits.max_tool_calls).toBeUndefined();
    expect(Object.hasOwn(reserved.snapshot.available, "max_tool_calls")).toBe(false);

    const again = ledger.reserve({
      idempotency_key: "turn-b",
      expected_version: 0,
      demand,
    });
    expect(again.duplicate).toBe(true);

    const settled = ledger.settle({
      reservation_id: reserved.reservation.reservation_id,
      expected_version: reserved.snapshot.version,
      usage,
      idempotency_key: "turn-b:settle",
    });
    expect(settled.ok).toBe(true);
    expect(settled.snapshot.settled).toEqual(usage);
    expect(settled.snapshot.reserved).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(settled.snapshot.available).toEqual({ max_steps: 7, max_elapsed_ms: 26000 });
    expect(Object.hasOwn(settled.snapshot.settled, "max_subagents")).toBe(false);
    expect(Object.hasOwn(settled.snapshot.limits, "max_external_effects")).toBe(false);

    const replayed = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: SPARSE,
    });
    expect(replayed.snapshot()).toEqual(settled.snapshot);
    const repeated = replayed.settle({
      reservation_id: reserved.reservation.reservation_id,
      expected_version: 0,
      usage,
      idempotency_key: "turn-b:settle",
    });
    expect(repeated.ok).toBe(true);
    expect(repeated.duplicate).toBe(true);
    expect(replayed.snapshot()).toEqual(settled.snapshot);
  });

  it("C — a demand that omits an active hard dimension fails before reservation", () => {
    const ledger = createMemoryExecutionBudgetLedger({
      budget_id: "budget:sparse",
      limits: SPARSE,
    });
    const before = ledger.snapshot();
    const refused = ledger.reserve({
      idempotency_key: "missing",
      expected_version: before.version,
      demand: { max_steps: 1 },
    });
    expect(refused.ok).toBe(false);
    expect(refused.error).toBe("missing_active_hard_dimension");
    expect(refused.dimension).toBe("max_elapsed_ms");
    expect(ledger.snapshot()).toEqual(before);
  });

  it("D — a demand that adds a non-active hard dimension fails before reservation", () => {
    const ledger = createMemoryExecutionBudgetLedger({
      budget_id: "budget:sparse",
      limits: SPARSE,
    });
    const before = ledger.snapshot();
    const refused = ledger.reserve({
      idempotency_key: "extra",
      expected_version: before.version,
      demand: { max_steps: 1, max_elapsed_ms: 50000, max_tool_calls: 0 },
    });
    expect(refused.ok).toBe(false);
    expect(refused.error).toBe("inactive_hard_dimension");
    expect(refused.dimension).toBe("max_tool_calls");
    expect(ledger.snapshot()).toEqual(before);
  });

  it("H — a provider failure still settles hard execution consumption", async () => {
    const store = createMemoryCopStore();
    const budgetId = "budget:failure";
    grant(store, budgetId, SPARSE);
    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: SPARSE,
    });
    const measured = {
      id: "handler:measured-failure",
      async invoke() {
        const error = new Error("provider_failed");
        error.execution_usage = { max_steps: 1, max_elapsed_ms: 1200 };
        throw error;
      },
    };
    const measuredResult = await invokeGovernedCapability({
      store,
      ledger,
      handler: measured,
      identity: identity(),
      capability: "reasoning.code",
      demand: { max_steps: 1, max_elapsed_ms: 5000 },
      idempotency_key: "h:measured",
    });
    expect(measuredResult.called_provider).toBe(true);
    expect(measuredResult.ok).toBe(false);
    expect(measuredResult.outcome).toBe("failed");
    expect(measuredResult.execution_budget_settlement.mode).toBe("observed");
    expect(ledger.snapshot().reserved).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(ledger.snapshot().settled).toEqual({ max_steps: 1, max_elapsed_ms: 1200 });

    const blind = {
      id: "handler:blind-failure",
      async invoke() {
        throw new Error("provider_failed");
      },
    };
    const blindResult = await invokeGovernedCapability({
      store,
      ledger,
      handler: blind,
      identity: identity(),
      capability: "reasoning.code",
      demand: { max_steps: 1, max_elapsed_ms: 5000 },
      idempotency_key: "h:blind",
    });
    expect(blindResult.called_provider).toBe(true);
    expect(blindResult.outcome).toBe("failed");
    expect(blindResult.execution_budget_settlement).toMatchObject({
      mode: "conservative",
      reason: "usage_unavailable",
      usage: { max_steps: 1, max_elapsed_ms: 5000 },
    });
    expect(ledger.snapshot().settled).toEqual({ max_steps: 2, max_elapsed_ms: 6200 });
    expect(ledger.snapshot().reserved.max_steps).toBe(0);
    expect(store.raw.some((event) => event.event_type === "ExecutionBudgetRelease")).toBe(false);
  });

  it("I — partial usage after the provider call settles the reserved bound", async () => {
    const store = createMemoryCopStore();
    const budgetId = "budget:partial";
    grant(store, budgetId, SPARSE);
    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: SPARSE,
    });
    const result = await invokeGovernedCapability({
      store,
      ledger,
      handler: {
        id: "handler:partial",
        async invoke() {
          return { text: "done", execution_usage: { max_steps: 1 } };
        },
      },
      identity: identity(),
      capability: "reasoning.code",
      demand: { max_steps: 1, max_elapsed_ms: 5000 },
      idempotency_key: "i:partial",
    });
    expect(result.ok).toBe(true);
    expect(result.called_provider).toBe(true);
    expect(result.execution_budget_settlement).toMatchObject({
      mode: "conservative",
      reason: "incomplete_or_invalid_usage",
      usage: { max_steps: 1, max_elapsed_ms: 5000 },
    });
    expect(ledger.snapshot().reserved).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(ledger.snapshot().settled).toEqual({ max_steps: 1, max_elapsed_ms: 5000 });
    expect(result.effect.execution_budget_settlement.reason).toBe("incomplete_or_invalid_usage");
  });

  it("J — preflight and TOCTOU refusals release the reservation without consumption", async () => {
    const store = createMemoryCopStore();
    const budgetId = "budget:release";
    grant(store, budgetId, SPARSE);
    const ledger = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: budgetId,
      limits: SPARSE,
    });
    let calls = 0;
    const preflight = await invokeGovernedCapability({
      store,
      ledger,
      handler: {
        id: "handler:preflight",
        preflightExecutionBudget() {
          return {
            ok: false,
            error: "execution_budget_dimension_unenforceable",
            dimension: "max_tool_calls",
            requested: 0,
            runtime_bound: null,
          };
        },
        async invoke() {
          calls += 1;
          return { execution_usage: { max_steps: 1, max_elapsed_ms: 1 } };
        },
      },
      identity: identity(),
      capability: "reasoning.code",
      demand: { max_steps: 1, max_elapsed_ms: 5000 },
      idempotency_key: "j:preflight",
    });
    expect(preflight.ok).toBe(false);
    expect(preflight.called_provider).toBe(false);
    expect(preflight.act_id).toBeNull();
    expect(preflight.error).toBe("execution_budget_dimension_unenforceable");
    expect(calls).toBe(0);
    expect(ledger.snapshot().reserved).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(ledger.snapshot().settled).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(store.raw.some((event) => event.payload?.kind === "CapabilityInvocation")).toBe(false);

    recordMandateControl(store, {
      principal_ref: identity().principal_ref,
      mandate_ref: identity().mandate_ref,
      action: "revoke",
      reason: "toctou",
    });
    const toctou = await invokeGovernedCapability({
      store,
      ledger,
      handler: {
        id: "handler:toctou",
        async invoke() {
          calls += 1;
          return { execution_usage: { max_steps: 1, max_elapsed_ms: 1 } };
        },
      },
      identity: identity(),
      capability: "reasoning.code",
      demand: { max_steps: 1, max_elapsed_ms: 1000 },
      idempotency_key: "j:toctou",
    });
    expect(toctou.called_provider).toBe(false);
    expect(toctou.act_id).toBeNull();
    expect(calls).toBe(0);
    expect(ledger.snapshot().settled).toEqual({ max_steps: 0, max_elapsed_ms: 0 });
    expect(ledger.snapshot().reserved.max_steps).toBe(0);
  });
});
