// netlify/edge-functions/rag_chatbot.js

// ============================================================================
// CONFIGURATION - Modèles et paramètres par défaut
// ============================================================================

import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../cop-host/src/config/instanceConfig.edge.js";

import { ALL_BRIQUE_PROMPTS } from "./lib/gen-all-prompts.js";

import createClient from "@supabase/supabase-js";

// TODO: should load OpenAI from bundle, not from esm.sh
// import OpenAI from "../../common/lib/openai.js";
import OpenAI from "https://esm.sh/openai@4";

const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
import { providerMetrics } from "./lib/provider-metrics.js";
const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";
const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";

const MODEL_MODES = {
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
    reasoning: "magistral-medium-latest",
  },

  anthropic: {
    main: "claude-sonnet-4-5-20250929",
    cheap: "claude-3-haiku-20240307",
  },

  openai: {
    main: "gpt-4.1",
    reasoning: "gpt-5.1",
    cheap: "gpt-4.1-nano",
  },

  google: {
    // Le modèle le plus intelligent (Gemini 3)
    main: "gemini-3-pro-preview",
    // Le modèle rapide et stable (Gemini 2.5 Flash)
    fast: "gemini-2.5-flash",
    // Modèle de raisonnement avancé (Thinking)
    reasoning: "gemini-2.0-flash-thinking-exp",
    // Pas cher
    cheap: "gemini-2.5-flash-lite",
  },

  huggingface: {
    // Chat généraliste (non limité au reasoning)
    main: "deepseek-ai/DeepSeek-V3",
    // Version plus légère (distill, toujours capable de reasoning mais moins coûteuse)
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    // Gros modèle reasoning quand tu veux l’artillerie lourde
    reasoning: "deepseek-ai/DeepSeek-R1",
  },

  grok: {
    main: "grok-4-fast-reasoning",
    fast: "grok-4-fast-non-reasoning",
    reasoning: "grok-4-fast-reasoning",
  },

  groq: {
    main: "llama-3.3-70b-versatile",
    fast: "llama-3.1-8b-instant",
    strong: "llama-3.3-70b-specdec",
  },
};

const DEFAULT_MODEL_MODE = {
  mistral: "fast",
  anthropic: "main",
  openai: "reasoning", // Changé à reasoning pour gpt-5.1
  huggingface: "main",
  google: "main",
  grok: "main",
  groq: "main",
};

const MODEL_MODE_DIRECTIVE_REGEX = /model_mode\s*=\s*([^\s;]+)/i;

const resolveModelForProvider = (provider, overrideMode) => {
  const providerModes = MODEL_MODES[provider];
  if (!providerModes) {
    console.warn(`[resolveModel] No modes defined for provider: ${provider}`);
    return undefined;
  }

  const candidateMode =
    overrideMode && providerModes[overrideMode]
      ? overrideMode
      : DEFAULT_MODEL_MODE[provider] || Object.keys(providerModes)[0];

  const resolved = providerModes[candidateMode];
  return resolved;
};

// ============================================================================
// OUTILS (TOOLS) - Définition centralisée
// ============================================================================

const TOOLS = {
  web_search: {
    name: "web_search",
    description:
      "Recherche des informations actualisées sur Internet. Utilise cet outil pour des questions sur des actualités, horaires, ou données externes (ex: 'horaires mairie corte 2025').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Requête de recherche courte et précise (3-8 mots).",
          minLength: 3,
          maxLength: 50,
        },
      },
      required: ["query"],
    },
  },
  vector_search: {
    name: "vector_search",
    description:
      "Recherche dans la base de connaissances locale pour des questions sur l'histoire locale, événements passés, conseils municipaux, etc.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Question ou requête de recherche en français.",
        },
        source_type: {
          type: "string",
          description:
            "Optional filter to only search chunks from a specific source_type (e.g., 'wiki_page').",
        },
        domain: {
          type: "string",
          description: "Optional filter for domain field (e.g., 'wiki', 'history').",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return (defaults to 5).",
        },
      },
      required: ["query"],
    },
  },
  wiki_search: {
    name: "wiki_search",
    description:
      "Search within the wiki pages indexed in the knowledge_chunks table (source_type = 'wiki_page').",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Question or search query" },
        limit: { type: "integer", description: "Max results to return" },
      },
      required: ["query"],
    },
  },
  sql_query: {
    name: "sql_query",
    description:
      "Execute a read-only SQL query against the database for advanced data access. Only SELECT queries are allowed. The model should target the condensed schema below and return only requested columns. Avoid UPDATE/INSERT/DELETE. Responses are JSON by default unless you request markdown explicitly.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL SELECT query to execute. Must be read-only (SELECT only).",
        },
        limit: {
          type: "integer",
          description: "Maximum number of rows to return (default 100).",
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description:
            "Output format. Defaults to 'json'. Set to 'markdown' only when a tabular rendition is explicitly required.",
        },
      },
      required: ["query"],
    },
  },
  create_post: {
    name: "create_post",
    description:
      "Publie un nouveau message, une annonce ou une pensée. Ne PAS utiliser pour des tâches ou des propositions.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Le contenu du message (Markdown supporté).",
        },
        title: { type: "string", description: "Titre optionnel du message." },
        group_id: {
          type: "string",
          description: "ID du groupe où publier (optionnel).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Liste de tags (ex: ['urgent', 'event']).",
        },
      },
      required: ["content"],
    },
  },
  update_post: {
    name: "update_post",
    description: "Modifie un message existant.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du message à modifier." },
        content: { type: "string", description: "Nouveau contenu." },
        title: { type: "string", description: "Nouveau titre." },
      },
      required: ["id"],
    },
  },
  list_posts: {
    name: "list_posts",
    description: "Liste les messages récents, filtrables par groupe ou type.",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Filtrer par groupe." },
        limit: {
          type: "integer",
          description: "Nombre max de résultats (défaut 10).",
        },
        query: {
          type: "string",
          description: "Recherche textuelle dans le contenu.",
        },
      },
    },
  },
  create_task: {
    name: "create_task",
    description: "Crée une nouvelle tâche dans un projet ou un groupe.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de la tâche." },
        description: { type: "string", description: "Description détaillée." },
        project_id: {
          type: "string",
          description: "ID du projet (groupe type task_project) ou groupe parent.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked"],
          description: "Statut initial.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priorité.",
        },
        assignee_id: {
          type: "string",
          description: "ID de l'utilisateur assigné.",
        },
      },
      required: ["title"],
    },
  },
  update_task: {
    name: "update_task",
    description: "Met à jour une tâche (statut, assignation, détails).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID de la tâche." },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked"],
        },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string" },
      },
      required: ["id"],
    },
  },
  list_tasks: {
    name: "list_tasks",
    description: "Liste les tâches, filtrables par projet, statut ou assignation.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID du projet." },
        status: { type: "string", description: "Filtrer par statut." },
        assignee_id: {
          type: "string",
          description: "Filtrer par assigné (me = moi).",
        },
        limit: { type: "integer", description: "Max résultats." },
      },
    },
  },
  create_mission: {
    name: "create_mission",
    description: "Crée une nouvelle mission (groupe d'action).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de la mission." },
        description: { type: "string", description: "Objectif de la mission." },
        location: { type: "string", description: "Lieu (optionnel)." },
      },
      required: ["name"],
    },
  },
  update_mission: {
    name: "update_mission",
    description: "Met à jour une mission.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID de la mission." },
        name: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
        status: { type: "string", enum: ["active", "completed", "archived"] },
      },
      required: ["id"],
    },
  },
  list_missions: {
    name: "list_missions",
    description: "Liste les missions disponibles.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Recherche par nom." },
        limit: { type: "integer", description: "Max résultats." },
      },
    },
  },
  join_group: {
    name: "join_group",
    description: "Rejoint un groupe ou une mission.",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "ID du groupe à rejoindre." },
      },
      required: ["group_id"],
    },
  },
  leave_group: {
    name: "leave_group",
    description: "Quitte un groupe ou une mission.",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "ID du groupe à quitter." },
      },
      required: ["group_id"],
    },
  },
  list_my_groups: {
    name: "list_my_groups",
    description: "Liste les groupes dont je suis membre.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  create_proposition: {
    name: "create_proposition",
    description: "Crée une proposition pour le vote.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de la proposition." },
        description: { type: "string", description: "Description détaillée." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags associés (ex: ['urbanisme', 'budget']).",
        },
      },
      required: ["title"],
    },
  },
  update_proposition: {
    name: "update_proposition",
    description: "Met à jour une proposition.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID de la proposition." },
        status: { type: "string", enum: ["active", "closed", "draft"] },
        title: { type: "string" },
      },
      required: ["id"],
    },
  },
  list_propositions: {
    name: "list_propositions",
    description: "Liste les propositions actives.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filtrer par statut (défaut: active).",
        },
        tag: { type: "string", description: "Filtrer par tag." },
        limit: { type: "integer", description: "Max résultats." },
      },
    },
  },
  vote_proposition: {
    name: "vote_proposition",
    description: "Vote pour ou contre une proposition.",
    parameters: {
      type: "object",
      properties: {
        proposition_id: {
          type: "string",
          description: "ID de la proposition.",
        },
        value: {
          type: "integer",
          enum: [1, -1, 0],
          description: "1 (Pour), -1 (Contre), 0 (Neutre/Retrait).",
        },
      },
      required: ["proposition_id", "value"],
    },
  },
  create_wiki_page: {
    name: "create_wiki_page",
    description: "Crée une nouvelle page Wiki.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de la page." },
        content: { type: "string", description: "Contenu (Markdown)." },
        summary: { type: "string", description: "Résumé court." },
      },
      required: ["title", "content"],
    },
  },
  update_wiki_page: {
    name: "update_wiki_page",
    description: "Met à jour une page Wiki.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID de la page." },
        content: { type: "string" },
        summary: { type: "string" },
      },
      required: ["id"],
    },
  },
  get_wiki_page: {
    name: "get_wiki_page",
    description: "Récupère le contenu d'une page Wiki.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID de la page (optionnel si title fourni).",
        },
        title: {
          type: "string",
          description: "Titre exact (optionnel si id fourni).",
        },
      },
    },
  },
  add_reaction: {
    name: "add_reaction",
    description: "Ajoute une réaction (emoji) à un post.",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID du post." },
        emoji: { type: "string", description: "Emoji (ex: '👍', '❤️')." },
      },
      required: ["post_id", "emoji"],
    },
  },
  create_comment: {
    name: "create_comment",
    description: "Ajoute un commentaire à un post.",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID du post." },
        content: { type: "string", description: "Contenu du commentaire." },
      },
      required: ["post_id", "content"],
    },
  },
  get_schema_info: {
    name: "get_schema_info",
    description: "Retourne des informations sur la structure de la base de données.",
    parameters: {
      type: "object",
      properties: {
        table: { type: "string", description: "Nom de la table (optionnel)." },
      },
    },
  },
  get_user_context: {
    name: "get_user_context",
    description: "Retourne les informations sur l'utilisateur actuel et le contexte de navigation.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  list_capabilities: {
    name: "list_capabilities",
    description: "Liste tous les outils disponibles pour l'agent.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  // Ajoute d'autres outils ici (ex: search_local_db, weather, etc.)
};

