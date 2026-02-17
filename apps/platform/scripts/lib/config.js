// scripts/lib/config.js
//
// loadConfig() :
// - lit le vault (instance_config)
// - répare les entrées dont is_secret est NULL uniquement si suspectes
// - aligne le vault sur .env (valeurs explicites + autodécouverte whitelistée)
// - recharge le vault pour retourner un snapshot stable
//
// Politique secrets :
// - si valeur paraît sensible : on force is_secret=true en DB (NULL/false -> true), jamais l'inverse
// - on signale les passages à is_secret=true sans afficher le secret
//
// IMPORTANT .env : évitez "KEY = value" (espaces). Utilisez "KEY=value".

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import process from "node:process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });

// ============================================================================
// 1) MAPPINGS EXPLICITES
// ============================================================================

const ENV_KEY_MAPPING = {
  // App / Netlify
  app_url: ["APP_URL", "VITE_APP_URL", "URL", "DEPLOY_PRIME_URL"],
  app_base_url: ["APP_BASE_URL", "DEPLOY_URL", "URL"],

  // Identité (front/back)
  city_name: ["CITY_NAME", "VITE_CITY_NAME"],
  city_tagline: ["CITY_TAGLINE", "VITE_CITY_TAGLINE"],
  bot_name: ["BOT_NAME", "VITE_BOT_NAME"],
  contact_email: ["CONTACT_EMAIL", "VITE_CONTACT_EMAIL"],
  facebook_page_url: ["FACEBOOK_PAGE_URL", "VITE_FACEBOOK_PAGE_URL"],

  // Map (si vous la stockez en texte)
  map_default_center: ["MAP_DEFAULT_CENTER", "VITE_MAP_DEFAULT_CENTER"],

  // Supabase
  supabase_url: ["SUPABASE_URL", "VITE_SUPABASE_URL"],
  supabase_service_role_key: ["SUPABASE_SERVICE_ROLE_KEY"],
  supabase_anon_key: ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"],
  postgres_url: ["POSTGRES_URL"],
  database_url: ["DATABASE_URL"],

  // Providers IA
  openai_api_key: ["OPENAI_API_KEY"],
  openai_model: ["OPENAI_MODEL", "OPENAI_CHAT_MODEL"],
  openai_moderation_model: ["OPENAI_MODERATION_MODEL"],
  anthropic_api_key: ["ANTHROPIC_API_KEY"],
  anthropic_model: ["ANTHROPIC_MODEL"],
  mistral_api_key: ["MISTRAL_API_KEY"],
  gemini_api_key: ["GEMINI_API_KEY"],
  google_filesearch_api_key: ["GOOGLE_FILESEARCH_API_KEY", "GEMINI_API_KEY"],

  // GitHub
  github_token: ["GITHUB_TOKEN"],
  github_client_id: ["GITHUB_CLIENT_ID"],
  github_client_secret: ["GITHUB_CLIENT_SECRET"],
  github_repo: ["GITHUB_REPO"],

  // Facebook OAuth / App
  facebook_app_id: ["FACEBOOK_APP_ID", "VITE_FACEBOOK_APP_ID"],
  facebook_client_secret: ["FACEBOOK_CLIENT_SECRET"],
  facebook_token: ["FACEBOOK_TOKEN"],

  // Tunnels
  cloudflare_tunnel_token: ["CLOUDFLARE_TUNNEL_TOKEN"],
  cloudflare_domain: ["CLOUDFLARE_DOMAIN"],
  tunnel_url: ["TUNNEL_URL"],
  tunnel_control_secret: ["TUNNEL_CONTROL_SECRET", "NGROK_CONTROL_SECRET"],

  // Ngrok
  ngrok_auth_token: ["NGROK_AUTH_TOKEN"],

  // Ports
  platform_port: ["PLATFORM_PORT", "PORT"],
  proxy_port: ["PROXY_PORT"],

  // Rooms
  bar_room_slug: ["BAR_ROOM_SLUG", "ROOM_SLUG", "VITE_ROOM_SLUG"],

  // Divers (selon votre .env)
  mairie_corte_google_maps_key: ["MAIRIE_CORTE_GOOGLE_MAPS_KEY"],
  brave_search_api_key: ["BRAVE_SEARCH_API_KEY"],
  huggingface_api_key: ["HUGGINGFACE_API_KEY"],
  edenai_key: ["EDENAI_KEY"],
  pinecone_api_key: ["PINECONE_API_KEY"],
  chromatic_project_token: ["CHROMATIC_PROJECT_TOKEN"],
  assistant_cloud_api_key: ["ASSISTANT_CLOUD_API_KEY"],
  assistant_cloud_api_url: ["ASSISTANT_CLOUD_API_URL"],

  // COP
  cop_network_id: ["COP_NETWORK_ID"],
  cop_node_id: ["COP_NODE_ID"],
  cop_base_url: ["COP_BASE_URL"],
};

