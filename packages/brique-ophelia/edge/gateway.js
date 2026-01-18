/**
 * packages/brique-ophelia/edge/gateway.js
 * Le Routeur Multi-Modal d'Ophélia.
 */

import { defineEdgeFunction } from "../../cop-host/src/runtime/edge.js";
import { runOperator } from "./lib/operator.js";
import { TRANSCRIPTION_MODELS } from "../../models/registry.js";
import { createAIClient, buildProviderOrder, resolveModel } from "./lib/providers.js";
import { handleOpenAIRequest } from "./lib/openai_compat.js";
import { providerMetrics } from "./lib/provider-metrics.js";
import { handleMCPRequest } from "./mcp_handler.js";
import { resolveIdentity } from "./identity.js";
import { ALL_BRIQUE_PROMPTS } from "./lib/gen-all-prompts.js";
import { getRole } from "./roles/registry.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSQL, loadInstanceConfig } from "../../cop-host/src/config/instanceConfig.edge.js";

const MODEL_DIRECTIVE_REGEX = /model\s*=\s*([^\s;]+)/i;
const PROVIDER_DIRECTIVE_REGEX =
  /provider\s*=\s*(anthropic|openai|huggingface|mistral|google|groq|grok)/i;
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
  // TODO: jhr, stricter detection because ; is valid in question
  const semicolonIndex = trimmed.indexOf(";");
  const directiveSource = semicolonIndex >= 0 ? trimmed.slice(0, semicolonIndex).trim() : trimmed;
  let userQuestion = semicolonIndex >= 0 ? trimmed.slice(semicolonIndex + 1).trim() : trimmed;

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

async function getLocalAiServerUrlForRoom(supabase, getConfig, roomId) {
  if (!supabase || !getConfig) return null;
  const slugs = [];
  if (roomId && typeof roomId === "string") slugs.push(roomId);
  const barSlug = getConfig("BAR_ROOM_SLUG") || "cyrnea";
  if (barSlug && (!roomId || barSlug !== roomId)) slugs.push(barSlug);
  const seen = new Set();
  for (const slug of slugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    try {
      const { data, error } = await supabase
        .from("inseme_rooms")
        .select("settings")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) continue;
      const settings = data.settings || {};
      const status = settings.ai_server_status || "offline";
      const url = settings.ai_server_url;
      if (url && status === "online") {
        return url;
      }
    } catch {}
  }
  return null;
}

