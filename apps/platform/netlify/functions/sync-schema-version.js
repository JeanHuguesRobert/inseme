/**
 * Netlify Function: Synchronise la version du schéma d'une instance vers le hub
 *
 * POST /api/sync-schema-version
 * Body: { subdomain: string }
 *
 * Cette fonction :
 * 1. Lit la version du schéma de l'instance (via son vault)
 * 2. Met à jour le registry du hub avec cette version
 */

import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";
import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { subdomain } = body;

    if (!subdomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "subdomain is required" }),
      };
    }

    // Load instance config
    await loadInstanceConfig();

    // Connexion au hub pour récupérer les infos de l'instance
    const hubUrl = getConfig("SUPABASE_URL");
    const hubKey = getConfig("SUPABASE_SERVICE_ROLE_KEY");

    if (!hubUrl || !hubKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Hub configuration missing" }),
      };
    }

    const hubClient = createClient(hubUrl, hubKey);

    // Récupérer l'instance depuis le registry
    const { data: instance, error: instanceError } = await hubClient
      .from("instance_registry")
      .select("supabase_url, supabase_anon_key")
      .eq("subdomain", subdomain)
      .single();

    if (instanceError || !instance) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Instance '${subdomain}' not found` }),
      };
    }

    // Connexion à l'instance pour lire sa version
    const instanceClient = createClient(instance.supabase_url, instance.supabase_anon_key);

    // Lire la version du schéma
    const { data: versionData, error: versionError } =
      await instanceClient.rpc("get_schema_version");

    let schemaVersion = null;
    let migrationsCount = 0;

    if (!versionError && versionData && versionData.length > 0) {
      schemaVersion = versionData[0].current_version;
      migrationsCount = versionData[0].migrations_count;
    }

    // Mettre à jour le registry du hub
    const { error: updateError } = await hubClient
      .from("instance_registry")
      .update({
        schema_version: schemaVersion,
        schema_updated_at: new Date().toISOString(),
        migrations_count: migrationsCount,
      })
      .eq("subdomain", subdomain);

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Update failed: ${updateError.message}` }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        subdomain,
        schema_version: schemaVersion,
        migrations_count: migrationsCount,
      }),
    };
  } catch (error) {
    console.error("Sync error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
