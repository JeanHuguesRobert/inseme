/**
 * AI Utilities for Ophelia
 * Handles error parsing, directive building, and stream processing.
 */

export const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
export const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";
export const CACHED_PREFIX = "__CACHED__";
export const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";

/**
 * Parses API errors into user-friendly and developer-friendly formats.
 */
export function parseApiError(error) {
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
      userMessage += mins > 0 ? ` — Réessayez dans ${mins}min ${secs}s` : ` — Réessayez dans ${secs}s`;
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
  } catch (e) {}

  const provider = providerMatch ? providerMatch[1] : null;
  const statusCode = providerMatch ? providerMatch[2] : null;
  const userMessage = provider
    ? `❌ ${provider}${statusCode ? ` (${statusCode})` : ""} : ${cleanMsg}`
    : `❌ ${cleanMsg}`;
  const consoleMessage = hasJson ? `[${provider || "Erreur"}] Full error: ${msg}` : msg;
  return { userMessage, consoleMessage, detailedLog: msg, shouldRetry: false };
}

/**
 * Builds a directive string for the AI backend.
 */
export function buildDirective({ provider, mode, manualModel }) {
  if (!provider) return "";
  const parts = [`provider=${provider}`];
  if (manualModel) parts.push(`model=${manualModel}`);
  else if (mode) parts.push(`model_mode=${mode}`);
  return parts.join(" ; ");
}

/**
 * Strips prefixed JSON payloads from a text chunk and handles them.
 */
export function stripPrefixedPayloads(incomingChunk, prefix, bufferRef, handler) {
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
}
