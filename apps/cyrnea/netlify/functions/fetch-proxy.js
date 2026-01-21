// apps/cyrnea/netlify/functions/fetch-proxy.js
// Proxy générique pour contourner les problèmes de connectivité Deno -> Supabase en local.
// Reçoit une requête POST avec { url, method, headers, body }
// Exécute la requête via Node.js fetch() et retourne le résultat.

import { checkAndWarn } from "../../../../packages/cop-host/src/utils/tunnel-connectivity.js";

// Self-check for proxy connectivity on cold start
checkAndWarn();

export async function handler(event, context) {
  // CORS pour le dev local
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  try {
    const payload = JSON.parse(event.body);
    const { url, method = "GET", headers = {}, body } = payload;

    if (!url) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing 'url' in body" }),
      };
    }

    console.log(`[fetch-proxy] Proxying ${method} ${url}`);

    // Exécution du fetch via Node.js
    const response = await fetch(url, {
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });

    // Lecture du corps de la réponse
    const responseText = await response.text();

    // Filtrage des headers de réponse (pour éviter les conflits ou fuites)
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // On garde l'essentiel
      if (["content-type", "content-length", "etag", "cache-control"].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        ...responseHeaders,
      },
      body: responseText,
    };
  } catch (error) {
    console.error("[fetch-proxy] Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
