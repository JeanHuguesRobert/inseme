/**
 * Classify evidence for an intended provider effect without inferring success
 * from reservation alone. Pure observation, not a claim/fencing mechanism.
 *
 * A completed workflow or Handler receipt is NOT authoritative provider
 * evidence; the caller must obtain verified effect evidence independently.
 */
export function classifyEffectObservation({
  intentId,
  claimPresent = false,
  effectVerified = false,
  effectVerification = null,
} = {}) {
  if (typeof intentId !== "string" || !intentId.trim()) {
    throw new TypeError("intentId is required");
  }
  if (effectVerified && !effectVerification) {
    throw new TypeError("verified effects require a source reference");
  }
  const status = effectVerified ? "effect_verified"
    : claimPresent ? "indeterminate" : "unclaimed";
  return Object.freeze({
    schema: "cop.effect-observation/v1",
    intent_id: intentId,
    status,
    claim_present: Boolean(claimPresent),
    effect_verification: effectVerified ? effectVerification : null,
    automatic_retry_allowed: false,
  });
}
