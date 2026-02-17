/**
 * packages/cop-host/src/lib/frontend-logger.js
 * Client frontend léger pour envoyer les logs via Edge Function sécurisée
 * Utilise l'architecture : Frontend → /api/logs → Axiom
 */

/**
 * Logger frontend sécurisé via Edge Function
 */
class FrontendLogger {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "/api/logs";
    this.enabled = options.enabled !== false; // Activé par défaut
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 5000; // 5 secondes
    this.queue = [];
    this.flushTimer = null;
  }

  /**
   * Envoyer un log immédiatement
   */
  async log(level, message, data = {}) {
    if (!this.enabled) return;

    const logEntry = {
      level,
      message,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logEntry),
      });

      if (!response.ok) {
        console.warn("[FrontendLogger] Failed to send log:", response.status);
      }
    } catch (err) {
      console.warn("[FrontendLogger] Error sending log:", err.message);
    }
  }

  /**
   * Ajouter un log à la file d'attente (batch processing)
   */
  enqueue(level, message, data = {}) {
    if (!this.enabled) return;

    this.queue.push({
      level,
      message,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Vider la file d'attente
   */
  async flush() {
    if (this.queue.length === 0) return;

    const logs = [...this.queue];
    this.queue = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Envoyer les logs en batch
    try {
      await Promise.all(
        logs.map((log) =>
          fetch(this.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(log),
          })
        )
      );
    } catch (err) {
      console.warn("[FrontendLogger] Error flushing logs:", err.message);
    }
  }

  // Méthodes de commodité
  info(message, data) {
    this.log("info", message, data);
  }

  warn(message, data) {
    this.log("warn", message, data);
  }

  error(message, data) {
    this.log("error", message, data);
  }

  debug(message, data) {
    this.log("debug", message, data);
  }

  // Méthodes batch (pour les logs fréquents)
  infoBatch(message, data) {
    this.enqueue("info", message, data);
  }

  warnBatch(message, data) {
    this.enqueue("warn", message, data);
  }

  errorBatch(message, data) {
    this.enqueue("error", message, data);
  }

  debugBatch(message, data) {
    this.enqueue("debug", message, data);
  }
}

// Instance singleton par défaut
const defaultLogger = new FrontendLogger();

// Export de la classe et de l'instance par défaut
export { FrontendLogger };
export default defaultLogger;

// Export des méthodes de commodité
export const logFrontend = {
  info: (message, data) => defaultLogger.info(message, data),
  warn: (message, data) => defaultLogger.warn(message, data),
  error: (message, data) => defaultLogger.error(message, data),
  debug: (message, data) => defaultLogger.debug(message, data),
  infoBatch: (message, data) => defaultLogger.infoBatch(message, data),
  warnBatch: (message, data) => defaultLogger.warnBatch(message, data),
  errorBatch: (message, data) => defaultLogger.errorBatch(message, data),
  debugBatch: (message, data) => defaultLogger.debugBatch(message, data),
  flush: () => defaultLogger.flush(),
};
