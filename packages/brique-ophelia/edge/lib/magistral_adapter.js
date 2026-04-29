/**
 * packages/brique-ophelia/edge/lib/magistral_adapter.js
 *
 * Adapts the Magistral Router (core) to behave like an OpenAI client
 * for use in Ophelia's edge environment.
 *
 * This allows Ophelia to use sophisticated routing logic (failover, tiering)
 * without needing an external Magistral server.
 */

import { createRouter } from "../../../magistral/src/router.js";
import { registry } from "./provider-metrics.js";
import defaultMap from "../../../magistral/registry/maps/default.js";

async function* openAIChunksFromResponse(response) {
  if (!response.body) throw new Error("No response body for stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6).trim();
        if (!payload || payload === "[DONE]") return;

        try {
          yield JSON.parse(payload);
        } catch (e) {
          console.warn("[MagistralAdapter] Ignoring malformed SSE payload:", e.message);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function createEmbeddedMagistral(runtime, options = {}) {
  const { getConfig } = runtime;

  // 1. Prepare API Keys
  const apiKeys = {
    GROQ_API_KEY: getConfig("GROQ_API_KEY") || getConfig("groq_api_key"),
    TOGETHER_API_KEY: getConfig("TOGETHER_API_KEY") || getConfig("together_api_key"),
    OPENAI_API_KEY: getConfig("OPENAI_API_KEY") || getConfig("openai_api_key"),
    ANTHROPIC_API_KEY: getConfig("ANTHROPIC_API_KEY") || getConfig("anthropic_api_key"),
  };

  // 2. Resolve Map (Configurable > Default)
  const map = options.map || defaultMap;

  // 3. Initialize Router with shared registry
  // We use the shared providerMetrics registry which is hydrated from Supabase
  const router = createRouter({
    map,
    apiKeys,
    registry,
  });

  // 4. Create OpenAI-compatible Client Adapter
  return {
    chat: {
      completions: {
        create: async (params) => {
          const { model, stream } = params;

          // Map "model" or "mode" to Magistral Tier
          let tier = "fast";
          if (model === "strong" || model === "reasoning") tier = "strong";
          if (model === "fallback") tier = "fallback";

          const payload = {
            ...params,
            stream: stream || false,
          };

          try {
            const response = await router.route(payload, tier);
            if (stream) {
              return openAIChunksFromResponse(response);
            }
            return await response.json();
          } catch (e) {
            console.error("[MagistralAdapter] Routing failed:", e);
            throw e;
          }
        },
      },
    },
  };
}
