/**
 * Netlify Function: Liste les versions de schéma de toutes les instances
 *
 * GET /api/schema-versions
 *
 * Retourne l'état de synchronisation de toutes les instances
 */

import { loadInstanceConfig } from "../../common/config/instanceConfig.backend.js";
import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    // Load instance config
    await loadInstanceConfig();

    const hubUrl = getConfig("SUPABASE_URL");
    const hubKey = getConfig("SUPABASE_ANON_KEY");

    if (!hubUrl || !hubKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Hub configuration missing" }),
      };
    }

    const hubClient = createClient(hubUrl, hubKey);

    // Récupérer toutes les instances avec leurs versions
    const { data: instances, error } = await hubClient
      .from("instance_registry")
      .select(
        `
        subdomain,
        display_name,
        status,
        schema_version,
        schema_updated_at,
        migrations_count,
        instance_type
      `
      )
      .order("display_name");

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    // Calculer les statistiques
    const stats = {
      total: instances.length,
      active: instances.filter((i) => i.status === "active").length,
      with_versioning: instances.filter((i) => i.schema_version).length,
      outdated: 0, // À calculer côté client en comparant avec la version cible
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60", // Cache 1 minute
      },
      body: JSON.stringify({
        instances,
        stats,
        checked_at: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Schema versions error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
