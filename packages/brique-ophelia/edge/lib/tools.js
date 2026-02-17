import OpenAI from "https://esm.sh/openai@4";
import { ALL_BRIQUE_TOOLS } from "./gen-all-tools.js";

/**
 * packages/brique-ophelia/edge/lib/tools.js
 * Registre centralisé des outils d'Ophélia et de leurs gestionnaires.
 */

export const ALL_TOOLS = [
  {
    type: "function",
    function: {
      name: "send_room_message",
      description: "Envoyer un message dans la room (texte, game_update, etc.).",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Le type de message (chat, game_update, game_start).",
          },
          content: { type: "string", description: "Le contenu texte." },
          metadata: {
            type: "object",
            description: "Métadonnées optionnelles (ex: gameState).",
          },
        },
        required: ["type", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Recherche des informations actualisées sur Internet.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Requête de recherche courte et précise.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_game",
      description:
        "Arbitrer un jeu social (Pictionary, Mots Croisés) en utilisant Prolog pour les règles et l'IA pour la narration.",
      parameters: {
        type: "object",
        properties: {
          game_id: { type: "string", description: "L'ID du GamePack." },
          action: {
            type: "object",
            description: "L'action du joueur (type, actorId, payload).",
          },
          current_state: {
            type: "object",
            description: "L'état actuel du jeu.",
          },
        },
        required: ["game_id", "action", "current_state"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_code",
      description:
        "Exécuter du code JavaScript de manière sécurisée pour des calculs, du filtrage ou de la logique algorithmique complexe.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "Le code JS à exécuter. Doit retourner une valeur (ex: 'return input.a + input.b').",
          },
          input: {
            type: "object",
            description: "Données d'entrée (JSON) accessibles via la variable 'input'.",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vector_search",
      description:
        "Recherche dans la base de connaissances locale (histoire, documents municipaux).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Question ou requête en français.",
          },
          limit: { type: "integer", default: 5 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sql_query",
      description: "Exécuter une requête SQL SELECT sur la base de données.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Requête SELECT uniquement." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_context",
      description: "Récupère des infos sur l'utilisateur actuel et le contexte.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_capabilities",
      description: "Liste tous les outils disponibles pour l'agent.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "assume_role",
      description: "Endosser un rôle spécifique.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            enum: ["mediator", "analyst", "scribe", "guardian"],
          },
          reason: { type: "string" },
        },
        required: ["role_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_speech_queue",
      description: "Gérer la file d'attente des orateurs.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["invite", "warn_time", "suggest_next"],
          },
          participant_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["action", "participant_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "persist_knowledge",
      description: "Sauvegarder une connaissance cruciale.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          category: { type: "string" },
        },
        required: ["content", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forget_knowledge",
      description: "Supprimer une connaissance obsolète.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          search_term: { type: "string" },
        },
        required: ["category", "search_term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_to_moderation",
      description: "Signaler un comportement inapproprié.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          participant_id: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_providers_status",
      description: "Vérifier l'état des fournisseurs d'IA.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_inseme_room",
      description: "Créer une nouvelle salle de discussion Inseme.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_semantic_window",
      description:
        "Récupère la fenêtre sémantique glissante (moment courant, thèmes, tensions) du salon.",
      parameters: {
        type: "object",
        properties: {
          room_id: {
            type: "string",
            description: "L'ID du salon (si différent du contexte actuel).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "speak",
      description: "Convertir un texte en parole (TTS) et le faire lire par l'interface vocale.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Le texte à vocaliser." },
          voice: {
            type: "string",
            description:
              "La voix à utiliser (ex: nova, alloy pour OpenAI; af_bella, am_adam pour Kokoro).",
          },
          provider: {
            type: "string",
            enum: ["openai", "kokoro"],
            description:
              "Le fournisseur TTS à utiliser (par défaut: openai ou configuré dans le salon).",
          },
        },
        required: ["text"],
      },
    },
  },
];

// Helper functions for vector search
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  return dot(a, b) / (norm(a) * norm(b));
}

