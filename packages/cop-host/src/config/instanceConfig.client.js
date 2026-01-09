/**
 * src\common\config\instanceConfig.client.js
 * Adaptateur client (frontend React) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement côté client et l'initialisation du client Supabase.
 */

import {
  inited,
  initializeInstanceCore,
  loadConfigTable as loadInstanceConfigCore,
} from "./instanceConfig.core.js";
import { createClient } from "@supabase/supabase-js";

// Fonction pour récupérer les variables d'environnement côté client (React)
const getenv = (key) => {
  // import.meta.env est la manière standard d'accéder aux variables d'environnement dans Vite/React
  // Nous utilisons une convention de nommage pour les variables d'environnement
  const envKey = `VITE_${key}`;
  const envKeyUpper = `VITE_${key.toUpperCase()}`;
  return import.meta.env[envKey] || import.meta.env[envKeyUpper] || undefined;
};

// Fonction pour créer une instance Supabase côté client
const createSupabase_Client = (admin = false, options = {}) => {
  const supabaseUrl = getenv("SUPABASE_URL");
  const supabaseAnonKey = getenv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Supabase URL or Anon Key not found in client environment. Supabase client will not be initialized."
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
};

export function newSupabase(admin = false, options = {}) {
  return createSupabase_Client(admin, options);
}

// Initialiser le module de configuration core avec les fonctions spécifiques au client
export async function initializeInstance(
  supabase,
  admin = false,
  options = {}
) {
  if (admin) {
    console.warn("Initializing admin Supabase client.");
    throw new Error(
      "Admin Supabase client initialization is not supported on the client side."
    );
  }
  return await initializeInstanceCore(
    supabase,
    getenv,
    newSupabase,
    admin,
    options
  );
}

export async function loadInstanceConfig(
  force = false,
  supabase_config = null
) {
  if (!inited()) {
    console.warn("loadInstanceConfig: calling initializeInstance()");
    // On utilise le client supabase par défaut si non fourni
    await initializeInstance();
  }
  return await loadInstanceConfigCore(force, supabase_config);
}

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans le frontend
export * from "./instanceConfig.core.js";
