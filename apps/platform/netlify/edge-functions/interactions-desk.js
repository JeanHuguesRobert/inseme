/**
 * Owner-gated read-only Interactions Desk API (Inseme #36 / #77).
 *
 * GET /api/interactions/desk?open=1&limit=50
 * GET /api/interactions/desk?packet_id=2026-09-10-001
 *
 * Auth: Bearer Supabase access token; Principal or NASA operator delegate.
 * Data: service-role query of interaction_cases_desk (+ packet for get).
 * Anonymous callers never receive case rows.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function subjects(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function loadVaultConfig() {
  const config = await import("@inseme/cop-host/config/instanceConfig.edge.js");
  const table = await config.loadInstanceConfig();
  return { config, table };
}

function vaultValue(table, name) {
  const row = table[String(name).trim().toLowerCase()];
  const value = row?.value_json ?? row?.value;
  return typeof value === "string" ? value.trim() : "";
}

const DESK_COLUMNS =
  "packet_id,status,status_label,status_display,disclosure,subject,primary_channel,channel_kind,counterparty_label,created_at,last_updated_at,next_followup_at,next_watch_count,superseded_by,revision,projection_version,projected_at,is_open,source_ref";

export default async function interactionsDesk(request) {
  if (request.method !== "GET" && request.method !== "PATCH" && request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405);
  }

  const token = bearerToken(request);
  if (!token) return response({ error: "missing_bearer_token" }, 401);

  let vault;
  try {
    vault = await loadVaultConfig();
  } catch (error) {
    console.error("Interactions desk vault failed", { message: error?.message });
    return response({ error: "interactions_vault_unavailable" }, 503);
  }

  const supabaseUser = vault.config.newSupabase(false);
  if (!supabaseUser) return response({ error: "jhn_auth_not_configured" }, 503);
  const { data, error } = await supabaseUser.auth.getUser(token);
  if (error || !data.user) return response({ error: "invalid_session" }, 401);

  const principal =
    vaultValue(vault.table, "INTERACTIONS_DESK_PRINCIPAL_SUBJECT") ||
    vaultValue(vault.table, "NASA_PRINCIPAL_SUBJECT");
  const operators = subjects(
    vaultValue(vault.table, "INTERACTIONS_DESK_OPERATOR_SUBJECTS") ||
      vaultValue(vault.table, "NASA_OPERATOR_SUBJECTS")
  );
  if (!principal) {
    return response({ error: "principal_subject_unconfigured" }, 503);
  }
  const accessClass =
    data.user.id === principal ? "principal" : operators.has(data.user.id) ? "delegate" : null;
  if (!accessClass) {
    return response(
      {
        schema: "inseme.jhn_interactions_desk.v1",
        authenticated: true,
        authorized: false,
        error: "not_principal_or_delegate",
      },
      403
    );
  }

  const admin = vault.config.newSupabase(true);
  if (!admin) return response({ error: "service_role_unavailable" }, 503);

  if (request.method === "PATCH" || request.method === "POST") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return response({ error: "invalid_json_body" }, 400);
    }

    const packetId = String(payload.packet_id || payload.id || "").trim();
    if (!packetId) {
      return response({ error: "missing_packet_id" }, 400);
    }

    const expectedRevision = payload.expected_revision ?? payload.revision;
    if (expectedRevision === undefined || expectedRevision === null) {
      return response({ error: "missing_expected_revision" }, 400);
    }

    const { data: currentCase, error: fetchErr } = await admin
      .from("interaction_cases")
      .select("*")
      .eq("packet_id", packetId)
      .maybeSingle();

    if (fetchErr) return response({ error: fetchErr.message }, 500);
    if (!currentCase) {
      return response({ error: "interaction_case_not_found", packet_id: packetId }, 404);
    }

    if (Number(currentCase.revision) !== Number(expectedRevision)) {
      return response(
        {
          error: "revision_mismatch",
          packet_id: packetId,
          expected_revision: Number(expectedRevision),
          actual_revision: currentCase.revision,
        },
        409
      );
    }

    const patch = payload.patch || {};
    if (payload.status !== undefined && patch.status === undefined) patch.status = payload.status;
    if (payload.status_label !== undefined && patch.status_label === undefined) {
      patch.status_label = payload.status_label;
    }
    if (payload.next_followup_at !== undefined && patch.next_followup_at === undefined) {
      patch.next_followup_at = payload.next_followup_at;
    }
    if (payload.next_watch !== undefined && patch.next_watch === undefined) {
      patch.next_watch = payload.next_watch;
    }
    if (payload.timeline_entry !== undefined && patch.timeline_entry === undefined) {
      patch.timeline_entry = payload.timeline_entry;
    }

    const currentPacket = currentCase.packet || {};
    const mergedPacket = { ...currentPacket };

    if (patch.status !== undefined) mergedPacket.status = patch.status;
    if (patch.status_label !== undefined) {
      const statusLabelKey = currentCase.field_bindings?.status_label || "statut";
      if (!String(statusLabelKey).includes(".")) {
        mergedPacket[statusLabelKey] = patch.status_label;
      }
    }
    if (patch.subject !== undefined) {
      const subjectKey = currentCase.field_bindings?.subject || "sujet";
      mergedPacket[subjectKey] = patch.subject;
    }
    if (Array.isArray(patch.next_watch)) {
      mergedPacket.next_watch = patch.next_watch;
    }
    if (patch.timeline_entry && typeof patch.timeline_entry === "object") {
      const existingTimeline = Array.isArray(mergedPacket.timeline)
        ? [...mergedPacket.timeline]
        : [];
      existingTimeline.push(patch.timeline_entry);
      mergedPacket.timeline = existingTimeline;
    }
    mergedPacket.last_updated = new Date().toISOString().slice(0, 10);
    patch.last_updated_at = mergedPacket.last_updated;

    const sqlPatch = {
      last_updated_at: patch.last_updated_at,
    };
    if (patch.status !== undefined) sqlPatch.status = patch.status;
    if (patch.status_label !== undefined) sqlPatch.status_label = patch.status_label;
    if (patch.subject !== undefined) sqlPatch.subject = patch.subject;
    if (patch.disclosure !== undefined) sqlPatch.disclosure = patch.disclosure;
    if (patch.primary_channel !== undefined) sqlPatch.primary_channel = patch.primary_channel;
    if (patch.channel_kind !== undefined) sqlPatch.channel_kind = patch.channel_kind;
    if (patch.counterparty_label !== undefined) {
      sqlPatch.counterparty_label = patch.counterparty_label;
    }
    if (patch.next_followup_at !== undefined) sqlPatch.next_followup_at = patch.next_followup_at;
    if (Array.isArray(patch.next_watch)) sqlPatch.next_watch_count = patch.next_watch.length;
    if (patch.superseded_by !== undefined) sqlPatch.superseded_by = patch.superseded_by;

    const changedBy = `${accessClass}:${data.user.email || data.user.id}`;
    const actRef = payload.act_ref || null;

    const { data: updatedCase, error: rpcErr } = await admin.rpc(
      "interaction_case_update_projected",
      {
        p_packet_id: packetId,
        p_expected_revision: Number(expectedRevision),
        p_patch: sqlPatch,
        p_merged_packet: mergedPacket,
        p_changed_by: changedBy,
        p_act_ref: actRef,
        p_field_bindings: currentCase.field_bindings,
      }
    );

    if (rpcErr) {
      if (rpcErr.code === "40001" || rpcErr.message?.includes("revision_mismatch")) {
        return response(
          {
            error: "revision_mismatch",
            packet_id: packetId,
            message: rpcErr.message,
          },
          409
        );
      }
      return response({ error: rpcErr.message }, 500);
    }

    const { data: updatedDesk, error: deskErr } = await admin
      .from("interaction_cases_desk")
      .select(DESK_COLUMNS)
      .eq("packet_id", packetId)
      .maybeSingle();

    if (deskErr) return response({ error: deskErr.message }, 500);

    return response({
      schema: "inseme.jhn_interactions_desk_update.v1",
      ok: true,
      authenticated: true,
      authorized: true,
      access_class: accessClass,
      packet_id: packetId,
      previous_revision: Number(expectedRevision),
      revision: updatedCase?.revision || Number(expectedRevision) + 1,
      desk: updatedDesk,
      case: {
        packet_id: packetId,
        next_watch: mergedPacket.next_watch || null,
        timeline: mergedPacket.timeline || null,
        current_status: mergedPacket.current_status || null,
        statut: mergedPacket.statut || null,
      },
    });
  }

  const url = new URL(request.url);
  const packetId = url.searchParams.get("packet_id");
  const openOnly = ["1", "true", "yes"].includes(
    String(url.searchParams.get("open") || "").toLowerCase()
  );
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50));

  if (packetId) {
    const { data: desk, error: deskErr } = await admin
      .from("interaction_cases_desk")
      .select(DESK_COLUMNS)
      .eq("packet_id", packetId)
      .maybeSingle();
    if (deskErr) return response({ error: deskErr.message }, 500);
    if (!desk) {
      return response({
        schema: "inseme.jhn_interactions_desk_get.v1",
        authenticated: true,
        authorized: true,
        access_class: accessClass,
        ok: false,
        error: "not_found",
        packet_id: packetId,
      });
    }
    const { data: full, error: fullErr } = await admin
      .from("interaction_cases")
      .select(
        "packet_id,packet,packet_hash,source_ref,field_bindings,next_watch_count,status_label,projection_version,revision"
      )
      .eq("packet_id", packetId)
      .single();
    if (fullErr) return response({ error: fullErr.message }, 500);
    return response({
      schema: "inseme.jhn_interactions_desk_get.v1",
      authenticated: true,
      authorized: true,
      access_class: accessClass,
      ok: true,
      read_only: true,
      desk,
      case: {
        packet_id: full.packet_id,
        packet_hash: full.packet_hash,
        source_ref: full.source_ref,
        field_bindings: full.field_bindings,
        projection_version: full.projection_version,
        revision: full.revision,
        next_watch: full.packet?.next_watch || null,
        linked_cases: full.packet?.linked_cases || null,
        current_status: full.packet?.current_status || null,
        statut: full.packet?.statut || null,
      },
    });
  }

  let query = admin
    .from("interaction_cases_desk")
    .select(DESK_COLUMNS)
    .order("packet_id")
    .limit(limit);
  if (openOnly) query = query.eq("is_open", true);
  const { data: cases, error: listErr } = await query;
  if (listErr) return response({ error: listErr.message }, 500);

  return response({
    schema: "inseme.jhn_interactions_desk_list.v1",
    authenticated: true,
    authorized: true,
    access_class: accessClass,
    read_only: true,
    open_only: openOnly,
    count: cases.length,
    cases,
  });
}
