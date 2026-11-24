/**
 * Ritornu MCP core — JSON-RPC 2.0 / Model Context Protocol tools adapter.
 *
 * Thin surface over the library pipeline. No Git writes. Captures go to
 * platform private storage (Supabase) when configured, otherwise an in-memory
 * session store suitable for desktop MCP hosts (tests / dry-run).
 *
 * Protocol versions aligned with Cogentia MCP for multi-host compatibility
 * (Claude, ChatGPT remote MCP, Cursor, Grok, etc.).
 */

import { createRequire } from "node:module";

import {
  NON_NEGOTIABLE_BOUNDARIES,
  RETROFIT_STATES,
  SCHEMA_VERSIONS,
  BRIQUE_ID,
  BRIQUE_STATUS,
} from "../constants.js";
import { prepareSubstackPublicUrl } from "../adapters/prepare.js";
import { buildLocalPackage, createHandoff, createReviewRequest } from "../pipeline.js";
import { DEFAULT_STORAGE_BUCKET, MemoryStore, SupabaseStore } from "../storage.js";
import { RitornuError } from "../errors.js";

const require = createRequire(import.meta.url);

export const SERVER_NAME = "ritornu-mcp";
export const SERVER_VERSION = "0.2.0";
export const PROTOCOL_VERSION = "2025-11-25";
export const SUPPORTED_PROTOCOLS = new Set([PROTOCOL_VERSION, "2025-06-18", "2024-11-05"]);

export const TOOLS = [
  {
    name: "ritornu_health",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    description:
      "Health and mandate snapshot for Ritornu (personal publication retrofit). Reports storage backend, schema versions, and non-negotiable boundaries. Prefer this first when connecting a new host.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "ritornu_boundaries",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    description:
      "List Ritornu invariants: private capture storage, human review before corpus handoff, no direct Git write, no recursive collection, no auth/CAPTCHA/paywall bypass. Read-only.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "ritornu_prepare_substack",
    description:
      "Under explicit human mandate: fetch ONE public Substack post URL (/p/slug), store the raw proof in private platform storage (or session memory if Supabase is not configured), normalize the editorial body, and return a review-request candidate. Does not write to Git. On unavailability returns explicit error and legitimate fallbacks (official export, provided copy, assisted browser). Never bypasses login walls, paywalls, CAPTCHA, or rate limits. Never follows additional links.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          minLength: 1,
          description:
            "Single https public Substack post URL containing /p/{slug}. Tracking query params are stripped for the canonical form.",
        },
        as_review_request: {
          type: "boolean",
          description:
            "If true (default), candidate.state is review-request. If false, state is candidate.",
        },
        persist: {
          type: "boolean",
          description:
            "If true (default), persist capture/transcription/candidate via the active store. If false, return packages only.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "ritornu_normalize_provided",
    description:
      "Normalize a human-provided copy (HTML or plain text) into a capture + transcription + import candidate without network access. Use when the author supplies an export or paste, or when a public URL is unavailable. Does not write to Git.",
    inputSchema: {
      type: "object",
      properties: {
        raw_text: {
          type: "string",
          minLength: 1,
          description: "Raw HTML or plain text body of one publication.",
        },
        platform: {
          type: "string",
          enum: ["substack", "facebook", "other", "unknown"],
          description: "Source platform hint (default other).",
        },
        content_type: {
          type: "string",
          description: "MIME type (default text/html if raw looks like HTML, else text/plain).",
        },
        requested_url: {
          type: "string",
          description: "Optional original URL for provenance (not fetched).",
        },
        method: {
          type: "string",
          enum: [
            "official-export",
            "public-rss",
            "public-url",
            "provided-copy",
            "assisted-browser",
          ],
          description: "Acquisition method (default provided-copy).",
        },
        persist: {
          type: "boolean",
          description: "Persist via store if true (default true).",
        },
      },
      required: ["raw_text"],
      additionalProperties: false,
    },
  },
  {
    name: "ritornu_create_handoff",
    description:
      "After an explicit human review decision, build a handoff package (file proposal patch or reject). Never commits to Git. Requires review.status approved|rejected and reviewed_by. Approved handoffs also require destination_repo and destination_path. Pass the candidate object returned by prepare/normalize tools.",
    inputSchema: {
      type: "object",
      properties: {
        candidate: {
          type: "object",
          description: "import_candidate package from a previous Ritornu tool call.",
        },
        review: {
          type: "object",
          description: "Human review decision.",
          properties: {
            status: { type: "string", enum: ["approved", "rejected"] },
            reviewed_by: { type: "string", minLength: 1 },
            reviewed_at: { type: "string" },
            notes: { type: "string" },
          },
          required: ["status", "reviewed_by"],
        },
        decisions: {
          type: "object",
          description:
            "Routing decisions for approved handoffs: destination_repo, destination_path, visibility, license, operation.",
          properties: {
            operation: {
              type: "string",
              enum: ["propose-create", "propose-update", "reject"],
            },
            destination_repo: { type: "string" },
            destination_path: { type: "string" },
            visibility: { type: "string" },
            license: { type: "string" },
            document_type: { type: "string" },
          },
        },
        persist: {
          type: "boolean",
          description: "Persist handoff via store if true (default true).",
        },
      },
      required: ["candidate", "review"],
      additionalProperties: false,
    },
  },
  {
    name: "ritornu_promote_review_request",
    description:
      "Promote an import_candidate to state review-request without deciding routing. Routing must stay undecided until human review. Does not write to Git.",
    inputSchema: {
      type: "object",
      properties: {
        candidate: {
          type: "object",
          description: "import_candidate package.",
        },
      },
      required: ["candidate"],
      additionalProperties: false,
    },
  },
];

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ fetchImpl?: typeof fetch, store?: object }} [options]
 */
