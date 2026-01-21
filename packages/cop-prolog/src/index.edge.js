import { RemotePrologAdapter } from "./RemotePrologAdapter.js";

export * from "./index.core.js";

export async function createPrologEngine(options = {}) {
  const endpoint = options.endpoint || "/.netlify/functions/gen-ophelia-prolog-executor";
  return new RemotePrologAdapter(endpoint);
}
