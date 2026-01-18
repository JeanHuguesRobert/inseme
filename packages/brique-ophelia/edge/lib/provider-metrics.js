/**
 * packages/brique-ophelia/edge/lib/provider-metrics.js
 * Implementation of provider metrics for in-memory tracking in Edge Functions.
 */

// Use a global variable to persist metrics across requests on the same worker node
// (Works best-effort in Netlify/Deno Edge Functions)
const providerStore = new Map();
let syncHandler = null;

export const providerMetrics = {
  configure: (handler) => {
    syncHandler = handler;
  },

  hasData: () => providerStore.size > 0,

  hydrate: (rows) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const key = `${row.provider}:${row.model}`;
      const metrics = row.metrics || {};
      providerStore.set(key, {
        status: row.status,
        lastSync: Date.now(),
        metrics: {
          consecutiveErrors: 0,
          requestCount: metrics.request_count || 0,
          successCount: metrics.success_count || 0,
          avgResponseTime: metrics.avg_latency || null,
          lastUsed: row.last_checked_at ? new Date(row.last_checked_at).getTime() : null,
          lastError: row.last_error,
        },
      });
    }
  },

  get: (provider, modelName) => {
    const key = `${provider}:${modelName || "default"}`;
    if (!providerStore.has(key)) {
      providerStore.set(key, {
        status: "available",
        lastSync: 0,
        metrics: {
          consecutiveErrors: 0,
          requestCount: 0,
          successCount: 0,
          avgResponseTime: null,
          lastUsed: null,
          lastError: null,
        },
      });
    }
    return providerStore.get(key);
  },

  recordSuccess: (provider, modelName, duration) => {
    const entry = providerMetrics.get(provider, modelName);
    const oldStatus = entry.status;

    entry.status = "available";
    entry.metrics.consecutiveErrors = 0;
    entry.metrics.requestCount++;
    entry.metrics.successCount++;
    entry.metrics.lastUsed = Date.now();
    if (duration) {
      entry.metrics.avgResponseTime = entry.metrics.avgResponseTime
        ? entry.metrics.avgResponseTime * 0.8 + duration * 0.2
        : duration;
    }

    // Heuristic: Sync if status recovered OR heartbeat every 5 minutes
    const now = Date.now();
    if (oldStatus !== "available" || now - (entry.lastSync || 0) > 300000) {
      providerMetrics.triggerSync(provider, modelName, entry);
    }
  },

  recordError: (provider, modelName, error) => {
    const entry = providerMetrics.get(provider, modelName);
    const oldStatus = entry.status;
    const errorMsg = error?.message || String(error);
    const status = error?.status || (errorMsg.match(/\b(\d{3})\b/) || [])[1];

    entry.metrics.consecutiveErrors++;
    entry.metrics.requestCount++;
    entry.metrics.lastUsed = Date.now();
    entry.metrics.lastError = {
      message: errorMsg,
      timestamp: Date.now(),
      status: status ? parseInt(status) : null,
    };

    // Analyse du statut 4xx / 5xx
    if (status) {
      const s = parseInt(status);
      if (s === 429) {
        entry.status = "rate_limited";
        // Tentative de parsing de retry-after
        const retryMatch = errorMsg.match(/(?:retry|wait|try\s+again).*?(\d+)/i);
        entry.metrics.lastError.retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60;
      } else if (s === 401 || s === 403) {
        entry.status = "auth_error";
      } else if (s >= 400 && s < 500) {
        // Autres erreurs 4xx (quota, invalid request, etc)
        if (/quota|balance|credit|insufficient/i.test(errorMsg)) {
          entry.status = "quota_exceeded";
        } else {
          entry.status = "error";
        }
      } else if (s >= 500) {
        entry.status = "degraded";
      }
    } else {
      // Pas de status explicite, on check le message
      if (/rate.?limit/i.test(errorMsg)) {
        entry.status = "rate_limited";
        entry.metrics.lastError.retryAfter = 30;
      } else if (/quota|balance|credit/i.test(errorMsg)) {
        entry.status = "quota_exceeded";
      } else if (entry.metrics.consecutiveErrors >= 3) {
        entry.status = "degraded";
      }
    }

    // Heuristic: Sync immediately if status changed to something worse
    if (entry.status !== oldStatus) {
      providerMetrics.triggerSync(provider, modelName, entry);
    }
  },

  triggerSync: (provider, modelName, entry) => {
    if (syncHandler) {
      // Fire and forget (don't await) to avoid blocking response,
      // but we catch errors to avoid crashing
      try {
        const result = syncHandler(provider, modelName || "default", {
          ...entry,
        });
        if (result && typeof result.then === "function") {
          result.catch((err) => console.error("[ProviderMetrics] Sync failed:", err));
        }
        entry.lastSync = Date.now();
      } catch (e) {
        console.error("[ProviderMetrics] Sync error:", e);
      }
    }
  },

  shouldSkip: (provider, modelName) => {
    const entry = providerMetrics.get(provider, modelName);

    // Si le fournisseur est marqué comme épuisé (quota), on le saute
    if (entry.status === "quota_exceeded" || entry.status === "auth_error") return true;

    // Gestion du Rate Limit
    if (entry.status === "rate_limited") {
      const lastError = entry.metrics.lastError;
      if (lastError && lastError.retryAfter) {
        const retryTime = lastError.timestamp + lastError.retryAfter * 1000;
        if (Date.now() < retryTime) return true;
      }
      // Si le temps est passé, on repasse en available pour retenter
      entry.status = "available";
    }

    // Gestion des erreurs consécutives (Cool down)
    if (entry.metrics.consecutiveErrors >= 5) {
      // On attend 5 minutes après 5 erreurs consécutives
      if (Date.now() - entry.metrics.lastUsed < 300000) return true;
      // Reset partiel après cool down
      entry.metrics.consecutiveErrors = 3;
    }

    return false;
  },
};
