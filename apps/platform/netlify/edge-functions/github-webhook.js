/* global Deno */
// Deno Edge Function: GitHub App Webhook Ingress (Issues #28 / #29 / #113)
// Path: /api/webhooks/github
//
// #28 durable path: delivery row → optional artifact → cop_event_append RPC
// (atomic topic_seq). On append failure → cop_spool_queue. Returns 202 after
// validation. Secret values never logged.
//
// #113: after a durable issue_comment, propose continuation-result events.
// This import is resolved from the compiled profile copy
// apps/platform/netlify/profiles/<id>/edge-functions/github-webhook.js.
import {
  continuationContextFromRecords,
  issueCommentObservationEvent,
  recognizeMappedContinuationResults,
} from "../../../../../../packages/cop-core/src/continuation-result.js";

const ARTIFACT_THRESHOLD = 8 * 1024;
const DEFAULT_ARTIFACT_BUCKET = "cop-artifacts";

/**
 * Resolve the ingress HMAC secret from the canonical instance Vault.
 * Bootstrap Supabase credentials remain host-only; the webhook secret itself
 * is never duplicated in Netlify environment configuration.
 */
async function loadWebhookConfig() {
  const config = await import("@inseme/cop-host/config/instanceConfig.edge.js");
  const table = await config.loadInstanceConfig();
  return { config, table };
}

function vaultValue(table, key) {
  const row = table[String(key).trim().toLowerCase()];
  return row?.value_json ?? row?.value ?? null;
}

function parseAllowlist(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
}

async function verifyHmacSignature(rawText, signatureHeader, secret) {
  if (!signatureHeader || !secret || !rawText) return false;
  const parts = signatureHeader.trim().split("=");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") return false;
  const expectedHex = parts[1].toLowerCase();

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify", "sign"]
    );
    const data = encoder.encode(rawText);
    const signatureBytes = new Uint8Array(
      expectedHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
    return await crypto.subtle.verify("HMAC", key, signatureBytes, data);
  } catch {
    return false;
  }
}

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sortKeys(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeys(value[key]);
  }
  return out;
}

async function payloadHashSha256(payload) {
  const canonical = JSON.stringify(sortKeys(payload ?? {}));
  const hex = await sha256Hex(canonical);
  return `sha256:${hex}`;
}