// ============================================================================
// GESTIONNAIRES D'OUTILS - Fonctions d'exécution
// ============================================================================

const TOOL_HANDLERS = {
  web_search({ query }) {
    return performWebSearch(query);
  },
  async vector_search({ query, source_type, domain, limit = 5 }, { supabase, openai }) {
    console.log(`[VectorSearch] ➜ query=${previewForLog(query)}`);
    if (!supabase || !openai) {
      return `Recherche vectorielle non configurée.`;
    }
    try {
      // Embed the query
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Fetch chunks (limit to 1000 for performance)
      let qb = supabase.from("knowledge_chunks").select("id,text,embedding,metadata");
      if (source_type) qb = qb.eq("source_type", source_type);
      if (domain) qb = qb.eq("domain", domain);
      const { data, error } = await qb.limit(1000);

      if (error) {
        console.error(`[VectorSearch] ❌ Supabase error:`, error);
        return `Erreur de recherche: ${error.message}`;
      }

      if (!data || data.length === 0) {
        return "Aucun résultat trouvé dans la base de connaissances locale.";
      }

      // Parse embeddings and compute cosine similarity
      const scored = data.map((chunk) => {
        let emb = chunk.embedding;
        if (typeof emb === "string") {
          try {
            emb = JSON.parse(emb);
          } catch {
            emb = emb.split(",").map(Number);
          }
        }
        const similarity = cosineSimilarity(queryEmbedding, emb);
        return { chunk, score: similarity };
      });

      // Sort by similarity descending
      scored.sort((a, b) => b.score - a.score);

      // Take top limit
      const topResults = scored.slice(0, limit);

      let result = `📚 Résultats de la recherche locale pour "${query}":\n\n`;
      topResults.forEach((item, i) => {
        const title = item.chunk.metadata?.title || `Résultat ${i + 1}`;
        result += `📄 **${title}**\n`;
        result += `${item.chunk.text.substring(0, 500)}...\n\n`;
      });

      console.log(`[VectorSearch] ✅ ${topResults.length} résultats`);
      return result;
    } catch (error) {
      console.error(`[VectorSearch] ❌ Erreur:`, error);
      return `⚠️ Erreur de recherche vectorielle: ${error.message}`;
    }
  },
  async wiki_search({ query, limit = 5 }, { supabase, openai }) {
    // Delegate to vector_search with specific filter
    try {
      return await TOOL_HANDLERS.vector_search(
        { query, source_type: "wiki_page", limit },
        { supabase, openai }
      );
    } catch (err) {
      console.error(`[WikiSearch] ❌ Error:`, err);
      return `⚠️ Erreur de recherche wiki: ${err.message}`;
    }
  },

  async sql_query({ query }, { supabase }) {
    console.log(`[SqlQuery] ➜ query=${previewForLog(query)}`);
    if (!supabase) return "Base de données non configurée.";
    try {
      // Nettoyage basique
      const cleanQuery = query.trim().replace(/;+$/, "");
      if (
        !cleanQuery.toLowerCase().startsWith("select") &&
        !cleanQuery.toLowerCase().startsWith("with")
      ) {
        return "Erreur: Seules les requêtes SELECT (lecture seule) sont autorisées.";
      }

      // Tentative via RPC exec_sql (standard dans nos instances)
      const { data, error } = await supabase.rpc("exec_sql", {
        sql_query: cleanQuery,
      });
      if (error) {
        console.warn(
          `[SqlQuery] ⚠️ RPC exec_sql failed, trying direct query if admin: ${error.message}`
        );
        // Fallback: si c'est un client admin, on pourrait tenter autre chose,
        // mais l'RPC est la méthode privilégiée pour les Edge Functions.
        return `Erreur SQL: ${error.message}`;
      }

      const rows = Array.isArray(data) ? data : data?.rows || [];
      console.log(`[SqlQuery] ✅ ${rows.length} lignes retournées`);
      return JSON.stringify(rows);
    } catch (error) {
      console.error(`[SqlQuery] ❌ Erreur:`, error);
      return `⚠️ Erreur d'exécution SQL: ${error.message}`;
    }
  },

  get_user_context(_, { user, context }) {
    console.log(`[UserContext] ➜ user=${user?.id || "anonymous"}`);
    return JSON.stringify({
      user: user
        ? {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata,
            role: user.role,
          }
        : null,
      navigation_context: context || {},
      timestamp: new Date().toISOString(),
    });
  },

  list_capabilities() {
    console.log(`[Capabilities] ➜ listing ${Object.keys(TOOLS).length} tools`);
    return JSON.stringify(
      Object.values(TOOLS).map((t) => ({
        name: t.name,
        description: t.description,
      }))
    );
  },

  // Ajoute d'autres handlers ici
};

function formatMarkdownCell(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return `\`${JSON.stringify(value)}\``;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// UTIL: small preview helper for logs
function previewForLog(value, max = 400) {
  try {
    let s = typeof value === "string" ? value : JSON.stringify(value);
    // Masquage des secrets (DSN Postgres, clés d'API, tokens)
    s = s.replace(/postgres:\/\/.*@/g, "postgres://***@");
    s = s.replace(
      /(key|token|password|auth|secret)["']?\s*[:=]\s*["']?([^"'\s,}]*)/gi,
      (m, p1, p2) => {
        return `${p1}": "***"`;
      }
    );
    return s.length > max ? s.slice(0, max) + "..." : s;
  } catch {
    let s = String(value);
    s = s.replace(/postgres:\/\/.*@/g, "postgres://***@");
    return s.slice(0, max) + (s.length > max ? "..." : "");
  }
}

// Vector similarity helpers
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

// ============================================================================
// BRAVE SEARCH - Outil de recherche web (amélioré)
// ============================================================================

async function performWebSearch(query) {
  console.log(`[WebSearch] ➜ request query=${previewForLog(query)}`);
  const apiKey = getConfig("BRAVE_SEARCH_API_KEY");
  if (!apiKey) {
    console.warn("[WebSearch] ⚠️ BRAVE_SEARCH_API_KEY manquant");
    return `Recherche web non configurée pour: "${query}". Réponds en t'excusant et en proposant une alternative si possible.`;
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", "10");
    url.searchParams.append("search_lang", "fr");
    url.searchParams.append("country", "FR");

    console.log(`[WebSearch] 🌐 fetch url=${previewForLog(url.toString())}`);
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    console.log(`[WebSearch] ⬅ status=${response.status}`);
    if (!response.ok) throw new Error(`Brave API: ${response.status}`);

    const data = await response.json();
    console.log(`[WebSearch] ⬅ data preview: ${previewForLog(data)}`);

    let resultText = `🔍 Résultats pour "${query}":\n\n`;

    // Résultats web classiques
    if (data.web?.results?.length > 0) {
      data.web.results.slice(0, 10).forEach((result, i) => {
        resultText += `📄 ${i + 1}. **${result.title}**\n`;
        resultText += `${result.description?.substring(0, 300) || "Pas de description"}...\n`;
        resultText += `🔗 [Source](${result.url})\n\n`;
      });
    } else {
      resultText += "Aucun résultat web trouvé.\n\n";
    }

    // Résultats locaux
    if (data.locations?.results?.length > 0) {
      resultText += `📍 **Infos locales :**\n`;
      data.locations.results.slice(0, 10).forEach((loc) => {
        resultText += `- **${loc.title}**\n`;
        if (loc.address) resultText += `  📍 ${loc.address}\n`;
        if (loc.phone) resultText += `  📞 ${loc.phone}\n`;
        if (loc.hours) resultText += `  ⏰ ${loc.hours}\n`;
      });
    }

    console.log(`[WebSearch] ✅ ${data.web?.results?.length || 0} résultats formatés`);
    return resultText;
  } catch (error) {
    console.error("[WebSearch] ❌ Erreur:", error.message);
    return `⚠️ Erreur de recherche: ${error.message}. Je ne peux pas accéder à Internet pour le moment.`;
  }
}

// ============================================================================
// UTILITAIRES - Fonctions communes
// ============================================================================
const parseToolArguments = (raw) => {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
};

const isAsyncIterable = (value) =>
  Boolean(value && typeof value[Symbol.asyncIterator] === "function");

// Update executeToolCalls to accept a fallbackContext for missing arguments
// Update executeToolCalls to support parallel execution and pass user context
async function executeToolCalls(
  toolCalls,
  provider = "mistral",
  fallbackContext = {},
  supabase,
  openai,
  metaCollector = null,
  toolEventEmitter = null,
  debugMode = false,
  user = null,
  context = {}
) {
  console.log(`[${provider}] 🔁 executeToolCalls parallel called count=${toolCalls.length}`);
  const toolPromises = toolCalls.map(async (call) => {
    try {
      const toolName = call.function?.name || call.name;
      let args = parseToolArguments(call.function?.arguments || call.arguments);
      console.log(`[${provider}] ➜ Tool call: ${toolName} args=${previewForLog(args, 400)}`);

      // Apply fallback logic for web_search: use question if query is missing
      if (toolName === "web_search") {
        if (!args || !args.query) {
          const fallbackQuery = fallbackContext?.web_search?.query || fallbackContext?.defaultQuery;
          if (fallbackQuery && typeof fallbackQuery === "string" && fallbackQuery.trim()) {
            args = { ...args, query: fallbackQuery };
            console.log(`[${provider}] ℹ️ web_search fallback -> query="${fallbackQuery}"`);
          }
        }
      }

      // Validate required parameters based on TOOLS definition
      const toolDef = Object.values(TOOLS).find((t) => t.name === toolName);
      if (toolDef) {
        const required = toolDef.parameters?.required || [];
        let hasAllRequired = true;
        for (const r of required) {
          if (
            !args ||
            args[r] === undefined ||
            args[r] === null ||
            (typeof args[r] === "string" && args[r].trim() === "")
          ) {
            hasAllRequired = false;
            break;
          }
        }
        if (!hasAllRequired) {
          console.warn(
            `[${provider}] ⚠️ Paramètres manquants pour ${toolName} (call id=${call.id}). Ignoré.`
          );
          return {
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: `Erreur: Paramètres requis manquants pour ${toolName}.`,
          };
        }
      }

      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        console.warn(`[${provider}] Outil non géré: ${toolName}`);
        return {
          role: "tool",
          tool_call_id: call.id,
          name: toolName,
          content: `Erreur: Outil "${toolName}" non supporté.`,
        };
      }

      if (toolName === "sql_query" && debugMode) {
        const rawQuery = typeof args?.query === "string" ? args.query.trim() : "";
        if (rawQuery) {
          const preview = previewForLog(rawQuery, 800);
          const debugMessage = `💡 SQL (debug) requête exécutée :\n${preview}`;
          toolEventEmitter?.({
            phase: "notice",
            provider,
            tool: toolName,
            callId: call.id,
            message: debugMessage,
            timestamp: Date.now(),
            debugSql: {
              query: rawQuery,
              preview,
            },
          });
        }
      }

      console.log(`[${provider}] 🛠 Exécution de ${toolName} avec:`, args);
      toolEventEmitter?.({
        phase: "start",
        provider,
        tool: toolName,
        callId: call.id,
        timestamp: Date.now(),
        argumentsPreview: previewForLog(args, 200),
      });
      const t0 = Date.now();
      const output = await handler(args, {
        supabase,
        openai,
        debugMode,
        user,
        context,
      });
      const t1 = Date.now();
      console.log(
        `[${provider}] ⬅ Tool result for ${toolName} preview: ${previewForLog(output, 400)}`
      );

      toolEventEmitter?.({
        phase: "finish",
        provider,
        tool: toolName,
        callId: call.id,
        durationMs: t1 - t0,
        resultPreview: previewForLog(output, 200),
        timestamp: Date.now(),
      });

      if (toolName === "sql_query") {
        toolEventEmitter?.({
          phase: "notice",
          provider,
          tool: toolName,
          callId: call.id,
          message: "🛠️ L'outil SQL a terminé, reprise de la réponse…",
          timestamp: Date.now(),
        });
      }

      if (metaCollector) {
        metaCollector.tool_trace = metaCollector.tool_trace || [];
        metaCollector.tool_trace.push({
          id: call.id,
          name: toolName,
          duration_ms: t1 - t0,
          result_preview: previewForLog(output, 400),
        });
      }

      return {
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: output,
      };
    } catch (error) {
      console.error(`[${provider}] ❌ Erreur outil:`, error);
      toolEventEmitter?.({
        phase: "error",
        provider,
        tool: call.function?.name || call.name,
        callId: call.id,
        error: error?.message || String(error),
        timestamp: Date.now(),
      });
      return {
        role: "tool",
        tool_call_id: call.id,
        name: call.function?.name || call.name,
        content: `⚠️ Erreur: ${error.message}`,
      };
    }
  });

  return await Promise.all(toolPromises);
}