export function getAuthorizedTools(runtime, role, identity, briqueTools = []) {
  const { sql, supabase } = runtime;
  const tools = ALL_TOOLS.filter(
    (t) =>
      t.function.name === "assume_role" ||
      !role ||
      !role.allowedTools ||
      role.allowedTools.includes(t.function.name)
  );

  // Outil SQL : seulement si le driver direct est dispo ET que le rôle l'autorise (ou pas de rôle)
  const hasSqlTool = tools.some((t) => t.function.name === "sql_query");
  if (
    !hasSqlTool &&
    sql &&
    (!role || !role.allowedTools || role.allowedTools.includes("sql_query"))
  ) {
    const sqlTool = ALL_TOOLS.find((t) => t.function.name === "sql_query");
    if (sqlTool) tools.push(sqlTool);
  }

  // Intégration des outils dynamiques des briques
  if (Array.isArray(briqueTools)) {
    for (const bt of briqueTools) {
      if (typeof bt === "string") {
        // C'est un ID de brique, on ajoute tous les outils de cette brique
        const toolsForBrique = ALL_BRIQUE_TOOLS.filter((t) => t.briqueId === bt);
        for (const t of toolsForBrique) {
          if (!tools.some((et) => et.function.name === t.function.name)) {
            tools.push(t);
          }
        }
      } else if (bt && bt.function && bt.function.name) {
        // C'est déjà un objet outil
        if (!tools.some((t) => t.function.name === bt.function.name)) {
          tools.push(bt);
        }
      }
    }
  }

  return tools;
}

async function performWebSearch(getConfig, query) {
  const apiKey = getConfig("BRAVE_SEARCH_API_KEY");
  if (!apiKey) return `Recherche web non configurée.`;
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    if (!response.ok) throw new Error(`Brave API: ${response.status}`);
    const data = await response.json();
    let resultText = `🔍 Résultats pour "${query}":\n\n`;
    if (data.web?.results?.length > 0) {
      data.web.results.slice(0, 5).forEach((result, i) => {
        resultText += `📄 ${i + 1}. **${result.title}**\n${result.description}\n🔗 [Source](${result.url})\n\n`;
      });
    } else {
      resultText += "Aucun résultat trouvé.";
    }
    return resultText;
  } catch (error) {
    return `Erreur de recherche: ${error.message}`;
  }
}

function debugLog(runtime, ...args) {
  const isDebug = runtime?.getConfig
    ? runtime.getConfig("DEBUG") === "true" || runtime.getConfig("DEBUG") === true
    : false;
  if (isDebug) {
    console.log("[DEBUG][Tools]", ...args);
  }
}

/**
 * Exécute un outil "interne" et retourne le résultat.
 */
