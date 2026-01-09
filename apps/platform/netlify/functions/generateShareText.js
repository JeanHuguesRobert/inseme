import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { InferenceClient } from "@huggingface/inference";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getConfig, loadInstanceConfig } from "../../common/config/instanceConfig.backend.js";

// Supabase client initialisé de façon lazy
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getConfig("supabase_url"), getConfig("supabase_service_role_key"));
  }
  return _supabase;
}

const MODEL_ALIASES = {
  "mistral-7b-instruct-v0.1": "mistralai/Mistral-7B-Instruct-v0.1",
  "mistral-7b-instruct-v0.2": "mistralai/Mistral-7B-Instruct-v0.2",
  "mistral-large-2": "mistralai/Mistral-Large-Instruct",
  "mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "llama-3-8b-instruct": "meta-llama/Meta-Llama-3-8B-Instruct",
  "llama-3-70b-instruct": "meta-llama/Meta-Llama-3-70B-Instruct",
};

const resolveModel = (alias) => MODEL_ALIASES[alias] || alias;

async function getShareSystemPrompt() {
  // Utiliser le vault pour les valeurs de branding
  const botName = getConfig("bot_name");
  const cityName = getConfig("city_name");
  const movementName = getConfig("movement_name");
  const partyName = getConfig("party_name");
  const hashtag = getConfig("hashtag");

  return `Tu es l'assistant citoyen ${botName} du mouvement/parti ${movementName} (${partyName}) ${hashtag} pour la commune de ${cityName}. Ton rôle est d'aider à rédiger des messages de partage concis et engageants pour les réseaux sociaux. Le message doit être adapté à la plateforme de destination et au contenu de la page Wiki. Réponds uniquement avec le texte de partage généré, sans fioritures ni explications supplémentaires.`;
}

async function runOpenAIAgent({ prompt }) {
  // Utiliser le vault pour la config OpenAI
  const apiKey = getConfig("openai_api_key");
  console.log("OpenAI API Key (first 5 chars):", apiKey ? apiKey.substring(0, 5) : "Not set");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquant");
  }

  const model = getConfig("openai_model") || "gpt-4o-mini";
  console.log("OpenAI Model:", model);

  console.log(`[OpenAI] Démarrage avec modèle: ${model}`);

  const client = new OpenAI({ apiKey, baseURL: getConfig("openai_base_url") });

  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        { role: "system", content: await getShareSystemPrompt() },
        { role: "user", content: prompt },
      ],
      stream: false,
    });

    const fullResponse = response.choices[0].message.content;

    console.log(`[OpenAI] Réponse générée (${fullResponse.length} chars)`);

    return fullResponse;
  } catch (error) {
    console.error("Error in runOpenAIAgent:", error);
    throw error;
  }
}

export const handler = async (event) => {
  console.log("Received event:", event); // Log de l'événement entrant
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // Load instance config
  await loadInstanceConfig();

  try {
    const { pageTitle, pageUrl, pageContent, selectedDestinations, currentShareText } = JSON.parse(
      event.body
    );

    let userPrompt = `Génère un texte de partage pour la page Wiki "${pageTitle}" (${pageUrl}).\n\nContenu de la page:\n${pageContent}\n\nPlateforme de destination: ${selectedDestinations}. Le texte doit être raisonnablement concis, engageant et adapté spécifiquement à cette plateforme (par exemple, pour Twitter, utiliser des hashtags pertinents et être bref; pour Facebook, un ton plus descriptif est possible). Si la plateforme de destination n'est pas Twitter, génère un résumé du contenu de la page. Pour Twitter, respecte la taille limite. Pas de Markdown.\n\nTexte actuel (si applicable): ${currentShareText}.`;

    console.log("User prompt for OpenAI:", userPrompt); // Log du prompt utilisateur

    const generatedText = await runOpenAIAgent({ prompt: userPrompt });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedText }),
    };
  } catch (error) {
    console.error("Error in handler generating share text:", error); // Log d'erreur plus spécifique
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate share text" }),
    };
  }
};