// ============================================================================
// APPels API - Gestion unifiée des LLM (Mistral, Anthropic, OpenAI)
// ============================================================================
const PROVIDER_CONFIGS = {
  mistral: {
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    toolFormat: "openai", // Mistral utilise le même format qu'OpenAI
  },
  anthropic: {
    apiUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-opus-20240229",
    toolFormat: "anthropic", // Format spécifique
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    toolFormat: "openai", // ✅ Identique à Mistral (SSE)
  },
  huggingface: {
    apiUrl: (_model) => `https://router.huggingface.co/v1/chat/completions`,
    defaultModel: "mistralai/Mixtral-8x22B-Instruct-v0.1",
    toolFormat: null, // Pas de support des outils
  },
  google: {
    // Utilisation de l'endpoint de compatibilité OpenAI de Google
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
    toolFormat: "openai", // Gemini via cet endpoint supporte le format OpenAI
  },
};

function formatToolsForProvider(tools, provider) {
  const config = PROVIDER_CONFIGS[provider];
  if (config.toolFormat === "anthropic") {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  } else if (config.toolFormat === "openai") {
    return tools.map((tool) => ({
      type: "function",
      function: tool,
    }));
  } else {
    return []; // Pas de support des outils
  }
}

async function callLLMAPI({
  provider,
  model,
  messages,
  _tools = [],
  toolChoice = "auto",
  stream = true,
}) {
  const config = PROVIDER_CONFIGS[provider];
  // GESTION SPÉCIFIQUE POUR LA CLÉ API GEMINI
  let apiKey;
  if (provider === "google") {
    apiKey = getConfig("GEMINI_API_KEY");
  } else {
    apiKey = getConfig(`${provider.toUpperCase()}_API_KEY`);
  }
  if (!apiKey) throw new Error(`Clé API manquante pour ${provider}`);

  const formattedTools = formatToolsForProvider(Object.values(TOOLS), provider);
  const payload = {
    model: model || config.defaultModel,
    messages,
    ...(formattedTools.length ? { tools: formattedTools } : {}),
    ...(toolChoice !== "none" ? { tool_choice: toolChoice } : {}),
    stream: stream && provider !== "huggingface",
    temperature: 0.3,
    top_p: 0.95,
  };

  // Add extended thinking for Anthropic (Claude)
  if (provider === "anthropic") {
    payload.thinking = {
      type: "enabled",
      budget_tokens: 2000, // Adjust based on your needs
    };
  }

  // Debug: request payload summary
  console.log(
    `[LLM] ➜ ${provider} request: model=${payload.model}, messages=${payload.messages?.length || 0}, tools=${formattedTools.length}, stream=${payload.stream}`
  );
  console.log(
    `[LLM] ➜ ${provider} payload preview: ${previewForLog({ model: payload.model, firstMessage: payload.messages?.[0]?.content || "", toolCount: formattedTools.length }, 100)}`
  );

  const apiUrl = typeof config.apiUrl === "function" ? config.apiUrl(model) : config.apiUrl;

  // Headers spécifiques par provider
  const headers = {
    "Content-Type": "application/json",
  };
  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.log(`[LLM] ⬅ ${provider} response status=${response.status} stream=${stream}`);

  if (!response.ok) {
    const body = await response.text();
    console.error(`[LLM] ❌ ${provider} error body preview: ${previewForLog(body)}`);
    throw new Error(`${provider} API ${response.status}: ${body}`);
  }

  if (!stream || provider === "huggingface") {
    const data = await response.json();
    console.log(`[LLM] ⬅ ${provider} non-stream preview: ${previewForLog(data, 1000)}`);
    // For Anthropic we keep legacy handling (thinking blocks, tool_uses normalization).
    // For other providers return the raw JSON so callers can normalize different shapes.
    if (provider === "anthropic") return handleDirectResponse(data, provider);
    return data;
  } else {
    console.log(`[LLM] ⬅ ${provider} streaming start`);
    return handleStreamingResponse(response, provider);
  }
}

