/**
 * packages/cop-host/src/lib/debug.js
 *
 * Système de traçage et de debug pour les briques (Edge & Functions).
 * Permet de collecter des logs et des métriques de performance,
 * et de les inclure dans la réponse JSON si DEBUG=true.
 */

export class DebugTrace {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.logs = [];
    this.startTime = Date.now();
    this.timers = {};

    if (this.enabled) {
      this.log("Debug trace initialized");
    }
  }

  /**
   * Active ou désactive la trace.
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled && this.logs.length === 0) {
      this.log("Debug trace enabled via configuration");
    }
  }

  /**
   * Ajoute une entrée de log à la trace.
   */
  log(message, data = null) {
    // On console.log toujours si DEBUG=true dans l'environnement pour aider au dev
    if (this.enabled) {
      const entry = {
        timestamp: Date.now() - this.startTime,
        message,
      };

      if (data !== null) {
        entry.data = data;
      }

      this.logs.push(entry);
    }

    // Log terminal si activé (utile même si enabled est false pour le moment)
    // On peut utiliser une variable globale ou un check rapide
    if (this.enabled) {
      console.log(`[DEBUG] ${message}`, data || "");
    }
  }

  /**
   * Démarre un chronomètre.
   */
  startTimer(label) {
    if (!this.enabled) return;
    this.timers[label] = Date.now();
  }

  /**
   * Arrête un chronomètre et log la durée.
   */
  stopTimer(label) {
    if (!this.enabled || !this.timers[label]) return;
    const duration = Date.now() - this.timers[label];
    this.log(`Timer [${label}]: ${duration}ms`);
    delete this.timers[label];
    return duration;
  }

  /**
   * Capture une erreur.
   */
  error(message, error) {
    if (!this.enabled) return;
    this.log(`ERROR: ${message}`, {
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }

  /**
   * Retourne l'objet de debug pour inclusion dans le JSON.
   */
  getTrace() {
    if (!this.enabled) return undefined;

    return {
      totalDuration: Date.now() - this.startTime,
      logs: this.logs,
    };
  }
}

/**
 * Helper pour créer une trace à partir des variables d'environnement.
 */
export function createDebugTrace(env) {
  let isDebug = false;

  if (env && typeof env.get === "function") {
    isDebug = env.get("DEBUG") === "true";
  } else if (typeof process !== "undefined" && process.env) {
    isDebug = process.env.DEBUG === "true";
  }

  return new DebugTrace(isDebug);
}
