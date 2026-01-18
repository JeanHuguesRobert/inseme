import { useState, useEffect, useCallback, useRef } from "react";
import { buildDirective } from "../../lib/ai/aiUtils.js";

export const MODEL_MODES = {
  auto: { main: "Auto" },
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
    reasoning: "magistral-medium-latest",
  },
  anthropic: {
    main: "claude-sonnet-4-5-20250929",
    cheap: "claude-3-haiku-20240307",
  },
  openai: { main: "gpt-4.1-mini", reasoning: "gpt-5.1", cheap: "gpt-4.1-nano" },
  huggingface: {
    main: "deepseek-ai/DeepSeek-V3",
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    reasoning: "deepseek-ai/DeepSeek-R1",
  },
  grok: {
    main: "grok-4-fast-reasoning",
    fast: "grok-4-fast-non-reasoning",
    reasoning: "grok-4-fast-reasoning",
  },
  google: {
    main: "gemini-3-pro-preview",
    fast: "gemini-2.5-flash",
    reasoning: "gemini-2.0-flash-thinking-exp",
    cheap: "gemini-2.5-flash-lite",
  },
  groq: {
    main: "llama-3.3-70b-versatile",
    fast: "llama-3.1-8b-instant",
    strong: "llama-3.3-70b-specdec",
  },
};

export const DEFAULT_MODEL_MODE = {
  auto: "main",
  mistral: "fast",
  anthropic: "main",
  openai: "cheap",
  huggingface: "main",
  grok: "main",
  google: "main",
  groq: "main",
};

export const MODEL_MODE_LABELS = {
  fast: "Rapide",
  strong: "Puissant",
  reasoning: "Raisonnement",
  main: "Standard",
  cheap: "Éco",
  small: "Petit",
};

const AVAILABLE_PROVIDERS = [
  "auto",
  "openai",
  "mistral",
  "huggingface",
  "anthropic",
  "google",
  "groq",
  "grok",
];

/**
 * Hook to manage AI providers, their status, and model selection.
 */
export default function useAIProviders(initialSettings = {}) {
  const [providersStatus, setProvidersStatus] = useState(null);
  const [providerMeta, setProviderMeta] = useState(null);
  const [modalProvider, setModalProvider] = useState(
    window.localStorage.getItem("bob_selected_provider") || "auto"
  );
  const [modalMode, setModalMode] = useState(DEFAULT_MODEL_MODE[modalProvider] || "fast");
  const [activeRole, setActiveRole] = useState(
    window.localStorage.getItem("bob_active_role") || "mediator"
  );
  const [directivePrefix, setDirectivePrefix] = useState("");

  const lastProvidersStatusRef = useRef(null);
  const lastProviderMetaRef = useRef(null);

  const getProviderPriorityScore = useCallback(
    (providerName) => {
      if (!providersStatus?.providers) return 0;
      const provider = providersStatus.providers.find((p) => p.name === providerName);
      if (!provider) return -1000;
      if (provider.status === "not_configured") return -1000;
      if (provider.status === "auth_error" || provider.status === "quota_exceeded") return -900;
      let score = 0;
      if (provider.status === "rate_limited") score -= 500;
      else if (provider.status === "degraded") score -= 200;
      else if (provider.status === "available") score += 300;
      const mainModel = provider.models?.[0];
      if (mainModel) {
        if (mainModel.successRate != null) {
          const s = Number(mainModel.successRate);
          if (!Number.isNaN(s)) score += Math.floor(s * 2);
        }
        if (mainModel.avgResponseTime != null) {
          const latencyMs = Number(mainModel.avgResponseTime);
          if (!Number.isNaN(latencyMs)) {
            if (latencyMs < 800) score += 80;
            else if (latencyMs < 2000) score += 30;
            else if (latencyMs < 5000) score -= 20;
            else score -= 80;
          }
        }
        if (mainModel.recentlyUsed) score += 40;
        if (mainModel.consecutiveErrors > 0) score -= mainModel.consecutiveErrors * 60;
      }
      return score;
    },
    [providersStatus]
  );

  const sortedAvailableProviders = useCallback(() => {
    let ap = providersStatus?.providers
      ? providersStatus.providers.filter((p) => p.status !== "not_configured").map((p) => p.name)
      : AVAILABLE_PROVIDERS.filter((p) => p !== "auto");

    const sorted = [...ap].sort(
      (a, b) => getProviderPriorityScore(b) - getProviderPriorityScore(a)
    );

    // Toujours mettre "auto" en premier si disponible
    return ["auto", ...sorted];
  }, [providersStatus, getProviderPriorityScore]);

  useEffect(() => {
    const sorted = sortedAvailableProviders();
    if (sorted.length > 0 && !sorted.includes(modalProvider)) {
      setModalProvider(sorted[0]);
    }
  }, [providersStatus]);

  useEffect(() => {
    if (modalProvider) window.localStorage.setItem("bob_selected_provider", modalProvider);
    const providerModes = MODEL_MODES[modalProvider] || {};
    const fallbackMode = DEFAULT_MODEL_MODE[modalProvider] || Object.keys(providerModes)[0] || "";
    setModalMode(fallbackMode);
    setDirectivePrefix(buildDirective({ provider: modalProvider, mode: fallbackMode }));
  }, [modalProvider]);

  const selectProvider = useCallback((provider, preferredMode = null) => {
    if (!provider) return;
    const resolvedMode =
      preferredMode ||
      DEFAULT_MODEL_MODE[provider] ||
      Object.keys(MODEL_MODES[provider] || {})[0] ||
      "";
    setModalProvider(provider);
    setModalMode(resolvedMode);
    setDirectivePrefix(buildDirective({ provider, mode: resolvedMode }));
  }, []);

  const selectRole = useCallback((roleId) => {
    if (!roleId) return;
    setActiveRole(roleId);
    window.localStorage.setItem("bob_active_role", roleId);
  }, []);

  return {
    providersStatus,
    setProvidersStatus,
    providerMeta,
    setProviderMeta,
    modalProvider,
    setModalProvider,
    modalMode,
    setModalMode,
    directivePrefix,
    setDirectivePrefix,
    activeRole,
    setActiveRole,
    selectRole,
    selectProvider,
    sortedAvailableProviders,
    lastProvidersStatusRef,
    lastProviderMetaRef,
  };
}
