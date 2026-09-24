import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createMemoryExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";
import { invokeGovernedCapability } from "../../../../packages/cop-core/src/governed-act.js";
import { createCopEventEnvelope } from "../../../../packages/cop-core/src/cop-event-envelope.js";
import {
  JHN_AGENT_ALLOWED_CAPABILITIES,
  JHN_AGENT_BUDGET_LIMITS,
  JHN_AGENT_TURN_DEMAND,
} from "../cop/jhnLocalAgentAuthority.js";
import {
  acpStdioRuntime,
  createHostRuntimeClient,
  preflightAcpExecutionBudget,
} from "../cop/hostRuntimeClient.js";

function memoryStore() {
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
    get raw() {
      return events;
    },
  };
}

function identity() {
  return {
    principal_ref: "principal:test",
    mandate_ref: "mandate:acp-budget@v1",
    logical_agent_ref: "agent:test",
    mandate: {
      mandate_id: "mandate:acp-budget",
      version: "v1",
      status: "active",
      principal_ref: "principal:test",
      logical_agent_ref: "agent:test",
      scope: { allowed_actions: ["coding.assist.read"] },
    },
  };
}

function fakeAcpSpawn({ toolCall = false } = {}) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      child.killed = true;
      child.emit("close", 0, "SIGTERM");
    };
    child.stdin.on("data", (chunk) => {
      for (const line of String(chunk).trim().split("\n")) {
        if (!line) continue;
        const request = JSON.parse(line);
        if (request.method === "session/prompt") {
          if (toolCall) {
            child.stdout.write(
              `${JSON.stringify({
                jsonrpc: "2.0",
                method: "session/update",
                params: {
                  update: {
                    sessionUpdate: "tool_call",
                    toolCallId: "call-read",
                    kind: "read",
                    status: "completed",
                  },
                },
              })}\n`
            );
            child.stdout.write(
              `${JSON.stringify({
                jsonrpc: "2.0",
                method: "session/update",
                params: {
                  update: { sessionUpdate: "usage_update", used: 12, size: 40, cost: null },
                },
              })}\n`
            );
          }
          child.stdout.write(
            `${JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              result: { stopReason: "end_turn" },
            })}\n`
          );
        } else {
          const result =
            request.method === "initialize"
              ? { protocolVersion: 1, agentCapabilities: {}, authMethods: [] }
              : request.method === "session/new"
                ? { sessionId: "session-1" }
                : {};
          child.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
        }
      }
    });
    return child;
  };
  return { spawn, calls };
}

test("E — ACP preflight refuses a hard tool-call ceiling before spawn", async () => {
  const fake = fakeAcpSpawn();
  const runtime = acpStdioRuntime({
    id: "runtime:test:acp",
    command: "codex-acp",
    handler_instance_ref: "handler:test:acp",
    invoke_timeout_ms: 240_000,
  });
  const client = createHostRuntimeClient({ runtimes: [runtime], spawnImpl: fake.spawn });
  const limits = {
    max_steps: 8,
    max_tool_calls: 0,
    max_subagents: 0,
    max_elapsed_ms: 60_000,
    max_external_effects: 0,
  };
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:acp-e", limits });
  const store = memoryStore();
  const result = await invokeGovernedCapability({
    store,
    ledger,
    handler: client.asHandler(runtime.id, { working_directory: process.cwd() }),
    identity: identity(),
    capability: "coding.assist.read",
    demand: {
      max_steps: 1,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 1_000,
      max_external_effects: 0,
    },
    idempotency_key: "e",
  });
  assert.equal(result.ok, false);
  assert.equal(result.called_provider, false);
  assert.equal(result.act_id, null);
  assert.equal(result.error, "execution_budget_dimension_unenforceable");
  assert.equal(result.dimension, "max_tool_calls");
  assert.equal(result.requested, 0);
  assert.equal(fake.calls.length, 0);
  assert.equal(ledger.snapshot().reserved.max_tool_calls, 0);
  assert.equal(ledger.snapshot().settled.max_steps, 0);
  assert.equal(
    store.raw.some((event) => event.payload?.kind === "CapabilityInvocation"),
    false
  );
});

