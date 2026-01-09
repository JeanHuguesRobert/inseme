import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../../../../packages/cop-host/src/config/instanceConfig.client.js";

// On tente de récupérer depuis le Vault, sinon depuis les env vars
const supabaseUrl =
  getConfig("SUPABASE_URL") || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  getConfig("SUPABASE_ANON_KEY") || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file or instance_config table."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      storageKey: "inseme-auth-token",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