export async function executeInternalTool(runtime, name, args, context = {}) {
  const { getConfig, sql, supabase: optSupabase, openai } = runtime;
  const runtimeSupabase = optSupabase || runtime.supabase;

  debugLog(runtime, "Executing tool:", name, "with args:", JSON.stringify(args));

  switch (name) {
    case "web_search":
      return await performWebSearch(getConfig, args.query);

    case "vector_search":
      if (!openai || !runtimeSupabase) return "Recherche vectorielle non disponible.";
      try {
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: args.query,
        });
        const queryEmb = embeddingRes.data[0].embedding;
        const { data: chunks, error: vErr } = await runtimeSupabase
          .from("knowledge_chunks")
          .select("text,embedding,metadata")
          .limit(200);
        if (vErr) throw vErr;

        const scored = (chunks || [])
          .map((c) => {
            let emb = c.embedding;
            if (typeof emb === "string") emb = JSON.parse(emb);
            return {
              text: c.text,
              title: c.metadata?.title || "Document",
              score: cosineSimilarity(queryEmb, emb),
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, args.limit || 5);

        return scored.map((s) => `### ${s.title}\n${s.text}`).join("\n\n");
      } catch (e) {
        return `Erreur vectorielle: ${e.message}`;
      }

    case "sql_query": {
      const isDebug = runtime.getConfig ? runtime.getConfig("DEBUG") === "true" : false;
      if (isDebug) console.log("[DEBUG][Tools] Executing sql_query:", args.query);

      console.log("[Tools] sql_query execution:", args.query);
      console.log("[Tools] Runtime status - SQL:", !!sql, "Supabase:", !!runtimeSupabase);

      let lastError = "";
      const queryLower = args.query.toLowerCase().trim();

      // 1. Essayer le driver direct si disponible
      if (sql) {
        try {
          if (isDebug) console.log("[DEBUG][Tools] Trying direct SQL driver...");
          console.log("[Tools] Using direct SQL driver (postgresjs)");
          if (!queryLower.startsWith("select")) {
            return "Erreur: Seul SELECT est autorisé via le driver direct.";
          }
          const result = await sql.unsafe(args.query);
          if (isDebug) console.log("[DEBUG][Tools] Direct SQL success, row count:", result?.length);
          console.log("[Tools] SQL direct success, rows:", result?.length);
          return JSON.stringify(result);
        } catch (e) {
          const errorMessage = e.message.replace(/postgres:\/\/.*@/, "postgres://***@");
          if (isDebug) console.error("[DEBUG][Tools] Direct SQL failed:", errorMessage);
          console.error("[Tools] SQL direct execution exception:", errorMessage);
          lastError = `Direct SQL error: ${errorMessage}`;
        }
      }

      // 2. Fallback vers le SDK Supabase (PostgREST API) - PAS DE RPC
      if (runtimeSupabase) {
        if (isDebug) console.log("[DEBUG][Tools] Trying Supabase SDK (PostgREST)...");
        console.log("[Tools] Attempting Supabase SDK for query");

        // Introspection: list tables
        if (queryLower.includes("information_schema.tables")) {
          const { data, error } = await runtimeSupabase
            .from("information_schema.tables")
            .select("table_name")
            .eq("table_schema", "public");
          if (!error) return JSON.stringify(data);
          lastError += ` | SDK Tables error: ${error.message}`;
        }

        // Introspection: list columns
        if (queryLower.includes("information_schema.columns")) {
          const { data, error } = await runtimeSupabase
            .from("information_schema.columns")
            .select("table_name, column_name, data_type")
            .eq("table_schema", "public");
          if (!error) return JSON.stringify(data);
          lastError += ` | SDK Columns error: ${error.message}`;
        }

        // Tentative de parsing pour SELECT simple via l'API Supabase
        const selectMatch = queryLower.match(
          /^select\s+\*\s+from\s+([a-zA-Z0-9_]+)(?:\s+limit\s+(\d+))?$/
        );
        if (selectMatch) {
          const tableName = selectMatch[1];
          const limit = selectMatch[2] ? parseInt(selectMatch[2]) : 10;
          const { data, error } = await runtimeSupabase.from(tableName).select("*").limit(limit);
          if (!error) return JSON.stringify(data);
          lastError += ` | SDK SELECT error: ${error.message}`;
        }
      }

      return `SQL Error: No suitable driver or ${lastError}`;
    }

    case "get_user_context":
      return JSON.stringify({
        room_id: context.room_id || "test-room",
        user_id: context.user_id || "anonymous",
        room_settings: context.room_settings || {},
        site_url: getConfig?.("URL") || "https://lepp.fr",
      });

    case "execute_code": {
      const { code, input = {} } = args;
      try {
        // Isolation basique : on passe input et quelques utilitaires
        // Dans une Edge Function, on n'a pas de Web Worker, donc on utilise new Function avec un scope restreint
        const fn = new Function("input", "Inseme", '"use strict";\n' + code);

        const logs = [];
        const sandboxInseme = {
          log: (...args) => logs.push(args.map(String).join(" ")),
          require: (cond, msg) => {
            if (!cond) throw new Error("Assertion failed: " + msg);
          },
        };

        const result = fn(input, sandboxInseme);
        return JSON.stringify({
          success: true,
          result,
          logs: logs.length > 0 ? logs : undefined,
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: err.message,
        });
      }
    }

    case "list_capabilities":
      return JSON.stringify(
        ALL_TOOLS.map((t) => ({
          name: t.function.name,
          description: t.function.description,
        }))
      );

    case "send_room_message": {
      if (!runtimeSupabase) return "Supabase non disponible.";
      const { type, content, metadata = {} } = args;
      const roomId = context.room_id || "test-room";
      const { error } = await runtimeSupabase.from("messages").insert({
        room_id: roomId,
        type,
        content,
        metadata,
        sender_id: "ophelia",
        sender_name: "Ophélia",
      });
      if (error) return `Erreur envoi message: ${error.message}`;
      return `Message envoyé dans la salle ${roomId}.`;
    }

    case "manage_game": {
      const { game_id, action, current_state } = args;
      try {
        const { createPrologEngine } =
          await import("../../../../packages/cop-prolog/src/index.edge.js");
        const engine = await createPrologEngine();

        // --- Logique Prolog & Business (Centralisée Backend) ---
        let rules = "";
        if (game_id === "pictionary_social") {
          rules = `
            valid_move('DRAW', _Actor, _Payload).
            valid_move('GUESS', _Actor, _Payload).
            valid_move('IA_JUDGE', 'IA', _Payload).
            valid_move('SYSTEM_TICK', 'SYSTEM', _Payload).
            game_over(Score) :- Score >= 100.
          `;
        } else if (game_id === "mots_croises_social") {
          rules = `
            grid_size(5).
            valid_move('FILL_CELL', _Actor, _Payload).
            valid_move('SYSTEM_TICK', 'SYSTEM', _Payload).
            game_over(Grid) :- \\+ member(empty, Grid).
          `;
        }

        const goal = `valid_move('${action.type}', '${action.actorId}', _).`;
        await engine.consult(rules);
        await engine.query(goal);
        const answers = await engine.findAllAnswers();
        const isLegal = answers.length > 0;

        if (!isLegal && action.type !== "SYSTEM_TICK") {
          return JSON.stringify({
            success: false,
            error: "Action non autorisée par Prolog.",
          });
        }

        // --- Business Logic Reduction ---
        let newState = { ...current_state };
        let nextActor = "BROADCAST";
        let instructions = "";

        if (action.type === "SYSTEM_TICK") {
          newState.idle_since = (current_state.idle_since || 0) + 1;
          if (newState.idle_since >= 3) {
            nextActor = "IA";
            instructions = "RELANCE_AMBIANCE";
          }
        } else {
          newState.idle_since = 0;
          newState.history = [...(current_state.history || []), action];

          if (game_id === "pictionary_social") {
            if (action.type === "DRAW") {
              newState.phase = "WAITING_FOR_IA";
              nextActor = "IA";
              instructions = `JUGEMENT_DESSIN: ${action.payload.description}`;
            } else if (action.type === "IA_JUDGE") {
              const score = action.payload.score || 0;
              const player = action.payload.targetPlayer;
              newState.scores[player] = (newState.scores[player] || 0) + score;
              newState.phase = "WAITING_FOR_PLAYER";
              nextActor = "BROADCAST";
              // Leveling persisté
              newState.leveling[player] = Math.floor(newState.scores[player] / 50) + 1;

              // Check game over via Prolog
              await engine.query(`game_over(${newState.scores[player]}).`);
              const overAnswers = await engine.findAllAnswers();
              if (overAnswers.length > 0) newState.phase = "GAME_OVER";
            }
          } else if (game_id === "mots_croises_social") {
            if (action.type === "FILL_CELL") {
              const { index, value } = action.payload;
              newState.grid[index] = value;
              if (newState.display) newState.display.data = [...newState.grid];
              nextActor = "BROADCAST";

              // Check game over via Prolog
              const gridList = newState.grid.map((c) => (c === "empty" ? "empty" : "filled"));
              await engine.query(`game_over([${gridList.join(", ")}]).`);
              const overAnswers = await engine.findAllAnswers();
              if (overAnswers.length > 0) newState.phase = "GAME_OVER";
            }
          }
        }

        return JSON.stringify({
          success: true,
          newState,
          nextActor,
          instructions,
        });
      } catch (err) {
        return JSON.stringify({ success: false, error: err.message });
      }
    }

    case "assume_role":
      return null; // Géré par le frontend via phase: action

    case "create_inseme_room": {
      if (!runtimeSupabase) return "Supabase non disponible.";
      const { data, error } = await runtimeSupabase
        .from("rooms")
        .insert({
          name: args.name,
          description: args.description,
          metadata: args.metadata || {},
        })
        .select()
        .single();
      if (error) return `Erreur création salle: ${error.message}`;
      return `Salle créée avec succès (ID: ${data.id})`;
    }

    case "persist_knowledge":
      if (sql) {
        await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                      VALUES (${context.room_id}, 'Ophélia', ${args.content}, 'knowledge', ${JSON.stringify(args)})`;
      }
      return "Connaissance sauvegardée.";

    case "forget_knowledge":
      if (sql) {
        // Recherche floue par catégorie ou terme
        await sql`DELETE FROM inseme_messages
                  WHERE room_id = ${context.room_id}
                  AND type = 'knowledge'
                  AND (metadata->>'category' = ${args.category} OR message ILIKE ${`%${args.search_term}%`})`;
      }
      return "Connaissance supprimée (si elle existait).";

    case "manage_speech_queue":
      if (sql) {
        await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                      VALUES (${context.room_id}, 'SYSTÈME', ${`Génion de la parole : ${args.action} pour ${args.participant_id}`}, 'speech_queue_log', ${JSON.stringify(args)})`;
      }
      return `Action sur la file de parole enregistrée : ${args.action}.`;

    case "report_to_moderation":
      if (sql) {
        await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                      VALUES (${context.room_id}, 'SYSTÈME', ${`SIGNALEMENT: ${args.reason}`}, 'moderation_log', ${JSON.stringify(args)})`;
      }
      return "Signalement enregistré.";

    case "check_providers_status": {
      const providers = ["openai", "anthropic", "mistral", "google", "groq", "huggingface"];
      const active = providers.filter(
        (p) =>
          !!getConfig(`${p.toUpperCase()}_API_KEY`) || (p === "groq" && !!getConfig("groq_api_key"))
      );
      return `Fournisseurs actifs : ${active.join(", ")}.`;
    }

    case "get_semantic_window": {
      const { getSemanticWindow } = await import("../semantic-fusion.js");
      const roomId = args.room_id || context.room_id;
      if (!roomId) return "Room ID manquant.";
      const window = await getSemanticWindow(roomId, runtime);
      return JSON.stringify(window);
    }

    case "speak": {
      const provider = args.provider || context.room_settings?.ophelia?.tts_provider || "openai";
      const voice =
        args.voice ||
        context.room_settings?.ophelia?.voice ||
        (provider === "kokoro" ? "ff_siwis" : "nova");

      try {
        let buffer;

        if (provider === "kokoro") {
          const kokoroUrl =
            context.room_settings?.ai_server_url ||
            runtime.getConfig("KOKORO_URL") ||
            "http://localhost:8880";
          console.log(
            `[Tools] Generating Kokoro TTS for: "${args.text.substring(0, 50)}..." with voice: ${voice} at ${kokoroUrl}`
          );

          const response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "kokoro",
              input: args.text,
              voice: voice,
              response_format: "mp3",
            }),
          });

          if (!response.ok) {
            throw new Error(`Kokoro API error: ${response.status} ${await response.text()}`);
          }

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            const base64 = data.audio_base64 || data.audio || data.base64;
            if (base64) {
              return {
                result: "Message vocalisé.",
                vocal_payload: base64,
              };
            }
          }
          buffer = await response.arrayBuffer();
        } else {
          if (!openai) return "Service vocal OpenAI non disponible.";
          console.log(
            `[Tools] Generating OpenAI TTS for: "${args.text.substring(0, 50)}..." with voice: ${voice}`
          );

          const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice,
            input: args.text,
          });
          buffer = await response.arrayBuffer();
        }

        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        return {
          result: "Message vocalisé.",
          vocal_payload: base64,
        };
      } catch (e) {
        console.error("[Tools] TTS Error:", e);
        return `Erreur TTS (${provider}): ${e.message}`;
      }
    }

    default:
      return null;
  }
}
