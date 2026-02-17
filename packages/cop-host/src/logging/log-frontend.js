/**
 * packages/cop-host/src/logging/log-frontend.js
 * Edge Function pour recevoir les logs du frontend et les envoyer à Axiom
 * Architecture sécurisée : Frontend → Edge Function → Axiom
 */

import { defineEdgeFunction } from "../runtime/edge.js";
import { edgeLogger } from "../lib/logging/edge-logger.js";
import { edgeConfigAdapter } from "../lib/logging/edge-config-adapter.js";
import { setConfigAdapter } from "../lib/logging/edge-logger.js";

// Initialiser l'adaptateur de configuration
setConfigAdapter(edgeConfigAdapter);

export const config = {
  path: "/api/logs",
};

export default defineEdgeFunction(async (request, _context) => {
  const { json, error } = _context.runtime;

  try {
    // Vérifier la méthode HTTP
    if (request.method !== "POST") {
      return error("Method not allowed", 405);
    }

    // Parser le corps de la requête
    const body = await request.json();
    const { level = "info", message, data = {} } = body;

    if (!message) {
      return error("Message is required", 400);
    }

    // Enrichir les données avec des informations contextuelles
    const enrichedData = {
      ...data,
      source: "frontend",
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    };

    // Envoyer le log vers Axiom via le logger edge
    switch (level.toLowerCase()) {
      case "error":
        edgeLogger.error(`[Frontend] ${message}`, enrichedData);
        break;
      case "warn":
      case "warning":
        edgeLogger.warn(`[Frontend] ${message}`, enrichedData);
        break;
      case "debug":
        edgeLogger.info(`[Frontend Debug] ${message}`, enrichedData);
        break;
      case "info":
      default:
        edgeLogger.info(`[Frontend] ${message}`, enrichedData);
        break;
    }

    return json({
      success: true,
      message: "Log received and forwarded to Axiom",
      level,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[LogFrontend] Error processing log request:", err);
    return error(`Failed to process log: ${err.message}`, 500);
  }
});