// ============================================================================
// 2) AUTO-DÉCOUVERTE (whitelist)
// ============================================================================

const AUTO_ENV_PREFIXES = [
  "VITE_",
  "SUPABASE_",
  "OPENAI_",
  "ANTHROPIC_",
  "MISTRAL_",
  "GEMINI_",
  "GOOGLE_",
  "GITHUB_",
  "FACEBOOK_",
  "NGROK_",
  "CLOUDFLARE_",
  "TUNNEL_",
  "BRAVE_",
  "HUGGINGFACE_",
  "GROK_",
  "GROC_",
  "EDENAI_",
  "PINECONE_",
  "CHROMATIC_",
  "ASSISTANT_CLOUD_",
  "COP_",
  "POSTGRES_",
  "DATABASE_",
];

const AUTO_ENV_KEYS = new Set([
  "APP_URL",
  "URL",
  "DEPLOY_URL",
  "DEPLOY_PRIME_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
]);

function hasOwn(obj, k) {
  return Object.prototype.hasOwnProperty.call(obj, k);
}

function isDefinedNonEmpty(v) {
  return v !== null && v !== undefined && String(v) !== "";
}

function shouldAutoIncludeEnvVar(envName) {
  if (AUTO_ENV_KEYS.has(envName)) return true;
  return AUTO_ENV_PREFIXES.some((p) => envName.startsWith(p));
}

function envNameToKey(envName) {
  return envName.toLowerCase();
}

function getEnvRawByName(envName) {
  const v = process.env[envName];
  return isDefinedNonEmpty(v) ? v : null;
}

function parseValue(value, key) {
  if (value === null || value === undefined || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;

  if (/_(?:ms|ttl|days|count|size|limit|max|min|port|zoom)$/i.test(key)) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return value;
}

/**
 * Env explicit = valeurs réellement présentes dans .env (explicites + auto whitelist).
 * Priorité : non-VITE > VITE.
 */
function buildEnvExplicit() {
  const envExplicit = {};

  // 1) Mappings explicites (alias multiples)
  for (const [key, envNames] of Object.entries(ENV_KEY_MAPPING)) {
    for (const envName of envNames) {
      const raw = getEnvRawByName(envName);
      if (raw === null) continue;

      if (hasOwn(envExplicit, key)) {
        const alreadyFromVite = String(envExplicit.__source?.[key] || "").startsWith("VITE_");
        const currentIsVite = envName.startsWith("VITE_");
        if (alreadyFromVite && !currentIsVite) {
          envExplicit[key] = parseValue(raw, key);
          envExplicit.__source[key] = envName;
        }
        continue;
      }

      envExplicit[key] = parseValue(raw, key);
      envExplicit.__source = envExplicit.__source || {};
      envExplicit.__source[key] = envName;
      break;
    }
  }

  // 2) Auto whitelist
  for (const [envName, raw] of Object.entries(process.env)) {
    if (!shouldAutoIncludeEnvVar(envName)) continue;
    if (!isDefinedNonEmpty(raw)) continue;

    let key = envNameToKey(envName);

    if (envName.startsWith("VITE_")) {
      key = envNameToKey(envName.slice(5));
      if (hasOwn(envExplicit, key)) continue; // non-VITE déjà prioritaire
    }

    if (hasOwn(envExplicit, key)) continue;

    envExplicit[key] = parseValue(raw, key);
  }

  delete envExplicit.__source;
  return envExplicit;
}

// ============================================================================
// 3) SUPABASE VAULT
// ============================================================================

let configCache = null;
let vaultChecked = false;
let _supabaseVault = null;

function getSupabaseForVault() {
  if (_supabaseVault) return _supabaseVault;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    _supabaseVault = createClient(url, key, { auth: { persistSession: false } });
  }
  return _supabaseVault;
}

// ============================================================================
// 4) SECRET DETECTION + SAFE LOG
// ============================================================================

