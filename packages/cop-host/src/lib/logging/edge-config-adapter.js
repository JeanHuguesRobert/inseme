/**
 * packages/cop-host/src/lib/logging/edge-config-adapter.js
 * Adaptateur Edge Function pour la configuration du logger Axiom
 * Suit le pattern de cop-host/src/config
 */

/* eslint-env deno */

import { getConfig } from "../../config/instanceConfig.edge.js";

/**
 * Adaptateur qui implémente l'interface générique pour les Edge Functions
 */
export class EdgeConfigAdapter {
  /**
   * Récupère une valeur de configuration depuis instanceConfig
   */
  getConfig(key, fallback = undefined) {
    return getConfig(key, fallback);
  }

  /**
   * Récupère une variable d'environnement (compatibilité)
   */
  getenv(key) {
    try {
      if (typeof globalThis !== "undefined" && globalThis.Deno) {
        return globalThis.Deno.env.get(key);
      } else if (typeof globalThis !== "undefined" && globalThis.process) {
        return globalThis.process.env[key];
      }
    } catch (_e) {
      return undefined;
    }
  }
}

// Export de l'adaptateur par défaut
export const edgeConfigAdapter = new EdgeConfigAdapter();
