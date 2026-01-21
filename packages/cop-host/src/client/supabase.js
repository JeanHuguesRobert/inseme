/**
 * @inseme/cop-host/client/supabase
 * Client Supabase dynamique avec support multi-instances et logging (Côté Client)
 */
import { createClient } from "@supabase/supabase-js";
import { resolveInstance } from "../lib/instanceResolver.js";
import { getConfig as getInstanceConfig } from "../config/instanceConfig.core.js";

let supabaseInstance = null;
let currentInstanceConfig = null;
let initPromise = null;

/**
 * Crée un client Supabase avec logging
 */
function createLoggingClient(url, anonKey, subdomain = "local", supabase_client = null) {
  const rawClient =
    supabase_client ||
    createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: `sb-${subdomain}-auth`,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });

  return new Proxy(rawClient, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === "function") {
        return (...args) => {
          const startTime = Date.now();
          console.log(`Supabase: Calling ${prop}`, args.length > 0 ? args[0] : "");

          try {
            const result = value.apply(target, args);

            if (result && typeof result.then === "function") {
              return result.then(
                (data) => {
                  const duration = Date.now() - startTime;
                  if (data?.error) {
                    console.error(
                      `Supabase: ${prop} resolved in ${duration}ms Error: ${data.error.message}`
                    );
                    throw new Error(`Supabase error in ${prop}: ${data.error.message}`);
                  } else {
                    console.log(`Supabase: ${prop} resolved in ${duration}ms Success`);
                  }
                  return data;
                },
                (error) => {
                  const duration = Date.now() - startTime;
                  console.error(`Supabase: ${prop} rejected in ${duration}ms`, error);
                  throw error;
                }
              );
            }
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Supabase: ${prop} threw synchronously in ${duration}ms`, error);
            throw error;
          }
        };
      }
      return value;
    },
  });
}

/**
 * Initialise le client Supabase pour l'instance actuelle
 */
export function initSupabaseWithInstance(instanceConfig) {
  if (!instanceConfig.supabase) {
    if (!instanceConfig?.supabaseUrl || !instanceConfig?.supabaseAnonKey) {
      throw new Error("Supabase configuration missing (URL or Anon Key)");
    }
  }

  currentInstanceConfig = instanceConfig;

  const url = instanceConfig.supabaseUrl;
  const key = instanceConfig.supabaseAnonKey;
  const subdomain = instanceConfig.subdomain || "local";

  supabaseInstance = createLoggingClient(url, key, subdomain, instanceConfig.supabase || null);
  instanceConfig.supabase = supabaseInstance;

  // Debug exposing
  if (typeof window !== "undefined") {
    window.__SUPABASE_INSTANCE__ = {
      subdomain: instanceConfig.subdomain,
      displayName: instanceConfig.displayName,
      source: instanceConfig.source,
      supabase: supabaseInstance,
    };
  }

  return supabaseInstance;
}

export async function initializeSupabase(instance = null) {
  return initSupabase(instance);
}

export async function initSupabase(instance = null) {
  if (initPromise) return initPromise;

  // Si déjà initialisé, retourner
  if (supabaseInstance && currentInstanceConfig && !instance) {
    return { supabase: supabaseInstance, instance: currentInstanceConfig };
  }

  initPromise = (async () => {
    const resolvedInstance = instance || (await resolveInstance());

    if (!resolvedInstance.isConfigured && !resolvedInstance.supabaseUrl) {
      console.warn("Initializing Supabase without valid config (likely fallback)");
    }

    const client = initSupabaseWithInstance(resolvedInstance);
    return { supabase: client, instance: resolvedInstance };
  })();

  return initPromise;
}

/**
 * Récupère le client Supabase (doit être initialisé)
 */
export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error("Supabase not initialized. Call initSupabase() first.");
  }
  return supabaseInstance;
}

/**
 * Configure / Instance Accessors
 */
export function getConfig(key, defaultValue = null) {
  return getInstanceConfig(key, defaultValue);
}

export function getInstance() {
  return currentInstanceConfig;
}

export function isSupabaseReady() {
  return supabaseInstance !== null;
}

export function resetSupabase() {
  supabaseInstance = null;
  currentInstanceConfig = null;
  initPromise = null;
}

export { getAllConfigKeys } from "../config/instanceConfig.core.js";
