/**
 * Pure shapes for Supabase COP persistence (Inseme #28).
 * Shared by Node tests and documented for Deno edge (inlined there).
 */

/**
 * Build delivery upsert row (no raw body).
 */
export function buildGithubDeliveryRow({
  deliveryId,
  eventName,
  action,
  repositoryName,
  installationId,
  senderLogin,
  signatureHeader,
  payloadHash,
  artifactRef = null,
  processingState = "received",
}) {
  return {
    delivery_id: deliveryId,
    event_name: eventName,
    action: action ?? null,
    repository_name: repositoryName ?? null,
    installation_id: installationId ?? null,
    sender_login: senderLogin ?? null,
    signature_sha256: signatureHeader ?? null,
    payload_sha256: payloadHash.startsWith("sha256:") ? payloadHash : `sha256:${payloadHash}`,
    raw_artifact_ref: artifactRef,
    processing_state: processingState,
    received_at: new Date().toISOString(),
  };
}

/**
 * Build arguments for public.cop_event_append RPC.
 */
export function buildCopEventAppendArgs({
  topicId,
  actorId,
  originRef,
  payload,
  meta,
  idempotencyKey,
  payloadHash,
  artifactRef = null,
  visibility = "restricted",
  epistemicStatus = "observed",
  eventType = "cop.event/v1",
  eventId = null,
  onBehalfOfInstanceId = "00000000-0000-0000-0000-000000000001",
}) {
  return {
    p_topic_id: topicId,
    p_event_type: eventType,
    p_actor_id: actorId,
    p_epistemic_status: epistemicStatus,
    p_origin_ref: originRef,
    p_payload: payload,
    p_meta: meta,
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash?.startsWith("sha256:")
      ? payloadHash
      : payloadHash
        ? `sha256:${payloadHash}`
        : null,
    p_artifact_ref: artifactRef,
    p_visibility: visibility,
    ...(eventId ? { p_event_id: eventId } : {}),
    p_on_behalf_of_instance_id: onBehalfOfInstanceId,
  };
}

/**
 * Build spool queue row when durable append fails.
 */
export function buildSpoolQueueRow({ topicId, payload, error }) {
  return {
    topic_id: topicId,
    event_type: "cop.event/v1",
    payload,
    status: "pending",
    attempts: 0,
    max_attempts: 5,
    last_error: error ? String(error).slice(0, 500) : null,
  };
}

/**
 * Whether raw body should be externalized to object storage.
 */
export function shouldExternalizeRawBody(byteLength, threshold = 8192) {
  return byteLength >= threshold;
}

/**
 * Storage object path for a raw delivery (content-addressed).
 */
export function artifactStoragePath(payloadHashHex, deliveryId) {
  const hex = String(payloadHashHex).replace(/^sha256:/, "");
  return `github-webhooks/${hex.slice(0, 2)}/${hex}-${deliveryId}.json`;
}
