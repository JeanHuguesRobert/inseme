/**
 * packages/brique-ophelia/edge/lib/provider-metrics.js
 * Implementation of provider metrics using Magistral's NodeRegistry.
 */

import { DEFAULT_EXHAUSTION_TTL_MS, NodeRegistry } from "../../../magistral/src/router.js";

// Global registry instance (persisted across requests in same worker)
export const registry = new NodeRegistry();
let syncHandler = null;

export const providerMetrics = {
  configure: (handler) => {
    syncHandler = handler;
  },

  hasData: () => registry.isDirty(),

  hydrate: (rows) => {
    if (!Array.isArray(rows)) return;
    // Map Supabase rows to NodeRegistry format
    const nodes = rows.map((row) => ({
      id: `${row.provider}:${row.model || "default"}`,
      status: row.status,
      requests: row.metrics?.request_count || 0,
      successes: row.metrics?.success_count || 0,
      failures: 0,
      totalLatencyMs: (row.metrics?.avg_latency || 0) * (row.metrics?.success_count || 0),
      lastError: row.last_error,
      exhaustedAt: null, // We'd need to persist this if we want strict continuity
    }));
    registry.loadFrom({ nodes });
  },

  get: (provider, modelName) => {
    const id = `${provider}:${modelName || "default"}`;
    const node = registry.get(id);

    // Adapt NodeRegistry format to old providerMetrics format for compatibility
    return {
      status: node.status === "active" ? "available" : node.status,
      lastSync: 0, // managed internally
      metrics: {
        consecutiveErrors: 0, // NodeRegistry tracks failures but not consecutive explicitly in public prop
        requestCount: node.requests,
        successCount: node.successes,
        avgResponseTime: node.successes > 0 ? node.totalLatencyMs / node.successes : 0,
        lastUsed: Date.now(), // NodeRegistry doesn't expose lastUsed publically yet, assuming now
        lastError: node.lastError,
      },
    };
  },

  recordSuccess: (provider, modelName, duration) => {
    const id = `${provider}:${modelName || "default"}`;
    const startTime = Date.now() - (duration || 0);
    registry.recordStart(id);
    registry.recordSuccess(id, startTime);
  },

  recordError: (provider, modelName, error) => {
    const id = `${provider}:${modelName || "default"}`;
    const errorMsg = error?.message || String(error);
    const status = error?.status || (errorMsg.match(/\b(\d{3})\b/) || [])[1];

    registry.recordStart(id);
    registry.recordError(id, errorMsg);

    if (status) {
      const s = parseInt(status);
      if (s === 429 || s === 402 || s === 403) {
        registry.markExhausted(id, `HTTP ${s}`);
      }
    }

    if (syncHandler) {
      const entry = providerMetrics.get(provider, modelName);
      providerMetrics.triggerSync(provider, modelName, entry);
    }
  },

  shouldSkip: (provider, modelName) => {
    const id = `${provider}:${modelName || "default"}`;
    const node = registry.get(id);

    // Check if exhausted (NodeRegistry handles cooldown internally in buildRoutingSequence,
    // but here we just check raw status or we need to check exhaustedAt)
    if (node.status === "exhausted") {
      if (node.exhaustedAt && Date.now() - node.exhaustedAt < DEFAULT_EXHAUSTION_TTL_MS) {
        return true;
      }
      node.status = "active";
      node.exhaustedAt = null;
      return false;
    }

    if (node.status === "disabled") return true;

    return false;
  },

  triggerSync: (provider, modelName, entry) => {
    if (syncHandler) {
      try {
        const result = syncHandler(provider, modelName || "default", { ...entry });
        if (result && typeof result.then === "function") {
          result.catch((err) => console.error("[ProviderMetrics] Sync failed:", err));
        }
      } catch (e) {
        console.error("[ProviderMetrics] Sync error:", e);
      }
    }
  },
};

// Monkey-patch registry to trigger sync on internal updates (from Magistral Router)
const _originalRS = registry.recordSuccess.bind(registry);
registry.recordSuccess = (id, startTime) => {
  _originalRS(id, startTime);
  const parts = id.split(":");
  if (parts.length >= 2) {
    const provider = parts[0];
    const model = parts.slice(1).join(":");
    // Only trigger sync if handler configured
    if (providerMetrics.triggerSync) {
      const entry = providerMetrics.get(provider, model);
      providerMetrics.triggerSync(provider, model, entry);
    }
  }
};

const _originalRE = registry.recordError.bind(registry);
registry.recordError = (id, error) => {
  _originalRE(id, error);
  const parts = id.split(":");
  if (parts.length >= 2) {
    const provider = parts[0];
    const model = parts.slice(1).join(":");
    if (providerMetrics.triggerSync) {
      const entry = providerMetrics.get(provider, model);
      providerMetrics.triggerSync(provider, model, entry);
    }
  }
};
