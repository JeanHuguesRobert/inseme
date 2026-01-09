import { useState, useRef, useCallback } from "react";

/**
 * Hook to manage AI tool execution traces and notifications.
 */
export default function useAITools(setMessages, onAction = null) {
  const toolTraceSeenRef = useRef(new Set());

  const handleToolTrace = useCallback((payload) => {
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
        action,
        args,
      } = trace || {};

      const key = [phase, callId, tool, trace?.timestamp].filter(Boolean).join(":");
      if (key) {
        if (toolTraceSeenRef.current.size > 200) {
          toolTraceSeenRef.current = new Set(Array.from(toolTraceSeenRef.current).slice(100));
        }
        if (toolTraceSeenRef.current.has(key)) return;
        toolTraceSeenRef.current.add(key);
      }

      // Handle specific actions that affect app state
      if (phase === "action" && action && onAction) {
          onAction(action, args);
      }

      if (debugSql?.query) {
        console.info(`[SQL Debug] ${debugSql.query}`);
      }

      let text = null;
      if (phase === "start") {
        text = `🛠️ L'outil ${tool || "inconnu"} démarre (${toolProvider || "n/a"}).`;
      } else if (phase === "finish") {
        const suffix = typeof durationMs === "number" ? ` (${Math.round(durationMs)} ms)` : "";
        text = `✅ L'outil ${tool || "inconnu"} est terminé${suffix}.`;
      } else if (phase === "notice" && message) {
        text = message;
      } else if (phase === "error") {
        text = `⚠️ L'outil ${tool || "inconnu"} a échoué : ${error || "erreur inconnue"}.`;
      }

      if (text) {
        const toolIdSuffix = callId ? `${callId}-${phase || "event"}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      console.warn("[AITools] Failed to parse tool trace payload", e);
    }
  }, [setMessages]);

  return { handleToolTrace };
}
