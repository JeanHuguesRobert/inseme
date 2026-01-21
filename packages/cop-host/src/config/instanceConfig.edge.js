/**
 * src/lib/config/instanceConfig.edge.js
 * Adaptateur Edge Function (Deno) pour l'initialisation de la configuration de l'instance.
 */

import {
  inited,
  initializeInstanceCore,
  loadConfigTable as loadInstanceConfigCore,
} from "./instanceConfig.core.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import postgres from "https://deno.land/x/postgresjs/mod.js";

// Global SQL client cache
let sqlClient = null;

// Function to get env var in Netlify Edge
function getenv(key) {
  let val = undefined;

  // 1. Try Netlify.env (Netlify Edge standard)
  try {
    if (typeof Netlify !== "undefined" && Netlify.env && typeof Netlify.env.get === "function") {
      val =
        Netlify.env.get(key) ||
        Netlify.env.get(`VITE_${key}`) ||
        Netlify.env.get(`VITE_${key.toUpperCase()}`);
    }
  } catch (_e) {
    /* ignore */
  }

  // 2. Fallback to Deno.env
  if (!val) {
    try {
      if (typeof Deno !== "undefined" && Deno.env && typeof Deno.env.get === "function") {
        val =
          Deno.env.get(key) ||
          Deno.env.get(`VITE_${key}`) ||
          Deno.env.get(`VITE_${key.toUpperCase()}`);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  return val;
}

// Proxy fetch implementation for Deno bridge
const proxyFetch = async (input, init = {}) => {
  // Determine URL and options from input/init
  let url;
  let options = init || {};

  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
    // Copy options from Request if not overridden by init
    // Note: This is simplified, might need more robust handling for Request objects
    options = {
      method: input.method,
      headers: input.headers,
      body: input.body, // Stream? Text?
      ...init,
    };
  }

  // Construct proxy URL (assuming localhost:8888 for dev bridge)
  // We try to use the current origin if available, otherwise default to localhost:8888
  let origin = "http://127.0.0.1:8888";
  try {
    // In Edge Functions context, sometimes we don't have location
    // But we can try Deno.env.get("URL") or similar
    // For now, hardcode localhost:8888 as this bridge is mainly for local dev fix
    if (getenv("URL")) origin = getenv("URL");
  } catch (e) {}

  // Force IPv4 loopback to avoid Deno/Node connectivity issues (os error 10061)
  if (origin.includes("localhost")) {
    origin = origin.replace("localhost", "127.0.0.1");
  }

  const proxyUrl = `${origin}/.netlify/functions/fetch-proxy`;

  console.log(`[ProxyFetch] Proxying to ${proxyUrl} -> ${url}`);

  // Convert headers to plain object
  const headersObj = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => (headersObj[k] = v));
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => (headersObj[k] = v));
    } else {
      Object.assign(headersObj, options.headers);
    }
  }

  // Handle body
  let bodyPayload = options.body;
  // If body is not string/null, we might need to handle it.
  // supabase-js usually sends stringified JSON.

  const proxyPayload = {
    url,
    method: options.method || "GET",
    headers: headersObj,
    body: bodyPayload,
  };

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(proxyPayload),
  });

  // Convert back to Response
  // Note: res.body is a stream (or text).
  // The proxy returns the target body as text (or json string).
  // We need to match what the caller expects.
  // Supabase client expects a Response object.

  return res;
};

// Fonction pour créer une instance Supabase côté Deno Edge
const createSupabase_Edge = (admin = false, options = {}) => {
  const supabaseUrl = options.supabaseUrl || getenv("SUPABASE_URL");
  const supabaseServiceRoleKey = options.supabaseKey || getenv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = options.supabaseKey || getenv("SUPABASE_ANON_KEY");

  const supabaseKey = admin ? supabaseServiceRoleKey : options.supabaseKey || supabaseAnonKey;
  if (!supabaseKey || !supabaseUrl) {
    console.warn(
      `Supabase ${admin ? "Service Role" : "Anon"} Key or URL not found in Deno Edge environment.`
    );
    return null;
  }

  // No need of auto refresh or persist session in edge functions
  options.auth = {
    ...options.auth,
    autoRefreshToken: false,
    persistSession: false,
  };

  // BRIDGE: Use proxy fetch if enabled
  // This is a workaround for local Deno connectivity issues
  const useBridge = getenv("SUPABASE_DENO_BRIDGE") === "true";
  if (useBridge) {
    console.log("[createSupabase_Edge] Using Proxy Fetch Bridge");
    options.global = {
      ...options.global,
      fetch: proxyFetch,
    };
  }

  return createClient(supabaseUrl, supabaseKey, options);
};