// Update handleStreamingResponse to yield event objects instead of raw strings
async function* handleStreamingResponse(response, provider) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolCalls = [];
  let fullContent = "";

  // Buffering for tool call fragments: id -> { name, argsStr }
  const pendingToolArgs = new Map();
  const pushedToolIds = new Set();
  const context = {
    pendingToolArgs,
    pushedToolIds,
    toolCalls,
    toolFragmentCounter: 0,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const payload = trimmed.startsWith("data:")
        ? trimmed.slice(trimmed.indexOf(":") + 1).trim()
        : trimmed;
      if (!payload || payload === "[DONE]") continue;

      try {
        // Small preview to help debugging
        const preview = payload.length > 300 ? payload.slice(0, 300) + "..." : payload;
        const data = JSON.parse(payload);
        const delta = provider === "anthropic" ? data.delta : data.choices?.[0]?.delta;
        const hasToolDelta =
          Boolean(delta?.tool_calls?.length) ||
          Boolean(delta?.tool_call) ||
          Boolean(delta?.tool_use?.length);
        const onlyContentDelta =
          Boolean(delta?.content) && !hasToolDelta && !delta?.tool_use?.length;
        const shouldLogPayload = !onlyContentDelta;

        if (shouldLogPayload) {
          console.log(`[${provider}] [SSE] incoming payload preview: ${preview}`);
          console.log(`[${provider}] [SSE] parsed keys: ${Object.keys(data).join(",")}`);
          if (delta) {
            console.log(`[${provider}] [SSE] delta keys: ${Object.keys(delta).join(",")}`);
          }
        }

        if (provider === "anthropic") {
          // Handle thinking blocks (extended thinking feature)
          if (delta?.type === "thinking" && delta?.thinking) {
            // Wrap thinking in <Think> tags for frontend
            const thinkingText = `<Think>${delta.thinking}</Think>`;
            fullContent += thinkingText;
            yield thinkingText;
          }

          // Handle regular text content
          if (delta?.text) {
            fullContent += delta.text;
            yield delta.text;
          }

          // Handle tool calls
          const calls = delta?.tool_use ? delta.tool_use.map(normalizeToolCall) : [];
          if (calls.length) toolCalls.push(...calls);
        } else {
          if (delta?.content) {
            fullContent += delta.content;
            yield delta.content;
          }
          const rawToolCalls = delta?.tool_calls || (delta?.tool_call ? [delta.tool_call] : []);
          if (rawToolCalls.length) {
            for (const raw of rawToolCalls) {
              processToolCallFragment(context, raw, provider);
            }
            while (context.toolCalls.length > 0) {
              const call = context.toolCalls.shift();
              toolCalls.push(call);
              yield { type: "tool_call", call };
            }
          }
        }
      } catch (err) {
        console.error(`[${provider}] [SSE] Erreur parsing payload: ${err.message}`, {
          payloadPreview: payload.slice(0, 200),
        });
      }
    }
  }

  return {
    content: fullContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

function handleDirectResponse(data, provider) {
  if (provider === "anthropic") {
    let content = "";

    // Check for thinking blocks
    if (data.thinking && Array.isArray(data.thinking)) {
      const thinkingContent = data.thinking.map((t) => t.content || t.text || "").join("\n");
      if (thinkingContent) {
        content += `<Think>${thinkingContent}</Think>\n\n`;
      }
    }

    // Add regular content
    content += data.content[0].text;

    return {
      content,
      toolCalls: data.tool_uses || [],
    };
  }
}

// Replace previous normalizeToolCall definition:
const normalizeToolCall = (call, idx = 0) => {
  // Accept multiple possible shapes and extract function-like properties
  const fnShape = call.function || call.tool || call.action || call.intent || call.metadata || {};
  let name =
    fnShape.name ||
    call.name ||
    call.tool?.name ||
    call.action?.name ||
    call.intent?.name ||
    call.metadata?.name ||
    "";
  let args = fnShape.arguments ?? call.arguments ?? call.params ?? call.payload ?? "{}";

  if (args == null) args = "{}";
  if (typeof args !== "string") {
    try {
      args = JSON.stringify(args);
    } catch {
      args = String(args);
    }
  }

  // Heuristic inference for missing function name
  if (!name || !name.trim()) {
    try {
      const parsedArgs = JSON.parse(args || "{}");
      if (parsedArgs && typeof parsedArgs === "object") {
        if (parsedArgs.query) {
          name = "web_search";
        }
        // Add additional heuristics here as needed
      }
    } catch {
      // ignore
    }
  }

  name = (name || "").trim();

  return {
    id: call.id || `tool-${Date.now()}-${idx}`,
    type: "function",
    function: {
      name,
      arguments: args,
    },
  };
};
const normalizeToolCalls = (calls = []) => calls.map(normalizeToolCall);

// New helper: assemble tool call fragments and push complete calls to toolCalls
function processToolCallFragment(context, raw, provider) {
  const { pendingToolArgs, pushedToolIds, toolCalls } = context;
  context.toolFragmentCounter = context.toolFragmentCounter || 0;

  const id =
    raw.id ||
    raw.tool_call_id ||
    raw.tool_call?.id ||
    `tool-${Date.now()}-${context.toolFragmentCounter++}`;

  const fn = raw.function || raw.tool || raw.tool_call || raw;
  const name = fn?.name || "";
  let argsFragment = fn?.arguments ?? fn?.args ?? fn?.arguments_text ?? "";

  if (argsFragment === undefined || argsFragment === null) {
    argsFragment = "";
  } else if (typeof argsFragment !== "string") {
    try {
      argsFragment = JSON.stringify(argsFragment);
    } catch {
      argsFragment = String(argsFragment);
    }
  }

  const existing = pendingToolArgs.get(id) || { name: "", argsStr: "" };
  const combinedName = existing.name || name;
  const combinedArgsStr = existing.argsStr + argsFragment;

  pendingToolArgs.set(id, { name: combinedName, argsStr: combinedArgsStr });

  // Try to parse the combined string as JSON only if it looks like JSON
  let parsedArgs;
  try {
    const trimmedArgs = combinedArgsStr.trim();
    if (trimmedArgs.startsWith("{") || trimmedArgs.startsWith("[")) {
      parsedArgs = JSON.parse(trimmedArgs);
    }
  } catch {
    parsedArgs = null; // Not complete / invalid JSON yet
  }

  // If parsed and not already pushed
  if (parsedArgs !== undefined && parsedArgs !== null && !pushedToolIds.has(id)) {
    // Infer a name if missing
    let finalName = combinedName || "";
    if (!finalName && parsedArgs && typeof parsedArgs === "object") {
      if (parsedArgs.query) finalName = "web_search";
      // Add more heuristics here if needed
    }

    if (finalName && TOOL_HANDLERS[finalName]) {
      const fullCall = {
        id,
        type: "function",
        function: {
          name: finalName,
          arguments: JSON.stringify(parsedArgs),
        },
      };
      toolCalls.push(fullCall);
      pushedToolIds.add(id);
      pendingToolArgs.delete(id);
    } else {
      // Mark as pushed/handled so we don't loop forever on fragments
      pushedToolIds.add(id);
      pendingToolArgs.delete(id);
      console.warn(
        `[${provider}] Outil ignoré après assemblage : ${finalName || "(no-name)"} (id=${id})`
      );
    }
  }
}

// ============================================================================
// ANALYSE DES DIRECTIVES - Extraction des directives utilisateur
// ============================================================================

const MODEL_DIRECTIVE_REGEX = /model\s*=\s*([^\s;]+)/i;
const PROVIDER_DIRECTIVE_REGEX =
  /provider\s*=\s*(anthropic|openai|huggingface|mistral|google|groq|grok)/i;
const MODE_DIRECTIVE_REGEX = /mode\s*=\s*(debug)/i;
const DB_URL_DIRECTIVE_REGEX = /db(?:_url)?\s*=\s*([^\s;]+)/i;

const MODEL_PROVIDER_PATTERNS = {
  anthropic: ["claude", "anthropic"],
  openai: ["gpt-", "gpt", "openai", "oai"],
  mistral: ["mistral"],
  huggingface: ["huggingface", "hf"],
  google: ["gemini", "google", "goog"],
  groq: ["groq"],
  grok: ["grok", "xai"],
};
const PROVIDERS = ["openai", "mistral", "huggingface", "anthropic", "google", "groq", "grok"];

const getLocalAiServerUrlForRoom = async (supabase, roomId) => {
  if (!supabase) return null;
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
};

const parseDirectives = (rawQuestion = "") => {
  const trimmed = String(rawQuestion).trim();
  const semicolonIndex = trimmed.indexOf(";");
  const directiveSource = semicolonIndex >= 0 ? trimmed.slice(0, semicolonIndex).trim() : trimmed;
  let userQuestion = semicolonIndex >= 0 ? trimmed.slice(semicolonIndex + 1).trim() : trimmed;

  if (semicolonIndex < 0) {
    userQuestion = userQuestion
      .replace(MODE_DIRECTIVE_REGEX, "")
      .replace(MODEL_DIRECTIVE_REGEX, "")
      .replace(PROVIDER_DIRECTIVE_REGEX, "")
      .replace(DB_URL_DIRECTIVE_REGEX, "")
      .replace(MODEL_MODE_DIRECTIVE_REGEX, "")
      .trim();
  }

  const modelModeMatch = directiveSource.match(MODEL_MODE_DIRECTIVE_REGEX);
  const providerMatch = directiveSource.match(PROVIDER_DIRECTIVE_REGEX);
  const modelMatch = directiveSource.match(MODEL_DIRECTIVE_REGEX);
  const dbUrlMatch = directiveSource.match(DB_URL_DIRECTIVE_REGEX);

  return {
    rawDirective: directiveSource,
    userQuestion,
    hasDirectiveBlock: semicolonIndex >= 0,
    directiveModelMode: modelModeMatch ? modelModeMatch[1].toLowerCase() : null,
    directiveProvider: providerMatch ? providerMatch[1].toLowerCase() : null,
    directiveModel: modelMatch ? modelMatch[1].toLowerCase() : null,
    directiveDbUrl: dbUrlMatch ? dbUrlMatch[1] : null,
  };
};

const detectModelProvider = (model) => {
  if (!model) return null;
  const target = model.toLowerCase();
  return PROVIDERS.find((provider) =>
    MODEL_PROVIDER_PATTERNS[provider]?.some((pattern) => target.includes(pattern))
  );
};

const PROVIDER_ENV_CHECKERS = {
  anthropic: () => Boolean(getConfig("ANTHROPIC_API_KEY")),
  openai: () => Boolean(getConfig("OPENAI_API_KEY")),
  mistral: () => Boolean(getConfig("MISTRAL_API_KEY")),
  huggingface: () => Boolean(getConfig("HUGGINGFACE_API_KEY")),
  google: () => Boolean(getConfig("GEMINI_API_KEY")),
};
const isProviderAvailable = (provider) => Boolean(PROVIDER_ENV_CHECKERS[provider]?.());

const isMistralCapacityError = (error) => {
  const msg = error?.message || "";
  return /service_tier_capacity_exceeded|capacity|3505|429/i.test(msg);
};

const SHOULD_RANDOMIZE_PROVIDERS = true; // TODO: jhr, was: getConfig("DISABLE_PROVIDER_RANDOMIZATION") !== "1";
const shuffleProviders = (providers) => {
  const arr = [...providers];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const shouldSkipProvider = ({
  provider,
  modelMode = null,
  enforcedProvider = null,
  resolvedModel = null,
  quiet = false,
}) => {
  try {
    if (enforcedProvider && provider === enforcedProvider) {
      return false; // Respecter le choix explicite de l'utilisateur
    }

    const modelName = resolvedModel || resolveModelForProvider(provider, modelMode);
    if (!modelName) return false;

    const skip = providerMetrics.shouldSkip(provider, modelName);
    if (skip && !quiet) {
      const entry = providerMetrics.get(provider, modelName);
      const status = entry?.status || "unknown";
      const consecutiveErrors = entry?.metrics?.consecutiveErrors || 0;
      const lastErrorMessage = entry?.metrics?.lastError?.message;
      const reason = lastErrorMessage || `${consecutiveErrors} consecutive errors`;
      console.log(
        `[EdgeFunction] ⏭️ Skipping ${provider} (${modelName}) due to ${status}${
          reason ? ` – ${reason}` : ""
        }`
      );
    }
    return skip;
  } catch (err) {
    console.warn(
      `[EdgeFunction] ⚠️ Unable to consult provider metrics for ${provider}:`,
      err?.message || err
    );
    return false;
  }
};

const buildProviderOrder = ({
  enforcedProvider = null,
  failedProviders = new Set(),
  modelMode = null,
} = {}) => {
  const order = [...PROVIDERS];
  let prioritizedOrder;

  if (enforcedProvider && order.includes(enforcedProvider)) {
    prioritizedOrder = [enforcedProvider, ...order.filter((p) => p !== enforcedProvider)];
  } else if (!failedProviders.has("openai") && order.includes("openai")) {
    // Prioriser OpenAI si non échoué
    prioritizedOrder = ["openai", ...order.filter((p) => p !== "openai")];
  } else {
    prioritizedOrder = order;
  }

  const filteredOrder = prioritizedOrder.filter(
    (provider) =>
      !shouldSkipProvider({
        provider,
        modelMode,
        enforcedProvider,
        quiet: true,
      })
  );

  // Si tous les providers ont été filtrés, retomber sur l'ordre priorisé initial
  return filteredOrder.length > 0 ? filteredOrder : prioritizedOrder;
};

const parseRetryAfter = (errorMessage) => {
  const match = errorMessage.match(/Please try again in (\d+(?:\.\d+)?)s/);
  return match ? parseFloat(match[1]) * 1000 : 5000; // default 5s if not found
};

const isRateLimitError = (error) => {
  const msg = error?.message || "";
  return /rate.?limit|429/i.test(msg) && /tokens?|requests?/i.test(msg);
};

function createDebugLogger() {
  const pendingLogs = [];
  let controllerRef = null;
  let encoderRef = null;
  let enabled = false;
  const originals = {};

  const formatArgs = (args) =>
    args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");

  const safeEnqueue = (line) => {
    if (!controllerRef || !encoderRef) {
      pendingLogs.push(line);
      return;
    }
    try {
      controllerRef.enqueue(encoderRef.encode(`\n\n${line}\n\n`));
    } catch {
      // Controller may be closed; fallback to pending logs and detach controller
      pendingLogs.push(line);
      controllerRef = null;
      encoderRef = null;
    }
  };

  const emit = (level, args) => {
    const line = `[DEBUG] ${level.toUpperCase()}: ${formatArgs(args)}`;
    safeEnqueue(line);
  };

  const wrap =
    (level) =>
    (...args) => {
      originals[level](...args);
      emit(level, args);
    };

  return {
    enable() {
      if (enabled) return;
      enabled = true;
      originals.log = console.log;
      originals.warn = console.warn;
      originals.error = console.error;
      console.log = wrap("log");
      console.warn = wrap("warn");
      console.error = wrap("error");
    },
    attachStream(controller, encoder) {
      if (!enabled) return;
      controllerRef = controller;
      encoderRef = encoder;
      if (pendingLogs.length > 0) {
        // try to flush, keep safe if controller throws
        const logsToFlush = pendingLogs.splice(0);
        for (const line of logsToFlush) {
          try {
            controller.enqueue(encoder.encode(`\n\n${line}\n\n`));
          } catch {
            // If fails, put the remaining lines back to pending logs
            pendingLogs.unshift(line);
            controllerRef = null;
            encoderRef = null;
            break;
          }
        }
      }
    },
    disable() {
      if (!enabled) return;
      console.log = originals.log;
      console.warn = originals.warn;
      console.error = originals.error;
      enabled = false;
      controllerRef = null;
      encoderRef = null;
    },
  };
}

// ============================================================================
// SYSTEM PROMPT - Chargement dynamique
// ============================================================================

async function getSystemPrompt() {
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let basePrompt = `📅 **Date actuelle :** ${currentDate}\n\n`;

  // 1. Charge le prompt depuis le registre compilé (Anciennement fetchPublicSystemPrompt)
  const opheliaPrompts = ALL_BRIQUE_PROMPTS.ophelia;
  if (opheliaPrompts) {
    if (opheliaPrompts.identity) basePrompt += `\n\n${opheliaPrompts.identity}`;
    if (opheliaPrompts["capability-sql"]) basePrompt += `\n\n${opheliaPrompts["capability-sql"]}`;
    if (opheliaPrompts["capability-search"])
      basePrompt += `\n\n${opheliaPrompts["capability-search"]}`;
  } else {
    // 2. Fallback avec les variables d'environnement
    const envPrompt = getConfig("BOB_SYSTEM_PROMPT");
    if (envPrompt) {
      basePrompt += envPrompt;
    } else {
      // 3. Fallback par défaut
      console.warn("Bad configuration, using default prompt.");
      const city = getConfig("CITY_NAME") || "Corte";
      const movement = getConfig("MOVEMENT_NAME") || "Pertitellu";
      const bot = getConfig("BOT_NAME") || "Ophélia";
      basePrompt += `
      **Rôle :** Tu es **${bot}**, l'assistant citoyen du mouvement **${movement}** pour la commune de **${city}**.

      **Instructions :**
      - Réponds **uniquement en français**, de manière **factuelle, concise et structurée** (Markdown : titres, listes, liens).
      - Cite toujours tes **sources officielles** quand c'est possible.
      - Pour les questions locales (projets, horaires), utilise les outils disponibles (**web_search**, **vector_search** pour l'histoire locale).
      - Si tu ne connais pas la réponse, dis-le clairement et propose une alternative.

      **Exemple de réponse :**
      > **Horaires de la mairie :**
      > - Lundi-vendredi : 8h30-17h
      > - Samedi : 9h-12h
      > *(Source : [site de la mairie](#))*`;
    }
  }

  // 4. Charge le wiki consolidé depuis Supabase
  /* JHR 2024-06-10 : désactivé pour l'instant car trop volumineux et ralentit tout le système
    const supabaseUrl = getConfig("SUPABASE_URL");
    const supabaseKey = getConfig("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/consolidated_wiki_documents?select=content&order=updated_at.desc&limit=1`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          console.log(
            `[SystemPrompt] Supabase data preview: ${previewForLog(data?.[0]?.content, 100)}`
          );
          if (data?.length > 0 && data[0].content) {
            basePrompt += `\n\n📚 **Contexte local (wiki) :**\n${data[0].content}...`;
          }
        }
      } catch (error) {
        console.error("[SystemPrompt] Erreur Supabase:", error.message);
      }
    }
    */

  // 5. Charge le contexte municipal (si disponible)
  /* JHR 2024-06-10 : désactivé pour l'instant car trop volumineux et ralentit tout le système
    const councilContext = await _fetchCouncilContext(siteUrl);
    if (councilContext) {
      basePrompt += `\n\n🏛 **Contexte municipal (conseils consolidés) :**\n${councilContext}...`;
    } else {
      basePrompt += `\n\n🏛 **Contexte municipal (conseils consolidés) :** indisponible pour le moment.`;
    }
    */
  console.log(`[SystemPrompt] ✅ Prompt chargé (${basePrompt.length} caractères)`);
  return basePrompt;
}

// ============================================================================
// HANDLER - Fonction principale de gestion des requêtes
// ============================================================================

const handler = async (request) => {
  // Load instance config from supabase
  await loadInstanceConfig();

  // Configure Provider Metrics Persistence
  const sbUrl = getConfig("SUPABASE_URL");
  const sbServiceKey = getConfig("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = sbUrl && sbServiceKey ? createClient(sbUrl, sbServiceKey) : null;

  if (supabaseAdmin) {
    providerMetrics.configure(async (provider, model, entry) => {
      try {
        await supabaseAdmin.from("ai_provider_status").upsert(
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
        console.error(`[EdgeFunction] Failed to sync status for ${provider}:`, err);
      }
    });

    // Hydrate metrics on cold start
    if (!providerMetrics.hasData()) {
      try {
        const { data } = await supabaseAdmin.from("ai_provider_status").select("*");
        if (data) providerMetrics.hydrate(data);
      } catch (e) {
        console.warn("[EdgeFunction] Failed to hydrate metrics:", e);
      }
    }
  }

  // Defensive: a supabase client should be available
  if (!getSupabase()) {
    console.warn("loadInstanceConfig: supabase client not available, fatal");
    throw new Error("loadInstanceConfig: supabase client not available, fatal");
  }
  // Quick healthcheck support (frontend calls GET /api/chat-stream?healthcheck=true)
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("healthcheck") === "true") {
      const providersList = (PROVIDERS || []).map((p) => {
        const configured = isProviderAvailable(p);
        const model = resolveModelForProvider(p);
        let status = configured ? "available" : "not_configured";
        let mMetrics = {
          avgResponseTime: null,
          successRate: null,
          recentlyUsed: false,
          retryAfter: null,
          consecutiveErrors: 0,
        };

        if (configured && model) {
          const entry = providerMetrics.get(p, model);
          // If we have data, use it. If it's a fresh default entry, it stays 'available'.
          status = entry.status;
          if (entry.metrics.requestCount > 0) {
            mMetrics.avgResponseTime = entry.metrics.avgResponseTime;
            mMetrics.successRate = (entry.metrics.successCount / entry.metrics.requestCount) * 100;
            mMetrics.recentlyUsed = Date.now() - (entry.metrics.lastUsed || 0) < 3600000;
            mMetrics.retryAfter = entry.metrics.lastError?.retryAfter || null;
            mMetrics.consecutiveErrors = entry.metrics.consecutiveErrors;
          }
        }

        return {
          name: p,
          status,
          models: [
            {
              name: model || null,
              ...mMetrics,
            },
          ],
        };
      });
      return new Response(JSON.stringify({ providers: providersList }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // continue to normal handler on malformed URL
  }

  // 1. Vérifie la méthode HTTP
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
      status: 405,
    });
  }

  // 2. Parse le corps de la requête
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Charge utile invalide", { status: 400 });
  }

  // Support POST-based healthcheck bodies: { healthcheck: true } or question === 'healthcheck'
  try {
    if (
      body &&
      (body.healthcheck === true || String(body.question || "").toLowerCase() === "healthcheck")
    ) {
      const providersList = (PROVIDERS || []).map((p) => {
        const configured = isProviderAvailable(p);
        const model = resolveModelForProvider(p);
        let status = configured ? "available" : "not_configured";
        let mMetrics = {
          avgResponseTime: null,
          successRate: null,
          recentlyUsed: false,
          retryAfter: null,
          consecutiveErrors: 0,
        };

        if (configured && model) {
          const entry = providerMetrics.get(p, model);
          status = entry.status;
          if (entry.metrics.requestCount > 0) {
            mMetrics.avgResponseTime = entry.metrics.avgResponseTime;
            mMetrics.successRate = (entry.metrics.successCount / entry.metrics.requestCount) * 100;
            mMetrics.recentlyUsed = Date.now() - (entry.metrics.lastUsed || 0) < 3600000;
            mMetrics.retryAfter = entry.metrics.lastError?.retryAfter || null;
            mMetrics.consecutiveErrors = entry.metrics.consecutiveErrors;
          }
        }

        return {
          name: p,
          status,
          models: [
            {
              name: model || null,
              ...mMetrics,
            },
          ],
        };
      });
      return new Response(JSON.stringify({ providers: providersList }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // ignore and continue
  }

  // 3. Valide la question
  const rawQuestion = String(body?.question || "").trim();
  if (!rawQuestion) {
    return new Response("Question manquante", { status: 400 });
  }

  // 4. Récupère et normalise l'historique de conversation (accepte plusieurs formats)
  let conversation_history = [];
  const rawConvCandidates = [
    body?.conversation_history,
    body?.conversationHistory,
    body?.history,
    body?.messages,
    body?.conversation,
  ];
  for (const candidate of rawConvCandidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      conversation_history = candidate.slice();
      break;
    }
    if (typeof candidate === "string") {
      // Try JSON parse first
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          conversation_history = parsed;
          break;
        }
      } catch {
        // Not JSON: fall back to newline-splitting into user messages
        const lines = candidate
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          conversation_history = lines.map((l) => ({
            role: "user",
            content: l,
          }));
          break;
        }
      }
    }
  }

  // Ensure normalized structure: array of {role, content} and strip <Think> blocks from assistant messages
  conversation_history = conversation_history.map((m) => {
    if (!m) return { role: "user", content: "" };
    if (typeof m === "string") return { role: "user", content: m };
    let content = String(m.content || "");
    if (m.role === "assistant") {
      // Remove all <Think> blocks from history sent to LLM
      content = content.replace(/<Think>[\s\S]*?<\/Think>/gi, "").trim();
    }
    return { role: m.role || "user", content };
  });

  // Diagnostic logging to help frontend debugging: show counts and sample
  try {
    const totalChars = conversation_history.reduce((s, m) => s + String(m.content || "").length, 0);
    const first = conversation_history.slice(0, 3).map((m) => ({
      role: m.role,
      preview: String(m.content || "").slice(0, 200),
    }));
    const last = conversation_history.slice(-3).map((m) => ({
      role: m.role,
      preview: String(m.content || "").slice(0, 200),
    }));
    console.log(
      `[EdgeFunction] 📚 Historique: ${conversation_history.length} messages, totalChars=${totalChars}`
    );
    console.log(`[EdgeFunction] 📚 Sample first: ${JSON.stringify(first)}`);
    console.log(`[EdgeFunction] 📚 Sample last: ${JSON.stringify(last)}`);
  } catch (err) {
    console.warn("[EdgeFunction] ⚠️ Failed to log conversation sample:", err?.message || err);
  }

  // 5. Parse les directives (modèle, fournisseur, debug)
  const {
    rawDirective,
    userQuestion,
    directiveModelMode,
    directiveProvider,
    directiveModel,
    directiveDbUrl,
  } = parseDirectives(rawQuestion);

  const bodyModelMode =
    typeof body?.modelMode === "string" ? body.modelMode.trim().toLowerCase() : null;
  const effectiveModelMode = directiveModelMode || bodyModelMode;
  const debugMode = Boolean(rawDirective && MODE_DIRECTIVE_REGEX.test(rawDirective));

  // 6. Détermine le fournisseur et le modèle
  const forcedProvider = directiveProvider; // Ex: "provider=anthropic"
  const modelProvider = directiveModel ? detectModelProvider(directiveModel) : null;

  // 7. Vérifie la disponibilité des clés API
  if (forcedProvider && !isProviderAvailable(forcedProvider)) {
    return new Response(
      JSON.stringify({
        error: `Le fournisseur "${forcedProvider}" est demandé mais non configuré.`,
      }),
      { status: 400 }
    );
  }

  if (modelProvider && !isProviderAvailable(modelProvider)) {
    return new Response(
      JSON.stringify({
        error: `Le modèle "${directiveModel}" requiert "${modelProvider}", mais sa clé API est absente.`,
      }),
      { status: 400 }
    );
  }

  // 8. Détermine l'ordre des fournisseurs
  const enforcedProvider = forcedProvider || modelProvider;
  const failedProviders = new Set(); // Suivi des échecs pendant la conversation
  let providerOrder = buildProviderOrder({
    enforcedProvider,
    failedProviders,
    modelMode: effectiveModelMode,
  });
  if (!enforcedProvider && SHOULD_RANDOMIZE_PROVIDERS) {
    // Si OpenAI est disponible et en premier, on le garde en premier et on mélange le reste
    if (providerOrder[0] === "openai") {
      const [first, ...rest] = providerOrder;
      providerOrder = [first, ...shuffleProviders(rest)];
    } else {
      providerOrder = shuffleProviders(providerOrder);
    }
  }
  console.log(
    `[EdgeFunction] 🔧 Fournisseur: ${enforcedProvider || "auto"} (ordre=${providerOrder.join(",")})`
  );

  // 9. Active les logs de debug
  const debugLogger = debugMode ? createDebugLogger() : null;
  debugLogger?.enable();

  // 10. Logs initiaux
  console.log(`[EdgeFunction] ========================================`);
  console.log(`[EdgeFunction] 🎯 Question: "${rawQuestion}"`);
  console.log(`[EdgeFunction] 📚 Historique: ${conversation_history.length} messages`);
  console.log(`[EdgeFunction] 🔧 Fournisseur: ${enforcedProvider || "auto"}`);
  console.log(`[EdgeFunction] ⏱️ Début: ${new Date().toISOString()}`);

  // 11. Charge le prompt système
  let systemPrompt = await getSystemPrompt();
  console.log(`[EdgeFunction] 📏 System prompt: ${systemPrompt.length} caractères`);

  // 11.5. Initialise les clients
  let user = null;
  const context = body?.context || {}; // Extraire le contexte utilisateur si présent
  const authHeader = request.headers.get("Authorization");
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseAnonKey = getConfig("SUPABASE_ANON_KEY");

  if (authHeader && supabaseUrl && supabaseAnonKey) {
    try {
      const token = authHeader.replace("Bearer ", "");
      // Create a temporary client to verify the user's token
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user: authUser },
        error: authError,
      } = await supabaseAuth.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
        console.log(`[EdgeFunction] 👤 Authenticated user: ${user.id}`);
      }
    } catch (e) {
      console.warn("[EdgeFunction] ⚠️ Error parsing auth header:", e.message);
    }
  }

  // Use the supabase client attached to the instance (usually service role)
  const supabase = getSupabase();

  const openai = new OpenAI({ apiKey: getConfig("OPENAI_API_KEY") });

  // 11.6. Retrieve local vector-search context and append to system prompt
  try {
    const vectorContext = await TOOL_HANDLERS.vector_search(
      { query: userQuestion, limit: 5 },
      { supabase, openai }
    );
    if (vectorContext && typeof vectorContext === "string" && vectorContext.trim()) {
      // Keep inserted context concise to avoid prompt bloat
      const truncated =
        vectorContext.length > 4000
          ? vectorContext.slice(0, 4000) + "\n... (truncated)"
          : vectorContext;
      systemPrompt += `\n\n📚 Connaissances locales (extrait) :\n${truncated}\n\n`;
      console.log(
        `[EdgeFunction] ℹ️ Appended vector-search context (${String(truncated).length} chars) to system prompt`
      );
    }
  } catch (err) {
    console.warn("[EdgeFunction] ⚠️ vector_search failed:", err?.message || err);
  }

  // 12. Crée un ReadableStream pour la réponse
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      debugLogger?.attachStream(controller, encoder);
      const emitProviderMeta = (meta) =>
        controller.enqueue(encoder.encode(`${PROVIDER_META_PREFIX}${JSON.stringify(meta)}\n`));
      const emitThink = (message) => {
        const text = String(message || "").trim();
        if (!text) return;
        const safe = text.replaceAll("<Think>", "").replaceAll("</Think>", "");
        controller.enqueue(encoder.encode(`<Think>${safe}</Think>\n`));
      };
      const emitToolTrace = (trace) => {
        if (!trace) return;
        try {
          controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(trace)}\n`));
          if (trace.phase === "finish") {
            const dur = Number.isFinite(trace.durationMs) ? `${trace.durationMs}ms` : null;
            emitThink(
              `Outil terminé : ${trace.tool}${dur ? ` (${dur})` : ""}${
                trace.resultPreview ? ` — ${previewForLog(trace.resultPreview, 160)}` : ""
              }`
            );
          } else if (trace.phase === "error") {
            emitThink(
              `Erreur outil : ${trace.tool}${trace.error ? ` — ${previewForLog(trace.error, 200)}` : ""}`
            );
          } else if (trace.phase === "notice" && trace.message) {
            emitThink(previewForLog(trace.message, 220));
          }
        } catch (err) {
          console.warn("[EdgeFunction] ⚠️ Failed to emit tool trace:", err?.message || err);
        }
      };

      // Préfixes pour les logs
      const _logPrefix = "📜 [LOG] ";
      const errorPrefix = "❌ [ERREUR] ";
      const chunkPrefix = "";

      let handled = false;
      const lastError = null;

      // 13. Essaie chaque fournisseur dans l'ordre
      emitThink(
        `Ordre des fournisseurs : ${providerOrder.join(", ")}${
          enforcedProvider
            ? ` (forcé=${enforcedProvider})`
            : SHOULD_RANDOMIZE_PROVIDERS
              ? " (aléatoire)"
              : ""
        }`
      );
      for (let providerIndex = 0; providerIndex < providerOrder.length; providerIndex++) {
        const provider = providerOrder[providerIndex];
        const resolvedModel = resolveModelForProvider(provider, effectiveModelMode);

        const skip = shouldSkipProvider({
          provider,
          modelMode: effectiveModelMode,
          enforcedProvider,
          resolvedModel,
        });
        if (skip) {
          try {
            const modelName =
              resolvedModel || resolveModelForProvider(provider, effectiveModelMode);
            const entry = modelName ? providerMetrics.get(provider, modelName) : null;
            const status = entry?.status || "unknown";
            const consecutiveErrors = entry?.metrics?.consecutiveErrors || 0;
            const lastErrorMessage = entry?.metrics?.lastError?.message;
            emitThink(
              `Saut du fournisseur ${provider}${modelName ? ` (${modelName})` : ""}: ${status}${
                lastErrorMessage
                  ? ` — ${previewForLog(lastErrorMessage, 160)}`
                  : consecutiveErrors
                    ? ` — ${consecutiveErrors} erreurs consécutives`
                    : ""
              }`
            );
          } catch {
            emitThink(`Saut du fournisseur ${provider}`);
          }
          continue;
        }

        let providerRetries = 0;
        const maxProviderRetries = 2;

        while (providerRetries <= maxProviderRetries) {
          const providerAttemptStart = Date.now();
          try {
            // GESTION SPÉCIFIQUE POUR LA CLÉ API GEMINI
            let apiKey;
            if (provider === "google") {
              apiKey = getConfig("GEMINI_API_KEY");
            } else {
              apiKey = getConfig(`${provider.toUpperCase()}_API_KEY`);
            }
            if (!apiKey) {
              console.log(`[EdgeFunction] ⏭️ Skipping ${provider} (no API key)`);
              emitThink(`Saut du fournisseur ${provider} : clé API manquante`);
              // Mark provider as failed/unavailable so we don't retry indefinitely
              try {
                failedProviders.add(provider);
              } catch (_) {
                /* ignored */
              }
              // break the retry loop to move to the next provider
              break;
            }
            console.log(
              `[EdgeFunction] 🔍 Model resolution: provider=${provider}, mode=${effectiveModelMode}, resolved=${resolvedModel}`
            );
            console.log(
              `[EdgeFunction] 🔍 Available modes for ${provider}:`,
              MODEL_MODES[provider]
            );
            emitProviderMeta({ provider, model: resolvedModel });
            console.log(`[EdgeFunction] 🚀 Tentative avec ${provider} (model=${resolvedModel})...`);
            emitThink(
              `Tentative avec le fournisseur ${provider}${resolvedModel ? ` (${resolvedModel})` : ""}${
                enforcedProvider ? ` — forcé=${enforcedProvider}` : ""
              }`
            );
            if (provider === "huggingface") {
              // HuggingFace a une API différente (non-streaming)
              const result = await runHuggingFaceAgent(
                userQuestion,
                systemPrompt,
                effectiveModelMode
              );
              controller.enqueue(encoder.encode(chunkPrefix + String(result)));
            } else {
              // Mistral, OpenAI, Anthropic utilisent tous runConversationalAgent
              const agentMeta = {};
              for await (const chunk of runConversationalAgent({
                provider,
                question: userQuestion,
                systemPrompt,
                conversationHistory: conversation_history,
                maxToolCalls: 2,
                modelMode: effectiveModelMode,
                supabase,
                openai,
                metaCollector: agentMeta,
                toolTraceEmitter: emitToolTrace,
                debugMode,
                user, // Pass authenticated user
                context: body.context || {}, // Pass frontend context
              })) {
                // If the generator yields an object, serialize it as provider metadata
                try {
                  if (chunk && typeof chunk === "object") {
                    controller.enqueue(
                      encoder.encode(PROVIDER_META_PREFIX + JSON.stringify(chunk) + "\n")
                    );
                  } else {
                    controller.enqueue(encoder.encode(chunkPrefix + String(chunk)));
                  }
                } catch (err) {
                  console.warn("[EdgeFunction] ⚠️ Failed to enqueue chunk:", err);
                }
              }
              // Populate and emit agent metadata if populated
              try {
                if (agentMeta) {
                  agentMeta.provider = agentMeta.provider || provider;
                  agentMeta.model = agentMeta.model || resolvedModel;
                  agentMeta.agent_duration_ms = Date.now() - providerAttemptStart;
                  const entry = resolvedModel ? providerMetrics.get(provider, resolvedModel) : null;
                  if (entry && entry.metrics) {
                    const metrics = entry.metrics;
                    const successRate =
                      metrics.requestCount && metrics.requestCount > 0
                        ? (metrics.successCount / metrics.requestCount) * 100
                        : null;
                    agentMeta.status = entry.status || null;
                    agentMeta.avgResponseTime = metrics.avgResponseTime ?? null;
                    agentMeta.successRate = successRate != null ? successRate : null;
                    agentMeta.consecutiveErrors = metrics.consecutiveErrors || 0;
                    agentMeta.retryAfter = metrics.lastError?.retryAfter || null;
                    agentMeta.recentlyUsed = Boolean(
                      metrics.lastUsed && Date.now() - metrics.lastUsed < 3600000
                    );
                  }
                  agentMeta.tool_trace = agentMeta.tool_trace || [];
                  emitProviderMeta({ __agent_metadata__: agentMeta });
                }
              } catch (err) {
                console.warn(
                  "[EdgeFunction] ⚠️ Failed to emit agent metadata:",
                  err?.message || err
                );
              }
            }
            handled = true;
            providerMetrics.recordSuccess(
              provider,
              resolvedModel,
              Date.now() - providerAttemptStart
            );
            emitThink(
              `Succès du fournisseur : ${provider}${resolvedModel ? ` (${resolvedModel})` : ""}`
            );
            break;
          } catch (error) {
            providerMetrics.recordError(provider, resolvedModel, error);
            const isForcedProvider = forcedProvider === provider;
            const capacityError = provider === "mistral" && isMistralCapacityError(error);
            const rateLimitError = provider === "openai" && isRateLimitError(error);

            if (capacityError && !isForcedProvider) {
              console.warn(
                `[EdgeFunction] ⚠️ ${provider} capacité atteinte, passage au fournisseur suivant.`
              );
              emitThink(
                `Changement de fournisseur : ${provider} capacité dépassée — tentative avec le suivant`
              );
              failedProviders.add(provider);
              break; // Passe immédiatement au provider suivant
            } else if (rateLimitError && providerRetries < maxProviderRetries) {
              const delayMs = parseRetryAfter(error.message);
              console.warn(
                `[EdgeFunction] ⏳ ${provider} rate limit, retrying in ${delayMs}ms (attempt ${providerRetries + 1}/${maxProviderRetries + 1})`
              );
              emitThink(
                `Nouvelle tentative ${provider} : limite de débit atteinte — attente de ${Math.round(delayMs)}ms (tentative ${providerRetries + 1}/${maxProviderRetries + 1})`
              );
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              providerRetries++;
              continue; // retry same provider
            } else {
              const errorDetail = error.message || String(error);
              console.error(`[EdgeFunction] ❌ ${provider} error:`, errorDetail);

              // If this is a forced provider, show error to user (no fallback available)
              if (isForcedProvider) {
                emitThink(
                  `Échec du fournisseur (forcé) : ${provider} — pas de repli possible${
                    errorDetail ? ` — ${previewForLog(errorDetail, 180)}` : ""
                  }`
                );
                const errorMessage = `⚠️ Le fournisseur ${provider} que vous avez demandé n'est pas disponible actuellement.\n\n**Détails** : ${errorDetail}\n\n`;
                console.error(
                  `[EdgeFunction] 🛑 Forced provider ${provider} failed, not falling back`
                );
                controller.enqueue(encoder.encode(errorMessage));
                handled = true;
                break;
              }

              // For automatic fallback: log in backend, don't show in UI (unless debug mode)
              console.warn(`[EdgeFunction] ⚠️ ${provider} failed, trying next provider...`);
              emitThink(
                `Changement de fournisseur : ${provider} a échoué — tentative avec le suivant${
                  errorDetail ? ` — ${previewForLog(errorDetail, 160)}` : ""
                }`
              );

              failedProviders.add(provider);
              break; // move to next provider
            }
          }
        }
        if (handled) break;
      }

      if (!handled) {
        let fallbackUsed = false;
        try {
          const localAiUrl = await getLocalAiServerUrlForRoom(supabase, body.room_id);
          if (localAiUrl) {
            const cleanBase = localAiUrl.replace(/\/+$/, "");
            emitThink("Tous les fournisseurs cloud ont échoué, recours au modèle local...");
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
              console.error(
                "[EdgeFunction] Local AI fallback HTTP error",
                response.status,
                errText
              );
            }
          }
        } catch (fallbackError) {
          console.error("[EdgeFunction] Local AI fallback failed:", fallbackError);
        }

        if (!fallbackUsed) {
          const message = `❌ Désolé, le service est temporairement indisponible.\n\nNos fournisseurs d'IA rencontrent actuellement des difficultés. Veuillez réessayer dans quelques instants.\n\n`;
          controller.enqueue(encoder.encode(`${message}`));
        }
      }
      // Emit final providers status (frontend reads metrics from this stream end)
      try {
        const providersList = (PROVIDERS || []).map((provider) => {
          const configured = isProviderAvailable(provider);
          const modelModes = MODEL_MODES[provider] || {};
          const models = Object.entries(modelModes).map(([mode, modelName]) => {
            const metricEntry = providerMetrics.get(provider, modelName);
            const metrics = metricEntry?.metrics || {};
            const successRate =
              metrics.requestCount && metrics.requestCount > 0
                ? Math.round((metrics.successCount / metrics.requestCount) * 100)
                : null;
            let retryAfter = null;
            const lastError = metricEntry?.metrics?.lastError;
            if (metricEntry?.status === "rate_limited" && lastError?.retryAfter) {
              const retryTime = lastError.timestamp + lastError.retryAfter * 1000;
              const secondsUntilRetry = Math.max(0, Math.ceil((retryTime - Date.now()) / 1000));
              if (secondsUntilRetry > 0) retryAfter = secondsUntilRetry;
            }
            return {
              name: modelName,
              mode,
              avgResponseTime: metrics.avgResponseTime ?? null,
              successRate,
              recentlyUsed: Boolean(metrics.lastUsed && Date.now() - metrics.lastUsed < 30000),
              retryAfter,
              consecutiveErrors: metrics.consecutiveErrors || 0,
              status: metricEntry?.status || (configured ? "available" : "not_configured"),
            };
          });

          let providerStatus = "available";
          if (!configured) {
            providerStatus = "not_configured";
          } else if (models.length === 0 || models.every((m) => m.status === "unknown")) {
            providerStatus = "unknown";
          } else if (
            models.some((m) => ["error", "quota_exceeded"].includes((m.status || "").toLowerCase()))
          ) {
            providerStatus = "degraded";
          } else if (models.every((m) => m.status === "rate_limited")) {
            providerStatus = "rate_limited";
          }

          return {
            name: provider,
            status: providerStatus,
            models,
          };
        });
        controller.enqueue(
          encoder.encode(
            `${PROVIDERS_STATUS_PREFIX}${JSON.stringify({ providers: providersList })}\n`
          )
        );
      } catch (err) {
        console.warn("[EdgeFunction] ⚠️ Failed to emit providers status:", err?.message || err);
      }
      controller.close();
    },

    cancel() {
      debugLogger?.disable();
    },
  });

  // 15. Retourne la réponse streamée
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

