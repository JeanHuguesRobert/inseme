/**
 * packages/brique-ophelia/edge/gateway.js
 * Le Routeur Multi-Modal d'Ophélia.
 * Restauration de la parité avec rag_chatbotv3.js (directives, healthcheck, provider fallback).
 */

import { defineEdgeFunction } from "../../cop-host/src/runtime/edge.js";
import { runOperator } from "./lib/operator_v2.js";
import {
  createAIClient,
  buildProviderOrder,
  resolveModel,
} from "./lib/providers.js";
import { handleOpenAIRequest } from "./lib/openai_compat.js";
import { handleMCPRequest } from "./mcp_handler.js";
import { resolveIdentity } from "./identity.js";
import { getRole } from "./roles/registry.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getSQL,
  loadInstanceConfig,
} from "../../cop-host/src/config/instanceConfig.edge.js";

const MODEL_DIRECTIVE_REGEX = /model\s*=\s*([^\s;]+)/i;
const PROVIDER_DIRECTIVE_REGEX =
  /provider\s*=\s*(anthropic|openai|huggingface|mistral|google)/i;
const MODE_DIRECTIVE_REGEX = /mode\s*=\s*(debug)/i;

/**
 * Détecte si la question nécessite un modèle "intelligent" (strong/reasoning).
 */
function detectSmartMode(question = "", currentMode = "main") {
  if (currentMode !== "main" && currentMode !== "auto") return currentMode;

  const q = question.toLowerCase();
  const reasoningKeywords = [
    "pourquoi",
    "explique",
    "comment",
    "calcule",
    "analyse",
    "compare",
    "différence",
    "code",
    "script",
    "étape",
    "step",
    "raisonne",
    "réfléchis",
    "logique",
    "énigme",
    "math",
    "détaille",
  ];

  if (reasoningKeywords.some((kw) => q.includes(kw)) || q.length > 200) {
    return "strong";
  }

  return "main";
}

function parseDirectives(rawQuestion = "") {
  const trimmed = String(rawQuestion).trim();
  const semicolonIndex = trimmed.indexOf(";");
  const directiveSource =
    semicolonIndex >= 0 ? trimmed.slice(0, semicolonIndex).trim() : trimmed;
  let userQuestion =
    semicolonIndex >= 0 ? trimmed.slice(semicolonIndex + 1).trim() : trimmed;

  if (semicolonIndex < 0) {
    userQuestion = userQuestion
      .replace(MODE_DIRECTIVE_REGEX, "")
      .replace(MODEL_DIRECTIVE_REGEX, "")
      .replace(PROVIDER_DIRECTIVE_REGEX, "")
      .trim();
  }

  const providerMatch = directiveSource.match(PROVIDER_DIRECTIVE_REGEX);
  const modelMatch = directiveSource.match(MODEL_DIRECTIVE_REGEX);

  return {
    userQuestion,
    directiveProvider: providerMatch ? providerMatch[1].toLowerCase() : null,
    directiveModel: modelMatch ? modelMatch[1].toLowerCase() : null,
    debugMode: MODE_DIRECTIVE_REGEX.test(directiveSource),
  };
}

