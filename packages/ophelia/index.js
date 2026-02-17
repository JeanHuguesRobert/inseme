// packages/ophelia/index.js
// Ophélia npm package – accès simple à l’API REST centrale

const API_URL =
  (typeof globalThis !== "undefined" && globalThis.process?.env?.OPHELIA_API_URL) ||
  "https://lepp.fr/api/ophelia";
const API_KEY =
  (typeof globalThis !== "undefined" && globalThis.process?.env?.OPHELIA_API_KEY) || "dev-demo-key";

async function ask(question, options = {}) {
  if (!question || typeof question !== "string") {
    throw new Error("Missing or invalid question");
  }
  const payload = {
    question,
    conversation_history: options.history || [],
    provider: options.provider,
    model: options.model,
    modelMode: options.modelMode,
  };
  const res = await fetch(options.apiUrl || API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey || API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

export * from "./websearch.js";
export { ask };