test("F — ACP preflight refuses a timeout larger than the elapsed reservation", async () => {
  const fake = fakeAcpSpawn();
  const runtime = acpStdioRuntime({
    id: "runtime:test:acp-timeout",
    command: "codex-acp",
    handler_instance_ref: "handler:test:acp-timeout",
    invoke_timeout_ms: 240_000,
  });
  const client = createHostRuntimeClient({ runtimes: [runtime], spawnImpl: fake.spawn });
  const limits = { max_steps: 8, max_elapsed_ms: 60_000 };
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:acp-f", limits });
  const result = await invokeGovernedCapability({
    store: memoryStore(),
    ledger,
    handler: client.asHandler(runtime.id, { working_directory: process.cwd() }),
    identity: identity(),
    capability: "coding.assist.read",
    demand: { max_steps: 1, max_elapsed_ms: 1_000 },
    idempotency_key: "f",
  });
  assert.equal(result.ok, false);
  assert.equal(result.called_provider, false);
  assert.equal(result.error, "execution_budget_bound_exceeds_reservation");
  assert.equal(result.dimension, "max_elapsed_ms");
  assert.equal(result.runtime_bound, 240_000);
  assert.equal(result.reserved, 1_000);
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(ledger.snapshot().reserved, { max_steps: 0, max_elapsed_ms: 0 });
  assert.deepEqual(ledger.snapshot().settled, { max_steps: 0, max_elapsed_ms: 0 });
});

test("G — a sparse enforceable ACP profile runs and keeps tool calls observational", async () => {
  const fake = fakeAcpSpawn({ toolCall: true });
  const runtime = acpStdioRuntime({
    id: "runtime:test:acp-sparse",
    command: "codex-acp",
    handler_instance_ref: "handler:test:acp-sparse",
    invoke_timeout_ms: 50_000,
  });
  const client = createHostRuntimeClient({ runtimes: [runtime], spawnImpl: fake.spawn });
  const limits = { max_steps: 8, max_elapsed_ms: 60_000 };
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:acp-g", limits });
  const result = await invokeGovernedCapability({
    store: memoryStore(),
    ledger,
    handler: client.asHandler(runtime.id, { working_directory: process.cwd() }),
    identity: identity(),
    capability: "coding.assist.read",
    input: { message: "Explain this repository." },
    demand: { max_steps: 1, max_elapsed_ms: 50_000 },
    idempotency_key: "g",
  });
  assert.equal(result.ok, true);
  assert.equal(result.called_provider, true);
  assert.equal(fake.calls.length, 1);
  assert.equal(result.execution_budget_settlement.mode, "observed");
  assert.equal(result.effect.execution_usage.max_steps, 1);
  assert.equal(Object.hasOwn(result.effect.execution_usage, "max_tool_calls"), false);
  assert.equal(result.effect.acp_observations.tool_calls.length, 1);
  assert.deepEqual(result.effect.acp_observations.tool_calls[0], {
    id: "call-read",
    kind: "read",
    status: "completed",
  });
  assert.equal(result.effect.acp_observations.provider_cost, "not_estimated");
  assert.equal(result.effect.permission_trace.length, 0);
  assert.deepEqual(ledger.snapshot().limits, limits);
  assert.equal(Object.hasOwn(ledger.snapshot().settled, "max_tool_calls"), false);
  assert.equal(ledger.snapshot().settled.max_steps, 1);
  assert.equal(ledger.snapshot().settled.max_elapsed_ms <= 50_000, true);
  assert.equal(ledger.snapshot().reserved.max_steps, 0);
});

test("the frozen JHN five-dimensional demand fails ACP preflight", () => {
  const verdict = preflightAcpExecutionBudget({
    demand: JHN_AGENT_TURN_DEMAND,
    promptTimeoutMs: 240_000,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.error, "execution_budget_dimension_unenforceable");
  assert.equal(verdict.dimension, "max_tool_calls");
  assert.equal(verdict.requested, 0);
  assert.equal(JHN_AGENT_BUDGET_LIMITS.max_tool_calls, 0);
  assert.equal(JHN_AGENT_BUDGET_LIMITS.max_elapsed_ms, 60_000);
  assert.deepEqual(JHN_AGENT_ALLOWED_CAPABILITIES, ["coding.assist"]);
  assert.equal(JHN_AGENT_TURN_DEMAND.max_elapsed_ms, 1_000);
});
