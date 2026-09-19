import assert from "node:assert/strict";
import test from "node:test";
import {
  attachProviderExecution,
  createExecutionBinding,
  createExecutionReceipt,
} from "../src/execution.js";

function bindingFor(provider_ref, overrides = {}) {
  return createExecutionBinding({
    requirement_ref: "requirement:compute:42",
    offer_id: `offer:${provider_ref}`,
    runtime_id: `runtime:${provider_ref}`,
    handler_instance_ref: `handler:${provider_ref}`,
    execution_surface: "batch",
    provider_ref,
    ...overrides,
  });
}

test("execution binding is provider-neutral, immutable, and carries no authority", () => {
  const binding = bindingFor("provider:a");

  assert.equal(binding.schema, "magistral.execution-binding/v1");
  assert.equal(binding.provider_execution_id, null);
  assert.equal(binding.requirement_ref, "requirement:compute:42");
  assert.equal(binding.mandate_ref, undefined);
  assert.equal(binding.budget_ref, undefined);
  assert.equal(binding.credentials, undefined);
  assert.equal(Object.isFrozen(binding), true);

  assert.deepEqual(JSON.parse(JSON.stringify(binding)), binding);
});

test("provider-native execution identity is attached explicitly and cannot silently change", () => {
  const pending = bindingFor("provider:a");
  const bound = attachProviderExecution(pending, "native-run-123");

  assert.equal(pending.provider_execution_id, null);
  assert.equal(bound.provider_execution_id, "native-run-123");
  assert.equal(attachProviderExecution(bound, "native-run-123"), bound);
  assert.throws(
    () => attachProviderExecution(bound, "different-run"),
    /provider_execution_id_already_bound/
  );
});

test("two independent providers satisfy the same binding and receipt seam", () => {
  const a = attachProviderExecution(bindingFor("provider:a"), "run-a-7");
  const b = attachProviderExecution(bindingFor("provider:b"), "job-b-99");

  const receiptA = createExecutionReceipt({
    binding: a,
    status: "completed",
    result_refs: ["artifact:result:a"],
    log_refs: ["artifact:log:a"],
  });
  const receiptB = createExecutionReceipt({
    binding: b,
    status: "completed",
    artifact_refs: ["artifact:output:b"],
    result_refs: ["artifact:result:b"],
  });

  assert.equal(receiptA.binding.provider_ref, "provider:a");
  assert.equal(receiptB.binding.provider_ref, "provider:b");
  assert.equal(receiptA.terminal, true);
  assert.equal(receiptB.terminal, true);

  for (const receipt of [receiptA, receiptB]) {
    assert.equal(receipt.github_run_id, undefined);
    assert.equal(receipt.provider_session, undefined);
    assert.equal(receipt.mandate_ref, undefined);
    assert.equal(Object.isFrozen(receipt), true);
  }
});

test("a cold handler can consume a serialized receipt without provider-private state", () => {
  const binding = attachProviderExecution(bindingFor("provider:a"), "run-a-8");
  const receipt = createExecutionReceipt({
    binding,
    status: "failed",
    log_refs: ["artifact:logs:run-a-8"],
    error: "provider_failed",
  });

  const materialized = JSON.parse(JSON.stringify(receipt));

  assert.equal(materialized.binding.requirement_ref, "requirement:compute:42");
  assert.equal(materialized.binding.provider_execution_id, "run-a-8");
  assert.equal(materialized.status, "failed");
  assert.equal(materialized.terminal, true);
  assert.deepEqual(materialized.log_refs, ["artifact:logs:run-a-8"]);
  assert.equal(materialized.error, "provider_failed");
});

test("nonterminal receipts preserve correlation while execution is still pending", () => {
  const binding = attachProviderExecution(bindingFor("provider:b"), "job-b-100");
  const receipt = createExecutionReceipt({ binding, status: "running" });

  assert.equal(receipt.terminal, false);
  assert.equal(receipt.binding.provider_execution_id, "job-b-100");
});
