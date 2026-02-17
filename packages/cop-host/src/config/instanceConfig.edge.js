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
    if (
      typeof globalThis !== "undefined" &&
      typeof globalThis.Netlify !== "undefined" &&
      globalThis.Netlify.env &&
      typeof globalThis.Netlify.env.get === "function"
    ) {
      val =
        globalThis.Netlify.env.get(key) ||
        globalThis.Netlify.env.get(`VITE_${key}`) ||
        globalThis.Netlify.env.get(`VITE_${key.toUpperCase()}`);
    }
  } catch (_e) {
    /* ignore */
  }

  // 2. Fallback to Deno.env
  if (!val) {
    try {
      if (
        typeof globalThis !== "undefined" &&
        typeof globalThis.Deno !== "undefined" &&
        globalThis.Deno.env &&
        typeof globalThis.Deno.env.get === "function"
      ) {
        val =
          globalThis.Deno.env.get(key) ||
          globalThis.Deno.env.get(`VITE_${key}`) ||
          globalThis.Deno.env.get(`VITE_${key.toUpperCase()}`);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  return val;
}

// Proxy bridge removed: Deno -> Node fetch bridge removed to avoid technical debt.
// Historically this provided a workaround for local Deno connectivity issues on Windows
// (e.g., os error 10061 caused by proxy/firewall). The bridge is no longer required.
// Leave a placeholder comment in case we need to reintroduce a safe, validated helper.

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

  // Bridge removed: SUPABASE_DENO_BRIDGE is deprecated and removed.
  // Default native fetch will be used in Edge environments.

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