function looksLikeJwt(s) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s);
}
function looksLikeBase64ishLong(s) {
  if (s.length < 32) return false;
  if (/\s/.test(s)) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(s);
}
function looksLikeOpenAIKey(s) {
  return /^sk-[A-Za-z0-9]{16,}/.test(s) || /^rk-[A-Za-z0-9]{16,}/.test(s);
}
function looksLikeDbUrl(s) {
  return /^(postgres(ql)?:\/\/|mongodb(\+srv)?:\/\/|mysql:\/\/|mariadb:\/\/|rediss?:\/\/)/i.test(s);
}
function looksLikePrivateKeyBlock(s) {
  return /-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?KEY-----/.test(s);
}

function inferSecretFromKey(key) {
  const k = String(key).toLowerCase();
  const strong = [
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "private_key",
    "service_role",
    "client_secret",
    "signing",
    "hmac",
    "jwt",
  ];
  if (strong.some((t) => k.includes(t))) return true;
  if (k.includes("key")) return true;
  if (k.includes("auth")) return true;
  if (k.includes("database") || k.includes("postgres")) return true;
  return false;
}

function inferSecretFromValue(value) {
  if (value === null || value === undefined) return false;
  const s = String(value);
  if (looksLikeDbUrl(s)) return true;
  if (looksLikePrivateKeyBlock(s)) return true;
  if (looksLikeOpenAIKey(s)) return true;
  if (looksLikeJwt(s)) return true;
  if (looksLikeBase64ishLong(s)) return true;
  if (/^gh[pousr]_[A-Za-z0-9_]{20,}$/.test(s)) return true;
  return false;
}

function isSecret(key, value) {
  return inferSecretFromKey(key) || inferSecretFromValue(value);
}

function maskValue(v) {
  if (v === null || v === undefined) return String(v);
  const s = String(v);
  if (s.length <= 8) return "********";
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

// ============================================================================
// 5) VAULT LOAD / REPAIR / UPSERT
// ============================================================================

async function loadFromVault() {
  const supabase = getSupabaseForVault();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("instance_config")
    .select("key, value, value_json")
    .order("key");

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      console.log("[config] Vault non disponible (table instance_config absente)");
      return {};
    }
    console.warn("[config] Erreur vault:", error.message);
    return {};
  }

  const config = {};
  for (const row of data || []) {
    if (row.value_json !== null && row.value_json !== undefined) {
      config[row.key] = row.value_json;
    } else if (row.value !== null && row.value !== undefined && row.value !== "") {
      config[row.key] = parseValue(row.value, row.key);
    } else {
      config[row.key] = null;
    }
  }

  console.log(`[vault] ${Object.keys(config).length} configs chargées depuis le vault`);
  return config;
}

/**
 * Répare is_secret=NULL uniquement pour les entrées suspectes.
 * Ne touche PAS aux autres NULL (vous les corrigerez à la main).
 */
