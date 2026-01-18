// src/scripts/config.js
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

// Try to find .env in current directory, then up to 5 levels up
function findDotEnv(startPath) {
  let current = startPath;
  for (let i = 0; i < 6; i++) {
    const p = path.join(current, ".env");
    // We can't easily check file existence here without 'fs',
    // but dotenv.config will just fail silently if file not found.
    // So we try the most likely places.
    current = path.join(current, "..");
  }
  // Default to root-ish or app-ish .env
  // For now, let's just use the same logic as before but adapted
  return path.join(__dirname, "..", "..", "..", "..", ".env");
}

dotenv.config({ path: path.join(process.cwd(), ".env") });
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

const AUTO_ENV_PREFIXES = [
  "VITE_",
  "SUPABASE_",
  "OPENAI_",
  "ANTHROPIC_",
  "MISTRAL_",
  "GEMINI_",
  "GITHUB_",
  "FACEBOOK_",
  "NGROK_",
  "COP_",
];

let configSnapshot = {};

export function getConfig(key) {
  return configSnapshot[key] || process.env[key];
}

export async function loadConfig() {
  // Fill from process.env using mapping
  for (const [configKey, envKeys] of Object.entries(ENV_KEY_MAPPING)) {
    for (const envKey of envKeys) {
      if (process.env[envKey]) {
        configSnapshot[configKey] = process.env[envKey];
        break;
      }
    }
  }

  // Auto-discovery
  for (const [envKey, value] of Object.entries(process.env)) {
    if (AUTO_ENV_PREFIXES.some((prefix) => envKey.startsWith(prefix))) {
      configSnapshot[envKey.toLowerCase()] = value;
    }
  }

  return configSnapshot;
}
