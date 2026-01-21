// src/common/config/instanceConfig.core.js
// Module de configuration centralisé (lecture seule)

const GLOBAL_CACHE_KEY = "__INSTANCE_DATA_CACHE_V1__";

// Idempotency, singleton, global instance stuff
var init_done = false;
export function inited() {
  return init_done;
}
function set_init_done() {
  if (init_done) {
    // console.log("set_init_done: multiple calls, ignored");
  }
  init_done = true;
}

function getGlobalCache() {
  if (!globalThis[GLOBAL_CACHE_KEY]) {
    globalThis[GLOBAL_CACHE_KEY] = {
      config: null, // { [key]: row }
      inFlight: null,
      loadedAt: 0,
      supabase: null,
      factory: null,
      getenv: null,
      data: {},
    };
  }
  return globalThis[GLOBAL_CACHE_KEY];
}

async function fetchAllRows(supabaseClient) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabaseClient
      .from("instance_config")
      .select("*")
      .order("key", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      const message = error.message || String(error);
      const code = error.code;

      const isConnectivityError =
        message.includes("tcp connect error") ||
        message.includes("error sending request for url") ||
        message.includes("Failed to fetch") ||
        message.includes("fetch failed");

      const isTableMissingError = code === "42P01";

      if (isConnectivityError || isTableMissingError) {
        const cache = getGlobalCache();
        let supabaseUrlStatus = "unknown";
        try {
          const url = cache && cache.getenv ? cache.getenv("SUPABASE_URL") || null : null;
          if (url) {
            try {
              const host = new URL(url).host;
              supabaseUrlStatus = host || "present";
            } catch (_e) {
              supabaseUrlStatus = "present_invalid_url";
            }
          } else {
            supabaseUrlStatus = "missing";
          }
        } catch (_e) {
          supabaseUrlStatus = "error_reading_env";
        }

        console.warn("[instanceConfig] instance_config fetch failed, fallback to env-only config", {
          reason: isConnectivityError ? "connectivity_or_dns" : "table_missing_or_schema",
          errorMessage: message,
          errorCode: code,
          pageFrom: from,
          env: {
            hasFactory: !!(cache && cache.factory),
            hasSupabaseClient: !!(cache && cache.supabase),
            supabaseUrlStatus,
          },
        });
        break;
      }

      throw new Error(`loadConfigTable: ${message}`);
    }

    const rows = data ?? [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const map = Object.create(null);
  for (const row of all) {
    if (row?.key) {
      // On trim la clé et on la stocke en minuscule pour faciliter la recherche
      const k = String(row.key).trim().toLowerCase();
      map[k] = row;
    }
  }
  return map;
}

// Load the instance config from some supabase. Reload if forced.
export async function loadConfigTable(force = false, supabase_config = null) {
  const cache = getGlobalCache();

  // If supabase config provided (url & keys), use them
  if (supabase_config) {
    const { supabaseUrl, supabaseKey } = supabase_config;
    if (supabaseUrl && supabaseKey) {
      console.log("loadConfigTable: using custom supabase_config for instance:", supabaseUrl);

      // Create a new supabase client using the factory
      // We pass the config as options to the factory
      const newClient = cache.factory(cache.admin, {
        supabaseUrl,
        supabaseKey,
      });

      if (newClient) {
        cache.supabase = newClient;
        // We MUST force reload because we changed the instance
        force = true;
        // Clear existing config to avoid using old data while loading
        cache.config = null;
      }
    }
  }

  if (!force && cache.inFlight) {
    console.log("loadConfigTable: already running, return promise");
    return cache.inFlight;
  }

  // If config is already in cache, no need to fetch it again
  if (!force && cache.config) {
    // Defensive: Double check that supabase client instance is really there
    if (cache.supabase) return cache.config;
    console.warn("loadConfigTable: supabase client is null, but config is in cache");
  }

  // Reuse supabase client or create a new (non admin) one
  if (cache.supabase) {
    console.log("loadConfigTable: using existing supabase client");
  } else {
    console.log("loadConfigTable: creating new supabase client");
    cache.supabase = cache.factory(cache.admin, cache.getenv);
    // It should not be null
    if (!cache.supabase) {
      console.warn("loadInstanceConfig: supabase client is null, factory failed, fatal");
      throw new Error("loadInstanceConfig: supabase client is null, factory failed, fatal");
    }
    // Defensive: make sure getSupabase() is ok, ie no exception
    try {
      const supabase = getSupabase();
      // Assert it is the same
      if (supabase !== cache.supabase) {
        console.warn("loadInstanceConfig: getSupabase() returned a different client, fatal");
        throw new Error("loadInstanceConfig: getSupabase() returned a different client, fatal");
      }
    } catch (e) {
      console.warn("loadInstanceConfig: getSupabase() failed, fatal");
      throw e;
    }
  }

  cache.inFlight = (async () => {
    try {
      const map = await fetchAllRows(cache.supabase);
      cache.config = map;
      cache.loadedAt = Date.now();
      cache.forced = force;
      return map;
    } finally {
      cache.inFlight = null;
    }
  })();

  return cache.inFlight;
}

