import { tokenRefFromToken } from "../../../../scripts/watch-the-watchers.js";

function requireSupabase(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("a Supabase service-role client is required");
  }
}

export function createArtifactAccessSupabaseStore(client) {
  requireSupabase(client);

  async function registerToken({
    token,
    recipient_ref,
    context_ref = null,
    artifact_ref,
    expires_at,
  }) {
    const token_ref = tokenRefFromToken(token);
    const { data, error } = await client.rpc("artifact_access_token_register", {
      p_token_ref: token_ref,
      p_recipient_ref: recipient_ref,
      p_context_ref: context_ref,
      p_artifact_ref: artifact_ref,
      p_expires_at: expires_at,
    });
    if (error) throw new Error(`artifact_access_token_register_failed: ${error.message || error}`);
    return { token_ref, row: data };
  }

  async function lookupToken(token) {
    const token_ref = tokenRefFromToken(token);
    const { data, error } = await client
      .from("artifact_access_tokens")
      .select("token_ref, recipient_ref, context_ref, artifact_ref, expires_at, disabled_at")
      .eq("token_ref", token_ref)
      .is("disabled_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw new Error(`artifact_access_token_lookup_failed: ${error.message || error}`);
    if (!data) return null;
    return { ...data, token_ref };
  }

  async function appendEvent(document) {
    if (!document || document.schema !== "artifact-access-event/v1") {
      throw new Error("artifact_access_event_document_required");
    }
    const { data, error } = await client.rpc("artifact_access_event_append", {
      p_event: document,
    });
    if (error) throw new Error(`artifact_access_event_append_failed: ${error.message || error}`);
    return { event: document, row: data };
  }

  async function purgeExpired(before = new Date().toISOString()) {
    const { data, error } = await client.rpc("artifact_access_purge_expired", {
      p_before: before,
    });
    if (error) throw new Error(`artifact_access_purge_failed: ${error.message || error}`);
    return data;
  }

  return Object.freeze({
    kind: "watch-the-watchers.supabase.v1",
    registerToken,
    lookupToken,
    appendEvent,
    purgeExpired,
  });
}
