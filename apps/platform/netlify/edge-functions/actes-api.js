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
    // GET /actes - Liste des actes
    if (method === "GET") {
      const collectiviteId = url.searchParams.get("collectiviteId");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      let query = supabase
        .from("actes")
        .select("*, proof(*), mandats(*)")
        .order("date_acte", { ascending: false })
        .range(offset, offset + limit - 1);

      if (collectiviteId) {
        query = query.eq("collectivite_id", collectiviteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    // POST /actes - Création d'un acte
    if (method === "POST") {
      const body = await request.json();
      const {
        collectivite_id,
        type_acte,
        numero_interne,
        numero_actes,
        objet_court,
        objet_complet,
        date_acte,
        date_seance,
        organe,
        rapporteur,
        mandat_id,
        metadata = { schemaVersion: 1 }
      } = body;

      const { data, error } = await supabase
        .from("actes")
        .insert({
          collectivite_id,
          type_acte,
          numero_interne,
          numero_actes,
          objet_court,
          objet_complet,
          date_acte,
          date_seance,
          organe,
          rapporteur,
          mandat_id,
          metadata,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 201, headers });
    }

    // PUT /actes/:id - Mise à jour d'un acte
    if (method === "PUT") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "actes-api") { // Basic validation
         return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
      }

      const body = await request.json();
      const { data, error } = await supabase
        .from("actes")
        .update(body)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    // DELETE /actes/:id - Suppression d'un acte
    if (method === "DELETE") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "actes-api") {
         return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
      }

      const { error } = await supabase
        .from("actes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  } catch (err) {
    console.error("[ACTES-API] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
