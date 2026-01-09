import { RemotePrologAdapter } from "./RemotePrologAdapter.js";

export * from "./index.core.js";

/**
 * Factory function to create a Prolog engine for Edge/Deno.
 * Delegates to a Node.js function via RemotePrologAdapter.
 */
export async function createPrologEngine(options = {}) {
  // In production, the URL will be relative to the site.
  // In development, it points to the local Netlify dev server.
  const endpoint = options.endpoint || "/.netlify/functions/prolog-executor";
  return new RemotePrologAdapter(endpoint);
}
