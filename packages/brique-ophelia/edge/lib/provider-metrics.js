/**
 * packages/brique-ophelia/edge/lib/provider-metrics.js
 * Mock implementation of provider metrics to eliminate dependency on apps/platform.
 */

export const providerMetrics = {
  shouldSkip: (provider, modelName) => {
    // Basic implementation: never skip unless explicitly needed
    return false;
  },
  get: (provider, modelName) => {
    // Return default empty metrics
    return {
      status: "available",
      metrics: {
        consecutiveErrors: 0,
        requestCount: 0,
        successCount: 0,
        avgResponseTime: null,
        lastUsed: null,
        lastError: null
      }
    };
  }
};
