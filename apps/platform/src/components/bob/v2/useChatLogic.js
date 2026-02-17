// src/components/bob/v2/useChatLogic.js

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "../../../lib/supabase.js";
import { canWrite } from "@inseme/cop-host";
import { useDataLoader, useApiCaller, useDataSaver, useSyncOperation } from "@inseme/cop-host";
import { createPropositionWithTags } from "../../../lib/propositions.js";
import { useNavigate } from "react-router-dom";
import { getConfig } from "../../../common/config/instanceConfig.client.js";

// Enhanced hook scaffold providing core chat state and simple send/abort
// behavior. This intentionally does not call real APIs — it provides
// the same surface as the original ChatWindow so modules can be wired
// progressively.
export default function useChatLogic(initial = {}) {
  const { user = null } = initial;
  const navigate = useNavigate();
  const [messages, setMessages] = useState(initial.messages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [relatedPropositions, setRelatedPropositions] = useState([]);
  const [showPropositionForm, setShowPropositionForm] = useState(false);
  const [newPropositionTitle, setNewPropositionTitle] = useState("");
  const [newPropositionDescription, setNewPropositionDescription] = useState("");
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const sendTimerRef = useRef(null);
  const abortFlag = useRef(false);
  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  // Last-seen metadata snapshots to avoid duplicate user notifications
  const lastProvidersStatusRef = useRef(null);
  const lastProviderMetaRef = useRef(null);
  const lastCacheKeyRef = useRef(null);

  const [providersStatus, setProvidersStatus] = useState(null);
  const messagesRef = useRef([]);
  const providerStatusBufferRef = useRef("");
  const providerMetaBufferRef = useRef("");
  const cacheMetaBufferRef = useRef("");
  const toolTraceBufferRef = useRef("");
  const toolTraceSeenRef = useRef(new Set());
  // Status hooks must be called at top-level of this hook (Rules of Hooks)
  const loadSettingsOp = useDataLoader();
  const loadChatHistoryOp = useDataLoader();
  const sendMessageOp = useApiCaller("Envoi du message");
  const matchOp = useApiCaller("Recherche de propositions liées");
  const suggestOp = useApiCaller("Suggestion de tags");
  const clearHistoryOp = useDataSaver();
  const syncHistoryOp = useDataSaver();
  const createPropositionOp = useDataSaver();
  const publishWikiOp = useDataSaver();
  // Provider / preset constants (ported from legacy)
  const MODEL_MODES = {
    mistral: {
      fast: "mistral-small-latest",
      strong: "mistral-large-latest",
      reasoning: "magistral-medium-latest",
    },
    anthropic: { main: "claude-sonnet-4-5-20250929", cheap: "claude-3-haiku-20240307" },
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
  };

  const DEFAULT_MODEL_MODE = {
    mistral: "fast",
    anthropic: "main",
    openai: "cheap",
    huggingface: "main",
    grok: "main",
    google: "main",
  };
  const MODEL_MODE_LABELS = {
    fast: "Rapide",
    strong: "Puissant",
    reasoning: "Raisonnement",
    main: "Standard",
    cheap: "Éco",
    small: "Petit",
  };

  const quickPresets = [
    { label: "Plus puissant (OpenAI)", provider: "openai", mode: "reasoning" },
    { label: "Rapide et équilibré (Mistral)", provider: "mistral", mode: "strong" },
    { label: "Économique (HuggingFace)", provider: "huggingface", mode: "main" },
  ];

  const AVAILABLE_PROVIDERS = ["openai", "mistral", "huggingface", "anthropic"];

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState("mistral");
  const [modalMode, setModalMode] = useState(DEFAULT_MODEL_MODE["mistral"] || "fast");
  const [customModel, setCustomModel] = useState("");
  const [directivePrefix, setDirectivePrefix] = useState("");
  const [chatbotSettings, setChatbotSettings] = useState(initial.chatbotSettings || {});
  const [chatHistory, setChatHistory] = useState([]);
  const [providerMeta, setProviderMeta] = useState(null);
  const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
  const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";
  const CACHED_PREFIX = "__CACHED__";
  const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";
  const [hasConsent, setHasConsent] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Compute available providers from providersStatus
  const availableProviders = useCallback(() => {
    if (providersStatus?.providers) {
      return providersStatus.providers
        .filter((p) => p.status !== "not_configured")
        .map((p) => p.name);
    }
    return AVAILABLE_PROVIDERS;
  }, [providersStatus]);

  // provider priority scoring (ported, simplified)
  const getProviderPriorityScore = useCallback(
    (providerName) => {
      if (!providersStatus?.providers) return 0;
      const provider = providersStatus.providers.find((p) => p.name === providerName);
      if (!provider || provider.status === "not_configured") return -1000;
      let score = 0;
      if (provider.status === "rate_limited") score -= 500;
      else if (provider.status === "degraded") score -= 200;
      else if (provider.status === "available") score += 300;
      else if (provider.status === "unknown") score += 100;
      const mainModel = provider.models?.[0];
      if (mainModel?.recentlyUsed && mainModel.successRate > 90) score += 200;
      if (mainModel?.avgResponseTime) {
        const avgSeconds = mainModel.avgResponseTime / 1000;
        if (avgSeconds < 2) score += 150;
        else if (avgSeconds < 5) score += 100;
        else if (avgSeconds < 10) score += 50;
        else score -= 50;
      }
      if (mainModel?.successRate != null) score += Math.floor(mainModel.successRate * 2);
      if (mainModel?.consecutiveErrors > 0) score -= mainModel.consecutiveErrors * 50;
      if (mainModel?.retryAfter) score -= 300;
      return score;
    },
    [providersStatus]
  );

  const sortedAvailableProviders = useCallback(() => {
    const ap = availableProviders();
    if (!ap || ap.length === 0) return [];
    return [...ap].sort((a, b) => {
      const scoreB = getProviderPriorityScore(b);
      const scoreA = getProviderPriorityScore(a);
      if (scoreA === scoreB) return a.toLowerCase().localeCompare(b.toLowerCase());
      return scoreB - scoreA;
    });
  }, [availableProviders, getProviderPriorityScore]);

  useEffect(() => {
    const sorted = sortedAvailableProviders();
    setModalProvider((prev) => (sorted.includes(prev) ? prev : sorted[0] || prev));
  }, [providersStatus]);

  // Persist selected provider in localStorage and initialize from it when possible
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bob_selected_provider");
      if (saved) setModalProvider(saved);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (modalProvider) window.localStorage.setItem("bob_selected_provider", modalProvider);
    } catch (e) {
      // ignore
    }
  }, [modalProvider]);

  useEffect(() => {
    const providerModes = MODEL_MODES[modalProvider] || {};
    const fallbackMode = DEFAULT_MODEL_MODE[modalProvider] || Object.keys(providerModes)[0] || "";
    setModalMode(fallbackMode);
  }, [modalProvider]);

  // Function to parse and format API errors (ported from legacy)
  const parseApiError = useCallback((error) => {
    const msg = error?.message || "";
    const quotaMatch = msg.match(/(?:quota|limit).*?exceeded/i);
    const retryMatch = msg.match(/(?:retry|wait|try\s+again).*?(\d+(?:\.\d+)?)\s*s/i);
    const providerMatch = msg.match(/^(\w+)\s+API\s+(\d+):/i);

    if (quotaMatch || msg.includes("429")) {
      const provider = providerMatch ? providerMatch[1] : "Fournisseur";
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      let userMessage = `⚠️ ${provider} : Quota/limite dépassé(e)`;
      if (retrySeconds) {
        const mins = Math.floor(retrySeconds / 60);
        const secs = retrySeconds % 60;
        userMessage +=
          mins > 0 ? ` — Réessayez dans ${mins}min ${secs}s` : ` — Réessayez dans ${secs}s`;
      }
      return {
        userMessage,
        consoleMessage: `[${provider}] Quota exceeded`,
        detailedLog: msg,
        shouldRetry: false,
      };
    }

    if (msg.includes("rate") && msg.includes("limit")) {
      const provider = providerMatch ? providerMatch[1] : "Fournisseur";
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 5;
      return {
        userMessage: `⏱️ ${provider} : Trop de requêtes — Réessayez dans ${retrySeconds}s`,
        consoleMessage: `[${provider}] Rate limited (retry in ${retrySeconds}s)`,
        detailedLog: msg,
        shouldRetry: true,
        retryAfter: retrySeconds * 1000,
      };
    }

    let cleanMsg = msg;
    let hasJson = false;
    try {
      const jsonMatch = msg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorObj = JSON.parse(jsonMatch[0]);
        cleanMsg = errorObj?.error?.message || errorObj?.message || msg;
        hasJson = true;
        if (cleanMsg.length > 200) cleanMsg = cleanMsg.substring(0, 197) + "...";
      }
    } catch (e) {
      // keep original
    }

    const provider = providerMatch ? providerMatch[1] : null;
    const statusCode = providerMatch ? providerMatch[2] : null;
    const userMessage = provider
      ? `❌ ${provider}${statusCode ? ` (${statusCode})` : ""} : ${cleanMsg}`
      : `❌ ${cleanMsg}`;
    const consoleMessage = hasJson ? `[${provider || "Erreur"}] Full error: ${msg}` : msg;
    return { userMessage, consoleMessage, detailedLog: msg, shouldRetry: false };
  }, []);

  const buildDirective = useCallback(({ provider, mode, manualModel }) => {
    if (!provider) return "";
    const parts = [`provider=${provider}`];
    if (manualModel) parts.push(`model=${manualModel}`);
    else if (mode) parts.push(`model_mode=${mode}`);
    return parts.join(" ; ");
  }, []);

  const handleModelSelection = useCallback(
    ({ provider, mode, manualModel }) => {
      const prefix = buildDirective({ provider, mode, manualModel });
      setDirectivePrefix(prefix);
      setModalMode(manualModel ? "" : mode || DEFAULT_MODEL_MODE[provider] || "");
      setCustomModel("");
      setModelModalOpen(false);
    },
    [buildDirective]
  );

  const handleQuickPreset = useCallback(
    (preset) => {
      const sorted = sortedAvailableProviders();
      if (!sorted.includes(preset.provider)) return;
      setModalProvider(preset.provider);
      setModalMode(preset.mode);
      handleModelSelection({ provider: preset.provider, mode: preset.mode });
    },
    [providersStatus]
  );

  // Select provider directly (bind to provider badges) — sets provider, default mode and updates directivePrefix
  const selectProvider = useCallback(
    (provider, preferredMode = null) => {
      if (!provider) return;
      const providerModes = MODEL_MODES[provider] || {};
      const resolvedMode =
        preferredMode || DEFAULT_MODEL_MODE[provider] || Object.keys(providerModes)[0] || "";
      setModalProvider(provider);
      setModalMode(resolvedMode);
      const prefix = buildDirective({ provider, mode: resolvedMode });
      if (prefix) setDirectivePrefix(prefix);
    },
    [buildDirective]
  );

  const sendMessage = useCallback(
    async (opts = {}) => {
      const text = opts.text ?? input;
      if (!text || !text.trim()) return;

      const userMessage = { id: Date.now(), text, sender: "user", timestamp: new Date() };
      setMessages((m) => [...m, userMessage]);
      setInput("");
      setIsLoading(true);

      // abort controller for streaming
      abortControllerRef.current = new AbortController();
      abortFlag.current = false;

      // elapsed timer
      setElapsedMs(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedMs((s) => s + 1000), 1000);

      try {
        return await sendMessageOp(async () => {
          // Log request metadata for debugging
          try {
            console.info("[Chat] Sending stream request", {
              directivePrefix,
              modalMode,
              userId: user?.id,
              textPreview: String(text).slice(0, 100),
            });
          } catch (_) {}
          // Notify user that the request has been sent and we're waiting for a response
          try {
            // setMessages((m) => [...m, { id: `sys-${Date.now()}`, text: "Requête envoyée — attente de la réponse…", sender: "system", isNotification: true }]);
          } catch (_) {}

          // Build normalized conversation history to send to backend
          const conv = messagesRef.current
            .filter((m) => !m.isNotification)
            .slice(-50)
            .map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text || m.content || "",
            }));

          const response = await fetch("/api/chat-stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}),
            },
            body: JSON.stringify({
              question: directivePrefix ? `${directivePrefix} ; ${text}` : text,
              user_id: user?.id ?? null,
              modelMode: modalMode,
              conversation_history: conv,
              context: {
                url: window.location.href,
                pathname: window.location.pathname,
                search: window.location.search,
                // Try to extract IDs from URL if possible, though backend can also parse URL
                groupId:
                  (window.location.pathname.match(/\/groups\/([a-f0-9-]+)/) || [])[1] || null,
                missionId:
                  (window.location.search.match(/missionId=([a-f0-9-]+)/) || [])[1] || null,
              },
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            try {
              console.error("[Chat] Stream request failed", { status: response.status, detail });
            } catch (_) {}
            throw new Error(`Erreur serveur (${response.status}) ${detail}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let full = "";
          let isCachedResponse = false;
          let cacheKey = null;

          const stripPrefixedPayloads = (incomingChunk, prefix, bufferRef, handler) => {
            let working = (bufferRef.current || "") + incomingChunk;
            while (true) {
              const idx = working.indexOf(prefix);
              if (idx === -1) break;
              const payloadStart = idx + prefix.length;
              const newlineIdx = working.indexOf("\n", payloadStart);
              if (newlineIdx === -1) {
                bufferRef.current = working.slice(idx);
                return working.slice(0, idx);
              }
              const payload = working.slice(payloadStart, newlineIdx);
              handler(payload);
              working = working.slice(0, idx) + working.slice(newlineIdx + 1);
            }
            bufferRef.current = "";
            return working;
          };

          const handleProvidersStatusPayload = (payload) => {
            try {
              const data = JSON.parse(payload);
              setProvidersStatus(data);
              try {
                console.debug("[Chat] Received providers status metadata", data);
              } catch (_) {}
              try {
                const serialized = JSON.stringify(data);
                if (lastProvidersStatusRef.current !== serialized) {
                  const hasExistingStatus = lastProvidersStatusRef.current !== null;
                  lastProvidersStatusRef.current = serialized;
                  // Only show notification if we had a previous status (not on first load)
                  if (hasExistingStatus) {
                    const summary = (data.providers || [])
                      .map((p) => {
                        const s = p.status || "unknown";
                        const emoji =
                          s === "available"
                            ? "🟢"
                            : s === "degraded"
                              ? "🟡"
                              : s === "rate_limited"
                                ? "⏳"
                                : s === "not_configured"
                                  ? "⚪"
                                  : "⚪";
                        return `${p.name || p.label || p.title || "fournisseur"} ${emoji}`;
                      })
                      .slice(0, 6)
                      .join(", ");
                    setMessages((m) => [
                      ...m,
                      {
                        id: `sys-${Date.now() + 1}`,
                        text: `Mise à jour statuts fournisseurs : ${summary || "Aucune information disponible."}`,
                        sender: "system",
                        isNotification: true,
                      },
                    ]);
                  }
                }
              } catch (_) {}
            } catch (e) {
              console.warn("[Chat] Failed to parse providers status payload", e);
            }
          };

          const handleProviderMetaPayload = (payload) => {
            try {
              const meta = JSON.parse(payload);
              const normalized =
                meta && typeof meta === "object" && meta.__agent_metadata__
                  ? { ...meta.__agent_metadata__ }
                  : meta;
              if (!normalized || typeof normalized !== "object") return;
              setProviderMeta((prev) => ({ ...(prev || {}), ...normalized }));
              try {
                console.debug("[Chat] Received provider meta", normalized);
              } catch (_) {}
              try {
                const serialized = JSON.stringify(normalized);
                if (lastProviderMetaRef.current !== serialized) {
                  lastProviderMetaRef.current = serialized;
                  const providerName =
                    normalized.provider || normalized.name || "fournisseur inconnu";
                  const modelName = normalized.model || normalized.modelName || "—";
                  const hintParts = [];
                  if (normalized.avgResponseTime != null)
                    hintParts.push(`latence ${Math.round(Number(normalized.avgResponseTime))}ms`);
                  if (normalized.successRate != null)
                    hintParts.push(`taux de succès ${Math.round(Number(normalized.successRate))}%`);
                  const hint = hintParts.length ? ` (${hintParts.join(", ")})` : "";
                  console.log("[Chat] Provider meta detected", {
                    providerName,
                    modelName,
                    hintParts,
                  });
                  // Optional: surface notification to user here if needed.
                }
              } catch (_) {}
            } catch (e) {
              console.warn("[Chat] Failed to parse provider meta payload", e);
            }
          };

          const handleCachePayload = (payload) => {
            try {
              const cacheInfo = JSON.parse(payload);
              isCachedResponse = true;
              cacheKey = cacheInfo.key || null;
              try {
                console.debug("[Chat] Received cached response metadata", cacheInfo);
              } catch (_) {}
              try {
                if (cacheKey && lastCacheKeyRef.current !== cacheKey) {
                  lastCacheKeyRef.current = cacheKey;
                  setMessages((m) => [
                    ...m,
                    {
                      id: `sys-${Date.now() + 3}`,
                      text: `Réponse servie depuis le cache.`,
                      sender: "system",
                      isNotification: true,
                    },
                  ]);
                }
              } catch (_) {}
            } catch (e) {
              console.warn("[Chat] Failed to parse cache payload", e);
            }
          };

          const handleToolTracePayload = (payload) => {
            try {
              const trace = JSON.parse(payload);
              const {
                phase,
                tool,
                provider: toolProvider,
                message,
                durationMs,
                error,
                callId,
                debugSql,
              } = trace || {};
              try {
                console.info("[Chat] Tool trace", trace);
              } catch (_) {}
              const key = [phase, callId, tool, trace?.timestamp].filter(Boolean).join(":");
              if (key) {
                if (toolTraceSeenRef.current.size > 200) {
                  toolTraceSeenRef.current = new Set(
                    Array.from(toolTraceSeenRef.current).slice(100)
                  );
                }
                if (toolTraceSeenRef.current.has(key)) return;
                toolTraceSeenRef.current.add(key);
              }
              if (debugSql?.query) {
                try {
                  console.info(`[SQL Debug] ${debugSql.query}`);
                } catch (_) {}
              }
              let text = null;
              if (phase === "start") {
                text = `🛠️ L'outil ${tool || "inconnu"} démarre (${toolProvider || "n/a"}).`;
              } else if (phase === "finish") {
                const suffix =
                  typeof durationMs === "number" ? ` (${Math.round(durationMs)} ms)` : "";
                text = `✅ L'outil ${tool || "inconnu"} est terminé${suffix}.`;
              } else if (phase === "notice" && message) {
                text = message;
              } else if (phase === "error") {
                text = `⚠️ L'outil ${tool || "inconnu"} a échoué : ${error || "erreur inconnue"}.`;
              }
              if (text) {
                const toolIdSuffix = callId
                  ? `${callId}-${phase || "event"}`
                  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                setMessages((m) => [
                  ...m,
                  {
                    id: `tool-${toolIdSuffix}`,
                    text,
                    sender: "system",
                    isNotification: true,
                  },
                ]);
              }
            } catch (e) {
              console.warn("[Chat] Failed to parse tool trace payload", e);
            }
          };

          // create placeholder bot message
          const botMessageId = Date.now() + 1;
          setMessages((prev) => [
            ...prev,
            { id: botMessageId, text: "", sender: "bot", timestamp: new Date(), isStreaming: true },
          ]);

          // Try to find related propositions before streaming (wrapped)
          // (already wrapped above) nothing to do here

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            let chunk = decoder.decode(value, { stream: true });

            chunk = stripPrefixedPayloads(
              chunk,
              PROVIDERS_STATUS_PREFIX,
              providerStatusBufferRef,
              handleProvidersStatusPayload
            );
            chunk = stripPrefixedPayloads(
              chunk,
              PROVIDER_META_PREFIX,
              providerMetaBufferRef,
              handleProviderMetaPayload
            );
            chunk = stripPrefixedPayloads(
              chunk,
              TOOL_TRACE_PREFIX,
              toolTraceBufferRef,
              handleToolTracePayload
            );
            chunk = stripPrefixedPayloads(
              chunk,
              CACHED_PREFIX,
              cacheMetaBufferRef,
              handleCachePayload
            );

            // Forward ALL backend messages to console for debugging (F12)
            if (
              chunk.includes("[EdgeFunction]") ||
              chunk.includes("FAILED") ||
              chunk.includes("⚠️") ||
              chunk.includes("Trying next provider") ||
              chunk.includes("[resolveModel]") ||
              chunk.includes("[LLM]")
            ) {
              try {
                console.log(`[Backend Stream] ${chunk.trim()}`);
              } catch (_) {}
            }

            // Detect ONLY critical errors for UI display (not fallback warnings)
            // Critical errors start with ❌ or are user-facing warnings containing "indisponible"
            if (
              chunk.startsWith("❌") ||
              (chunk.includes("⚠️") && chunk.includes("indisponible")) ||
              chunk.includes("[DEBUG]") // Show debug messages in UI when debug mode is active
            ) {
              // Extract and display the error/debug message in the UI
              const errorMatch = chunk.match(/(?:❌|⚠️|\[DEBUG\])[^]*?(?=\n\n|$)/);
              if (errorMatch) {
                const errorText = errorMatch[0].trim();
                const isDebug = errorText.startsWith("[DEBUG]");
                setMessages((m) => [
                  ...m,
                  {
                    id: `${isDebug ? "debug" : "error"}-${Date.now()}`,
                    text: errorText,
                    sender: "system",
                    isNotification: true,
                    error: !isDebug,
                  },
                ]);
              }

              // If we had a placeholder bot message, finalize it with the error text
              if (errorMatch && botMessageId && !chunk.includes("[DEBUG]")) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? { ...m, text: errorMatch[0].trim(), isStreaming: false, error: true }
                      : m
                  )
                );
              }
            }

            full += chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === botMessageId ? { ...m, text: full, isStreaming: true } : m))
            );
          }

          // finalize
          try {
            console.info("[Chat] Stream finished", {
              isCachedResponse,
              cacheKey,
              length: full.length,
            });
          } catch (_) {}
          // try { setMessages((m) => [...m, { id: `sys-${Date.now()+4}`, text: 'Réception terminée.', sender: 'system', isNotification: true }]); } catch (_) { }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMessageId
                ? { ...m, text: full, isStreaming: false, cached: isCachedResponse, cacheKey }
                : m
            )
          );

          // Persist interaction to Supabase when possible
          if (user && canWrite(user)) {
            try {
              await getSupabase()
                .from("chat_interactions")
                .insert([
                  {
                    user_id: user.id,
                    question: text,
                    answer: full,
                    sources: [],
                    created_at: new Date().toISOString(),
                  },
                ]);
              // If the response was served from cache, update cached_queries bookkeeping
              if (isCachedResponse) {
                try {
                  await getSupabase()
                    .from("cached_queries")
                    .upsert(
                      [
                        {
                          query: text,
                          answer: full,
                          last_used: new Date().toISOString(),
                          cache_key: cacheKey,
                          use_count: 1,
                        },
                      ],
                      { onConflict: ["query"] }
                    );
                  // also increment cache hit counter via RPC when available
                  try {
                    if (cacheKey) {
                      await getSupabase()
                        .rpc("increment_cache_hit", { key: cacheKey })
                        .catch(() => {});
                    }
                  } catch (e) {
                    // ignore rpc errors
                  }
                } catch (e) {
                  // ignore cache bookkeeping errors
                }
              }
            } catch (dbErr) {
              console.error("Supabase save error:", dbErr);
            }
          }

          setIsLoading(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setElapsedMs(0);
          return full;
        });
      } catch (err) {
        if (abortControllerRef.current && abortControllerRef.current.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now(), text: "⚠️ Requête annulée.", sender: "bot", error: true },
          ]);
        } else {
          try {
            const parsed = parseApiError(err);
            // Log console-friendly message
            try {
              console.error("[ChatWindowV2] API Error:", parsed.consoleMessage);
            } catch (_) {}
            if (parsed.detailedLog && parsed.detailedLog !== parsed.consoleMessage) {
              try {
                console.error("[ChatWindowV2] Full error details:", parsed.detailedLog);
              } catch (_) {}
            }
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                text: parsed.userMessage || String(err.message || err),
                sender: "bot",
                error: true,
              },
            ]);
          } catch (e) {
            setMessages((prev) => [
              ...prev,
              { id: Date.now(), text: String(err.message || err), sender: "bot", error: true },
            ]);
          }
        }
        setIsLoading(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setElapsedMs(0);
        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [input, user]
  );

  const abort = useCallback(() => {
    try {
      console.info("[Chat] Abort requested");
    } catch (_) {}
    abortFlag.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    setIsLoading(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
  }, []);

  const handleFeedback = useCallback(
    (messageId, feedback) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
      // try to persist feedback to Supabase if possible
      if (user && canWrite(user)) {
        (async () => {
          try {
            await getSupabase().from("chat_interactions").update({ feedback }).eq("id", messageId);
          } catch (e) {
            // ignore
          }
        })();
        // If message was cached, increment cached feedback counter
        const msg = messages.find((m) => m.id === messageId);
        if (msg && msg.cached) {
          (async () => {
            try {
              await getSupabase().rpc("increment_feedback_count", { query: msg.text });
            } catch (e) {
              // ignore
            }
          })();
        }
      }
    },
    [user]
  );

  // Ported handleNotUsefulClick from legacy: mark message as not useful and open model modal
  const openModelModal = useCallback(() => {
    const sorted = sortedAvailableProviders();
    const lastProvider = providerMeta?.provider || sorted[0] || "openai";
    const provider = sorted.includes(lastProvider) ? lastProvider : sorted[0] || "openai";

    setModalProvider(provider);

    // Try to map providerMeta.model to a known mode
    if (providerMeta?.model && MODEL_MODES[provider]) {
      const modes = MODEL_MODES[provider];
      const matching = Object.entries(modes).find(
        ([mode, modelName]) => modelName === providerMeta.model
      );
      if (matching) setModalMode(matching[0]);
      else setModalMode(DEFAULT_MODEL_MODE[provider] || "");
    } else {
      setModalMode(DEFAULT_MODEL_MODE[provider] || "");
    }

    setCustomModel("");
    setModelModalOpen(true);
  }, [providerMeta, MODEL_MODES, DEFAULT_MODEL_MODE, sortedAvailableProviders]);

  const handleNotUsefulClick = useCallback(
    (msg) => {
      handleFeedback(msg.id, "not_useful");
      // Find the user message that led to this bot response
      const botIndex = messages.findIndex((m) => m.id === msg.id);
      if (botIndex > 0 && messages[botIndex - 1]?.sender === "user") {
        setInput(messages[botIndex - 1].text);
      } else {
        // Fallback: find the last user message
        const lastUserQuestion = [...messages]
          .reverse()
          .find((m) => m.sender === "user" && typeof m.text === "string");
        setInput(lastUserQuestion?.text || "");
      }
      openModelModal();
    },
    [handleFeedback, messages, setInput, openModelModal]
  );

  // Find related propositions using HF embeddings + Supabase RPC
  const findRelatedPropositions = useCallback(async (question) => {
    try {
      const apiKey = getConfig("huggingface_api_key");
      if (!apiKey) return [];
      const embeddingResponse = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: question }),
        }
      );
      const [embedding] = await embeddingResponse.json();
      let result = [];
      await matchOp(async () => {
        const { data } = await getSupabase().rpc("match_propositions_by_embedding", {
          query_embedding: embedding,
          match_threshold: 0.65,
          match_count: 3,
        });
        result = data || [];
      });
      return result;
    } catch (e) {
      return [];
    }
  }, []);

  // Suggest tags for a question using HF embeddings + Supabase RPC
  const suggestTags = useCallback(async (question) => {
    try {
      const apiKey = getConfig("huggingface_api_key");
      if (!apiKey) return [];
      const resp = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: question }),
        }
      );
      const [embedding] = await resp.json();
      let result = [];
      await suggestOp(async () => {
        const { data } = await getSupabase().rpc("find_similar_tags", {
          query_embedding: embedding,
          limit: 5,
        });
        if (data) setSuggestedTags(data);
        result = data || [];
      });
      return result;
    } catch (e) {
      return [];
    }
  }, []);

  // Sync local history to Supabase for logged users and load history
  const fetchChatHistory = useCallback(async () => {
    if (!user || !canWrite(user)) return;
    let data = [];
    try {
      const resp = await getSupabase()
        .from("chat_interactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      data = resp.data;
      if (data && data.length > 0) {
        const formatted = data.flatMap((item) => {
          const entries = [
            {
              id: `history-user-${item.id}`,
              text: item.question,
              sender: "user",
              timestamp: item.created_at,
              related: { answer: item.answer, sources: item.sources, feedback: item.feedback },
            },
          ];
          if (item.answer)
            entries.push({
              id: `history-bot-${item.id}`,
              text: item.answer,
              sender: "bot",
              sources: item.sources,
              feedback: item.feedback,
              timestamp: item.created_at,
            });
          return entries;
        });
        setMessages((prev) => {
          const withoutHistory = prev.filter(
            (msg) => !(typeof msg.id === "string" && msg.id.startsWith("history-"))
          );
          return [...formatted.reverse(), ...withoutHistory];
        });
        setChatHistory(formatted.reverse());
      }
    } catch (e) {
      // ignore for now
      return [];
    }
    return data || [];
  }, [user]);

  const handleClearHistory = useCallback(async () => {
    // Ask for confirmation only when more than one message exists
    if (messages.length > 1) {
      if (!window.confirm("Effacer tout l'historique de vos échanges ?")) return;
    }
    try {
      await clearHistoryOp(async () => {
        if (user) {
          const { error } = await getSupabase()
            .from("chat_interactions")
            .delete()
            .eq("user_id", user.id);
          if (error) throw error;
        }
        // Always remove anonymous local history to avoid re-synchronization later
        try {
          localStorage.removeItem("anonymous_chat_history");
        } catch (e) {
          // ignore
        }
      });
      // After successful deletion, refresh state from backend to avoid ghost entries
      const remaining = await fetchChatHistory();
      if (Array.isArray(remaining) && remaining.length > 0) {
        console.error("Chat interactions deletion did not remove all entries", { remaining });
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: "system",
            isNotification: true,
            text: "⚠️ Échec partiel de la suppression : certaines conversations existent toujours.",
          },
        ]);
        return;
      }
    } catch (e) {
      console.error("Failed to clear chat history:", e);
      // notify user of error (keep existing messages until we can refresh)
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: "system",
          isNotification: true,
          text: "⚠️ Impossible d'effacer l'historique. Réessayez plus tard.",
        },
      ]);
      return;
    }
    setMessages([]);
    setInput("");
    setRelatedPropositions([]);
    setChatHistory([]);
  }, [user, fetchChatHistory, messages]);

  // Consent management
  useEffect(() => {
    const stored = window.localStorage.getItem("bob_chat_consent");
    if (stored === "true") setHasConsent(true);
    else if (stored === "false") setHasConsent(false);
    else setHasConsent(false);
  }, []);

  const openPropositionForm = useCallback(
    (initial = {}) => {
      setNewPropositionTitle(initial.title || "");
      setNewPropositionDescription(initial.description || "");
      setSelectedTags([]);
      setSuggestedTags([]);
      setShowPropositionForm(true);
      if (input) suggestTags(input);
    },
    [input, suggestTags]
  );

  const openAuthModal = useCallback(() => setShowAuthModal(true), []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  // Load chatbot settings and initial providers status
  useEffect(() => {
    (async () => {
      await loadSettingsOp(async () => {
        try {
          const { data } = await getSupabase().rpc("get_chatbot_settings");
          if (data && data.length > 0) setChatbotSettings(data[0]);
        } catch (e) {
          // ignore
        }

        try {
          const r = await fetch("/api/chat-stream?healthcheck=true");
          const json = await r.json();
          setProvidersStatus(json);
        } catch (e) {
          // ignore
        }
      });
    })();
  }, []);

  useEffect(() => {
    const syncLocalHistory = async () => {
      const localHistory = localStorage.getItem("anonymous_chat_history");
      if (user && canWrite(user) && localHistory) {
        try {
          const parsedHistory = JSON.parse(localHistory || "[]");
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            const interactionsToInsert = [];
            let currentInteraction = {};

            const tsFor = (m) => {
              try {
                if (m.timestamp) return new Date(m.timestamp).getTime();
                if (typeof m.id === "number") return m.id;
                const n = parseInt(m.id);
                if (!Number.isNaN(n)) return n;
              } catch (e) {
                // ignore
              }
              return 0;
            };

            const sorted = [...parsedHistory]
              .filter((m) => m && !m.isNotification && !m.isStreaming)
              .sort((a, b) => tsFor(a) - tsFor(b));

            for (const msg of sorted) {
              if (msg.sender === "user") {
                const createdAt = msg.timestamp
                  ? new Date(msg.timestamp).toISOString()
                  : typeof msg.id === "number"
                    ? new Date(msg.id).toISOString()
                    : !Number.isNaN(parseInt(msg.id))
                      ? new Date(parseInt(msg.id)).toISOString()
                      : new Date().toISOString();

                currentInteraction = {
                  user_id: user.id,
                  question: msg.text || "",
                  created_at: createdAt,
                };
              } else if (msg.sender === "bot" && currentInteraction.question) {
                currentInteraction.answer = msg.text || "";
                currentInteraction.sources = msg.sources || [];
                currentInteraction.feedback = msg.feedback || null;
                interactionsToInsert.push({ ...currentInteraction });
                currentInteraction = {};
              }
            }
            if (interactionsToInsert.length > 0) {
              await getSupabase()
                .from("chat_interactions")
                .insert(interactionsToInsert)
                .catch(() => {});
              localStorage.removeItem("anonymous_chat_history");
            } else {
              localStorage.removeItem("anonymous_chat_history");
            }
          }
        } catch (e) {
          localStorage.removeItem("anonymous_chat_history");
        }
      }
    };

    // Use the status operation wrappers for sync/load
    syncHistoryOp(async () => syncLocalHistory()).then(() => {
      loadChatHistoryOp(async () => fetchChatHistory());
    });
  }, [user, loadChatHistoryOp, syncHistoryOp, fetchChatHistory]);

  // Persist anonymous history locally
  useEffect(() => {
    if (!user || !canWrite(user)) {
      const messagesToSave = messages
        .filter((m) => !m.isNotification && !m.isStreaming)
        .map((m) => {
          const ts = m.timestamp
            ? new Date(m.timestamp).toISOString()
            : typeof m.id === "number"
              ? new Date(m.id).toISOString()
              : !Number.isNaN(parseInt(m.id))
                ? new Date(parseInt(m.id)).toISOString()
                : new Date().toISOString();
          return { ...m, timestamp: ts };
        });
      try {
        if (messagesToSave.length > 0)
          localStorage.setItem("anonymous_chat_history", JSON.stringify(messagesToSave));
        else localStorage.removeItem("anonymous_chat_history");
      } catch (e) {
        // ignore
      }
    }
  }, [messages, user]);

  // Subscribe to new propositions created by the chatbot
  useEffect(() => {
    if (!user) return;
    const channel = getSupabase()
      .channel("new_propositions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "propositions",
          filter: `created_from=eq.chatbot`,
        },
        (payload) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1000,
              text: `🔔 Nouvelle proposition créée depuis le chatbot : "${payload.new.title}"`,
              sender: "system",
              timestamp: new Date(),
              isNotification: true,
              link: `/propositions/${payload.new.id}`,
            },
          ]);
        }
      )
      .subscribe();

    return () => getSupabase().removeChannel(channel);
  }, [user]);

  const createProposition = useCallback(async ({ title, description, tags = [] }) => {
    // Prefer using centralized proposition helper when available
    setShowPropositionForm(false);
    setSuggestedTags([]);
    if (!user) {
      openAuthModal?.();
      return null;
    }
    try {
      if (user && canWrite(user)) {
        let created = null;
        await createPropositionOp(async () => {
          created = await createPropositionWithTags({
            userId: user.id,
            title,
            description,
            status: "active",
            selectedTags: tags,
          });
        });
        if (created) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 2,
              text: `✅ Proposition créée: ${created.title}`,
              sender: "system",
              isNotification: true,
              link: `/propositions/${created.id}`,
            },
          ]);
          try {
            navigate(`/propositions/${created.id}`);
          } catch (_) {}
          return created;
        }
      }
    } catch (e) {
      // fallback to simulated notification
    }

    // fallback simulated creation for anonymous users or on error
    const fake = { id: `p-${Date.now()}`, title, description, tags };
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 2,
        text: `✅ Proposition créée: ${title}`,
        sender: "system",
        isNotification: true,
        link: `/propositions/${fake.id}`,
      },
    ]);
    return fake;
  }, []);

  // Determine if a real conversation exists (not just notifications)
  const hasConversation = messages.some((m) => !m.isNotification);

  // Publish conversation as a Wiki page (similar to v1 behavior)
  const handlePublishWiki = useCallback(async () => {
    if (!hasConversation) return null;
    if (!user) {
      openAuthModal?.();
      return null;
    }

    // Build conversation content
    const conversationContent = messages
      .filter((m) => m.sender !== "system" || m.isNotification)
      .map((m) => {
        const sender = m.sender === "user" ? "Utilisateur" : "Bot";
        return `**${sender}**: ${m.text}`;
      })
      .join("\n\n");

    const defaultTitle = (messages.find((m) => m.sender === "user")?.text || "Conversation").slice(
      0,
      120
    );

    try {
      let pageUrl = null;
      await publishWikiOp(async () => {
        const optimizeResponse = await fetch("/api/optimize-wiki-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultTitle, pageContent: conversationContent }),
        });
        if (!optimizeResponse.ok) throw new Error("Title optimization failed");
        const { optimizedTitle, optimizedSlug } = await optimizeResponse.json();

        const { data, error } = await getSupabase()
          .from("wiki_pages")
          .insert([
            {
              title: optimizedTitle,
              content: conversationContent,
              slug: optimizedSlug,
              author_id: user.id,
            },
          ])
          .select();

        if (error || !data || !data[0]) throw new Error("Wiki creation failed");

        pageUrl = `${window.location.origin}/wiki/${data[0].slug}`;

        // Try generate share text
        let shareText = "";
        try {
          const shareRes = await fetch("/api/generateShareText", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageTitle: optimizedTitle,
              pageUrl,
              pageContent: conversationContent,
              selectedDestinations: "Twitter",
              currentShareText: "",
            }),
          });
          if (shareRes.ok) {
            const sd = await shareRes.json();
            shareText = sd.generatedText || "";
            try {
              await navigator.clipboard.writeText(shareText);
            } catch (_) {}
          }
        } catch (_) {}

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            isNotification: true,
            text: `Page Wiki créée : ${pageUrl}${shareText ? `\n\nTexte de partage : ${shareText}` : ""}`,
            link: pageUrl,
          },
        ]);
      });
      return pageUrl;
    } catch (e) {
      console.error("Publish wiki failed:", e);
      return null;
    }
  }, [messages, user, canWrite]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    sendMessage,
    abort,
    handleFeedback,
    relatedPropositions,
    setRelatedPropositions,
    showPropositionForm,
    openPropositionForm,
    setShowPropositionForm,
    newPropositionTitle,
    setNewPropositionTitle,
    newPropositionDescription,
    setNewPropositionDescription,
    suggestedTags,
    setSuggestedTags,
    selectedTags,
    setSelectedTags,
    createProposition,
    providersStatus,
    chatbotSettings,
    providerMeta,
    chatHistory,
    hasConversation,
    handlePublishWiki,
    handleClearHistory,
    showAuthModal,
    openAuthModal,
    closeAuthModal,
    setShowAuthModal,
    handleNotUsefulClick,
    openModelModal,
    selectProvider,
    // Provider / presets surface
    quickPresets,
    MODEL_MODES,
    modelModalOpen,
    setModelModalOpen,
    modalProvider,
    setModalProvider,
    modalMode,
    setModalMode,
    customModel,
    setCustomModel,
    directivePrefix,
    setDirectivePrefix,
    handleQuickPreset,
    handleModelSelection,
    availableProviders: availableProviders(),
    sortedAvailableProviders: sortedAvailableProviders(),
    getProviderPriorityScore,
    elapsedMs,
  };
}
