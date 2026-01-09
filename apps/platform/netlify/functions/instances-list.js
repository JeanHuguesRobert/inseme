// netlify/functions/instances-list.js
// API pour lister les instances actives (pour la page de sélection)

import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: "",
    };
  }

  // GET only
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const instances = await listInstances();

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "public, max-age=300", // 5 minutes de cache
      },
      body: JSON.stringify(instances),
    };
  } catch (error) {
    console.error("List instances error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

async function listInstances() {
  const registryUrl = process.env.REGISTRY_SUPABASE_URL || process.env.SUPABASE_URL;
  const registryKey = process.env.REGISTRY_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!registryUrl || !registryKey) {
    console.warn("No registry configured, returning empty list");
    return [];
  }

  const supabase = createClient(registryUrl, registryKey);

  // Essayer la fonction RPC
  const { data, error } = await supabase.rpc("list_active_instances");

  if (error) {
    // Fallback sur query directe
    if (error.code === "42883") {
      const { data: directData } = await supabase
        .from("instance_registry")
        .select(
          "subdomain, display_name, instance_type, logo_url, primary_color, description, metadata"
        )
        .eq("status", "active")
        .order("display_name");

      return (directData || []).map(formatInstance);
    }
    console.error("List error:", error);
    return [];
  }

  return (data || []).map(formatInstance);
}

function formatInstance(row) {
  return {
    subdomain: row.subdomain,
    displayName: row.display_name,
    instanceType: row.instance_type,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    description: row.description,
    metadata: row.metadata || {},
  };
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}
