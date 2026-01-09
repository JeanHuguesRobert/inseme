import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@inseme/cop-host";
import { useNavigate } from "react-router-dom";
import useAIProviders from "./useAIProviders.js";
import useAITools from "./useAITools.js";
import { 
    parseApiError, 
    PROVIDERS_STATUS_PREFIX, 
    PROVIDER_META_PREFIX, 
    TOOL_TRACE_PREFIX, 
    CACHED_PREFIX,
    stripPrefixedPayloads 
} from "../../lib/ai/aiUtils.js";

import { useApiCaller } from "@inseme/cop-host";

/**
 * useOpheliaChat - Refactored and modularized chat logic.
 */
export default function useOpheliaChat(initial = {}) {
  const { user = null } = initial;
  const navigate = useNavigate();
  const [messages, setMessages] = useState(initial.messages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);

  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const messagesRef = useRef([]);

  // Status operations
  const sendMessageOp = useApiCaller("Envoi du message");

  // Modular specialized hooks
  const providers = useAIProviders(initial.chatbotSettings);
  const tools = useAITools(setMessages, (action, args) => {
      if (action === "update_ai_settings") {
          providers.selectProvider(args.provider, args.mode);
      } else if (action === "assume_role") {
          providers.selectRole(args.role_id);
      }
  });

  // Buffers for streaming
  const statusBuffer = useRef("");
  const metaBuffer = useRef("");
  const cacheBuffer = useRef("");
  const toolBuffer = useRef("");

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const sendMessage = useCallback(async (opts = {}) => {
    const text = opts.text ?? input;
    if (!text || !text.trim()) return;

    const userMessage = { id: Date.now(), text, sender: "user", timestamp: new Date() };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setIsLoading(true);
    setElapsedMs(0);

    abortControllerRef.current = new AbortController();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsedMs((s) => s + 1000), 1000);

    try {
      return await sendMessageOp(async () => {
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
            question: providers.directivePrefix ? `${providers.directivePrefix} ; ${text}` : text,
            user_id: user?.id ?? null,
            modelMode: providers.modalMode,
            role: providers.activeRole,
            conversation_history: conv,
            context: { url: window.location.href },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let isCached = false;
        let cacheKey = null;

        const botMessageId = Date.now() + 1;
        setMessages((prev) => [...prev, { id: botMessageId, text: "", sender: "bot", timestamp: new Date(), isStreaming: true }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          let chunk = decoder.decode(value, { stream: true });

          chunk = stripPrefixedPayloads(chunk, PROVIDERS_STATUS_PREFIX, statusBuffer, (p) => providers.setProvidersStatus(JSON.parse(p)));
          chunk = stripPrefixedPayloads(chunk, PROVIDER_META_PREFIX, metaBuffer, (p) => providers.setProviderMeta(JSON.parse(p)));
          chunk = stripPrefixedPayloads(chunk, TOOL_TRACE_PREFIX, toolBuffer, (p) => tools.handleToolTrace(p));
          chunk = stripPrefixedPayloads(chunk, CACHED_PREFIX, cacheBuffer, (p) => {
              const info = JSON.parse(p);
              isCached = true;
              cacheKey = info.key;
          });

          full += chunk;
          setMessages((prev) => prev.map((m) => m.id === botMessageId ? { ...m, text: full } : m));
        }

        setMessages((prev) => prev.map((m) => m.id === botMessageId ? { ...m, isStreaming: false, cached: isCached, cacheKey } : m));
        return full;
      });
    } catch (err) {
      if (err.name === "AbortError") return;
      const parsed = parseApiError(err);
      setMessages((prev) => [...prev, { id: Date.now(), text: parsed.userMessage, sender: "bot", error: true, isNotification: true }]);
    } finally {
      setIsLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [input, user, providers, tools]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    elapsedMs,
    abort,
    showAuthModal,
    setShowAuthModal,
    modelModalOpen,
    setModelModalOpen,
    ...providers
  };
}
