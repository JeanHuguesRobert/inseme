/**
 * packages/cop-host/src/lib/logging/edge-wrapper.js
 * Wrapper universel pour les Edge Functions avec logging intégré
 * Initialise automatiquement l'adaptateur de configuration pour Axiom
 */

import { defineEdgeFunction } from "../../runtime/edge.js";
import { edgeLogger, setConfigAdapter } from "./edge-logger.js";
import { edgeConfigAdapter } from "./edge-config-adapter.js";

// Helper functions pour le logging
async function logRequest(request, functionName, additionalData = {}) {
  const url = new URL(request.url);
  edgeLogger.info(`[${functionName}] Request started`, {
    method: request.method,
    url: url.pathname,
    userAgent: request.headers.get("user-agent"),
    ...additionalData,
  });
}

async function logResponse(response, functionName, duration, additionalData = {}) {
  edgeLogger.info(`[${functionName}] Request completed`, {
    status: response.status,
    duration: `${duration}ms`,
    ...additionalData,
  });
}

async function logError(error, functionName, duration, additionalData = {}) {
  edgeLogger.error(`[${functionName}] Request failed`, {
    error: error.message,
    stack: error.stack,
    duration: `${duration}ms`,
    ...additionalData,
  });
}

/**
 * Définit une Edge Function avec logging automatique
 * @param {Function} handler - La logique de la fonction (request, runtime, context)
 * @param {Object} options - Options de configuration
 * @param {string} options.name - Nom de la fonction pour les logs
 * @param {boolean} options.logRequest - Loguer automatiquement les requêtes (default: true)
 * @param {boolean} options.logResponse - Loguer automatiquement les réponses (default: true)
 * @param {boolean} options.logErrors - Loguer automatiquement les erreurs (default: true)
 * @param {Object} options.defaultLogData - Données par défaut à inclure dans tous les logs
 */
export function defineEdgeFunctionWithLogging(handler, options = {}) {
  const {
    name = "Unknown",
    logRequest: shouldLogRequest = true,
    logResponse: shouldLogResponse = true,
    logErrors: shouldLogErrors = true,
    defaultLogData = {},
  } = options;

  // Initialiser l'adaptateur de configuration pour Axiom
  setConfigAdapter(edgeConfigAdapter);

  return async (request, context) => {
    const startTime = Date.now();

    try {
      // Loguer la requête si demandé
      if (shouldLogRequest) {
        await logRequest(request, name, defaultLogData);
      }

      // Exécuter le handler original
      const response = await handler(request, context, {
        ...context,
        logger: edgeLogger,
        logRequest: (data) => logRequest(request, name, { ...defaultLogData, ...data }),
        logResponse: (data) => logResponse(response, name, { ...defaultLogData, ...data }),
        logError: (error, data) => logError(error, name, { ...defaultLogData, ...data }),
      });

      // Loguer la réponse si demandé
      if (shouldLogResponse) {
        const duration = Date.now() - startTime;
        logResponse(response, name, {
          ...defaultLogData,
          duration: `${duration}ms`,
          responseSize: response.headers.get("content-length") || "unknown",
        });
      }

      return response;
    } catch (error) {
      // Loguer l'erreur si demandé
      if (shouldLogErrors) {
        const duration = Date.now() - startTime;
        logError(error, name, {
          ...defaultLogData,
          duration: `${duration}ms`,
          phase: "handler_execution",
        });
      }

      // Relancer l'erreur pour que le gestionnaire d'erreurs de defineEdgeFunction la traite
      throw error;
    }
  };
}

/**
 * Crée un middleware de logging pour les edge functions existantes
 * @param {Function} edgeFunction - Une edge function existante (déjà wrappée par defineEdgeFunction)
 * @param {Object} options - Options de logging (même format que defineEdgeFunctionWithLogging)
 */
export function withLogging(edgeFunction, options = {}) {
  const {
    name = "Unknown",
    logRequest: shouldLogRequest = true,
    logResponse: shouldLogResponse = true,
    logErrors: shouldLogErrors = true,
    defaultLogData = {},
  } = options;

  return async (request, context) => {
    const startTime = Date.now();

    try {
      // Loguer la requête si demandé
      if (shouldLogRequest) {
        await logRequest(request, name, defaultLogData);
      }

      // Exécuter la fonction originale
      const response = await edgeFunction(request, context);

      // Loguer la réponse si demandé
      if (shouldLogResponse) {
        const duration = Date.now() - startTime;
        logResponse(response, name, {
          ...defaultLogData,
          duration: `${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      // Loguer l'erreur si demandé
      if (shouldLogErrors) {
        const duration = Date.now() - startTime;
        logError(error, name, {
          ...defaultLogData,
          duration: `${duration}ms`,
        });
      }

      // Relancer l'erreur
      throw error;
    }
  };
}

/**
 * Helper pour créer des logs structurés pour les opérations spécifiques
 * @param {string} operation - Nom de l'opération
 * @param {string} functionName - Nom de la fonction
 * @param {Object} data - Données additionnelles
 */
export function logOperation(operation, functionName, data = {}) {
  edgeLogger.info(`${functionName} ${operation}`, {
    operation,
    function: functionName,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Helper pour logger les performances
 * @param {string} operation - Nom de l'opération
 * @param {number} duration - Durée en ms
 * @param {string} functionName - Nom de la fonction
 * @param {Object} data - Données additionnelles
 */
export function logPerformance(operation, duration, functionName, data = {}) {
  edgeLogger.info(`${functionName} PERFORMANCE`, {
    operation,
    duration: `${duration}ms`,
    function: functionName,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Helper pour logger les appels API externes
 * @param {string} apiName - Nom de l'API
 * @param {string} method - Méthode HTTP
 * @param {string} url - URL de l'API
 * @param {number} duration - Durée en ms
 * @param {number} status - Status code
 * @param {string} functionName - Nom de la fonction
 */
export function logApiCall(apiName, method, url, duration, status, functionName) {
  edgeLogger.info(`${functionName} API CALL`, {
    api: apiName,
    method,
    url,
    duration: `${duration}ms`,
    status,
    function: functionName,
    timestamp: new Date().toISOString(),
  });
}

// Export par défaut pour compatibilité
export default defineEdgeFunctionWithLogging;
