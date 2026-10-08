import { createHash } from "node:crypto";

/**
 * Packet/compute/artifact reconciliation. This module knows nothing about
 * Gmail or any other delivery service, nor does it grant a mandate or budget.
 */
const sha256 = b => createHash("sha256").update(b).digest("hex");
const hex = /^[0-9a-f]{64}$/i;
export function verifyPacketComputeArtifact({ packetRef, computationId, result, artifactPath, bytes }) {
  if (typeof packetRef !== "string" || !packetRef.trim()) throw Error("packet_ref_required");
  if (!result || result.schema !== "cop.compute-result/v1" || result.computation_id !== computationId) throw Error("compute_result_correlation_failed");
  if (result.execution_receipt?.status !== "completed" || result.result?.passed !== true) throw Error("compute_not_completed");
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw Error("artifact_bytes_required");
  const match = result.result.outputs?.find(o => o.path === artifactPath);
  if (!match || !hex.test(match.sha256)) throw Error("artifact_not_declared");
  const digest = sha256(bytes);
  if (digest !== match.sha256 || bytes.length !== match.bytes) throw Error("artifact_digest_mismatch");
  return Object.freeze({
    schema: "cop.packet-artifact-handoff/v1",
    packet_ref: packetRef,
    computation_id: computationId,
    artifact: {
      path: artifactPath,
      bytes: bytes.length,
      sha256: digest,
      content_ref: "sha256:" + digest,
    },
    execution_receipt_ref: result.execution_receipt.log_refs?.[0] || null,
    state: "verified-ready-for-adapter",
    // This is an observation, not proof of mandate or budget allocation.
  });
}
