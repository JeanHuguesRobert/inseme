/**
 * packages/brique-ophelia/node/node-logger.js
 * Logger universel pour les fonctions Node.js Inseme
 * Utilise LogLayer + Axiom avec optimisation production/dev
 * Compatible avec l'environnement Node.js (Deno/Edge)
 */

import { LogLayer, ConsoleTransport } from "loglayer";
import { AxiomTransport } from "@loglayer/transport-axiom";
import { Axiom } from "@axiomhq/js";
import { serializeError } from "serialize-error";
import { getConfig } from "../../config/instanceConfig.backend.js";

const isProd = process.env.NODE_ENV === "production";

// 1. Initialisation du client Axiom uniquement en production
let axiomClient = null;

if (isProd) {
  // Check if all required Axiom config parameters are set
  const axiomToken = getConfig("AXIOM_TOKEN");
  const axiomOrgId = getConfig("AXIOM_ORG_ID");
  const axiomDataset = getConfig("AXIOM_DATASET");

  if (axiomToken && axiomOrgId && axiomDataset) {
    // All required parameters are set, initialize Axiom
    try {
      axiomClient = new Axiom({
        token: axiomToken,
        orgId: axiomOrgId,
      });
    } catch (error) {
      console.error("[NodeLogger] Failed to initialize Axiom client:", error);
      axiomClient = null;
    }
  } else if (axiomToken || axiomOrgId || axiomDataset) {
    // Partial configuration - warn the user
    const missing = [];
    if (!axiomToken) missing.push("AXIOM_TOKEN");
    if (!axiomOrgId) missing.push("AXIOM_ORG_ID");
    if (!axiomDataset) missing.push("AXIOM_DATASET");

    console.warn(
      `[NodeLogger] Partial Axiom configuration detected. Missing: ${missing.join(", ")}. Axiom logging disabled.`
    );
  }
}

// 2. Configuration des transports
const transports = [
  new ConsoleTransport({
    logger: console,
  }),
];

// Ajouter le transport Axiom uniquement en production et si le client est disponible
if (isProd && axiomClient) {
  const dataset = getConfig("AXIOM_DATASET");

  transports.push(
    new AxiomTransport({
      logger: axiomClient,
      dataset: dataset,
      onError: (error) => {
        console.error("[NodeLogger] Failed to send log to Axiom:", error);
      },
      consoleDebug: false, // Pas de debug console en production
    })
  );
}

// 3. Initialisation de LogLayer avec la bonne configuration
const log = new LogLayer({
  errorSerializer: serializeError,
  transport: transports.length === 1 ? transports[0] : transports,
});

// 4. Export specialized logging methods for Node.js functions
export const nodeLogger = {
  // Generic logging methods
  info: (message, data = {}) => {
    log.info(message, {
      ...data,
      environment: isProd ? "production" : "development",
      runtime: "nodejs",
      timestamp: new Date().toISOString(),
    });
  },

  warn: (message, data = {}) => {
    log.warn(message, {
      ...data,
      environment: isProd ? "production" : "development",
      runtime: "nodejs",
      timestamp: new Date().toISOString(),
    });
  },

  error: (message, data = {}) => {
    log.error(message, {
      ...data,
      environment: isProd ? "production" : "development",
      runtime: "nodejs",
      timestamp: new Date().toISOString(),
    });
  },

  // Node.js function specific logging
  function: (functionName, message, data = {}) => {
    log.info(`[${functionName}] ${message}`, {
      ...data,
      source: functionName,
      category: "node-function",
      runtime: "nodejs",
      environment: isProd ? "production" : "development",
    });
  },

  // Brique-specific logging
  brique: (briqueId, functionName, message, data = {}) => {
    log.info(`[${briqueId}-${functionName}] ${message}`, {
      ...data,
      briqueId: briqueId,
      functionName: functionName,
      source: "brique-function",
      category: "brique",
      runtime: "nodejs",
      environment: isProd ? "production" : "development",
    });
  },

  // API logging
  api: (method, path, data = {}) => {
    log.info(`API ${method} ${path}`, {
      ...data,
      method: method,
      path: path,
      source: "api",
      category: "http",
      runtime: "nodejs",
      environment: isProd ? "production" : "development",
    });
  },

  // Database logging
  database: (operation, table, data = {}) => {
    log.info(`DB ${operation} on ${table}`, {
      ...data,
      operation: operation,
      table: table,
      source: "database",
      category: "database",
      runtime: "nodejs",
      environment: isProd ? "production" : "development",
    });
  },

  // Performance logging
  performance: (operation, duration, data = {}) => {
    log.info(`Performance: ${operation}`, {
      ...data,
      operation: operation,
      duration: duration,
      source: "performance",
      category: "performance",
      runtime: "nodejs",
      environment: isProd ? "production" : "development",
    });
  },
};

// Export the raw log for advanced usage
export { log };

/**
 * Helper to automatically log Node.js function execution
 * Usage: await logFunctionExecution('MyFunction', async () => { ... });
 */
export async function logFunctionExecution(functionName, fn, additionalData = {}) {
  const startTime = Date.now();

  nodeLogger.function(functionName, "START", {
    ...additionalData,
    phase: "start",
  });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    nodeLogger.function(functionName, "SUCCESS", {
      ...additionalData,
      phase: "success",
      duration: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    nodeLogger.error(`${functionName} ERROR`, {
      ...additionalData,
      phase: "error",
      duration: duration,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });

    throw error;
  }
}

/**
 * Helper to create a wrapped function with automatic logging
 * Usage: export default withLogging('MyFunction', myHandler, { briqueId: 'my-brique' });
 */
export function withLogging(functionName, handler, options = {}) {
  return async function (...args) {
    return await logFunctionExecution(functionName, () => handler.apply(this, args), {
      functionName: functionName,
      ...options,
    });
  };
}
