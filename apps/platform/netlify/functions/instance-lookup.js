// netlify/functions/instance-lookup.js
// Fonction Netlify pour le lookup d'instance (alternative à l'edge function)
// Utilisé comme API : GET /.netlify/functions/instance-lookup?subdomain=corte

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

  // Extraire le subdomain
  const subdomain = event.queryStringParameters?.subdomain;

  if (!subdomain) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "subdomain parameter required" }),
    };
  }

  try {
    const instance = await lookupInstance(subdomain);

    if (!instance) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Instance not found", subdomain }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(instance),
    };
  } catch (error) {
    console.error("Instance lookup error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

async function lookupInstance(subdomain) {
  const registryUrl = process.env.REGISTRY_SUPABASE_URL || process.env.SUPABASE_URL;
  const registryKey = process.env.REGISTRY_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!registryUrl || !registryKey) {
    console.warn("No registry configured");
    return null;
  }

  const supabase = createClient(registryUrl, registryKey);

  // Essayer la fonction RPC
  const { data, error } = await supabase.rpc("get_instance_by_subdomain", {
    p_subdomain: subdomain,
  });

  if (error) {
    // Fallback sur query directe si la fonction n'existe pas
    if (error.code === "42883") {
      const { data: directData } = await supabase
        .from("instance_registry")
        .select("subdomain, display_name, supabase_url, supabase_anon_key, instance_type, metadata")
        .eq("subdomain", subdomain)
        .eq("status", "active")
        .single();

      return directData;
    }
    console.error("Lookup error:", error);
    return null;
  }

  return data;
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}
