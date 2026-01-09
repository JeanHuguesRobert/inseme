// netlify/functions/ophelia-api.js
// Ophélia API REST - Point d'entrée centralisé
// POST /api/ophelia

import { getOpheliaAnswer } from "../edge-functions/lib/lib/getOpheliaAnswer.js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export default async (req, context) => {
  // Charger la configuration
  await loadInstanceConfig();

  // 1. Vérifier la méthode
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Authentification par clé API (header: x-api-key)
  const API_KEY = getConfig("ophelia_api_key", "dev-demo-key");
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized: invalid or missing API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Lire et valider le corps de la requête
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = (body?.question || "").trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "Missing question" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. (À venir) Rate limiting, logs
  // TODO: Ajouter quota IP, logs usage

  // 5. Appel au moteur RAG/conversationnel (non-stream)
  try {
    const { answer, metadata, sources } = await getOpheliaAnswer({
      question,
      conversation_history: body.conversation_history || [],
      provider: body.provider,
      model: body.model,
      modelMode: body.modelMode,
    });
    return new Response(
      JSON.stringify({
        success: true,
        answer,
        metadata,
        sources,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