// 2026-01-09 11:30 (Force reload after config fix)
export default defineEdgeFunction(async (request, runtime, context) => {
  const { json, error, getConfig } = runtime;
  const url = new URL(request.url);
  const path = url.pathname;

  // On s'assure que la config est chargée immédiatement pour avoir accès aux clés API en DB
  await loadInstanceConfig();
  if (
    url.searchParams.get("healthcheck") === "true" ||
    path === "/api/health"
  ) {
    const providers = [
      "openai",
      "mistral",
      "anthropic",
      "google",
      "huggingface",
    ];
    const status = providers.map((p) => ({
      name: p,
      status: !!getConfig(`${p.toUpperCase()}_API_KEY`)
        ? "available"
        : "not_configured",
    }));
    return json({ providers: status });
  }

  // 2. Compatibilité OpenAI V1
  if (path.includes("/v1/chat/completions")) {
    return await handleOpenAIRequest(request, runtime);
  }

  // 3. Protocol MCP (Model Context Protocol)
  if (path.includes("/api/mcp")) {
    return await handleMCPRequest(request, runtime);
  }

  // Supabase initialization for Room Broadcasts
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseKey = getConfig("SUPABASE_SERVICE_ROLE_KEY");
  const supabase =
    supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  try {
    // 3. Services de Transcription/Traduction (Logic simplification)
    if (path.includes("/api/transcribe")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return error("No file provided", 400);
      const openai = createAIClient(runtime, "openai");
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });
      return json({ text: transcription.text });
    }

    if (path.includes("/api/translate")) {
      const body = await request.json();
      const { text, target_lang } = body;
      const openai = createAIClient(runtime, "openai");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate into ${target_lang}. Return ONLY the text.`,
          },
          { role: "user", content: text },
        ],
      });
      return json({ translated_text: completion.choices[0].message.content });
    }

    // 4. Chat Principal avec Fallback & Directives
    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = { question: "" };
    }

    const { userQuestion, directiveProvider, directiveModel, debugMode } =
      parseDirectives(body.question || "");
    const identity = resolveIdentity(runtime);
    const role = getRole(body.role || "mediator");

    const providerOrder = buildProviderOrder(
      runtime,
      directiveProvider || body.provider
    );
    const resolvedMode = detectSmartMode(userQuestion, body.mode || "main");
    const encoder = new TextEncoder();
    const voice = body.voice || body.room_settings?.ophelia?.voice || "nova";

    const readable = new ReadableStream({
      async start(controller) {
        let handled = false;

        for (const provider of providerOrder) {
          try {
            const model = resolveModel(
              provider,
              resolvedMode,
              directiveModel || body.model
            );
            const openai = createAIClient(runtime, provider);

            // Metadata initiales
            controller.enqueue(
              encoder.encode(
                `__PROVIDER_INFO__${JSON.stringify({ provider, model, role: role.id, voice, identity: identity.name, debugMode })}\n`
              )
            );

            const sql = getSQL(runtime);
            const dbUrl = runtime.getConfig("DATABASE_URL") || "NOT_FOUND";
            const sslMode = runtime.getConfig("DB_SSL_MODE") || "NOT_FOUND";
            const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");

            controller.enqueue(
              encoder.encode(
                `<Think>DEBUG: Gateway Version 2026-01-09 11:45 (SQL: ${!!sql}, DB_URL: ${maskedUrl}, SSL: ${sslMode})</Think>\n`
              )
            );

            console.log(
              `[DEBUG][Gateway] Calling runOperator with SQL: ${!!sql}`
            );
            await runOperator(
              runtime,
              { ...body, question: userQuestion, model },
              {
                provider,
                openai,
                supabase,
                sql,
                identity,
                role,
                encoder,
                controller,
              }
            );
            handled = true;
            break;
          } catch (err) {
            console.error(
              `[Gateway] Provider ${provider} failed, trying next...`,
              err.message
            );
            controller.enqueue(
              encoder.encode(
                `<Think>Échec de ${provider} : ${err.message}. Tentative suivante...</Think>\n`
              )
            );
          }
        }

        if (!handled) {
          controller.enqueue(
            encoder.encode(
              `\n❌ Tous les fournisseurs d'IA ont échoué. Veuillez réessayer plus tard.\n`
            )
          );
        }

        // Final Providers Status (Parity)
        const statusList = providerOrder.map((p) => ({
          name: p,
          status: "available",
        }));
        controller.enqueue(
          encoder.encode(
            `__PROVIDERS_STATUS__${JSON.stringify({ providers: statusList })}\n`
          )
        );

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error(`[Gateway] Error on ${path}:`, err);
    return error(err.message, 500);
  }
});