// 2026-01-09 11:30 (Force reload after config fix)
export default defineEdgeFunction(async (request, runtime, context) => {
  const { json, error, getConfig } = runtime;
  const url = new URL(request.url);
  const path = url.pathname;

  // On s'assure que la config est chargée immédiatement pour avoir accès aux clés API en DB
  await loadInstanceConfig();
  if (url.searchParams.get("healthcheck") === "true" || path === "/api/health") {
    const openaiKey = getConfig("OPENAI_API_KEY");
    const groqKey = getConfig("GROQ_API_KEY");
    return json({
      status: "ok",
      version: "1.3.0",
      config: {
        hasOpenAIKey: !!openaiKey,
        hasGroqKey: !!groqKey,
        providerOrder: buildProviderOrder(runtime),
        environment: typeof Deno !== "undefined" ? "deno/netlify" : "unknown",
      },
    });
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
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  // Configure Provider Metrics Persistence
  if (supabase) {
    providerMetrics.configure(async (provider, model, entry) => {
      try {
        await supabase.from("ai_provider_status").upsert(
          {
            provider,
            model: model || "default",
            status: entry.status,
            last_checked_at: new Date().toISOString(),
            last_error: entry.metrics.lastError,
            metrics: {
              success_count: entry.metrics.successCount,
              request_count: entry.metrics.requestCount,
              avg_latency: Math.round(entry.metrics.avgResponseTime || 0),
            },
          },
          { onConflict: "provider, model" }
        );
      } catch (err) {
        console.error(`[Gateway] Failed to sync status for ${provider}:`, err);
      }
    });

    // Hydrate metrics on cold start (per worker)
    if (!providerMetrics.hasData()) {
      try {
        const { data } = await supabase.from("ai_provider_status").select("*");
        if (data) providerMetrics.hydrate(data);
      } catch (e) {
        console.warn("[Gateway] Failed to hydrate metrics:", e);
      }
    }
  }

  try {
    // 3. Services Sémantiques
    if (path.includes("/api/semantic/state")) {
      const { handleSemanticState } = await import("./semantic-fusion.js");
      const body = await request.json();
      const result = await handleSemanticState(body, runtime);
      return json(result);
    }

    if (path.includes("/api/semantic/window")) {
      const { getSemanticWindow } = await import("./semantic-fusion.js");
      const roomId = url.searchParams.get("room_id");
      const result = await getSemanticWindow(roomId, runtime);
      return json(result);
    }
    // 3. Services de Transcription/Traduction (Logic simplification)
    if (path.includes("/api/transcribe")) {
      console.log("[Gateway] Transcription request received");
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) {
        console.error("[Gateway] No file in transcription request");
        return error("No file provided", 400);
      }
      console.log(`[Gateway] File received: ${file.name} (${file.size} bytes, type: ${file.type})`);

      const providers = Object.keys(TRANSCRIPTION_MODELS); // ["openai", "groq"]
      let lastError = null;

      for (const provider of providers) {
        try {
          // Robust API key check (parity with providers.js)
          const apiKey =
            getConfig(`${provider.toUpperCase()}_API_KEY`) ||
            (provider === "groq" && getConfig("groq_api_key"));

          if (!apiKey) {
            console.warn(`[Gateway] Skipping ${provider}: API key missing`);
            continue;
          }

          console.log(`[Gateway] Attempting transcription with ${provider}...`);
          const client = createAIClient(runtime, provider);
          const model = TRANSCRIPTION_MODELS[provider];

          const transcription = await client.audio.transcriptions.create({
            file,
            model,
          });

          console.log(`[Gateway] ${provider} transcription success: "${transcription.text}"`);
          return json({ text: transcription.text, provider });
        } catch (err) {
          console.warn(`[Gateway] ${provider} transcription failed:`, err.message);
          lastError = err;
        }
      }

      console.error("[Gateway] All transcription providers failed.");
      return error(`Transcription failed: ${lastError?.message}`, 500);
    }

    if (path.includes("/api/translate")) {
      const body = await request.json();
      const { text, target_lang, provider: requestedProvider } = body;
      const provider = requestedProvider || "openai";
      const openai = createAIClient(runtime, provider);
      const model = resolveModel(provider, "main");

      const systemPrompt =
        ALL_BRIQUE_PROMPTS.ophelia?.["task-translate"] ||
        `Translate into ${target_lang}. Return ONLY the text.`;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt.replace("${target_lang}", target_lang),
          },
          { role: "user", content: text },
        ],
      });
      return json({ translated_text: completion.choices[0].message.content });
    }

    if (path.includes("/api/summarize")) {
      const body = await request.json();
      const { text, provider: requestedProvider } = body;
      const provider = requestedProvider || "openai";
      const openai = createAIClient(runtime, provider);
      const model = resolveModel(provider, "main");

      const systemPrompt =
        ALL_BRIQUE_PROMPTS.ophelia?.["task-summarize"] || "Summarize the following text concisely.";

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      });
      return json({ summary: completion.choices[0].message.content });
    }

    if (path.includes("/api/tts")) {
      const body = await request.json();
      const { text, voice, provider = "openai" } = body;

      if (!text) return error("No text provided", 400);

      let buffer;
      if (provider === "kokoro") {
        const kokoroUrl = runtime.getConfig("KOKORO_URL") || "http://localhost:8880";
        const kokoroVoice = voice || "af_bella";
        console.log(
          `[Gateway] Generating Kokoro TTS for: "${text.substring(0, 50)}..." with voice: ${kokoroVoice}`
        );

        const response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "kokoro",
            input: text,
            voice: kokoroVoice,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          return error(`Kokoro API error: ${response.status}`, 500);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          const base64 = data.audio_base64 || data.audio || data.base64;
          if (base64) {
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            buffer = bytes.buffer;
          } else {
            return error("Kokoro API returned JSON without audio data", 500);
          }
        } else {
          buffer = await response.arrayBuffer();
        }
      } else {
        const client = createAIClient(runtime, provider);
        const openAIVoice = voice || "nova";
        console.log(
          `[Gateway] Generating OpenAI TTS for: "${text.substring(0, 50)}..." with voice: ${openAIVoice}`
        );

        const response = await client.audio.speech.create({
          model: "tts-1",
          voice: openAIVoice,
          input: text,
        });
        buffer = await response.arrayBuffer();
      }

      return new Response(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
        },
      });
    }

    // 4. Chat Principal avec Fallback & Directives
    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = { question: "" };
    }

    // 5. Enrichissement avec la Fenêtre Sémantique (si room_id présent)
    if (body.room_id) {
      try {
        const { getSemanticWindow } = await import("./semantic-fusion.js");
        const window = await getSemanticWindow(body.room_id, runtime);
        body.semantic_window = window;
      } catch (e) {
        console.warn("[Gateway] Failed to fetch semantic window:", e);
      }
    }

    const { userQuestion, directiveProvider, directiveModel, debugMode } = parseDirectives(
      body.question || ""
    );
    const identity = resolveIdentity(runtime);
    const role = getRole(body.role || "mediator");

    const providerOrder = buildProviderOrder(runtime, directiveProvider || body.provider);
    const resolvedMode = detectSmartMode(userQuestion, body.mode || "main");
    const encoder = new TextEncoder();
    const voice = body.voice || body.room_settings?.ophelia?.voice || "nova";

    const readable = new ReadableStream({
      async start(controller) {
        let handled = false;

        for (const provider of providerOrder) {
          try {
            const model = resolveModel(provider, resolvedMode, directiveModel || body.model);
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

            console.log(`[DEBUG][Gateway] Calling runOperator with SQL: ${!!sql}`);
            const providerStart = Date.now();
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
            providerMetrics.recordSuccess(provider, model, Date.now() - providerStart);
            break;
          } catch (err) {
            providerMetrics.recordError(provider, null, err);
            console.error(`[Gateway] Provider ${provider} failed, trying next...`, err.message);
            controller.enqueue(
              encoder.encode(
                `<Think>Échec de ${provider} : ${err.message}. Tentative suivante...</Think>\n`
              )
            );
          }
        }

        if (!handled) {
          let fallbackUsed = false;
          try {
            const localAiUrl = await getLocalAiServerUrlForRoom(supabase, getConfig, body.room_id);
            if (localAiUrl) {
              const cleanBase = localAiUrl.replace(/\/+$/, "");
              controller.enqueue(
                encoder.encode(
                  `<Think>Tous les fournisseurs cloud ont échoué, recours au modèle local...</Think>\n`
                )
              );
              const response = await fetch(`${cleanBase}/v1/llm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: userQuestion,
                  max_tokens: body.max_tokens || 512,
                  temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
                }),
              });
              if (response.ok) {
                const data = await response.json();
                const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
                if (text) {
                  controller.enqueue(encoder.encode(text));
                  fallbackUsed = true;
                }
              } else {
                const errText = await response.text().catch(() => "");
                console.error("[Gateway] Local AI fallback HTTP error", response.status, errText);
              }
            }
          } catch (fallbackError) {
            console.error("[Gateway] Local AI fallback failed:", fallbackError);
          }

          if (!fallbackUsed) {
            controller.enqueue(
              encoder.encode(
                `\n❌ Tous les fournisseurs d'IA ont échoué. Veuillez réessayer plus tard.\n`
              )
            );
          }
        }

        // Final Providers Status
        const statusList = providerOrder.map((p) => {
          const entry = providerMetrics.get(p, null);
          return {
            name: p,
            status: entry?.status || "available",
          };
        });
        controller.enqueue(
          encoder.encode(`__PROVIDERS_STATUS__${JSON.stringify({ providers: statusList })}\n`)
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
