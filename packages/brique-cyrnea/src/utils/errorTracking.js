// packages/brique-cyrnea/utils/errorTracking.js

/**
 * Système de tracking d'erreurs avec Axiom + LogLayer
 * Compatible avec l'infrastructure existante
 */

class ErrorTracker {
  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.axiomEndpoint = import.meta.env.VITE_AXIOM_ENDPOINT;
    this.logLayer = window.logLayer; // Supposé injecté par le backend
    this.errorQueue = [];
    this.isOnline = navigator.onLine;

    // Écouter les changements de connexion
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  /**
   * Track une erreur avec contexte enrichi
   */
  trackError(error, context = {}) {
    const errorData = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      context: {
        ...context,
        appVersion: import.meta.env.VITE_APP_VERSION || "1.0.0",
        buildTime: import.meta.env.VITE_BUILD_TIME,
        environment: import.meta.env.MODE,
      },
    };

    // En développement, log dans console
    if (this.isDevelopment) {
      console.group("🚨 Error Tracked");
      console.error(error);
      console.debug("Context:", context);
      console.debug("Error Data:", errorData);
      console.groupEnd();
    }

    // Ajouter à la queue pour envoi
    this.errorQueue.push(errorData);

    // Envoyer immédiatement si online
    if (this.isOnline) {
      this.sendToAxiom(errorData);
    }

    // Envoyer vers LogLayer si disponible
    if (this.logLayer) {
      this.sendToLogLayer(errorData);
    }
  }

  /**
   * Track une action utilisateur pour contexte
   */
  trackAction(action, data = {}) {
    const actionData = {
      timestamp: new Date().toISOString(),
      type: "user_action",
      action,
      data,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      url: window.location.href,
    };

    if (this.isDevelopment) {
      console.debug("📊 Action Tracked:", actionData);
    }

    // LogLayer pour les actions utilisateur
    if (this.logLayer) {
      this.sendToLogLayer(actionData);
    }
  }

  /**
   * Track une performance metric
   */
  trackPerformance(metric, value, context = {}) {
    const perfData = {
      timestamp: new Date().toISOString(),
      type: "performance",
      metric,
      value,
      context,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
    };

    if (this.isDevelopment) {
      console.debug("⚡ Performance Tracked:", perfData);
    }

    if (this.logLayer) {
      this.sendToLogLayer(perfData);
    }
  }

  /**
   * Envoyer vers Axiom (edge function)
   */
  async sendToAxiom(data) {
    if (!this.axiomEndpoint) return;

    try {
      await fetch(this.axiomEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn("Failed to send to Axiom:", err);
      // Garder dans la queue pour retry plus tard
    }
  }

  /**
   * Envoyer vers LogLayer
   */
  sendToLogLayer(data) {
    if (!this.logLayer?.log) return;

    try {
      this.logLayer.log(data);
    } catch (err) {
      console.warn("Failed to send to LogLayer:", err);
    }
  }

  /**
   * Vider la queue d'erreurs en attente
   */
  async flushQueue() {
    const errors = [...this.errorQueue];
    this.errorQueue = [];

    for (const error of errors) {
      await this.sendToAxiom(error);
    }
  }

  /**
   * Obtenir l'ID utilisateur courant
   */
  getCurrentUserId() {
    // Essayer plusieurs sources pour l'ID utilisateur
    // Migration vers Entity-Service Pattern
    if (window.currentUser?.user_id) return window.currentUser.user_id;
    if (window.currentUser?.id) return window.currentUser.id;
    if (localStorage.getItem("inseme_user_id")) return localStorage.getItem("inseme_user_id");
    return this.getSessionId();
  }

  /**
   * Obtenir/générer l'ID de session
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem("inseme_session_id");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem("inseme_session_id", sessionId);
    }
    return sessionId;
  }

  /**
   * Configurer le tracking global des erreurs non capturées
   */
  setupGlobalErrorHandling() {
    // Erreurs JavaScript
    window.addEventListener("error", (event) => {
      this.trackError(event.error || new Error(event.message), {
        source: "global_error_handler",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Promesses rejetées non gérées
    window.addEventListener("unhandledrejection", (event) => {
      this.trackError(event.reason || new Error("Unhandled Promise Rejection"), {
        source: "unhandled_promise_rejection",
        promise: event.promise,
      });
    });
  }

  /**
   * Wrapper pour les fonctions async avec tracking d'erreurs
   */
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        const result = await fn(...args);
        this.trackAction(`${fn.name}_success`, { context, args });
        return result;
      } catch (error) {
        this.trackError(error, {
          source: "async_wrapper",
          functionName: fn.name,
          context,
          args,
        });
        throw error;
      }
    };
  }
}

// Instance singleton
export const errorTracker = new ErrorTracker();

// Hook React pour le tracking
export function useErrorTracking() {
  const trackError = (error, context) => {
    errorTracker.trackError(error, context);
  };

  const trackAction = (action, data) => {
    errorTracker.trackAction(action, data);
  };

  const trackPerformance = (metric, value, context) => {
    errorTracker.trackPerformance(metric, value, context);
  };

  return { trackError, trackAction, trackPerformance };
}

// Initialiser automatiquement en production
if (!import.meta.env.DEV) {
  errorTracker.setupGlobalErrorHandling();
}