export function createMcpCore(env = process.env, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const store = options.store || createStoreFromEnv(env);
  const startedAt = new Date().toISOString();

  function initialize(params = {}) {
    const requested = String(params.protocolVersion || "");
    return {
      protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "Ritornu is a personal publication retrofit assistant under human mandate. " +
        "One publication at a time. Prefer ritornu_health then ritornu_prepare_substack (public URL) " +
        "or ritornu_normalize_provided (export/paste). Captures are private proofs, not corpus documents. " +
        "Never write to Git or GitHub from these tools; use ritornu_create_handoff only after explicit human review " +
        "to produce a patch proposal the human applies. On unavailability, use official export, provided copy, or assisted browser — never bypass protections.",
    };
  }

  async function handleJsonRpc(message) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return jsonRpcError(message?.id ?? null, -32600, "Invalid Request");
    }
    // Notifications have no id — acknowledge by silence (MCP).
    if (message.id === undefined) {
      if (message.method === "notifications/initialized") return null;
      return null;
    }
    try {
      if (message.method === "initialize") {
        return jsonRpcResult(message.id, initialize(message.params || {}));
      }
      if (message.method === "ping") {
        return jsonRpcResult(message.id, {});
      }
      if (message.method === "tools/list") {
        return jsonRpcResult(message.id, { tools: TOOLS });
      }
      if (message.method === "tools/call") {
        const name = String(message.params?.name || "");
        const args = message.params?.arguments || {};
        const data = await callTool(name, args);
        return jsonRpcResult(message.id, mcpToolResult(data));
      }
      if (message.method === "resources/list") {
        return jsonRpcResult(message.id, { resources: [] });
      }
      if (message.method === "prompts/list") {
        return jsonRpcResult(message.id, { prompts: [] });
      }
      return jsonRpcError(message.id, -32601, "Method not found");
    } catch (error) {
      const text =
        error instanceof RitornuError
          ? JSON.stringify(
              {
                error: {
                  code: error.code,
                  message: error.message,
                  details: error.details,
                },
                git_write_forbidden: true,
              },
              null,
              2
            )
          : error?.message || String(error);
      return jsonRpcResult(message.id, {
        content: [{ type: "text", text }],
        isError: true,
      });
    }
  }

  async function callTool(name, args = {}) {
    switch (name) {
      case "ritornu_health":
        return {
          ok: true,
          server: SERVER_NAME,
          version: SERVER_VERSION,
          brique_id: BRIQUE_ID,
          brique_status: BRIQUE_STATUS,
          issue: "https://github.com/JeanHuguesRobert/inseme/issues/26",
          started_at: startedAt,
          storage: {
            backend: store.backend,
            bucket: store.bucket,
            storage_class: store.storageClass,
            note:
              store.backend === "memory"
                ? "Session memory only (no Supabase env). Fine for desktop MCP dry-runs; platform production uses Supabase private bucket."
                : "Platform private Supabase bucket.",
          },
          schema_versions: SCHEMA_VERSIONS,
          retrofit_states: RETROFIT_STATES,
          git_write_forbidden: true,
          review_required: true,
        };

      case "ritornu_boundaries":
        return {
          ok: true,
          boundaries: [...NON_NEGOTIABLE_BOUNDARIES],
          retrofit_states: RETROFIT_STATES,
          acquisition_preference: [
            "official-export",
            "public-rss",
            "public-url",
            "provided-copy",
            "assisted-browser",
          ],
          forbidden: [
            "recursive-crawl",
            "social-graph",
            "comments-reactions-audience",
            "captcha-paywall-auth-bypass",
            "cookie-or-secret-storage",
            "automatic-git-or-github-write",
          ],
          git_write_forbidden: true,
        };

      case "ritornu_prepare_substack": {
        requireString(args.url, "url");
        const persist = args.persist !== false;
        const prepared = await prepareSubstackPublicUrl({
          url: args.url,
          store: persist ? store : null,
          fetchImpl,
          asReviewRequest: args.as_review_request !== false,
        });
        if (!prepared.ok) {
          return {
            ok: false,
            status: "unavailable",
            platform: "substack",
            requested_url: prepared.requested_url,
            canonical_url: prepared.canonical_url,
            error: prepared.error,
            fallbacks: prepared.fallbacks,
            message:
              "Substack publication unavailable for unauthenticated public fetch. Use official export, provided copy, or assisted browser. No bypass is performed.",
            git_write_forbidden: true,
            review_required: true,
          };
        }
        return publicToolPackage(prepared, {
          tool: "ritornu_prepare_substack",
          persisted: persist,
        });
      }

      case "ritornu_normalize_provided": {
        requireString(args.raw_text, "raw_text");
        const raw = args.raw_text;
        const looksHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
        const contentType = args.content_type || (looksHtml ? "text/html" : "text/plain");
        const persist = args.persist !== false;
        const built = await buildLocalPackage({
          rawBytes: raw,
          store: persist ? store : null,
          rawFilename: looksHtml ? "raw.html" : "raw.txt",
          captureOptions: {
            method: args.method || "provided-copy",
            platform: args.platform || "other",
            contentType,
            requestedUrl: args.requested_url || null,
          },
        });
        const candidate = createReviewRequest(built.candidate);
        return publicToolPackage(
          {
            ok: true,
            status: "prepared",
            platform: built.capture.platform,
            method: built.capture.method,
            capture: built.capture,
            transcription: built.transcription,
            candidate,
            review_required: true,
            git_write_forbidden: true,
          },
          { tool: "ritornu_normalize_provided", persisted: persist }
        );
      }

      case "ritornu_promote_review_request": {
        if (!args.candidate || typeof args.candidate !== "object") {
          throw new RitornuError("candidate-required", "candidate object is required");
        }
        const reviewRequest = createReviewRequest(args.candidate);
        return {
          ok: true,
          candidate: stripHeavyFields(reviewRequest),
          review_required: true,
          git_write_forbidden: true,
        };
      }

      case "ritornu_create_handoff": {
        if (!args.candidate || typeof args.candidate !== "object") {
          throw new RitornuError("candidate-required", "candidate object is required");
        }
        if (!args.review || typeof args.review !== "object") {
          throw new RitornuError("review-required", "Explicit human review object is required");
        }
        const handoff = createHandoff({
          candidate: args.candidate,
          review: args.review,
          decisions: args.decisions || {},
        });
        if (args.persist !== false) {
          await store.saveHandoff(handoff);
        }
        return {
          ok: true,
          handoff: {
            ...handoff,
            // Keep patch content (human needs it) but cap extreme size in text channel via stringify later.
          },
          git_write_forbidden: true,
          message:
            handoff.review.status === "approved"
              ? "Handoff is a file proposal only. A human must apply it outside Ritornu; no commit was made."
              : "Handoff records rejection. No corpus write.",
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  return {
    tools: TOOLS,
    store,
    initialize,
    handleJsonRpc,
    callTool, // used by federated hub
  };
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
export function createStoreFromEnv(env = process.env) {
  const bucket = env.RITORNU_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;
  const url = env.SUPABASE_URL || env.RITORNU_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY || env.RITORNU_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return new SupabaseStore({ supabase, bucket });
    } catch {
      // Fall through to memory when client package or credentials fail.
    }
  }
  return new MemoryStore({ bucket });
}

/**
 * Strip raw-sized bodies from MCP responses while keeping reviewable packages.
 * @param {object} prepared
 * @param {object} meta
 */
function publicToolPackage(prepared, meta) {
  const transcription = prepared.transcription
    ? {
        ...prepared.transcription,
        // line_ops can be huge; keep stats + noise for agents.
        diff_from_raw: prepared.transcription.diff_from_raw
          ? {
              algorithm: prepared.transcription.diff_from_raw.algorithm,
              raw_fingerprint: prepared.transcription.diff_from_raw.raw_fingerprint,
              normalized_fingerprint: prepared.transcription.diff_from_raw.normalized_fingerprint,
              stats: prepared.transcription.diff_from_raw.stats,
              removed_noise_kinds: prepared.transcription.diff_from_raw.removed_noise_kinds,
            }
          : undefined,
      }
    : null;

  return {
    ok: true,
    status: prepared.status || "prepared",
    tool: meta.tool,
    persisted: meta.persisted,
    platform: prepared.platform,
    method: prepared.method,
    capture: prepared.capture
      ? {
          ...prepared.capture,
          // raw bytes never returned — only proof pointer
        }
      : null,
    transcription,
    candidate: stripHeavyFields(prepared.candidate),
    summary: {
      title: prepared.transcription?.title ?? null,
      author: prepared.transcription?.author ?? null,
      published_at: prepared.transcription?.published_at ?? null,
      canonical_url: prepared.transcription?.canonical_url ?? null,
      proposed_filename: prepared.candidate?.proposed_filename ?? null,
      state: prepared.candidate?.state ?? null,
    },
    review_required: true,
    git_write_forbidden: true,
    next_step:
      "Human reviews routing (repo, path, visibility, license), then may call ritornu_create_handoff. Do not commit automatically.",
  };
}

function stripHeavyFields(candidate) {
  if (!candidate) return null;
  return { ...candidate };
}

function requireString(value, name) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new RitornuError("invalid-argument", `${name} must be a non-empty string`);
  }
}

export function mcpToolResult(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text }],
    ...(typeof data === "object" && data !== null ? { structuredContent: data } : {}),
  };
}

export function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
