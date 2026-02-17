/**
 * packages/cop-host/cop-host.logging.config.js
 * Configuration du système de logging pour cop-host
 * Définit les routes et fonctions de logging disponibles
 */

export const loggingConfig = {
  // Edge Functions de logging
  edgeFunctions: [
    {
      name: "log-frontend",
      path: "/api/logs",
      description: "Reçoit les logs du frontend et les transfère à Axiom",
      handler: "./src/logging/log-frontend.js",
      methods: ["POST"],
    },
  ],

  // Configuration par défaut pour les loggers
  defaultConfig: {
    // Backend (Node.js)
    backend: {
      dataset: "kudocracy-logs",
      enableConsole: true,
      enableAxiom: true,
    },

    // Edge Functions
    edge: {
      dataset: "kudocracy-logs",
      enableConsole: true,
      enableAxiom: true,
    },

    // Frontend (via Edge Function)
    frontend: {
      endpoint: "/api/logs",
      batchSize: 10,
      flushInterval: 5000,
      enabled: true,
    },
  },

  // Mapping des niveaux de log
  logLevels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },

  // Enrichissement automatique des logs
  enrichment: {
    // Backend
    backend: {
      include: ["timestamp", "environment", "process_id"],
    },

    // Edge Functions
    edge: {
      include: ["timestamp", "environment", "request_id", "user_agent"],
    },

    // Frontend
    frontend: {
      include: ["timestamp", "url", "user_agent", "session_id"],
    },
  },
};

export default loggingConfig;