async function repairNullSecretsIfSuspect() {
  const supabase = getSupabaseForVault();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("instance_config")
    .select("key, value, value_json, is_secret")
    .is("is_secret", null);

  if (error) {
    console.warn("[vault] Erreur lecture NULL secrets:", error.message);
    return;
  }

  const rows = data || [];
  if (rows.length === 0) return;

  const keysToForce = [];
  for (const r of rows) {
    const val =
      r.value_json !== null && r.value_json !== undefined
        ? JSON.stringify(r.value_json)
        : r.value !== null && r.value !== undefined
          ? String(r.value)
          : null;

    if (isSecret(r.key, val)) {
      keysToForce.push(r.key);
    }
  }

  if (keysToForce.length === 0) {
    console.log(`[vault] is_secret=NULL: ${rows.length} lignes, aucune jugée suspecte`);
    return;
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("instance_config")
    .update({ is_secret: true, is_public: false, updated_at: nowIso })
    .in("key", keysToForce);

  if (updErr) {
    console.warn("[vault] Erreur correction NULL->true:", updErr.message);
    return;
  }

  console.warn(
    `[vault][security] is_secret forcé à true pour ${keysToForce.length} clés (anciennement NULL)`
  );
}

async function uploadToVault(vars) {
  const supabase = getSupabaseForVault();
  if (!supabase) return;

  const keys = Object.keys(vars);
  if (keys.length === 0) return;

  console.log(`[vault] Upload de ${keys.length} configs au vault`);

  const { data: existingRows, error: fetchErr } = await supabase
    .from("instance_config")
    .select("key, value, value_json, version, category, is_secret, is_public")
    .in("key", keys);

  if (fetchErr) throw fetchErr;

  const existingByKey = {};
  for (const r of existingRows || []) existingByKey[r.key] = r;

  const nowIso = new Date().toISOString();
  const toUpsert = [];

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let secretForced = 0;

  for (const k of keys) {
    const desired = vars[k];
    const existing = existingByKey[k];

    const incomingIsJson = desired !== null && typeof desired === "object";
    const incomingValue = incomingIsJson ? null : desired == null ? null : String(desired);
    const incomingJson = incomingIsJson ? desired : null;

    const incomingValueStr = incomingIsJson
      ? JSON.stringify(incomingJson)
      : incomingValue !== null
        ? String(incomingValue)
        : null;

    let storedValueStr = null;
    if (existing) {
      const storedIsJson = existing.value_json !== null && existing.value_json !== undefined;
      storedValueStr =
        existing.value !== null && existing.value !== undefined
          ? String(existing.value)
          : storedIsJson
            ? JSON.stringify(existing.value_json)
            : null;
    }

    const changed = !existing || storedValueStr !== incomingValueStr;

    // Politique: NULL/false -> true si suspect
    const suspectSecret = isSecret(k, incomingValueStr);
    const needsSecretForce = suspectSecret && existing?.is_secret !== true;

    if (!changed && !needsSecretForce) {
      skipped++;
      continue;
    }

    const category = existing?.category ?? "general";

    const row = {
      key: k,
      category, // TOUJOURS présent (NOT NULL)
      value: incomingValue,
      value_json: incomingJson,
      updated_at: nowIso,
    };

    if (!existing) {
      row.description = null;
      row.is_secret = suspectSecret;
      row.is_public = !suspectSecret;
      row.previous_value = null;
      row.version = 1;
      row.created_at = nowIso;
      inserted++;
    } else {
      if (changed) {
        row.previous_value = storedValueStr;
        row.version = (existing.version ?? 1) + 1;
      } else {
        row.version = existing.version ?? 1;
      }

      if (needsSecretForce) {
        row.is_secret = true;
        row.is_public = false;
        secretForced++;
        console.warn(
          `[vault][security] is_secret forcé à true pour "${k}" (valeur: ${maskValue(incomingValueStr)})`
        );
      }

      updated++;
    }

    toUpsert.push(row);
  }

  if (toUpsert.length === 0) {
    console.log(`[vault] 0 upsert (tout est déjà à jour). skipped=${skipped}`);
    return;
  }

  const { error: upsertErr } = await supabase
    .from("instance_config")
    .upsert(toUpsert, { onConflict: "key" });

  if (upsertErr) throw upsertErr;

  console.log(
    `[vault] upsert ok: inserted=${inserted}, updated=${updated}, skipped=${skipped}, is_secret_forced=${secretForced}`
  );
}

// ============================================================================
// 6) PUBLIC API
// ============================================================================

export async function loadConfig(forceRefresh = false) {
  if (!forceRefresh && configCache) return configCache;

  // 0) Env explicit (autodécouverte + mappings)
  const envExplicit = buildEnvExplicit();
  console.log(`[config] env explicite: ${Object.keys(envExplicit).length} clés`);

  // 1) Vault
  if (!vaultChecked || forceRefresh) {
    // 1.1) Réparer NULL -> true uniquement si suspect
    await repairNullSecretsIfSuspect();

    // 1.2) Lire config vault
    const dbConfig = await loadFromVault();

    // 2) Aligner .env explicite -> vault
    const to_align_env = [];
    for (const key of Object.keys(envExplicit)) {
      if (!hasOwn(dbConfig, key) || envExplicit[key] !== dbConfig[key]) {
        to_align_env.push(key);
      }
    }

    // 4) Recharger vault après sync pour snapshot stable
    const dbAfter = await loadFromVault();
    configCache = { ...dbAfter, ...envExplicit };

    vaultChecked = true;
  }

  console.log(`[config] ${Object.keys(configCache).length} configs chargées (runtime)`);
  return configCache;
}

export function getConfig(key, defaultValue = undefined) {
  if (configCache && hasOwn(configCache, key)) {
    const v = configCache[key];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  if (defaultValue !== undefined) return defaultValue;
  return null;
}

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL || getConfig("supabase_url");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || getConfig("supabase_service_role_key");
  if (!url || !key) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
  return createClient(url, key, { auth: { persistSession: false } });
}