// Add runConversationalAgent (hoisted so handler can call it)
async function* runConversationalAgent({
  provider = "mistral",
  question,
  systemPrompt,
  conversationHistory = [],
  maxToolCalls = 2,
  modelMode,
  supabase,
  openai,
  metaCollector = null,
  toolTraceEmitter = null,
  debugMode = false,
  user = null,
  context = {},
}) {
  let toolCallCount = 0;
  const idleTimeoutMs = Number(getConfig("LLM_STREAM_TIMEOUT_MS")) || 30000;
  const agentStartMs = Date.now();

  // Build attendance summary from context
  const connectedUsers = context?.connectedUsers || [];
  let presenceSummary = "";
  if (connectedUsers.length > 0) {
    const crowdInfo = connectedUsers
      .map(
        (u) =>
          `- **${u.name || "Anonyme"}** (${u.zone || "Zone inconnue"}) [${u.status || "online"}]`
      )
      .join("\n");
    presenceSummary = `\n\n👥 **Présence actuelle dans le bar :**\n${crowdInfo}`;
  }

  let messages = [
    { role: "system", content: systemPrompt + presenceSummary },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  console.log(`[${provider}] ✅ runConversationalAgent initialized (maxToolCalls=${maxToolCalls})`);
  while (toolCallCount < maxToolCalls) {
    const model = resolveModelForProvider(provider, modelMode);
    console.log(`[${provider}] 🔁 Appel LLM (model=${model}) - messages:${messages.length}`);
    yield `<Think>Appel LLM : fournisseur=${provider}${model ? ` modèle=${model}` : ""}, messages=${messages.length}, outilsUtilisés=${toolCallCount}/${maxToolCalls}</Think>\n`;
    const streamOrDirect = await callLLMAPI({
      provider,
      model,
      messages,
      tools: Object.values(TOOLS),
      toolChoice: "auto",
      stream: true,
    });

    // Diagnostic: capture exact shape returned by callLLMAPI for non-stream cases
    try {
      console.log(
        `[${provider}] DEBUG streamOrDirect typeof=${typeof streamOrDirect} isAsyncIterable=${isAsyncIterable(streamOrDirect)}`
      );
      console.log(
        `[${provider}] DEBUG streamOrDirect preview: ${previewForLog(streamOrDirect, 1000)}`
      );
    } catch (err) {
      console.warn(`[${provider}] ⚠️ Failed to preview streamOrDirect: ${err?.message || err}`);
    }

    // Direct (non-stream) response
    if (!isAsyncIterable(streamOrDirect)) {
      console.log(`[${provider}] ℹ️ Direct LLM response received`);
      const data = streamOrDirect || {};
      if (data.toolCalls && data.toolCalls.length > 0) {
        const normalized = normalizeToolCalls(data.toolCalls);
        const valid = normalized.filter((c) => c.function?.name && TOOL_HANDLERS[c.function.name]);
        if (valid.length > 0) {
          toolCallCount++;
          console.log(
            `[${provider}] 🛠 Executing ${valid.length} tool(s) (direct):`,
            valid.map((c) => c.function.name)
          );
          yield `<Think>Outils demandés (direct) : ${valid
            .map((c) => c.function?.name)
            .filter(Boolean)
            .join(", ")}</Think>\n`;
          const toolMessages = await executeToolCalls(
            valid,
            provider,
            {
              web_search: { query: question },
              defaultQuery: question,
            },
            supabase,
            openai,
            metaCollector,
            toolTraceEmitter,
            debugMode,
            user,
            context
          );
          yield `<Think>Outils exécutés (direct) : ${valid
            .map((c) => c.function?.name)
            .filter(Boolean)
            .join(", ")} — reprise du LLM</Think>\n`;
          messages = [
            ...messages,
            {
              role: "assistant",
              content: data.content || null,
              ...(provider === "anthropic" ? { tool_uses: valid } : { tool_calls: valid }),
            },
            ...toolMessages,
          ];
          continue; // re-run LLM with augmented messages
        }
      }
      if (data.content) {
        yield data.content;
      }
      return;
    }

    // Streamed response: iterate events with timeout
    console.log(`[${provider}] 🚀 Streaming LLM response - processing events`);
    const iterator = streamOrDirect[Symbol.asyncIterator]?.();
    let accumulatedContent = "";
    let eventToolExecuted = false;
    let streamTimedOut = false;
    let finalStreamResult = undefined;
    let lastStreamToolInfo = null;

    try {
      while (true) {
        const nextPromise = iterator.next();
        let res;
        try {
          res = await Promise.race([
            nextPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("stream-timeout")), idleTimeoutMs)
            ),
          ]);
        } catch (err) {
          if (err?.message === "stream-timeout") {
            console.warn(
              `[${provider}] ⚠️ Stream idle timeout (${idleTimeoutMs}ms). Falling back to direct call.`
            );
            yield `<Think>Délai d'attente du flux dépassé (${idleTimeoutMs}ms) : passage en mode non-stream</Think>\n`;
            streamTimedOut = true;
            break;
          }
          throw err;
        }

        if (res.done) {
          console.log(`[${provider}] ℹ️ Stream finished cleanly`);
          finalStreamResult = res.value;
          break;
        }
        const evt = res.value;
        if (!evt) continue;

        if (typeof evt === "string") {
          accumulatedContent += evt;
          yield evt;
          continue;
        }
        if (evt.type === "content") {
          accumulatedContent += evt.chunk;
          yield evt.chunk;
          continue;
        }
        if (evt.type === "tool_call") {
          const call = evt.call;
          const fnName = call?.function?.name;
          console.log(
            `[${provider}] 🛠 Received tool_call event: id=${call?.id}, name=${fnName || "(no-name)"}`
          );

          if (!fnName || !TOOL_HANDLERS[fnName]) {
            console.warn(
              `[${provider}] ⚠️ Unknown/unsupported tool: ${fnName || "(no-name)"} - ignoring`
            );
            continue;
          }

          toolCallCount++;
          if (toolCallCount > maxToolCalls) {
            throw new Error(`[${provider}] Limite de ${maxToolCalls} appels d'outils atteinte.`);
          }

          console.log(`[${provider}] 🛠 Executing tool now: ${fnName} (id=${call.id})`);
          yield `<Think>Outil demandé (flux) : ${fnName} (id=${call?.id || "n/a"}) — exécution</Think>\n`;
          lastStreamToolInfo = { name: fnName, id: call?.id };
          const toolMessages = await executeToolCalls(
            [call],
            provider,
            {
              web_search: { query: question },
              defaultQuery: question,
            },
            supabase,
            openai,
            metaCollector,
            toolTraceEmitter,
            debugMode,
            user,
            context
          );
          yield `<Think>Outil exécuté (flux) : ${fnName} (id=${call?.id || "n/a"}) — reprise du LLM</Think>\n`;

          messages = [
            ...messages,
            {
              role: "assistant",
              content: accumulatedContent || null,
              ...(provider === "anthropic" ? { tool_uses: [call] } : { tool_calls: [call] }),
            },
            ...toolMessages,
          ];

          eventToolExecuted = true;
          break; // restart LLM with updated messages
        }
      }
    } finally {
      try {
        if (iterator?.return) await iterator.return();
      } catch {
        /* ignore */
      }
    }

    if (eventToolExecuted) {
      console.log(
        `[${provider}] 🔄 Completed a tool call cycle during streaming, restarting LLM loop`
      );
      console.info(
        `[${provider}] ℹ️ Tool ${lastStreamToolInfo?.name || "(unknown)"} terminé, reprise du flux utilisateur (call id=${lastStreamToolInfo?.id || "n/a"}).`
      );
      continue;
    }

    const streamToolCalls = Array.isArray(finalStreamResult?.toolCalls)
      ? normalizeToolCalls(finalStreamResult.toolCalls)
      : [];
    const validStreamCalls = streamToolCalls.filter(
      (c) => c.function?.name && TOOL_HANDLERS[c.function.name]
    );
    if (validStreamCalls.length > 0) {
      toolCallCount++;
      console.log(
        `[${provider}] 🛠 Executing ${validStreamCalls.length} tool(s) (stream completion):`,
        validStreamCalls.map((c) => c.function.name)
      );
      const toolMessages = await executeToolCalls(
        validStreamCalls,
        provider,
        {
          web_search: { query: question },
          defaultQuery: question,
        },
        supabase,
        openai,
        metaCollector,
        toolTraceEmitter,
        debugMode,
        user,
        context
      );
      messages = [
        ...messages,
        {
          role: "assistant",
          content: finalStreamResult?.content || null,
          ...(provider === "anthropic"
            ? { tool_uses: validStreamCalls }
            : { tool_calls: validStreamCalls }),
        },
        ...toolMessages,
      ];
      continue;
    }

    if (accumulatedContent && accumulatedContent.trim().length > 0) {
      console.log(
        `[${provider}] ✅ Streaming provided content (${accumulatedContent.length} chars). Returning.`
      );
      return;
    }

    // Fallback: direct call to fetch content/tool_calls if stream timed out or provided nothing
    console.log(
      `[${provider}] ⚠️ ${streamTimedOut ? "Stream timed out." : "No tool calls/content from stream."} Attempting direct fallback.`
    );
    if (streamTimedOut) {
      yield `<Think>Délai d'attente du flux dépassé (${idleTimeoutMs}ms) : basculement vers le mode direct</Think>\n`;
    } else {
      yield `<Think>Flux terminé sans contenu ni appel d'outil : basculement vers le mode direct</Think>\n`;
    }
    const direct = await callLLMAPI({
      provider,
      model: resolveModelForProvider(provider, modelMode),
      messages,
      tools: Object.values(TOOLS),
      toolChoice: "auto",
      stream: false,
    });

    // Normalize possible shapes for tool_calls in direct responses.
    // Providers may place tool calls in different locations:
    // - direct.toolCalls or direct.tool_calls
    // - direct.choices[0].message.tool_calls
    // - direct.choices[0].message.function_call (single function)
    // Normalize to `direct.toolCalls` as an array of { id, function: { name, arguments } }.
    try {
      try {
        console.log(`[${provider}] 🔍 Direct response keys:`, Object.keys(direct || {}));
        console.log(
          `[${provider}] 🔍 choices[0].message.tool_calls preview:`,
          previewForLog(
            direct?.choices?.[0]?.message?.tool_calls || direct?.choices?.[0]?.tool_calls,
            200
          )
        );
      } catch (e) {
        /* ignore preview errors */
      }

      const directResp = { ...(direct || {}) };
      // Top-level aliases
      if (Array.isArray(directResp.toolCalls) && directResp.toolCalls.length > 0) {
        // already normalized
      } else if (Array.isArray(directResp.tool_calls) && directResp.tool_calls.length > 0) {
        directResp.toolCalls = directResp.tool_calls;
      } else if (Array.isArray(directResp.choices) && directResp.choices.length > 0) {
        const choice = directResp.choices[0];
        const message = choice?.message || choice || {};

        // If tool_calls array is present on the message/choice, use it
        const candidateArray =
          message?.tool_calls || message?.toolCalls || choice?.tool_calls || choice?.toolCalls;
        if (Array.isArray(candidateArray) && candidateArray.length > 0) {
          directResp.toolCalls = candidateArray;
        } else if (
          message?.function_call &&
          (message.function_call.name || message.function_call?.id)
        ) {
          // Single function_call -> convert to toolCalls array
          directResp.toolCalls = [
            {
              id: choice?.id || `call-${Date.now()}`,
              function: {
                name: message.function_call.name || message.function_call?.id || "",
                arguments: message.function_call.arguments || "{}",
              },
            },
          ];
        } else if (
          choice?.function_call &&
          (choice.function_call.name || choice.function_call.arguments)
        ) {
          directResp.toolCalls = [
            {
              id: choice?.id || `call-${Date.now()}`,
              function: {
                name: choice.function_call.name || "",
                arguments: choice.function_call.arguments || "{}",
              },
            },
          ];
        }
      }
      // Ensure toolCalls is an array if present
      if (directResp.toolCalls && !Array.isArray(directResp.toolCalls)) {
        directResp.toolCalls = [directResp.toolCalls];
      }
      // Optional: surface the normalized payload for diagnostics
      if (directResp.toolCalls && Array.isArray(directResp.toolCalls)) {
        console.log(
          `[${provider}] 🔧 Normalized direct.toolCalls:`,
          directResp.toolCalls.map((c) => ({
            id: c.id,
            name: c.function?.name,
          }))
        );
      }

      const directHasContent = Boolean(directResp?.content && String(directResp.content).trim());
      const directHasToolCalls =
        Array.isArray(directResp?.toolCalls) && directResp.toolCalls.length > 0;

      if (directHasToolCalls) {
        const normalized = normalizeToolCalls(directResp.toolCalls);
        const valid = normalized.filter((c) => c.function?.name && TOOL_HANDLERS[c.function.name]);
        if (valid.length > 0) {
          toolCallCount++;
          console.log(
            `[${provider}] 🛠 Executing ${valid.length} tool(s) (direct fallback):`,
            valid.map((c) => c.function.name)
          );
          const toolMessages = await executeToolCalls(
            valid,
            provider,
            {
              web_search: { query: question },
              defaultQuery: question,
            },
            supabase,
            openai,
            metaCollector,
            toolTraceEmitter,
            debugMode,
            user,
            context
          );
          messages = [
            ...messages,
            {
              role: "assistant",
              content: directResp.content || null,
              ...(provider === "anthropic" ? { tool_uses: valid } : { tool_calls: valid }),
            },
            ...toolMessages,
          ];
          continue; // re-run LLM
        } else {
          console.warn(
            `[${provider}] ⚠️ Direct fallback tool_calls present but none were valid/handled.`
          );
        }
      }

      if (directHasContent) {
        console.log(
          `[${provider}] ✅ Direct fallback returned content (${String(directResp.content).length} chars).`
        );
        yield directResp.content;
        return;
      }
    } catch (e) {
      console.warn(`[${provider}] ⚠️ toolCalls normalization failed:`, e?.message || e);
    }
    console.warn(`[${provider}] ⚠️ Direct fallback returned no content and no tool_calls.`);
    return;
  }

  throw new Error(`[${provider}] Limite de ${maxToolCalls} appels d'outils atteinte.`);
}

async function runHuggingFaceAgent(userQuestion, systemPrompt, modelMode) {
  const provider = "huggingface";
  const apiKey = getConfig("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("Clé API manquante pour huggingface");

  const model =
    resolveModelForProvider(provider, modelMode) || PROVIDER_CONFIGS.huggingface.defaultModel;
  const url =
    typeof PROVIDER_CONFIGS.huggingface.apiUrl === "function"
      ? PROVIDER_CONFIGS.huggingface.apiUrl(model)
      : PROVIDER_CONFIGS.huggingface.apiUrl;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuestion },
  ];

  const payload = {
    model,
    messages,
    temperature: 0.3,
    top_p: 0.95,
    stream: false,
  };

  console.log(`[huggingface] ➜ request model=${model}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log(`[huggingface] ⬅ status=${resp.status}`);
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[huggingface] ❌ error body preview: ${previewForLog(body)}`);
    throw new Error(`huggingface API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";

  return String(text || "").trim();
}

export default handler;
export const config = { path: "/api/chat-stream" };
