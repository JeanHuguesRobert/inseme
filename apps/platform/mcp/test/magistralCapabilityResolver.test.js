import assert from "node:assert/strict";
import test from "node:test";
import { createCapabilityCatalog, codexAcpCapabilityOffer } from "@inseme/magistral/capabilities";
import { createContinuationDescriptor } from "../../../../packages/cop-kernel/src/continuation.js";
import { COPScheduler } from "../../../../packages/cop-kernel/src/scheduler.js";
import { COPBus } from "../../../../packages/cop-kernel/src/bus.js";
import { createHostRuntimeClient, codexAcpRuntime } from "../cop/hostRuntimeClient.js";
import {
  createMagistralCapabilityResolver,
  createMagistralAcpContinuationHandler,
  MAGISTRAL_CAPABILITY_RESOLUTION,
} from "../cop/magistralCapabilityResolver.js";

function capabilityContinuation(overrides = {}) {
  return {
    continuationId: "cont-capability-1",
    resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
    state: {
      capability_request: {
        requirement: { capability: "coding.assist.read", execution_surface: "acp" },
        prompt: "Review the supplied code without making changes.",
        working_directory: process.cwd(),
      },
    },
    ...overrides,
  };
}

test("a designated continuation resolves and invokes the matching ACP runtime", async () => {
  const catalog = createCapabilityCatalog({
    offers: [codexAcpCapabilityOffer({ host_ref: "host:thinkpad-jhr" })],
  });
  const runtimeClient = createHostRuntimeClient({
    runtimes: [codexAcpRuntime({ command: "codex-acp.cmd", host_ref: "host:thinkpad-jhr" })],
  });
  const invoked = [];
  runtimeClient.invoke = async (input) => {
    invoked.push(input);
    return { text: "analysis", elapsed_ms: 12, runtime_id: input.runtime_id };
  };
  const resolver = createMagistralCapabilityResolver({
    capabilityCatalog: catalog,
    hostRuntimeClient: runtimeClient,
  });

  const handler = await resolver(MAGISTRAL_CAPABILITY_RESOLUTION, capabilityContinuation());
  const result = await handler.execute();

  assert.deepEqual(invoked, [
    {
      runtime_id: "runtime:local:codex-acp",
      prompt: "Review the supplied code without making changes.",
      working_directory: process.cwd(),
    },
  ]);
  assert.equal(result.capability_resolution.offer_id, "capability:local:codex-acp");
  assert.equal(result.capability_resolution.provider_ref, "provider:codex-acp");
  assert.equal(result.capability_resolution.context_inheritance, "ambient-host");
  assert.equal(result.execution_binding.schema, "magistral.execution-binding/v1");
  assert.equal(
    result.execution_binding.requirement_ref,
    "continuation:cont-capability-1:capability_request"
  );
  assert.equal(result.execution_binding.provider_ref, "provider:codex-acp");
  assert.equal(result.execution_binding.provider_execution_id, null);
  assert.equal(result.execution_receipt.schema, "magistral.execution-receipt/v1");
  assert.equal(result.execution_receipt.status, "completed");
  assert.equal(result.execution_receipt.terminal, true);
  assert.deepEqual(result.continuations, []);
});

test("the resolver refuses an undeclared target and mismatched runtime binding", async () => {
  const catalog = createCapabilityCatalog({ offers: [codexAcpCapabilityOffer()] });
  const runtimeClient = createHostRuntimeClient({
    runtimes: [codexAcpRuntime({ command: "codex-acp.cmd", host_ref: "host:other" })],
  });
  const resolver = createMagistralCapabilityResolver({
    capabilityCatalog: catalog,
    hostRuntimeClient: runtimeClient,
  });

  assert.equal(await resolver("capability:direct-agent", capabilityContinuation()), null);
  await assert.rejects(
    () => resolver(MAGISTRAL_CAPABILITY_RESOLUTION, capabilityContinuation()),
    /capability_runtime_binding_mismatch:host_ref/
  );
});

test("COPScheduler crosses the continuation boundary before invoking ACP", async () => {
  const catalog = createCapabilityCatalog({ offers: [codexAcpCapabilityOffer()] });
  const runtimeClient = createHostRuntimeClient({
    runtimes: [codexAcpRuntime({ command: "codex-acp.cmd" })],
  });
  runtimeClient.invoke = async () => ({ text: "scheduled analysis", elapsed_ms: 5 });
  const scheduledContinuation = createContinuationDescriptor({
    resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
    state: capabilityContinuation().state,
  });
  const scheduler = new COPScheduler(new COPBus({ name: "magistral-capability-bridge" }), {
    handlerResolver: createMagistralCapabilityResolver({
      capabilityCatalog: catalog,
      hostRuntimeClient: runtimeClient,
    }),
  });

  const receipt = await scheduler.execute(scheduledContinuation);

  assert.equal(receipt.execution.handler, MAGISTRAL_CAPABILITY_RESOLUTION);
  assert.equal(receipt.execution.result.output.text, "scheduled analysis");
  assert.equal(
    receipt.execution.result.capability_resolution.runtime_id,
    "runtime:local:codex-acp"
  );
  assert.equal(
    receipt.execution.result.execution_receipt.binding.requirement_ref,
    `continuation:${scheduledContinuation.continuationId}:capability_request`
  );
  assert.equal(receipt.execution.result.execution_receipt.status, "completed");
});

test("JHN can receive ACP assistance only through a continuation-backed handler", async () => {
  const catalog = createCapabilityCatalog({ offers: [codexAcpCapabilityOffer()] });
  const runtimeClient = createHostRuntimeClient({
    runtimes: [codexAcpRuntime({ command: "codex-acp.cmd" })],
  });
  runtimeClient.invoke = async () => ({ text: "review receipt", elapsed_ms: 4 });
  const handler = createMagistralAcpContinuationHandler({
    capabilityCatalog: catalog,
    hostRuntimeClient: runtimeClient,
    working_directory: process.cwd(),
  });

  const effect = await handler.invoke({ message: "Review this implementation." });

  assert.equal(handler.id, "handler:local:codex-acp");
  assert.equal(effect.text, "review receipt");
  assert.equal(effect.context_inheritance, "ambient-host");
  assert.equal(effect.execution_receipt.status, "completed");
  assert.equal(effect.execution_receipt.binding.provider_ref, "provider:codex-acp");
  assert.match(effect.continuation_id, /^[0-9a-f-]{36}$/);
});


test("provider-native execution identity from a runtime is normalized into the receipt", async () => {
  const catalog = createCapabilityCatalog({ offers: [codexAcpCapabilityOffer()] });
  const runtimeClient = createHostRuntimeClient({
    runtimes: [codexAcpRuntime({ command: "codex-acp.cmd" })],
  });
  runtimeClient.invoke = async () => ({
    text: "async-like result",
    status: "completed",
    provider_execution_id: "native-execution-77",
    result_refs: ["artifact:result:77"],
    log_refs: ["artifact:log:77"],
  });

  const resolver = createMagistralCapabilityResolver({
    capabilityCatalog: catalog,
    hostRuntimeClient: runtimeClient,
  });
  const handler = await resolver(MAGISTRAL_CAPABILITY_RESOLUTION, capabilityContinuation());
  const result = await handler.execute();

  assert.equal(result.execution_binding.provider_execution_id, "native-execution-77");
  assert.equal(
    result.execution_receipt.binding.provider_execution_id,
    "native-execution-77"
  );
  assert.deepEqual(result.execution_receipt.result_refs, ["artifact:result:77"]);
  assert.deepEqual(result.execution_receipt.log_refs, ["artifact:log:77"]);
});
