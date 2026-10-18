import { primaryPacketPlacement } from "@inseme/cop-core";

/**
 * Resolve PacketClaim authority from the Packet's current primary placement.
 *
 * This is deliberately not a registry. The host injects resolveCoordinator(),
 * which may return a local coordinator, an explicit remote adapter, or null.
 * Absence never widens local authority.
 */
export function createPrimaryPlacementPacketClaimResolver({ resolveCoordinator } = {}) {
  if (typeof resolveCoordinator !== "function") {
    throw new TypeError("resolveCoordinator must be a function");
  }

  return async function resolvePacketClaimCoordinator(coordination = {}, context = {}) {
    const continuation = context.continuation || null;
    const packetRef =
      coordination.packetRef ||
      coordination.packet?.packet_id ||
      coordination.packet?.id ||
      continuation?.packetRef ||
      null;

    const placementWitness =
      continuation?.packetPlacementWitness &&
      Array.isArray(continuation.packetPlacementWitness)
        ? continuation.packetPlacementWitness
        : null;

    const packet =
      coordination.packet ||
      (packetRef && placementWitness
        ? {
            packet_id: packetRef,
            placements: structuredClone(placementWitness),
          }
        : null);

    if (!packet) {
      return {
        ok: false,
        code: "PACKET_COORDINATION_PACKET_REQUIRED",
        packet_ref: packetRef,
      };
    }

    let primaryPlacement;
    try {
      primaryPlacement = primaryPacketPlacement(packet, { required: true });
    } catch (error) {
      return {
        ok: false,
        code: "PACKET_PRIMARY_PLACEMENT_INVALID",
        packet_ref: packetRef,
        reason: error?.message || String(error),
      };
    }

    const coordinator = await resolveCoordinator({
      storeId: primaryPlacement.store_id,
      placement: primaryPlacement,
      packet,
      coordination,
      context,
    });

    if (!coordinator) {
      return {
        ok: false,
        code: "PACKET_CLAIM_LOCALITY_UNAVAILABLE",
        packet_ref: packetRef,
        required_store_id: primaryPlacement.store_id,
        primary_placement: primaryPlacement,
      };
    }

    if (
      typeof coordinator.tryClaim !== "function" ||
      typeof coordinator.complete !== "function"
    ) {
      return {
        ok: false,
        code: "PACKET_CLAIM_COORDINATOR_INVALID",
        packet_ref: packetRef,
        required_store_id: primaryPlacement.store_id,
        primary_placement: primaryPlacement,
      };
    }

    return {
      ok: true,
      packet_ref: packetRef,
      coordinator,
      primary_placement: primaryPlacement,
    };
  };
}
