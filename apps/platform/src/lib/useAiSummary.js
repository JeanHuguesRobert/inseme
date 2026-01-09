import { useState, useCallback } from "react";
import { getMetadata, setMetadata } from "@inseme/cop-host";

/**
 * Hook to use AI summarization service
 * Sends text to the /api/summarize endpoint
 *
 * @returns {{ summarize: Function, loading: boolean, error: string|null }}
 */
export function useAiSummary() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const summarize = useCallback(async (text, provider = null) => {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      const errorMsg = "Le texte à résumer ne peut pas être vide";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, provider }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      setLoading(false);
      return data.summary;
    } catch (err) {
      const errorMessage = err.message || "Erreur lors du résumé";
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  return {
    summarize,
    loading,
    error,
  };
}

export default useAiSummary;
