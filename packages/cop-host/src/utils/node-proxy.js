import { setGlobalDispatcher, EnvHttpProxyAgent } from "undici";

/**
 * packages/cop-host/src/utils/node-proxy.js
 *
 * Configures the global Node.js fetch to use HTTP_PROXY / NO_PROXY environment variables.
 * Designed to be imported by Netlify Functions or other Node.js backend scripts.
 *
 * Usage:
 * import '@inseme/cop-host/utils/node-proxy.js';
 */

// Helper to get env var from various sources (Node, Netlify, Deno)
function getEnv(key) {
  // Priority: Process Env > Netlify Env > Deno Env
  return (
    (typeof process !== "undefined" && process.env?.[key]) ||
    globalThis.Netlify?.env?.get?.(key) ||
    globalThis.Deno?.env?.get?.(key)
  );
}

// Ensure we are in a Node.js-like environment with global fetch
if (typeof globalThis.fetch === "function" && typeof process !== "undefined") {
  // 1. Detect Proxy Configuration
  const httpProxy = getEnv("HTTP_PROXY");
  const httpsProxy = getEnv("HTTPS_PROXY");
  const noProxy = getEnv("NO_PROXY");

  // 2. Apply Configuration
  if (httpProxy || httpsProxy) {
    try {
      // EnvHttpProxyAgent reads directly from process.env.
      // We explicitly sync them in case they came from Netlify.env or other sources.
      if (httpProxy && !process.env.HTTP_PROXY) process.env.HTTP_PROXY = httpProxy;
      if (httpsProxy && !process.env.HTTPS_PROXY) process.env.HTTPS_PROXY = httpsProxy;
      if (noProxy && !process.env.NO_PROXY) process.env.NO_PROXY = noProxy;

      // Create and set the agent
      const agent = new EnvHttpProxyAgent();
      setGlobalDispatcher(agent);

      // Log only if explicitly debugging or in development to avoid log spam in prod
      if (process.env.NODE_ENV !== "production" || process.env.DEBUG) {
        console.log(`[@inseme/cop-host] 🛡️  Global fetch proxy configured via EnvHttpProxyAgent`);
        if (httpProxy) console.log(`  - HTTP_PROXY: ${httpProxy}`);
        if (noProxy) console.log(`  - NO_PROXY: ${noProxy}`);
      }
    } catch (err) {
      console.warn(`[@inseme/cop-host] Failed to configure global proxy: ${err.message}`);
    }
  }
}
