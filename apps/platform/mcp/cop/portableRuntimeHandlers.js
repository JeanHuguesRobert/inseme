import { CopAccessDeniedError } from "./portableRuntimeGateway.js";
import { CopCapabilityError } from "./signedCapability.js";

function result(status, body) {
  return { status, body };
}

function failure(error) {
  if (error instanceof CopCapabilityError) {
    return result(401, { error: error.message, code: error.code });
  }
  if (error instanceof CopAccessDeniedError) {
    return result(403, { error: error.message, code: error.code });
  }
  if (error instanceof TypeError) {
    return result(400, { error: error.message, code: "COP_INVALID_REQUEST" });
  }
  return result(500, { error: error.message, code: "COP_RUNTIME_WRITE_FAILED" });
}

/**
 * Framework-neutral COP runtime write handlers.
 *
 * resolveContext(request) must authenticate the transport and return
 * { principal, mandate }. It is intentionally supplied by the host: a plain
 * HTTP header or a network location is not an identity assertion.
 */
export function createPortableCopRuntimeHandlers({ gateway, resolveContext } = {}) {
  if (!gateway) throw new TypeError("gateway is required");
  if (typeof resolveContext !== "function")
    throw new TypeError("resolveContext(request) is required");

  const write = (method) => async (request) => {
    try {
      const context = await resolveContext(request);
      if (!context) {
        return result(401, {
          error: "COP runtime identity is required",
          code: "COP_UNAUTHENTICATED",
        });
      }
      const row = await gateway[method](context, request.body ?? {});
      return result(201, { data: row });
    } catch (error) {
      return failure(error);
    }
  };

  return {
    registerHandler: write("registerHandler"),
    upsertLogicalAgent: write("upsertLogicalAgent"),
    upsertPacket: write("upsertPacket"),
    upsertTask: write("upsertTask"),
    upsertStep: write("upsertStep"),
    appendEvent: write("appendEvent"),
    appendArtifact: write("appendArtifact"),
  };
}