export function newSupabase(admin = false, options = {}) {
  return createSupabase_Edge(admin, options);
}

/**
 * Retourne un client SQL (Postgres) initialisé avec DATABASE_URL ou POSTGRES_URL.
 */
export function getSQL(configMap = null) {
  let dbUrl = getenv("DATABASE_URL") || getenv("POSTGRES_URL");

  if (!dbUrl) {
    console.log("[DEBUG][getSQL] dbUrl from getenv is empty, trying configMap");
  }
  if (!dbUrl && configMap) {
    const map = configMap.config || configMap;
    dbUrl = map["database_url"]?.value || map["postgres_url"]?.value;
  }

  const sslMode = getenv("DB_SSL_MODE");
  const isDebug = getenv("DEBUG") === "true";

  if (isDebug) {
    const maskedUrl = dbUrl ? dbUrl.replace(/\/\/.*:.*@/, "//***:***@") : "NONE";
    console.log(`[DEBUG][getSQL] dbUrl: ${maskedUrl}`);
    console.log(`[DEBUG][getSQL] sslMode: ${sslMode}`);
  }

  // Si déjà initialisé avec la même URL et le même mode SSL, on retourne le client existant
  if (sqlClient && sqlClient._url === dbUrl && sqlClient._sslMode === sslMode) {
    return sqlClient;
  }

  if (!dbUrl) {
    console.warn("getSQL: No DATABASE_URL or POSTGRES_URL found.");
    return null;
  }

  try {
    // Nettoyage de l'URL si elle contient des guillemets (fréquent en .env)
    let cleanUrl = dbUrl.replace(/^["']|["']$/g, "");

    let sslConfig = false;

    if (sslMode === "require") {
      sslConfig = "require";
    } else if (sslMode === "prefer") {
      sslConfig = "prefer";
    } else if (sslMode === "verify-full") {
      sslConfig = "verify-full";
    } else if (sslMode === "unsafe") {
      // Pour Deno/postgresjs, l'objet { rejectUnauthorized: false } échoue souvent avec UnknownIssuer
      // On utilise donc sslmode=disable dans l'URL et sslConfig = false
      sslConfig = false;
      if (!cleanUrl.includes("sslmode=")) {
        cleanUrl += (cleanUrl.includes("?") ? "&" : "?") + "sslmode=disable";
      }

      // Si on utilise le pooler Supabase (port 6543), on tente de repasser sur le port direct (5432)
      // car le pooler est parfois problématique avec le SSL désactivé.
      if (cleanUrl.includes(":6543")) {
        console.log("[getSQL] Switching from pooler port 6543 to direct port 5432 for unsafe mode");

        // 1. Try to use POSTGRES_URL if available (best source for direct connection)
        const explicitDirectUrl = getenv("POSTGRES_URL");
        if (explicitDirectUrl && explicitDirectUrl !== dbUrl) {
          console.log("[getSQL] Using POSTGRES_URL for direct connection override");
          cleanUrl = explicitDirectUrl.replace(/^["']|["']$/g, "");
          if (!cleanUrl.includes("sslmode=")) {
            cleanUrl += (cleanUrl.includes("?") ? "&" : "?") + "sslmode=disable";
          }
        } else {
          // 2. Heuristic fallback (works for some Supabase projects, fails for others like aws-1-...)
          cleanUrl = cleanUrl.replace(":6543", ":5432");
          cleanUrl = cleanUrl.replace(".pooler.supabase.com", ".supabase.co");
        }
      }
    }

    console.log(
      "[getSQL] Initializing postgres with sslConfig:",
      JSON.stringify(sslConfig),
      "URL:",
      cleanUrl.split("@")[1] || "hidden"
    );

    const postgresOptions = {
      prepare: false,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      ssl: sslConfig,
    };

    sqlClient = postgres(cleanUrl, postgresOptions);
    // On stocke l'URL et le mode pour détection de changement
    sqlClient._url = dbUrl;
    sqlClient._sslMode = sslMode;

    return sqlClient;
  } catch (err) {
    const errorMessage = err.message.replace(/postgres:\/\/.*@/, "postgres://***@");
    console.error("getSQL: Failed to initialize postgres client", errorMessage);
    return null;
  }
}

export async function initializeInstance(supabase, admin = false) {
  return await initializeInstanceCore(supabase, getenv, newSupabase, admin);
}

export async function initializeInstanceAdmin(supabase) {
  return initializeInstance(supabase, true);
}

export async function loadInstanceConfig(force = false, supabase_config = null) {
  if (!inited()) {
    await initializeInstanceAdmin();
  }
  return await loadInstanceConfigCore(force, supabase_config);
}

export * from "./instanceConfig.core.js";
