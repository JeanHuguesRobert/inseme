import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig } from "../../src/common/config/instanceConfig.backend.js";

export default async (request, context) => {
  // Charger la configuration
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseAnonKey = getConfig("SUPABASE_ANON_KEY");

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Authentication
  let supabase;
  let user;
  const authHeader = request.headers.get("Authorization");

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    user = authUser;
  } else {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers,
    });
  }

  const url = new URL(request.url);
  const method = request.method;

  try {
    // GET /proof-links - Liste des liens vers des preuves
    if (method === "GET") {
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id");
      
      // Backward compatibility support for old params
      const acteId = url.searchParams.get("acte_id");
      const demandeAdminId = url.searchParams.get("demande_admin_id");
      const mandatId = url.searchParams.get("mandat_id");

      let query = supabase
        .from("proof_link")
        .select("*, proof(*)");

      if (entityType && entityId) {
        query = query.eq("entity_type", entityType).eq("entity_id", entityId);
      } else if (acteId) {
        query = query.eq("entity_type", "ACTE").eq("entity_id", acteId);
      } else if (demandeAdminId) {
        query = query.eq("entity_type", "DEMANDE").eq("entity_id", demandeAdminId);
      } else if (mandatId) {
        query = query.eq("entity_type", "MANDAT").eq("entity_id", mandatId);
      } else {
        return new Response(JSON.stringify({ error: "Missing entity_type/entity_id or backward compatible params" }), { status: 400, headers });
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    // POST /proof-links - Création d'un lien
    if (method === "POST") {
      const body = await request.json();
      const { proof_id, entity_type, entity_id, role = "PIECE_PRINCIPALE", metadata = { schemaVersion: 1 } } = body;

      if (!proof_id || !entity_type || !entity_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
      }

      const { data, error } = await supabase
        .from("proof_link")
        .insert({
          proof_id,
          entity_type,
          entity_id,
          role,
          metadata
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 201, headers });
    }

    // DELETE /proof-links/:id - Suppression d'un lien
    if (method === "DELETE") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "proof-links-api") {
         return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
      }

      const { error } = await supabase
        .from("proof_link")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  } catch (err) {
    console.error("[PROOF-LINKS-API] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
