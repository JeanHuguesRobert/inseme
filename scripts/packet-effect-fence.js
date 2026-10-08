import { validateCurrentPacketClaim } from "../packages/cop-core/src/packet-coordination.js";

/** F2: read-only provenance; never implies exclusive access. */
export function observePacketSnapshot({ packetRef, projection }) {
  if (!packetRef || !Number.isInteger(projection?.generation) || projection.generation < 1) throw Error("invalid_packet_snapshot");
  return Object.freeze({ schema:"cop.packet-snapshot/v1", packet_ref:packetRef, observed_generation:projection.generation });
}

/**
 * F4 reference effect gate. Serialize the check and commit against ONE durable
 * authoritative store in production; merely running this function is NOT a lock.
 */
export function checkPacketEffectFence({packetRef, projection, claim, expectedGeneration, idempotencyKey, seenKeys = new Map(), now = new Date()}) {
  if (!packetRef || claim?.packet_ref !== packetRef || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) throw Error("invalid_effect_request");
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 1) throw Error("invalid_expected_generation");
  const previous = seenKeys.get(idempotencyKey);
  if (previous) return previous.packet_ref === packetRef && previous.generation === expectedGeneration
    ? {ok:false,code:"ALREADY_APPLIED",effect_ref:previous.effect_ref}
    : {ok:false,code:"IDEMPOTENCY_CONFLICT"};
  const current = validateCurrentPacketClaim(projection,{claimId:claim.claim_id,handlerRef:claim.handler_ref,epoch:claim.epoch,now});
  if (!current.ok) return {ok:false,code:current.code};
  if (projection.generation !== expectedGeneration) return {ok:false,code:"STALE_GENERATION"};
  return {ok:true,code:"EFFECT_PREFLIGHT_VALID",packet_ref:packetRef,claim_epoch:claim.epoch,expected_generation:expectedGeneration,idempotency_key:idempotencyKey,atomic_commit_required:true};
}
