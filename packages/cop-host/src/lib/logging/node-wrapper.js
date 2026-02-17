/**
 * packages/brique-ophelia/node/node-wrapper.js
 * Wrapper universel pour les fonctions Node.js avec logging Axiom intégré
 * Similaire à edge-wrapper.js mais adapté pour l'environnement Node.js
 */

import { nodeLogger, logFunctionExecution, withLogging } from "./node-logger.js";

/**
 * Définit une fonction Node.js avec logging automatique
 * @param {Function} handler - La fonction handler à wrapper
 * @param {Object} options - Options de logging
 * @param {string} options.name - Nom de la fonction
 * @param {boolean} options.logRequest - Logger les requêtes (défaut: true)
 * @param {boolean} options.logResponse - Logger les réponses (défaut: true)
 * @param {boolean} options.logErrors - Logger les erreurs (défaut: true)
 * @param {Object} options.defaultLogData - Données par défaut pour les logs
 * @returns {Function} - La fonction wrapper avec logging
 */
export function defineNodeFunctionWithLogging(handler, options = {}) {
  const {
    name = "UnknownFunction",
    logRequest = true,
    logResponse = true,
    logErrors = true,
    defaultLogData = {},
  } = options;

  return async function (...args) {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log de début
    if (logRequest) {
      nodeLogger.function(name, "REQUEST", {
        requestId: requestId,
        argsCount: args.length,
        phase: "request",
        ...defaultLogData,
      });
    }

    try {
      // Exécuter le handler
      const result = await handler.apply(this, args);
      const duration = Date.now() - startTime;

      // Log de succès
      if (logResponse) {
        nodeLogger.function(name, "RESPONSE", {
          requestId: requestId,
          duration: duration,
          success: true,
          phase: "response",
          ...defaultLogData,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log d'erreur
      if (logErrors) {
        nodeLogger.error(`${name} ERROR`, {
          requestId: requestId,
          duration: duration,
          success: false,
          phase: "error",
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...defaultLogData,
        });
      }

      throw error;
    }
  };
}

/**
 * Wrapper simple pour les fonctions existantes
 * @param {Function} handler - La fonction à wrapper
 * @param {Object} options - Options de configuration
 * @returns {Function} - La fonction wrapper
 */
export function withNodeLogging(handler, options = {}) {
  return defineNodeFunctionWithLogging(handler, options);
}

/**
 * Helper pour les fonctions de briques avec logging enrichi
 * @param {string} briqueId - ID de la brique
 * @param {string} functionName - Nom de la fonction
 * @param {Function} handler - Handler de la fonction
 * @param {Object} options - Options additionnelles
 * @returns {Function} - La fonction wrapper avec logging brique
 */
export function defineBriqueFunctionWithLogging(briqueId, functionName, handler, options = {}) {
  return defineNodeFunctionWithLogging(handler, {
    name: `${briqueId}-${functionName}`,
    defaultLogData: {
      briqueId: briqueId,
      functionName: functionName,
      category: "brique-function",
    },
    ...options,
  });
}

/**
 * Helper pour les fonctions API avec logging HTTP
 * @param {string} routeName - Nom de la route
 * @param {Function} handler - Handler de la route
 * @param {Object} options - Options additionnelles
 * @returns {Function} - La fonction wrapper avec logging API
 */
export function defineApiFunctionWithLogging(routeName, handler, options = {}) {
  return defineNodeFunctionWithLogging(handler, {
    name: `api-${routeName}`,
    defaultLogData: {
      routeName: routeName,
      category: "api-function",
    },
    ...options,
  });
}

/**
 * Helper pour mesurer les performances
 * @param {string} operation - Nom de l'opération
 * @param {Function} fn - Fonction à mesurer
 * @param {Object} additionalData - Données additionnelles
 * @returns {*} - Résultat de la fonction
 */
export async function measurePerformance(operation, fn, additionalData = {}) {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    nodeLogger.performance(operation, duration, {
      success: true,
      ...additionalData,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    nodeLogger.performance(operation, duration, {
      success: false,
      error: error.message,
      ...additionalData,
    });

    throw error;
  }
}

/**
 * Helper pour les opérations de base de données
 * @param {string} operation - Type d'opération (SELECT, INSERT, UPDATE, DELETE)
 * @param {string} table - Nom de la table
 * @param {Function} fn - Fonction de base de données
 * @param {Object} additionalData - Données additionnelles
 * @returns {*} - Résultat de l'opération
 */
export async function logDatabaseOperation(operation, table, fn, additionalData = {}) {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    nodeLogger.database(operation, table, {
      success: true,
      duration: duration,
      rowsAffected: Array.isArray(result) ? result.length : 1,
      ...additionalData,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    nodeLogger.error(`DB ${operation} ERROR on ${table}`, {
      success: false,
      duration: duration,
      error: error.message,
      ...additionalData,
    });

    throw error;
  }
}

// Export par défaut pour compatibilité
export default {
  defineNodeFunctionWithLogging,
  withNodeLogging,
  defineBriqueFunctionWithLogging,
  defineApiFunctionWithLogging,
  measurePerformance,
  logDatabaseOperation,
};
