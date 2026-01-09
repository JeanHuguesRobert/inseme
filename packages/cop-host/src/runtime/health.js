/**
 * packages/cop-host/src/runtime/health.js
 * Fonction de santé générique pour toutes les applications Inseme.
 * Vérifie la configuration, la connexion Supabase et le statut du runtime.
 */

import { defineEdgeFunction } from "./edge.js";

export const healthHandler = async (request, runtime, context) => {
  const checks = {
    runtime: "ok",
    config: "pending",
    supabase: "pending",
  };

  try {
    // 1. Vérification de la configuration
    const communityName =
      runtime.getConfig("community_name") || runtime.getConfig("SUPABASE_URL");
    checks.config = communityName ? "ok" : "failed";

    // 2. Vérification de Supabase
    const supabase = runtime.getSupabase();
    if (supabase) {
      // On tente une requête simple et légère
      const { error } = await supabase
        .from("_health_check")
        .select("id")
        .limit(1)
        .maybeSingle();
      // On accepte l'erreur 404 (table non existante) car elle prouve que Supabase répond
      // PGRST116: no rows, 42P01: undefined table, PGRST205: schema cache / table not found
      if (
        error &&
        error.code !== "PGRST116" &&
        error.code !== "42P01" &&
        error.code !== "PGRST205"
      ) {
        checks.supabase = `failed (${error.code})`;
      } else {
        checks.supabase = "ok";
      }
    } else {
      checks.supabase = "not_configured";
    }

    const allOk =
      checks.config === "ok" &&
      (checks.supabase === "ok" || checks.supabase === "not_configured");

    return runtime.json(
      {
        status: allOk ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        checks,
        instance: runtime.getConfig("community_name", "unknown"),
        version: "1.0.0",
      },
      allOk ? 200 : 503
    );
  } catch (error) {
    return runtime.error(`Health check failed: ${error.message}`, 500, {
      checks,
    });
  }
};

export default defineEdgeFunction(healthHandler);
