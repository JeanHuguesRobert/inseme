/**
 * COP continuation boundary for rich Magistral capabilities.
 *
 * A deterministic COP step does not open an ACP session itself.  It emits a
 * continuation addressed to `magistral:capability-resolution`; the scheduler
 * may then use this resolver as its execution boundary.  Mandate, budget and
 * receipt policy remain responsibilities of the caller that executes the
 * continuation.
 */
import { isAbsolute } from "node:path";
import { COPBus, COPScheduler, createContinuationDescriptor } from "@inseme/cop-kernel";
import {
  attachProviderExecution,
  createExecutionBinding,
  createExecutionReceipt,
} from "@inseme/magistral/execution";

const MAGISTRAL_CAPABILITY_RESOLUTION = "magistral:capability-resolution";

export { MAGISTRAL_CAPABILITY_RESOLUTION };

/**
 * Turn an explicit capability-resolution continuation into a scheduler handler.
 * The returned resolver is compatible with COPScheduler's handlerResolver.
 */
export function createMagistralCapabilityResolver({ capabilityCatalog, hostRuntimeClient } = {}) {
  if (!capabilityCatalog || typeof capabilityCatalog.resolve !== "function") {
    throw new TypeError("capabilityCatalog.resolve is required");
  }
  if (
    !hostRuntimeClient ||
    typeof hostRuntimeClient.list !== "function" ||
    typeof hostRuntimeClient.invoke !== "function"
  ) {
    throw new TypeError("hostRuntimeClient.list and hostRuntimeClient.invoke are required");
  }

  return async function resolveContinuationHandler(resumeTo, continuation) {
    if (resumeTo !== MAGISTRAL_CAPABILITY_RESOLUTION) return null;
    const request = parseContinuationRequest(continuation);
    const [offer] = capabilityCatalog.resolve(request.requirement);
    if (!offer) return null;
    assertRuntimeBinding(offer, hostRuntimeClient.list());

    return {
      async execute() {
        let executionBinding = createExecutionBinding({
          requirement_ref: request.requirement_ref || `continuation:${continuation.continuationId}:capability_request`,
          offer_id: offer.id,
          runtime_id: offer.runtime_id,
          handler_instance_ref: offer.handler_instance_ref,
          execution_surface: offer.execution_surface,
          provider_ref: offer.provider_ref,
        });

        const output = await hostRuntimeClient.invoke({
          runtime_id: offer.runtime_id,
          prompt: request.prompt,
          working_directory: request.working_directory,
        });

        if (output?.provider_execution_id) {
          executionBinding = attachProviderExecution(
            executionBinding,
            String(output.provider_execution_id)
          );
        }

        const executionReceipt = createExecutionReceipt({
          binding: executionBinding,
          status: output?.status || "completed",
          artifact_refs: output?.artifact_refs || [],
          result_refs: output?.result_refs || [],
          log_refs: output?.log_refs || [],
          error: output?.error || null,
        });

        return {
          capability_resolution: publicResolution(offer),
          execution_binding: executionBinding,
          execution_receipt: executionReceipt,
          output,
          continuations: [],
        };
      },
    };
  };
}

/**
 * Bind the continuation boundary to the existing JHN governed-handler shape.
 *
 * This adapter holds no mandate or budget.  `createJhnDelegatingAgent` keeps
 * those gates and records the returned effect as its governed-act trace.
 */
export function createMagistralAcpContinuationHandler({
  capabilityCatalog,
  hostRuntimeClient,
  working_directory,
  requirement = { capability: "coding.assist.read", execution_surface: "acp" },
} = {}) {
  if (!isAbsolute(working_directory)) {
    throw new TypeError("working_directory must be absolute");
  }
  const resolve = createMagistralCapabilityResolver({ capabilityCatalog, hostRuntimeClient });
  const [offer] = capabilityCatalog.resolve(requirement);
  if (!offer) throw new Error("capability_requirement_unavailable");

  return {
    id: offer.handler_instance_ref,
    capability: requirement.capability,
    async invoke(input = {}) {
      const prompt = String(input.message || input.prompt || "").trim();
      if (!prompt) throw new TypeError("governed ACP handler prompt is required");
      const continuation = createContinuationDescriptor({
        resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
        resumeIntent: "resolve-capability",
        state: { capability_request: { requirement, prompt, working_directory } },
      });
      const scheduler = new COPScheduler(new COPBus({ name: "jhn-magistral-acp" }), {
        handlerResolver: resolve,
      });
      const receipt = await scheduler.execute(continuation, { reason: "jhn-governed-delegation" });
      const output = receipt.execution?.result?.output;
      return {
        ...(output || {}),
        text: String(output?.text || ""),
        context_inheritance: receipt.execution?.result?.capability_resolution?.context_inheritance,
        capability_resolution: receipt.execution?.result?.capability_resolution,
        execution_binding: receipt.execution?.result?.execution_binding,
        execution_receipt: receipt.execution?.result?.execution_receipt,
        continuation_id: continuation.continuationId,
      };
    },
  };
}

function parseContinuationRequest(continuation) {
  const request = continuation?.state?.capability_request;
  if (!request || typeof request !== "object") {
    throw new TypeError("continuation.state.capability_request is required");
  }
  if (!request.requirement || typeof request.requirement !== "object") {
    throw new TypeError("capability_request.requirement is required");
  }
  if (typeof request.prompt !== "string" || request.prompt.length === 0) {
    throw new TypeError("capability_request.prompt is required");
  }
  if (!isAbsolute(request.working_directory)) {
    throw new TypeError("capability_request.working_directory must be absolute");
  }
  return request;
}

function assertRuntimeBinding(offer, runtimes) {
  const runtime = runtimes.find((candidate) => candidate.id === offer.runtime_id);
  if (!runtime) throw new Error(`capability_runtime_unavailable:${offer.runtime_id}`);
  for (const field of ["host_ref", "handler_instance_ref", "execution_surface"]) {
    if (runtime[field] !== offer[field]) {
      throw new Error(`capability_runtime_binding_mismatch:${field}`);
    }
  }
  if (!runtime.capabilities?.includes(offer.capabilities[0])) {
    throw new Error("capability_runtime_binding_mismatch:capability");
  }
}

function publicResolution(offer) {
  return {
    offer_id: offer.id,
    runtime_id: offer.runtime_id,
    host_ref: offer.host_ref,
    handler_instance_ref: offer.handler_instance_ref,
    provider_ref: offer.provider_ref,
    execution_surface: offer.execution_surface,
    context_inheritance: offer.context_inheritance,
    dependencies: [...offer.dependencies],
    recovery: offer.recovery,
  };
}
