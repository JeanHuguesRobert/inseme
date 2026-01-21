import { ProxyAgent } from "undici";

/**
 * Helper to get environment variables in both Node (process.env) and Netlify (Netlify.env).
 * Duplicated from cop-kernel/env.js to avoid dependency cycles.
 */
function getEnv(name) {
  // 1. Try Netlify.env (Newer Node/Edge runtimes)
  try {
    if (typeof Netlify !== "undefined" && Netlify.env && typeof Netlify.env.get === "function") {
      const v = Netlify.env.get(name);
      if (typeof v === "string" && v) return v;
    }
  } catch (_e) {
    /* ignore */
  }

  // 2. Try process.env (Standard Node)
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[name];
    if (typeof v === "string" && v) return v;
  }

  return undefined;
}

/**
 * Creates a fetch function that automatically uses a proxy if configured.
 *
 * Priority order for Proxy URL:
 * 1. instanceConfig.proxy_url (if provided)
 * 2. Netlify.env.get("HTTP_PROXY")
 * 3. process.env.HTTP_PROXY
 *
 * @param {Object} [instanceConfig] - Optional Supabase instance configuration object
 * @returns {Function} A fetch-compatible function
 */
export function createNodeFetch(instanceConfig = {}) {
  // Determine Proxy URL
  const proxyUrl = instanceConfig?.proxy_url || getEnv("HTTP_PROXY") || getEnv("HTTPS_PROXY");

  // If no proxy, return native fetch
  if (!proxyUrl) {
    return globalThis.fetch;
  }

  try {
    // Configure Undici ProxyAgent
    // Note: We create a new agent for this fetcher.
    // If you need connection pooling across requests, cache this fetcher.
    const dispatcher = new ProxyAgent(proxyUrl);

    // Return a wrapper that injects the dispatcher
    return function proxyFetch(url, init = {}) {
      return globalThis.fetch(url, {
        ...init,
        dispatcher,
      });
    };
  } catch (err) {
    console.warn(`[createNodeFetch] Failed to configure proxy agent for ${proxyUrl}:`, err);
    return globalThis.fetch;
  }
}