/**
 * Get all entries's name in the instance config as a name table.
 * One should then call getConfig( key ) to get the value.
 */

export function getAllConfigKeys() {
  const cache = getGlobalCache();
  const t = cache.config;
  return t ? Object.keys(t) : [];
}

/**
 * Récupère la valeur d'une clé depuis la table chargée (ou depuis le cache global).
 *
 * @param {string} key
 * @returns {*} value_json si présent, sinon value, sinon undefined
 */
export function getConfig(key, by_default = undefined) {
  if (!key) return by_default;

  const cache = getGlobalCache();

  // 1. Priorité aux variables d'environnement
  if (cache.getenv) {
    const envVal = cache.getenv(key);
    if (envVal !== undefined && envVal !== null && envVal !== "") return envVal;
  }

  // 2. Recherche dans la config chargée depuis Supabase
  const t = cache.config;
  if (t) {
    const kLower = String(key).trim().toLowerCase();
    const row = t[kLower];

    if (row) {
      // Priorité à value_json si présent
      const val =
        row.value_json !== null && row.value_json !== undefined ? row.value_json : row.value;

      if (val !== null && val !== undefined && val !== "") return val;
    }
  }

  return by_default;
}

/** Optionnel: accès au timestamp du cache */
export function getConfigInfo() {
  const cache = getGlobalCache();
  return {
    loadedAt: cache.loadedAt,
    hasConfig: !!cache.config,
    config: cache.config,
    data: cache.data,
    inFlight: !!cache.inFlight,
    supabase: cache.supabase,
    factory: cache.factory,
    getenv: cache.getenv,
  };
}

export function getSupabase() {
  if (!inited()) {
    console.warn("getSupabase: premature call, fatal");
    throw new Error("getSupabase: premature call, fatal");
  }
  const cache = getGlobalCache();
  if (!cache) {
    console.warn("getSupabase: cache is null, fatal");
    throw new Error("getSupabase: cache is null, fatal");
  }
  if (!cache.supabase) {
    console.warn("getSupabase: supabase not initialized, fatal");
    throw new Error("getSupabase: supabase not initialized, fatal");
  }
  return cache.supabase;
}

export function supabaseFactory() {
  if (!inited) {
    console.warn("supabaseFactory: premature call, fatal");
    throw new Error("supabaseFactory: premature call, fatal");
  }
  const cache = getGlobalCache();
  if (!cache) {
    console.warn("supabaseFactory: cache is null, fatal");
    throw new Error("supabaseFactory: cache is null, fatal");
  }
  if (!cache.factory) {
    console.warn("supabaseFactory: factory is null, fatal");
    throw new Error("supabaseFactory: factory is null, fatal");
  }
  return cache.factory;
}

export function setInstanceData(key, val) {
  getGlobalCache().data[key] = val;
}

export function getInstanceData(key) {
  return getGlobalCache().data[key];
}

export async function initializeInstanceCore(supabase, getenv_impl, newSupabase_impl, admin) {
  // This function is called by the runtime specific implementation of initializeInstance()

  // Adapters must be provided
  if (!getenv_impl || !newSupabase_impl) {
    throw new Error("initializeInstanceCore: getenv_impl and newSupabase_impl must be provided");
  }
  // Admin option must be provided
  if (admin === undefined) {
    throw new Error("initializeInstanceCore: admin option must be provided");
  }

  const cache = getGlobalCache();
  cache.admin = admin;
  // Defensive: cache.supabase should not be nullized
  if (supabase) {
    if (cache.supabase && supabase !== cache.supabase) {
      console.warn("initializeInstanceCore: supabase client changed, fatal");
      throw new Error("initializeInstanceCore: supabase client changed, fatal");
    }
    cache.supabase = supabase;
  }
  cache.getenv = getenv_impl;
  cache.factory = newSupabase_impl;
  set_init_done();
  // Returns a supabaseClient factory
  return newSupabase_impl;
}

