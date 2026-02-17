// packages/brique-cyrnea/utils/analytics.js

/**
 * Système d'analytics avec ReactVital existant + tracking personnalisé
 * Focus sur les métriques d'utilisation sans données personnelles
 */

class AnalyticsTracker {
  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.reactVital = window.ReactVital; // Supposé déjà injecté
    this.metrics = {
      pageViews: 0,
      featureUsage: {},
      sessionDuration: 0,
      errors: 0,
      performance: {},
    };
    this.sessionStart = Date.now();
    this.lastActivity = Date.now();

    this.initializeTracking();
  }

  /**
   * Initialiser le tracking
   */
  initializeTracking() {
    // Tracking de l'activité utilisateur
    this.trackActivity();

    // Tracking des performances
    this.trackPerformance();

    // Tracking des visites de pages
    this.trackPageView();

    // Envoyer les métriques périodiquement
    setInterval(() => this.sendMetrics(), 30000); // Toutes les 30 secondes
  }

  /**
   * Tracker l'utilisation d'une fonctionnalité
   */
  trackFeature(feature, data = {}) {
    // Incrémenter le compteur
    this.metrics.featureUsage[feature] = (this.metrics.featureUsage[feature] || 0) + 1;

    const eventData = {
      feature,
      timestamp: Date.now(),
      data,
      sessionId: this.getSessionId(),
    };

    // ReactVital tracking
    if (this.reactVital?.track) {
      this.reactVital.track("feature_used", eventData);
    }

    // Log en développement
    if (this.isDevelopment) {
      console.debug("📊 Feature Tracked:", eventData);
    }

    this.lastActivity = Date.now();
  }

  /**
   * Tracker une vue de page/écran
   */
  trackPageView(screen = null) {
    this.metrics.pageViews++;

    const pageData = {
      screen: screen || window.location.pathname,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      url: window.location.href,
    };

    if (this.reactVital?.track) {
      this.reactVital.track("page_view", pageData);
    }

    if (this.isDevelopment) {
      console.debug("👁️ Page View Tracked:", pageData);
    }
  }

  /**
   * Tracker une erreur
   */
  trackError(error, context = {}) {
    this.metrics.errors++;

    const errorData = {
      message: error.message || String(error),
      context,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
    };

    if (this.reactVital?.track) {
      this.reactVital.track("error", errorData);
    }

    if (this.isDevelopment) {
      console.debug("🚨 Error Tracked:", errorData);
    }
  }

  /**
   * Tracker les performances
   */
  trackPerformance() {
    // Observer les métriques de performance
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "navigation") {
            this.metrics.performance.pageLoad = entry.loadEventEnd - entry.loadEventStart;
          } else if (entry.entryType === "paint") {
            this.metrics.performance[entry.name] = entry.startTime;
          }
        }
      });

      observer.observe({ entryTypes: ["navigation", "paint"] });
    }

    // Observer les métriques Core Web Vitals
    this.trackCoreWebVitals();
  }

  /**
   * Tracker les Core Web Vitals
   */
  trackCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.performance.lcp = lastEntry.startTime;

      if (this.reactVital?.track) {
        this.reactVital.track("lcp", { value: lastEntry.startTime });
      }
    }).observe({ entryTypes: ["largest-contentful-paint"] });

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.metrics.performance.fid = entry.processingStart - entry.startTime;

        if (this.reactVital?.track) {
          this.reactVital.track("fid", { value: entry.processingStart - entry.startTime });
        }
      }
    }).observe({ entryTypes: ["first-input"] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.metrics.performance.cls = clsValue;

      if (this.reactVital?.track) {
        this.reactVital.track("cls", { value: clsValue });
      }
    }).observe({ entryTypes: ["layout-shift"] });
  }

  /**
   * Tracker l'activité utilisateur
   */
  trackActivity() {
    const updateActivity = () => {
      this.lastActivity = Date.now();
    };

    // Écouter les événements utilisateur
    ["click", "scroll", "keydown", "mousemove", "touchstart"].forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  }

  /**
   * Envoyer les métriques accumulées
   */
  sendMetrics() {
    const now = Date.now();
    const sessionDuration = now - this.sessionStart;
    const inactiveTime = Math.max(0, now - this.lastActivity - 30000); // 30s d'inactivité

    const metrics = {
      ...this.metrics,
      sessionDuration,
      inactiveTime,
      timestamp: now,
      sessionId: this.getSessionId(),
    };

    if (this.reactVital?.track) {
      this.reactVital.track("session_metrics", metrics);
    }

    if (this.isDevelopment) {
      console.debug("📈 Metrics Sent:", metrics);
    }
  }

  /**
   * Obtenir l'ID de session
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem("inseme_analytics_session");
    if (!sessionId) {
      sessionId = `analytics_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem("inseme_analytics_session", sessionId);
    }
    return sessionId;
  }

  /**
   * Tracker un événement personnalisé
   */
  trackEvent(eventName, data = {}) {
    const eventData = {
      eventName,
      data,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
    };

    if (this.reactVital?.track) {
      this.reactVital.track(eventName, eventData);
    }

    if (this.isDevelopment) {
      console.debug("🎯 Custom Event Tracked:", eventData);
    }
  }
}

// Instance singleton
export const analytics = new AnalyticsTracker();

// Hook React pour l'analytics
export function useAnalytics() {
  const trackFeature = (feature, data) => {
    analytics.trackFeature(feature, data);
  };

  const trackPageView = (screen) => {
    analytics.trackPageView(screen);
  };

  const trackError = (error, context) => {
    analytics.trackError(error, context);
  };

  const trackEvent = (eventName, data) => {
    analytics.trackEvent(eventName, data);
  };

  return { trackFeature, trackPageView, trackError, trackEvent };
}

// Fonctions utilitaires pour tracking spécifique
export const trackFeatureUsage = {
  // Authentification
  login: () => analytics.trackFeature("auth_login"),
  logout: () => analytics.trackFeature("auth_logout"),
  pseudoChange: () => analytics.trackFeature("auth_pseudo_change"),

  // Navigation
  screenChange: (screen) => analytics.trackFeature("navigation_screen_change", { screen }),

  // Caméra
  cameraOpen: () => analytics.trackFeature("camera_open"),
  cameraCapture: () => analytics.trackFeature("camera_capture"),
  cameraError: (error) => analytics.trackFeature("camera_error", { error }),

  // Chat/Messages
  messageSend: () => analytics.trackFeature("message_send"),
  attachmentSend: () => analytics.trackFeature("attachment_send"),

  // Barman
  barmanLogin: () => analytics.trackFeature("barman_login"),
  barmanAction: (action) => analytics.trackFeature("barman_action", { action }),

  // Jeux
  gameStart: (game) => analytics.trackFeature("game_start", { game }),
  gameEnd: (game, score) => analytics.trackFeature("game_end", { game, score }),

  // Pourboires
  tipSend: (amount) => analytics.trackFeature("tip_send", { amount }),
  tipReceive: (amount) => analytics.trackFeature("tip_receive", { amount }),
};

// Export par défaut
export default analytics;
