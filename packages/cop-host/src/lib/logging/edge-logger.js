/**
 * packages/cop-host/src/lib/logging/edge-logger.js
 * Logger universel pour les Edge Functions Inseme
 * Utilise LogLayer + Axiom avec optimisation production/dev
 * Pattern: client importe l'adaptateur, l'adaptateur implémente l'interface générique
 */

/* eslint-env deno */

import { LogLayer, ConsoleTransport } from "loglayer";
import { AxiomTransport } from "@loglayer/transport-axiom";
import { Axiom } from "@axiomhq/js";
import { serializeError } from "serialize-error";

const isProd =
  (typeof globalThis !== "undefined" &&
    typeof globalThis.Deno !== "undefined" &&
    globalThis.Deno.env.get("DENO_DEPLOYMENT_ID")) ||
  (typeof globalThis !== "undefined" && globalThis.process?.env?.NODE_ENV === "production");

// Instance de l'adaptateur de configuration (injectée par le client)
let configAdapter = null;

// Fonction pour injecter l'adaptateur de configuration
export function setConfigAdapter(adapter) {
  configAdapter = adapter;
}

function getAxiomConfig(key, fallback = undefined) {
  // 1. Try environment variables first (for early initialization)
  let value = undefined;

  // Helper to get environment variable safely
  const getEnv = (envKey) => {
    try {
      if (typeof globalThis !== "undefined" && globalThis.Deno) {
        return globalThis.Deno.env.get(envKey);
      } else if (typeof globalThis !== "undefined" && globalThis.process) {
        return globalThis.process.env[envKey];
      }
    } catch (_e) {
      return undefined;
    }
  };

  value = getEnv(key);
  if (value !== undefined) return value;

  // 2. Try config adapter if available
  if (configAdapter) {
    try {
      value = configAdapter.getConfig(key);
      if (value !== undefined && value !== null) return value;
    } catch (_e) {
      // Config adapter failed, continue with fallback
    }
  }

  // 3. Fallback values
  const fallbacks = {
    AXIOM_TOKEN: undefined,
    AXIOM_DATASET: "kudocracy-logs",
    AXIOM_ORG_ID: undefined,
    NODE_ENV: "development",
  };

  return fallbacks[key] || fallback;
}

// 1. Création du client Axiom (uniquement en production)
let axiomClient = null;
if (isProd) {
  const token = getAxiomConfig("AXIOM_TOKEN");
  if (token) {
    axiomClient = new Axiom({ token });
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
  const dataset = getAxiomConfig("AXIOM_DATASET") || "kudocracy-logs";

  transports.push(
    new AxiomTransport({
      logger: axiomClient,
      dataset: dataset,
      onError: (error) => {
        console.error("[Logger] Failed to send log to Axiom:", error);
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

// 4. Console interception DISABLED to avoid infinite loops
// The redirection creates recursion with LogLayer's internal console usage
// Use edgeLogger methods directly instead of console methods

// 4. Export specialized logging methods for different edge functions
export const edgeLogger = {
  // Generic logging methods
  info: (message, data = {}) => {
    log.info(message, {
      ...data,
      environment: isProd ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  },

  warn: (message, data = {}) => {
    log.warn(message, {
      ...data,
      environment: isProd ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  },

  error: (message, data = {}) => {
    log.error(message, {
      ...data,
      environment: isProd ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  },

  // Edge function specific logging
  gateway: (message, data = {}) => {
    log.info(`[Gateway] ${message}`, {
      ...data,
      source: "Gateway",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  sessions: (message, data = {}) => {
    log.info(`[Sessions] ${message}`, {
      ...data,
      source: "Sessions",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  mcp: (message, data = {}) => {
    log.info(`[MCP] ${message}`, {
      ...data,
      source: "MCP",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  semantic: (message, data = {}) => {
    log.info(`[Semantic] ${message}`, {
      ...data,
      source: "Semantic",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  vector: (message, data = {}) => {
    log.info(`[Vector] ${message}`, {
      ...data,
      source: "Vector",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  prolog: (message, data = {}) => {
    log.info(`[Prolog] ${message}`, {
      ...data,
      source: "Prolog",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  identity: (message, data = {}) => {
    log.info(`[Identity] ${message}`, {
      ...data,
      source: "Identity",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  health: (message, data = {}) => {
    log.info(`[Health] ${message}`, {
      ...data,
      source: "Health",
      category: "edge-function",
      environment: isProd ? "production" : "development",
    });
  },

  // Vocal-specific logging (backward compatibility)
  vocal: (message, data = {}) => {
    log.info(`[Vocal] ${message}`, {
      ...data,
      source: "vocal-system",
      category: "vocal",
      environment: isProd ? "production" : "development",
    });
  },

  talkButton: (message, data = {}) => {
    log.info(`[TalkButton] ${message}`, {
      ...data,
      source: "TalkButton",
      category: "vocal",
      environment: isProd ? "production" : "development",
    });
  },

  voiceHandler: (message, data = {}) => {
    log.info(`[useVoiceHandler] ${message}`, {
      ...data,
      source: "useVoiceHandler",
      category: "vocal",
      environment: isProd ? "production" : "development",
    });
  },

  audioAnalyzer: (message, data = {}) => {
    log.info(`[AudioAnalyzer] ${message}`, {
      ...data,
      source: "AudioAnalyzer",
      category: "vocal",
      environment: isProd ? "production" : "development",
    });
  },

  transcription: (message, data = {}) => {
    log.info(`[Transcription] ${message}`, {
      ...data,
      source: "Transcription",
      category: "vocal",
      environment: isProd ? "production" : "development",
    });
  },
};

// Export the raw log for advanced usage
export { log };

/**
 * Helper to automatically log edge function requests
 * Usage: await logRequest(request, 'Gateway', { additionalData });
 */
export async function logRequest(request, functionName, additionalData = {}) {
  const url = new URL(request.url);
  edgeLogger.info(`${functionName} REQUEST`, {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    userAgent: request.headers.get("user-agent"),
    ...additionalData,
  });
}

/**
 * Helper to automatically log edge function responses
 * Usage: logResponse(response, 'Gateway', { duration: 1200 });
 */
export function logResponse(response, functionName, additionalData = {}) {
  edgeLogger.info(`${functionName} RESPONSE`, {
    status: response.status,
    statusText: response.statusText,
    ...additionalData,
  });
}

/**
 * Helper to log errors with context
 * Usage: logError(error, 'Gateway', { operation: 'transcription' });
 */
export function logError(error, functionName, additionalData = {}) {
  edgeLogger.error(`${functionName} ERROR`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...additionalData,
  });
}
