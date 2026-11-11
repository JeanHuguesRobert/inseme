// Capability classification is not a mandate. Fail closed for external effects.
export const EFFECT_BOUNDARY_SCHEMA = "cop.governed-effect-boundary/v1";
export const EffectBoundary = Object.freeze({
  LOCAL_TRANSACTIONAL: "local_transactional",
  EXTERNAL_PROVIDER_FENCED: "external_provider_fenced",
  EXTERNAL_UNFENCED: "external_unfenced",
});
export function classifyGovernedEffect({effect, providerFence} = {}) {
  if (!effect || typeof effect !== "object" || !Object.values(EffectBoundary).includes(effect.boundary)) {
    return {schema:EFFECT_BOUNDARY_SCHEMA,status:"BLOCKED",code:"UNKNOWN_EFFECT_BOUNDARY",execution_authorized:false};
  }
  if (effect.boundary === EffectBoundary.LOCAL_TRANSACTIONAL) {
    if(effect.provider !== "sqlite-governed-effect-gateway" || effect.kind !== "synthetic_state_update")
      return {schema:EFFECT_BOUNDARY_SCHEMA,status:"BLOCKED",code:"UNSUPPORTED_LOCAL_EFFECT",execution_authorized:false};
    return {schema:EFFECT_BOUNDARY_SCHEMA,status:"ADVISORY_READY",code:"LOCAL_COMMIT_MUST_RECHECK_AUTHORITY",execution_authorized:false,
      required_boundary:"SqliteGovernedEffectGateway.commit"};
  }
  if(effect.boundary === EffectBoundary.EXTERNAL_UNFENCED)
    return {schema:EFFECT_BOUNDARY_SCHEMA,status:"BLOCKED",code:"EXTERNAL_EFFECT_UNFENCED",execution_authorized:false};
  // A declaration of a fence (including a boolean) is not an enforceable provider commit boundary.
  // No provider with atomic authority enforcement is connected in this experiment.
  return {schema:EFFECT_BOUNDARY_SCHEMA,status:"BLOCKED",
    code:providerFence?.verified===true ? "PROVIDER_FENCE_ADAPTER_NOT_CONNECTED" : "PROVIDER_FENCE_UNVERIFIED",
    execution_authorized:false};
}
