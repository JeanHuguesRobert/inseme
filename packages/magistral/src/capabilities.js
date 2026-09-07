/**
 * Capability catalog for execution surfaces that cannot be represented as an
 * OpenAI-compatible HTTP model node.
 *
 * Offers describe availability and dependency posture. They never contain a
 * command, credential, or other host-local secret. A selected offer must still
 * be bound to a governed COP invocation before it can execute.
 */
export function createCapabilityCatalog({ offers = [] } = {}) {
  const catalog = new Map(offers.map(normalizeOffer).map((offer) => [offer.id, offer]));

  return {
    list() {
      return [...catalog.values()].map(publicOffer);
    },

    get(id) {
      const offer = catalog.get(id);
      return offer ? publicOffer(offer) : null;
    },

    resolve(requirement = {}) {
      if (!requirement.capability) throw new TypeError("requirement.capability is required");
      return [...catalog.values()]
        .filter((offer) => offer.enabled)
        .filter((offer) => offer.capabilities.includes(requirement.capability))
        .filter(
          (offer) =>
            !requirement.execution_surface ||
            offer.execution_surface === requirement.execution_surface
        )
        .filter((offer) => !requirement.host_ref || offer.host_ref === requirement.host_ref)
        .filter(
          (offer) => requirement.allow_situated !== false || offer.context_inheritance === "none"
        )
        .sort(
          (left, right) => right.attraction - left.attraction || left.id.localeCompare(right.id)
        )
        .map(publicOffer);
    },
  };
}

/** A safe, declared offer corresponding to a host-local Codex ACP runtime. */
export function codexAcpCapabilityOffer({
  id = "capability:local:codex-acp",
  runtime_id = "runtime:local:codex-acp",
  host_ref = "host:local",
  handler_instance_ref = "handler:local:codex-acp",
  context_inheritance = "ambient-host",
  attraction = 100,
  enabled = true,
  dependencies = ["codex-acp", "principal-codex-account", "host-local-working-context"],
  recovery = "portable-cop-continuation",
} = {}) {
  return normalizeOffer({
    id,
    runtime_id,
    host_ref,
    handler_instance_ref,
    capability: "coding.assist.read",
    execution_surface: "acp",
    context_inheritance,
    attraction,
    enabled,
    dependencies,
    recovery,
  });
}

export function openCodeMagistralCapabilityOffer({
  id = "capability:local:opencode-magistral",
  runtime_id = "runtime:local:opencode-magistral",
  host_ref = "host:local",
  handler_instance_ref = "handler:local:opencode-magistral",
  attraction = 60,
  enabled = true,
} = {}) {
  return normalizeOffer({
    id,
    runtime_id,
    host_ref,
    handler_instance_ref,
    capability: "coding.assist.read",
    execution_surface: "cli",
    context_inheritance: "cop-artifact",
    attraction,
    enabled,
    dependencies: ["opencode", "magistral-gateway", "cop-continuation"],
    recovery: "terminal-continuation-after-timeout",
  });
}

function normalizeOffer(value) {
  if (!value?.id || !value?.runtime_id || !value?.host_ref || !value?.handler_instance_ref) {
    throw new TypeError("offer id, runtime_id, host_ref, and handler_instance_ref are required");
  }
  const capabilities = [...new Set(value.capabilities || [value.capability].filter(Boolean))];
  if (capabilities.length === 0) throw new TypeError("offer capability is required");
  const contextInheritance = value.context_inheritance || "none";
  if (!new Set(["none", "ambient-host", "cop-artifact"]).has(contextInheritance)) {
    throw new TypeError("context_inheritance must be none, ambient-host, or cop-artifact");
  }
  return {
    id: value.id,
    runtime_id: value.runtime_id,
    host_ref: value.host_ref,
    handler_instance_ref: value.handler_instance_ref,
    capabilities,
    execution_surface: value.execution_surface || "unknown",
    context_inheritance: contextInheritance,
    attraction: Number.isFinite(Number(value.attraction)) ? Number(value.attraction) : 0,
    enabled: value.enabled !== false,
    dependencies: [...new Set(value.dependencies || [])],
    recovery: value.recovery || "unknown",
  };
}

function publicOffer(offer) {
  return { ...offer, capabilities: [...offer.capabilities], dependencies: [...offer.dependencies] };
}
