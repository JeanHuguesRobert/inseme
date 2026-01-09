/**
 * packages/brique-ophelia/edge/lib/operator.js
 * Le Cœur d'Ophélia : Boucle itérative LLM + Outils.
 * Restauration de la parité avec rag_chatbotv3.js (multi-turn, stream fallback, thinking).
 */

import { buildSystemPrompt } from "./prompts.js";
import { getAuthorizedTools, executeInternalTool } from "./tools.js";

const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";
const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";

async function broadcastThought(
  supabase,
  room_id,
  thought,
  type = "reasoning"
) {
  if (!supabase || !room_id) return;
  try {
    const channel = supabase.channel(`room:${room_id}`);
    await channel.send({
      type: "broadcast",
      event: "ephemeral_reasoning",
      payload: {
        thought,
        type,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn("[Ophelia] Broadcast failed:", e);
  }
}

function sanitizeHistoryV2(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => {
    let content = m.text || m.content || "";
    if (m.role === "assistant" || m.sender === "assistant") {
      // Remove <Think> blocks from history sent to LLM to save tokens and avoid confusion
      content = content.replace(/<Think>[\s\S]*?<\/Think>/gi, "").trim();
    }
    return {
      role: m.role || (m.sender === "user" ? "user" : "assistant"),
      content,
    };
  });
}

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}

export async function runOperator(runtime, body, options = {}) {
  const { openai, supabase, sql, identity, role, encoder, controller } =
    options;
  const isDebug = runtime.getConfig
    ? runtime.getConfig("DEBUG") === "true"
    : false;

  if (isDebug) {
    console.log("[DEBUG][Operator] Starting runOperator");
    console.log("[DEBUG][Operator] Identity:", identity.name);
    console.log("[DEBUG][Operator] Role:", role.id);
  }

  const { messages, question, room_id, model: userModel } = body;
  const idleTimeoutMs = 30000;

  const systemMsg = await buildSystemPrompt(identity, role, body, runtime);
  if (isDebug)
    console.log("[DEBUG][Operator] Prompt built. Length:", systemMsg.length);

  let fullMessages = [
    { role: "system", content: systemMsg },
    ...sanitizeHistoryV2(messages),
  ];

  if (question) {
    let instruction = question;
    if (Array.isArray(body.brique_tools) && body.brique_tools.length > 0) {
      instruction += `\n\n(IMPORTANT: Tu as accès aux outils des briques suivantes : ${body.brique_tools.join(", ")}. Utilise-les si nécessaire pour répondre à la demande.)`;
    } else {
      instruction +=
        "\n\n(IMPORTANT: Utilise l'outil 'sql_query' pour répondre à cette demande. C'est ton outil principal d'analyste.)";
    }

    fullMessages.push({
      role: "user",
      content: instruction,
    });
  }

  // On enrichit le runtime avec les outils nécessaires
  const fullRuntime = {
    ...runtime,
    supabase: options.supabase || runtime.supabase,
    sql: options.sql || runtime.sql,
    openai: options.openai,
  };

  const tools = await getAuthorizedTools(
    fullRuntime,
    role,
    identity,
    body.brique_tools
  );
  console.log(
    "[Operator] Authorized tools for role",
    role.id,
    ":",
    tools.map((t) => t.function.name)
  );
  let iteration = 0;
  const maxIterations = 3;

  while (iteration < maxIterations) {
    iteration++;
    if (isDebug)
      console.log(`[DEBUG][Operator] Iteration ${iteration}/${maxIterations}`);

    const model = userModel || "gpt-4o";
    if (isDebug)
      console.log("[DEBUG][Operator] Calling LLM with model:", model);

    // Yield thinking metadata
    const iterationThink = `<Think>Itération ${iteration}/${maxIterations} — Appel ${model}</Think>\n`;
    controller.enqueue(encoder.encode(iterationThink));
    await broadcastThought(
      supabase,
      room_id,
      `Réflexion (tour ${iteration})`,
      "llm_reasoning"
    );

    // Nettoyage des outils pour ne garder que ce que l'API LLM attend (type, function)
    const cleanedTools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    let stream;
    try {
      const completionOptions = {
        model,
        messages: fullMessages,
        tools: cleanedTools.length > 0 ? cleanedTools : undefined,
        stream: options.provider !== "groq" && options.provider !== "sovereign", // Disable stream for Groq and Sovereign to get reliable tool calls
      };

      // Groq and Sovereign do not support parallel tool calls reliably yet
      if (options.provider === "groq" || options.provider === "sovereign") {
        completionOptions.parallel_tool_calls = false;
      }

      stream = await openai.chat.completions.create(completionOptions);
    } catch (err) {
      console.error("[Operator] LLM call failed:", err);
      // On ne renvoie pas l'erreur directement au client ici si on veut que le gateway puisse réessayer
      // Mais on doit signaler l'échec pour sortir de la boucle et laisser le gateway gérer.
      throw err;
    }

    let currentAiContent = "";
    let currentToolCalls = [];
    let streamTimedOut = false;

    if (isAsyncIterable(stream)) {
      // Stream consumption with race-timeout (parity with rag_chatbotv3)
      const iterator = stream[Symbol.asyncIterator]();
      try {
        while (true) {
          const nextPromise = iterator.next();
          let res;
          try {
            res = await Promise.race([
              nextPromise,
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("stream-timeout")),
                  idleTimeoutMs
                )
              ),
            ]);
          } catch (err) {
            if (err.message === "stream-timeout") {
              console.warn(
                "[Operator] Stream timeout, switching to direct if needed."
              );
              streamTimedOut = true;
              break;
            }
            throw err;
          }

          if (res.done) break;
          const chunk = res.value;
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            currentAiContent += delta.content;
            controller.enqueue(encoder.encode(delta.content));
          }

          if (delta.reasoning_content) {
            const thinkChunk = `<Think>${delta.reasoning_content}</Think>`;
            controller.enqueue(encoder.encode(thinkChunk));
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!currentToolCalls[tc.index]) {
                currentToolCalls[tc.index] = {
                  id: tc.id,
                  type: "function",
                  function: { name: "", arguments: "" },
                };
              }
              if (tc.id) currentToolCalls[tc.index].id = tc.id;
              if (tc.function?.name)
                currentToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments)
                currentToolCalls[tc.index].function.arguments +=
                  tc.function.arguments;
            }
          }
        }
      } finally {
        if (iterator.return) await iterator.return();
      }
    } else {
      // Direct response (non-streaming)
      const msg = stream.choices[0].message;
      currentAiContent = msg.content || "";
      currentToolCalls = msg.tool_calls || [];

      const reasoning = msg.reasoning_content || msg.thought || "";
      if (reasoning) {
        controller.enqueue(encoder.encode(`<Think>${reasoning}</Think>\n`));
      }

      if (currentAiContent) {
        controller.enqueue(encoder.encode(currentAiContent));
      }
    }

    // If stream was empty or timed out, we might need a direct fallback (simplified here)
    if (
      streamTimedOut &&
      currentAiContent === "" &&
      currentToolCalls.length === 0
    ) {
      controller.enqueue(
        encoder.encode(
          `<Think>Timeout du flux, tentative de repli direct...</Think>\n`
        )
      );
      const direct = await openai.chat.completions.create({
        model,
        messages: fullMessages,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
      });
      const msg = direct.choices[0].message;
      currentAiContent = msg.content || "";
      currentToolCalls = msg.tool_calls || [];
      if (currentAiContent)
        controller.enqueue(encoder.encode(currentAiContent));
    }

    if (!currentToolCalls || currentToolCalls.length === 0) break;

    // Filter out any holes in the array and ensure each tool call is complete
    const validToolCalls = currentToolCalls.filter((tc) => tc && tc.id);

    // DEBUG: Send tool calls structure to client
    controller.enqueue(
      encoder.encode(
        `<Think>DEBUG ToolCalls: ${JSON.stringify(validToolCalls)}</Think>\n`
      )
    );

    // Execute internal tools
    fullMessages.push({
      role: "assistant",
      content: currentAiContent || null,
      tool_calls: validToolCalls,
    });

    for (const tc of validToolCalls) {
      const name = tc.function.name;
      if (!name) continue;

      let args = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch (e) {
        console.warn(
          `[Operator] Failed to parse tool args for ${name}`,
          tc.function.arguments
        );
      }

      // Trace & Broadcast
      const startMsg = { phase: "start", tool: name, timestamp: Date.now() };
      controller.enqueue(
        encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(startMsg)}\n`)
      );
      controller.enqueue(
        encoder.encode(`<Think>Exécution outil : ${name}</Think>\n`)
      );
      await broadcastThought(
        supabase,
        room_id,
        `Outil: ${name}`,
        "tool_execution"
      );

      const t0 = Date.now();
      console.log(`[DEBUG][Operator] Tool: ${name}, SQL: ${!!sql}`);

      let result = await executeInternalTool(
        {
          ...runtime,
          supabase: runtime.supabase || supabase,
          openai,
          sql: sql,
        },
        name,
        args,
        body
      );

      // --- DELEGATION TO DYNAMIC BRIQUE TOOLS ---
      if (!result || result.startsWith("Outil inconnu")) {
        const briqueTool = tools.find((t) => t.function.name === name);

        if (briqueTool && briqueTool.briqueId) {
          try {
            const briqueId = briqueTool.briqueId;
            const toolUrl = `${runtime.url.origin}/api/tools/${briqueId}/${name}`;
            console.log(`[Ophelia] Delegating to brique tool: ${toolUrl}`);

            const toolResponse = await fetch(toolUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });

            if (toolResponse.ok) {
              result = await toolResponse.text();
            } else {
              result = `Erreur lors de l'appel à l'outil brique ${name}: ${toolResponse.statusText}`;
            }
          } catch (e) {
            result = `Erreur d'exécution de l'outil brique ${name}: ${e.message}`;
          }
        }
      }
      const t1 = Date.now();

      if (result !== null) {
        fullMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
        const finishMsg = {
          phase: "finish",
          tool: name,
          durationMs: t1 - t0,
          timestamp: Date.now(),
        };
        controller.enqueue(
          encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(finishMsg)}\n`)
        );
      } else {
        // External/Asynchronous tool (handled by frontend)
        controller.enqueue(
          encoder.encode(
            `${TOOL_TRACE_PREFIX}${JSON.stringify({
              phase: "action",
              action: name,
              tool: name,
              args,
              timestamp: Date.now(),
            })}\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `<Think>Action externe ${name} demandée — Attente réponse client.</Think>\n`
          )
        );
        return; // Break multi-turn as we depend on client
      }
    }
  }
}
