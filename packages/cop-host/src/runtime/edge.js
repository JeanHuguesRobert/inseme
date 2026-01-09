/**
 * packages/cop-host/src/runtime/edge.js
 * Helper universel pour les Edge Functions Inseme.
 * Gère le CORS, le chargement du Vault, la résolution d'instance et la gestion d'erreurs.
 */

import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
  newSupabase,
  getSQL,
  getAllConfigKeys,
  getConfigInfo,
} from "../config/instanceConfig.edge.js";
import {
  substituteVariables,
  getCommonVariables,
  substituteWithInstanceConfig,
} from "../lib/template.js";
import { createDebugTrace } from "../lib/debug.js";
import { Contract } from "../lib/contract.js";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Ophelia-Instance",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Expose-Headers":
    "X-Ophelia-Instance, X-Ophelia-Instance-Name, X-Ophelia-Supabase-URL, X-Ophelia-Supabase-Anon-Key, X-Ophelia-Instance-Error",
};

// --- Multi-instance resolution constants ---
const BASE_DOMAINS = ["lepp.fr", "kudocracy.org", "inseme.org"];
const IGNORED_SUBDOMAINS = [
  "www",
  "app",
  "api",
  "admin",
  "staging",
  "preview",
  "platform",
];

/**
 * Extracts the subdomain from the request host.
 * @param {string} host
 * @returns {string|null}
 */
function extractSubdomainFromHost(host) {
  if (!host) return null;

  // Localhost or IP = no subdomain
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes("localhost:")
  ) {
    return null;
  }

  // Check each base domain
  for (const baseDomain of BASE_DOMAINS) {
    if (host.endsWith(`.${baseDomain}`)) {
      const subdomain = host.replace(`.${baseDomain}`, "");
      // Ignore system subdomains
      if (!IGNORED_SUBDOMAINS.includes(subdomain)) {
        return subdomain;
      }
    }
  }

  return null;
}

/**
 * Looks up an instance in the registry by subdomain.
 * @param {string} subdomain
 * @returns {Promise<Object|null>}
 */
async function lookupInstanceInRegistry(subdomain) {
  // We need a supabase client for the Hub/Registry
  // loadInstanceConfig must have been called at least once to init the factory
  const supabase = getSupabase();
  if (!supabase) return null;

  // Try the RPC function first
  const { data, error } = await supabase.rpc("get_instance_by_subdomain", {
    p_subdomain: subdomain,
  });

  if (error) {
    // Fallback to direct query if RPC doesn't exist (code 42883)
    if (error.code === "42883") {
      const { data: directData } = await supabase
        .from("instance_registry")
        .select(
          "subdomain, display_name, supabase_url, supabase_anon_key, instance_type, metadata"
        )
        .eq("subdomain", subdomain)
        .eq("status", "active")
        .single();

      return directData;
    }
    console.error(`[cop-host] Registry lookup error for ${subdomain}:`, error);
    return null;
  }

  return data;
}

/**
 * Edge Function Middleware for Dynamic Instance Resolution.
 * Extracts the subdomain from the URL or query params, looks up the target instance
 * in the Hub registry, and reloads the global configuration.
 *
 * @param {Request} request
 * @param {Object} context
 * @returns {Promise<Response|undefined>} Returns a Response if resolution fails or undefined to continue
 */