export async function reloadInstanceConfig() {
  // Valid only if already initialized
  if (!inited()) {
    console.warn("reloadInstanceConfig: not initialized, ignored");
    return false;
  }
  return loadConfigTable(true);
}

export async function loadInstanceConfigCore(force = false, supabase_config = null) {
  // Invalid if not initialized properly
  if (!inited()) {
    console.warn("loadInstanceConfig: initializeInstance() not initialized, fatal");
    throw new Error("loadInstanceConfig: initializeInstance() not initialized, fatal");
  }
  console.log("initializeInstanceCore ok, loading instance config");
  const prev_cache = getGlobalCache();
  // Debug. Make a "by value copy" for future comparison, using keys in cache
  const prev_values = {};
  if (prev_cache) {
    for (const k of Object.keys(prev_cache)) {
      prev_values[k] = prev_cache[k];
    }
  }
  const prev_supabase = prev_cache.supabase;
  const result = await loadConfigTable(force, supabase_config);
  const new_cache = getGlobalCache();
  const new_values = {};
  if (new_cache) {
    for (const k of Object.keys(new_cache)) {
      new_values[k] = new_cache[k];
    }
  }
  const new_supabase = new_cache?.supabase;
  if (prev_supabase && new_supabase !== prev_supabase) {
    if (!new_supabase) {
      console.warn("loadInstanceConfig: supabase client became null, fatal");
      throw new Error("loadInstanceConfig: supabase client became null, fatal");
    }
    console.warn("loadInstanceConfig: supabase client changed, fatal");
    throw new Error("loadInstanceConfig: supabase client changed, fatal");
  }
  // Debug: detect changes, is it the same cache?
  if (prev_cache && prev_cache !== new_cache) {
    // If changed, that's a fatal error, unless first time
    console.warn("loadInstanceConfig: cache changed, fatal");
    throw new Error("loadInstanceConfig: cache changed, fatal");
  }
  // Debug: detect changes, what keys and what previous vs new values
  const changed_keys = [];
  for (const k of Object.keys(new_values)) {
    if (prev_values[k] !== new_values[k]) {
      changed_keys.push(k);
    }
  }
  // Debug: log changed keys
  console.log("loadInstanceConfig: cache changed keys:", changed_keys);
  // Debug: detect changes, log previous vs new values
  for (const k of changed_keys) {
    if (prev_values[k] !== new_values[k]) {
      if (new_values[k] !== null) {
        if (prev_values[k] === null) {
          console.log("loadInstanceConfig: cache value changed (was null), not null, key:", k);
        } else {
          console.log("loadInstanceConfig: cache value changed, was not null, not null, key:", k);
        }
      } else {
        if (prev_values[k] !== null) {
          console.log("loadInstanceConfig: cache value changed (became null), key:", k);
        } else {
          console.log("loadInstanceConfig: cache value changed, null, key:", k);
        }
      }
    }
    // Signal what was null and isn't anymore
    if (prev_values[k] === null && new_values[k] !== null) {
      console.log("loadInstanceConfig: cache changed (was null), key:", k);
    }
    // Signal what was not null and became null
    if (prev_values[k] !== null && new_values[k] === null) {
      console.log("loadInstanceConfig: cache changed (became null), key:", k);
    }
  }

  // Defensive: make sure getSupabase() is ok, ie no exception
  try {
    getSupabase();
  } catch (e) {
    console.warn("loadInstanceConfig: getSupabase() failed, fatal");
    throw e;
  }
  // Defensive: make sure getConfig() is ok, ie no exception
  try {
    getConfig("community_name");
  } catch (e) {
    console.warn("loadInstanceConfig: getConfig() failed, fatal");
    throw e;
  }
  return result;
}

export function getenv(key) {
  // Invalid if not initialized
  if (!inited()) {
    console.warn("instanceConfigCore.getenv: not initialized, fatal");
    throw new Error("InstanceConfigCore.getenv: not initialized, fatal");
  }
  return getGlobalCache().getenv(key);
}

export function getFederationConfig() {
  // TODO: implement federation config
  // Invalid if not initialized
  if (!inited()) {
    console.warn("instanceConfigCore.getFederationConfig: not initialized, fatal");
    throw new Error("instanceConfigCore.getFederationConfig: not initialized, fatal.");
  }
  return {};
}
