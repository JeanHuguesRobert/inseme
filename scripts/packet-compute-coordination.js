import { validateCurrentPacketClaim } from "../packages/cop-core/src/packet-coordination.js";

/**
 * Bridge between #120 capability results and #121 packet coordination.
 * Compute artifacts remain valid observations independently of claim state.
 * Promoting an artifact into mutable Packet state requires a current claim.
 * This function is a preflight; real effect adapters MUST recheck atomically
 * at their own durable commit boundary (F4, not implemented here).
 */
export function planPacketResultPromotion({ packetRef, handoff, projection, claim, now }) {
  if (!packetRef || handoff?.schema !== "cop.packet-artifact-handoff/v1" ||
      handoff.packet_ref !== packetRef || handoff.state !== "verified-ready-for-adapter") {
    throw Error("invalid_packet_artifact_handoff");
  }
  if (!claim || claim.packet_ref !== packetRef) {
    return { status: "observation-only", reason: "no_applicable_packet_claim", artifact: handoff.artifact };
  }
  const checked = validateCurrentPacketClaim(projection, {
    claimId: claim.claim_id, handlerRef: claim.handler_ref, epoch: claim.epoch, now,
  });
  if (!checked.ok) {
    return { status: "observation-only", reason: checked.code, artifact: handoff.artifact };
  }
  return {
    status: "promotion-preflight-passed",
    packet_ref: packetRef,
    claim_id: claim.claim_id,
    claim_epoch: claim.epoch,
    expected_generation: projection.generation,
    artifact: handoff.artifact,
    effect_boundary_recheck_required: true,
  };
}
