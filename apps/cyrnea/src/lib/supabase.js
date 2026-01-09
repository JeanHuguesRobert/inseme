import { createClient } from "@supabase/supabase-js";

// Utilise les variables d'environnement directement pour l'initialisation initiale
// Le Vault pourra écraser ces valeurs plus tard si nécessaire
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase credentials missing. Please check your .env file or Vite configuration."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      storageKey: "cyrnea-auth-token",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