export default async (request, _context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-GitHub-Delivery, X-GitHub-Event, X-Hub-Signature-256",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const deliveryId = request.headers.get("x-github-delivery") || "";
  const eventName = request.headers.get("x-github-event") || "";
  const signatureHeader = request.headers.get("x-hub-signature-256") || "";

  if (!deliveryId || !eventName) {
    return new Response(JSON.stringify({ ok: false, error: "missing_github_headers" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  let vault;
  try {
    vault = await loadWebhookConfig();
  } catch (error) {
    console.error("GitHub webhook Vault configuration failed", { message: error?.message });
    return new Response(JSON.stringify({ ok: false, error: "webhook_vault_unavailable" }), {
      status: 503,
      headers: corsHeaders,
    });
  }
  const webhookSecret = String(vaultValue(vault.table, "github_webhook_secret") || "").trim();
  if (!webhookSecret) {
    return new Response(JSON.stringify({ ok: false, error: "webhook_secret_unconfigured" }), {
      status: 503,
      headers: corsHeaders,
    });
  }
  const allowlist = parseAllowlist(vaultValue(vault.table, "github_repo_allowlist"));
  if (!allowlist.length) {
    return new Response(JSON.stringify({ ok: false, error: "webhook_allowlist_unconfigured" }), {
      status: 503,
      headers: corsHeaders,
    });
  }
  const artifactBucket = String(
    vaultValue(vault.table, "cop_artifact_bucket") || DEFAULT_ARTIFACT_BUCKET
  ).trim();
  const rawText = await request.text();

  const isValid = await verifyHmacSignature(rawText, signatureHeader, webhookSecret);
  if (!isValid) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_hmac_signature" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  let payload = {};
  try {
    payload = JSON.parse(rawText || "{}");
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json_payload" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const repositoryName = payload?.repository?.full_name || null;
  const action = payload?.action || null;
  const senderLogin = payload?.sender?.login || null;
  const installationId = payload?.installation?.id ? Number(payload.installation.id) : null;
  const payloadHashHex = await sha256Hex(rawText);
  const payloadHash = `sha256:${payloadHashHex}`;
  const rawBytes = new TextEncoder().encode(rawText || "").length;

  // Allowlist is canonical Vault configuration; empty fails closed above.
  let allowlistOutcome = "not_checked";
  if (repositoryName && allowlist.length > 0) {
    const allowed = allowlist.some((r) => r.toLowerCase() === repositoryName.toLowerCase());
    if (!allowed) {
      allowlistOutcome = "ignored";
      // Still 202 — do not leak existence; optional durable ignore without event
      return new Response(
        JSON.stringify({
          ok: true,
          accepted: true,
          delivery_id: deliveryId,
          event: eventName,
          repository: repositoryName,
          durable: "ignored_allowlist",
          spooled: false,
          artifact: false,
        }),
        { status: 202, headers: corsHeaders }
      );
    }
    allowlistOutcome = "allowed";
  }

  let durable = "skipped_no_supabase";
  let artifactRef = null;
  let spooled = false;
  let continuation = null;

  {
    const supabase = vault.config.newSupabase(true);
    if (!supabase) {
      return new Response(JSON.stringify({ ok: false, error: "webhook_store_unavailable" }), {
        status: 503,
        headers: corsHeaders,
      });
    }

    if (rawBytes >= ARTIFACT_THRESHOLD) {
      const objectPath = `github-webhooks/${payloadHashHex.slice(0, 2)}/${payloadHashHex}-${deliveryId}.json`;
      const { error: upErr } = await supabase.storage
        .from(artifactBucket)
        .upload(objectPath, rawText, {
          contentType: "application/json",
          upsert: true,
        });
      if (!upErr) {
        artifactRef = `artifact:supabase:${artifactBucket}/${objectPath}`;
      }
    }

    const deliveryRow = {
      delivery_id: deliveryId,
      event_name: eventName,
      action,
      repository_name: repositoryName,
      installation_id: installationId,
      sender_login: senderLogin,
      signature_sha256: signatureHeader,
      payload_sha256: payloadHash,
      raw_artifact_ref: artifactRef,
      processing_state: "received",
      received_at: new Date().toISOString(),
    };

    const { error: deliveryError } = await supabase
      .from("github_webhook_deliveries")
      .upsert(deliveryRow, { onConflict: "delivery_id" });

    if (deliveryError) {
      durable = "delivery_failed";
    } else {
      const topicId = `github:${repositoryName || "global"}`;
      const actorId = senderLogin ? `github:${senderLogin}` : "github:anonymous";
      const idempotencyKey = `github:${deliveryId}:${eventName}`;
      const commentObservation =
        eventName === "issue_comment"
          ? issueCommentObservationEvent({
              deliveryId,
              eventName,
              action,
              repository: repositoryName,
              senderLogin,
              payload,
            })
          : null;
      const eventPayload = commentObservation
        ? {
            ...commentObservation.payload,
            installation_id: installationId,
            details: {
              ...commentObservation.payload.details,
              sender: senderLogin,
              payload_hash: payloadHash,
              externalized: Boolean(artifactRef),
            },
          }
        : {
            github_event: eventName,
            action,
            repository: repositoryName,
            installation_id: installationId,
            summary: `GitHub Event ${eventName} (${action || "no-action"}) on ${repositoryName || "unknown"}`,
            details: {
              sender: senderLogin,
              payload_hash: payloadHash,
              externalized: Boolean(artifactRef),
            },
          };
      const eventPayloadHash = await payloadHashSha256(eventPayload);

      const { error: appendError } = await supabase.rpc("cop_event_append", {
        p_topic_id: topicId,
        p_event_type: "cop.event/v1",
        p_actor_id: actorId,
        p_epistemic_status: "observed",
        p_origin_ref: `github:delivery:${deliveryId}`,
        p_payload: eventPayload,
        p_meta: {
          delivery_id: deliveryId,
          received_at: new Date().toISOString(),
          raw_payload_hash: payloadHash,
        },
        p_idempotency_key: idempotencyKey,
        p_payload_hash: eventPayloadHash,
        p_artifact_ref: artifactRef,
        p_visibility: "restricted",
      });

      if (appendError) {
        const { error: spoolError } = await supabase.from("cop_spool_queue").insert({
          topic_id: topicId,
          event_type: "cop.event/v1",
          payload: {
            envelope_hint: eventPayload,
            delivery_id: deliveryId,
            idempotency_key: idempotencyKey,
            artifact_ref: artifactRef,
            payload_hash: eventPayloadHash,
            raw_payload_hash: payloadHash,
          },
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          last_error: String(appendError.message || appendError).slice(0, 500),
        });
        spooled = !spoolError;
        durable = spooled ? "spooled" : "append_and_spool_failed";
      } else {
        durable = "appended";
        await supabase
          .from("github_webhook_deliveries")
          .update({
            processing_state: "normalized",
            normalized_at: new Date().toISOString(),
          })
          .eq("delivery_id", deliveryId);
        if (commentObservation && action !== "deleted") {
          continuation = await proposeContinuationResultEvents(supabase, {
            ...commentObservation,
            payload: eventPayload,
          });
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      accepted: true,
      delivery_id: deliveryId,
      event: eventName,
      repository: repositoryName,
      durable,
      spooled,
      artifact: Boolean(artifactRef),
      allowlist: allowlistOutcome,
      continuation,
    }),
    {
      status: 202,
      headers: corsHeaders,
    }
  );
};

async function proposeContinuationResultEvents(supabase, observation) {
  try {
    const declared = await supabase
      .from("cop_event_log")
      .select("payload")
      .like("idempotency_key", "continuation:%:declared")
      .limit(20);
    if (declared.error) return { ok: false, error: "continuation_context_unavailable" };
    const results = await supabase
      .from("cop_event_log")
      .select("payload")
      .like("idempotency_key", "continuation-result:%")
      .limit(200);
    if (results.error) return { ok: false, error: "continuation_result_context_unavailable" };

    const context = continuationContextFromRecords(declared.data, results.data);
    if (!Object.keys(context.continuations).length) {
      return { ok: true, matched: false, progression: "none", proposed: 0 };
    }
    const recognition = recognizeMappedContinuationResults([observation], context);
    const report = recognition.reports[0] || { matched: false, progression: "none" };
    let appended = 0;
    for (const proposed of recognition.proposed_events) {
      const proposedHash = await payloadHashSha256(proposed.payload);
      const { error } = await supabase.rpc("cop_event_append", {
        p_topic_id: proposed.topic_id,
        p_event_type: proposed.event_type || "cop.event/v1",
        p_actor_id: proposed.actor_id,
        p_epistemic_status: proposed.epistemic_status || "observed",
        p_origin_ref: proposed.origin_ref,
        p_payload: proposed.payload,
        p_meta: proposed.meta || {},
        p_idempotency_key: proposed.idempotency_key,
        p_payload_hash: proposedHash,
        p_visibility: proposed.visibility || "restricted",
      });
      if (!error) appended += 1;
    }
    return {
      ok: true,
      matched: report.matched === true,
      progression: report.progression || "none",
      continuation_id: report.continuation_id || null,
      proposed: recognition.proposed_events.length,
      appended,
    };
  } catch (error) {
    console.error("Continuation recognition failed", { message: error?.message });
    return { ok: false, error: "continuation_recognition_failed" };
  }
}
