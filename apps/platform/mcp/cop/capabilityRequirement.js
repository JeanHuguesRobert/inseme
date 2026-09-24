/**
 * Exact capability-requirement satisfaction for the JHN delegation path
 * (Inseme #99).
 *
 * COP currently has no capability hierarchy. Magistral catalog resolution and
 * Mandate evaluation both use exact string membership. This helper keeps the
 * same fail-closed equality at the HandlerAssistDecision → HandlerInstance
 * boundary. Do not infer that coding.assist contains coding.assist.read, or
 * the inverse.
 */

function isCapabilityName(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * True only when the bound handler's declared capability exactly equals the
 * decision's required capability. Missing, empty, or non-object inputs fail
 * closed. Prefix, suffix, wildcard, and inheritance matching are not defined.
 *
 * @param {object|null|undefined} requirement  `{ capability }`
 * @param {object|null|undefined} handler  `{ capability }`
 * @returns {boolean}
 */
export function satisfiesCapabilityRequirement(requirement, handler) {
  if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
    return false;
  }
  if (!handler || typeof handler !== "object" || Array.isArray(handler)) {
    return false;
  }
  const required = requirement.capability;
  const declared = handler.capability;
  if (!isCapabilityName(required) || !isCapabilityName(declared)) {
    return false;
  }
  return required === declared;
}

/** Normalized required capability string, or null when absent/invalid. */
export function requiredCapabilityOf(decision) {
  const capability = decision?.capability_requirement?.capability;
  return isCapabilityName(capability) ? capability : null;
}
