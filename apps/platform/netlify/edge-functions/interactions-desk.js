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
  if (request.method !== "GET") {
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
