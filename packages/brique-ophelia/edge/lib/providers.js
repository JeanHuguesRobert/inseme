/**
 * packages/brique-ophelia/edge/lib/providers.js
 * Gestionnaire des fournisseurs d'IA (OpenAI, Anthropic, Mistral, Google, HuggingFace, Groq).
 * Restauration de la parité avec rag_chatbotv3.js (shuffling, metrics skipping).
 */

import OpenAI from "https://esm.sh/openai@4";
import { SOVEREIGN_MODELS, REMOTE_MODELS } from "../../../models/registry.js";

export const PROVIDERS = [
  "openai",
  "mistral",
  "anthropic",
  "google",
  "huggingface",
  "groq",
  "sovereign",
];

export const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  mistral: "https://api.mistral.ai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/",
  groq: "https://api.groq.com/openai/v1",
  huggingface: "https://router.huggingface.co/v1",
  sovereign: "http://localhost:8080/v1",
};

export const MODEL_MODES = {
  mistral: {
    main: REMOTE_MODELS.fast.mistral,
    fast: REMOTE_MODELS.fast.mistral,
    strong: REMOTE_MODELS.advanced.mistral,
    reasoning: REMOTE_MODELS.advanced.mistral,
  },
  anthropic: {
    main: REMOTE_MODELS.advanced.anthropic,
    fast: REMOTE_MODELS.fast.anthropic,
    strong: REMOTE_MODELS.advanced.anthropic,
    reasoning: REMOTE_MODELS.advanced.anthropic,
  },
  openai: {
    main: REMOTE_MODELS.advanced.openai,
    fast: REMOTE_MODELS.fast.openai,
    strong: REMOTE_MODELS.advanced.openai,
    reasoning: "o1-mini",
  },
  google: {
    main: "gemini-1.5-pro",
    fast: "gemini-1.5-flash",
    strong: "gemini-1.5-pro",
    reasoning: "gemini-1.5-pro",
  },
  huggingface: {
    main: "deepseek-ai/DeepSeek-V3",
    strong: "deepseek-ai/DeepSeek-R1",
  },
  groq: {
    main: REMOTE_MODELS.advanced.groq,
    fast: REMOTE_MODELS.fast.groq,
    strong: REMOTE_MODELS.advanced.groq,
    reasoning: REMOTE_MODELS.advanced.groq,
  },
  sovereign: {
    main: SOVEREIGN_MODELS["qwen-2.5-coder-1.5b"].filename,
    fast: SOVEREIGN_MODELS["qwen-2.5-coder-1.5b"].filename,
    strong: SOVEREIGN_MODELS["llama-3.2-3b"].filename,
    reasoning: SOVEREIGN_MODELS["qwen-2.5-coder-1.5b"].filename,
  },
};

export const DEFAULT_MODEL_MODES = {
  mistral: "fast",
  anthropic: "main",
  openai: "main",
  google: "fast",
  huggingface: "main",
  groq: "main",
  sovereign: "main",
};

/**
 * Mélange aléatoirement les fournisseurs.
 */
export function shuffleProviders(providers) {
  const arr = [...providers];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Décide si un fournisseur doit être sauté (metrics, quotas).
 * (Simplified version of the legacy BOT metrics)
 */
export function shouldSkipProvider(runtime, provider) {
  const { getConfig } = runtime;
  const apiKey =
    getConfig(`${provider.toUpperCase()}_API_KEY`) ||
    (provider === "google" && getConfig("GEMINI_API_KEY")) ||
    (provider === "groq" && getConfig("groq_api_key")) ||
    provider === "sovereign"; // Local LLM doesn't need API key
  if (!apiKey) return true;

  // In a full implementation, we would check a global metrics store here
  return false;
}

/**
 * Construit l'ordre de passage des fournisseurs.
 */
export function buildProviderOrder(runtime, enforcedProvider = null) {
  let order = [...PROVIDERS];
  if (enforcedProvider && order.includes(enforcedProvider)) {
    order = [enforcedProvider, ...order.filter((p) => p !== enforcedProvider)];
  } else {
    // Prioritize OpenAI by default if available
    order = ["openai", ...order.filter((p) => p !== "openai")];
  }

  // Filter & Randomize remaining
  const available = order.filter((p) => !shouldSkipProvider(runtime, p));
  if (!enforcedProvider) {
    // Keep the first one, shuffle the rest? Or shuffle all?
    // Legacy bot shuffles all if no enforced provider.
    return shuffleProviders(available);
  }
  return available;
}

/**
 * Résout le modèle à utiliser.
 */
export function resolveModel(provider, mode, overrideModel) {
  if (overrideModel) return overrideModel;
  const providerModes = MODEL_MODES[provider] || {};
  return (
    providerModes[mode] ||
    providerModes[DEFAULT_MODEL_MODES[provider]] ||
    Object.values(providerModes)[0]
  );
}

/**
 * Initialise un client OpenAI-compatible.
 */
export function createAIClient(runtime, provider) {
  const { getConfig } = runtime;

  let apiKey = "";
  let baseURL = "";

  if (provider === "anthropic") {
    apiKey = getConfig("ANTHROPIC_API_KEY");
    baseURL = "https://api.anthropic.com/v1";
  } else if (provider === "mistral") {
    apiKey = getConfig("MISTRAL_API_KEY");
    baseURL = "https://api.mistral.ai/v1";
  } else if (provider === "google") {
    apiKey =
      getConfig("GEMINI_API_KEY") || getConfig("GOOGLE_GENERATIVE_AI_API_KEY");
    baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
  } else if (provider === "huggingface") {
    apiKey = getConfig("HUGGINGFACE_API_KEY");
    baseURL = "https://router.huggingface.co/v1";
  } else if (provider === "groq") {
    apiKey = getConfig("GROQ_API_KEY") || getConfig("groq_api_key");
    baseURL = "https://api.groq.com/openai/v1";
  } else if (provider === "sovereign") {
    apiKey = "sovereign-key"; // Placeholder
    baseURL = "http://localhost:8080/v1";
  } else {
    apiKey = getConfig("OPENAI_API_KEY");
    baseURL = "https://api.openai.com/v1";
  }

  if (!apiKey) throw new Error(`${provider.toUpperCase()} API key is missing`);

  return new OpenAI({
    apiKey,
    baseURL,
    // For Anthropic, we'd normally need a special header or a proxy,
    // but many services now offer OpenAI-compatible endpoints.
    // If native Anthropic is needed, we'd use the '@anthropic-ai/sdk'.
    defaultHeaders:
      provider === "anthropic"
        ? { "anthropic-version": "2023-06-01" }
        : undefined,
  });
}