export async function handleInstanceResolution(request, context) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;

  // 1. Priority: URL parameter ?instance=xxx (for dev/test)
  let subdomain = url.searchParams.get("instance");

  // 2. Subdomain extraction
  if (!subdomain) {
    subdomain = extractSubdomainFromHost(host);
  }

  if (!subdomain) {
    console.log(`[cop-host] No subdomain detected for host: ${host}`);
    return undefined; // Continue with default instance
  }

  try {
    // Ensure we are initialized with Hub config first (to access registry)
    await loadInstanceConfig();

    console.log(`[cop-host] Resolving instance for subdomain: ${subdomain}`);
    const instance = await lookupInstanceInRegistry(subdomain);

    if (!instance) {
      console.warn(`[cop-host] Instance not found for subdomain: ${subdomain}`);
      return undefined;
    }

    console.log(
      `[cop-host] Instance resolved: ${instance.display_name} (${instance.subdomain})`
    );

    // 3. Reload configuration with target instance credentials
    await loadInstanceConfig(true, {
      supabaseUrl: instance.supabase_url,
      supabaseKey: instance.supabase_anon_key,
    });

    // We don't return a Response here because this is used as a "setup" middleware
    // but the caller might want to inject headers in the final response.
    // In Netlify Edge Functions, we can't easily "inject" headers into the next step
    // without returning a Response, but instance-resolver.js is usually a top-level
    // function that returns the result of handleInstanceResolution.
    // If we return undefined, the caller continues.
    return undefined;
  } catch (error) {
    console.error("[cop-host] handleInstanceResolution failed:", error);
    return undefined;
  }
}

/**
 * Encapsule une fonction Edge pour injecter les comportements standards.
 * @param {Function} handler - La logique de la fonction (request, runtime, context)
 */
export function defineEdgeFunction(handler) {
  Contract.require(typeof handler === "function", "Handler must be a function");

  return async (request, context) => {
    // Gestion automatique du CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }

    // Accès aux variables d'environnement (Netlify.env ou Deno.env)
    const env = {
      get: (key) => {
        try {
          if (typeof Netlify !== "undefined" && Netlify.env)
            return Netlify.env.get(key);
        } catch (_e) {}
        try {
          if (typeof Deno !== "undefined" && Deno.env) return Deno.env.get(key);
        } catch (_e) {}
        return undefined;
      },
    };

    // Initialisation de la trace de debug (désactivée par défaut, sera activée après loadInstanceConfig si DEBUG=true)
    const debug = createDebugTrace(env);

    try {
      // 1. Initialisation automatique de la configuration (Vault)
      debug.startTimer("loadInstanceConfig");
      await loadInstanceConfig();
      debug.stopTimer("loadInstanceConfig");

      // Activation du debug si configuré dans l'instance
      if (getConfig("DEBUG") === "true" || getConfig("DEBUG") === true) {
        debug.setEnabled(true);
      }

      // POST-CONDITION: Instance configuration must be loaded
      Contract.ensure(
        getConfig("community_name") || getConfig("SUPABASE_URL"),
        "Instance configuration failed to load"
      );

      // 2. Préparation du runtime injecté
      const runtime = {
        debug,
        getConfig: (key, defaultValue) => getConfig(key, defaultValue),
        getAllConfigKeys: () => getAllConfigKeys(),
        getConfigInfo: () => getConfigInfo(),
        getSupabase: () => getSupabase(),
        newSupabase: (admin, options) => newSupabase(admin, options),
        sql: getSQL(),

        // Helper pour les réponses JSON avec CORS et Debug
        json: (data, status = 200, extraHeaders = {}) => {
          const body = { ...data };
          if (debug.enabled) {
            body._debug = debug.getTrace();
          }
          return new Response(JSON.stringify(body), {
            status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
              ...extraHeaders,
            },
          });
        },

        // Helper pour les erreurs
        error: (message, status = 500, extraData = {}) => {
          const body = { error: message, ...extraData };
          if (debug.enabled) {
            body._debug = debug.getTrace();
          }
          return new Response(JSON.stringify(body), {
            status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
            },
          });
        },

        // Templates helpers
        template: {
          substitute: (text, vars) => substituteVariables(text, vars),
          commonVars: () => getCommonVariables(),
          substituteWithConfig: (text, extraVars) =>
            substituteWithInstanceConfig(text, extraVars),
        },
      };

      // 3. Exécution du handler
      debug.startTimer("handler");
      const response = await handler(request, runtime, context);
      debug.stopTimer("handler");

      // POST-CONDITION: Response check
      Contract.ensure(
        response instanceof Response,
        "Edge handler must return a Response object"
      );

      return response;
    } catch (error) {
      debug.error("Edge Function Error", error);
      console.error("[cop-host] Edge Function Error:", error);

      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error.message,
          _debug: debug.enabled ? debug.getTrace() : undefined,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
  };
}
