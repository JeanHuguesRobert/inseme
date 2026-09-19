/**
 * Provider-neutral execution identity and receipt helpers.
 *
 * These objects are deliberately first-order and JSON-serializable so that a
 * cold handler can correlate logical work with provider-native execution
 * without relying on process/session memory.
 *
 * They describe execution. They do not grant mandate, credentials, budget, or
 * any other authority.
 */

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"]);
const ALLOWED_STATUSES = new Set(["accepted", "running", ...TERMINAL_STATUSES]);

export function createExecutionBinding({
  requirement_ref,
  offer_id,
  runtime_id,
  handler_instance_ref,
  execution_surface,
  provider_ref,
  provider_execution_id = null,
} = {}) {
  for (const [name, value] of Object.entries({
    requirement_ref,
    offer_id,
    runtime_id,
    handler_instance_ref,
    execution_surface,
    provider_ref,
  })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${name} is required`);
    }
  }

  if (
    provider_execution_id !== null &&
    (typeof provider_execution_id !== "string" || provider_execution_id.length === 0)
  ) {
    throw new TypeError("provider_execution_id must be null or a non-empty string");
  }

  return freezePlain({
    schema: "magistral.execution-binding/v1",
    requirement_ref,
    offer_id,
    runtime_id,
    handler_instance_ref,
    execution_surface,
    provider_ref,
    provider_execution_id,
  });
}

export function attachProviderExecution(binding, provider_execution_id) {
  assertBinding(binding);
  if (binding.provider_execution_id !== null) {
    if (binding.provider_execution_id !== provider_execution_id) {
      throw new Error("provider_execution_id_already_bound");
    }
    return binding;
  }
  return createExecutionBinding({
    ...binding,
    provider_execution_id,
  });
}

export function createExecutionReceipt({
  binding,
  status,
  artifact_refs = [],
  result_refs = [],
  log_refs = [],
  error = null,
} = {}) {
  assertBinding(binding);
  if (!ALLOWED_STATUSES.has(status)) {
    throw new TypeError(
      "status must be accepted, running, completed, failed, cancelled, or timed_out"
    );
  }
  if (error !== null && typeof error !== "string") {
    throw new TypeError("error must be null or a string");
  }

  return freezePlain({
    schema: "magistral.execution-receipt/v1",
    binding,
    status,
    terminal: TERMINAL_STATUSES.has(status),
    artifact_refs: normalizeRefs(artifact_refs, "artifact_refs"),
    result_refs: normalizeRefs(result_refs, "result_refs"),
    log_refs: normalizeRefs(log_refs, "log_refs"),
    error,
  });
}

function assertBinding(binding) {
  if (!binding || binding.schema !== "magistral.execution-binding/v1") {
    throw new TypeError("binding must be a magistral.execution-binding/v1 object");
  }
}

function normalizeRefs(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const refs = [...new Set(values)];
  if (refs.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${field} entries must be non-empty strings`);
  }
  return Object.freeze(refs);
}

function freezePlain(value) {
  return Object.freeze(value);
}
