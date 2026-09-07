/**
 * @magistral/core - router.js
 *
 * Pure, runtime-agnostic Magistral routing primitives.
 * Works in both Deno and Node.js with standard ESM imports.
 */

// The router is shared by Node and the Deno reference pilot.  Depend only on
// the pure accounting primitives rather than the complete COP kernel, whose
// host/storage adapters are intentionally Node-specific.
import {
  createCognitivePacket,
  appendPacketHop,
  appendPacketSpending,
} from "@inseme/cop-kernel/accounting/packetAccounting";

export const MAGISTRAL_PROTOCOL = "MAGISTRAL-v1";
export const DEFAULT_EXHAUSTION_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeRegistryStatus(status) {
  if (!status || status === "available") return "active";
  if (status === "quota_exceeded" || status === "auth_error" || status === "rate_limited") {
    return "exhausted";
  }
  return status;
}

function normalizeTier(tier) {
  if (!tier || tier === "main" || tier === "default" || tier === "magistral") return "fast";
  if (tier === "reasoning") return "strong";
  return tier;
}

function normalizeSnapshotNodes(data) {
  if (!data) return [];
  if (Array.isArray(data.nodes)) return data.nodes;
  if (data.nodes && typeof data.nodes === "object") {
    return Object.entries(data.nodes).map(([id, state]) => ({ id, ...state }));
  }
  if (Array.isArray(data)) return data;
  return [];
}

function sanitizeUrl(url = "") {
  return String(url).replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");
}

export function sanitizeNodeForPersistence(node) {
  const { apiKey, api_key, authorization, ...safeNode } = node || {};
  return safeNode;
}

export function createMetricsSnapshot(map, registry, options = {}) {
  const protocol = options.protocol || MAGISTRAL_PROTOCOL;
  const nodes = (Array.isArray(map) ? map : []).map((node) => {
    const state = registry.get(node.id);
    const avgLatency = state.successes > 0 ? Math.round(state.totalLatencyMs / state.successes) : 0;

    return {
      id: node.id,
      url: sanitizeUrl(node.url),
      model: node.model,
      tier: node.tier,
      weight: node.weight,
      status: state.status,
      requests: state.requests,
      successes: state.successes,
      failures: state.failures,
      avgLatencyMs: avgLatency,
      lastError: state.lastError,
      exhaustedAt: state.exhaustedAt,
    };
  });

  return { protocol, nodes };
}

// --- NodeRegistry (State) ---
export class NodeRegistry {
  constructor() {
    this._state = new Map(); // id -> { status, failures, latencySum, latencyCount, ... }
    this._dirty = false;
  }

  isDirty() {
    return this._dirty;
  }
  clearDirty() {
    this._dirty = false;
  }

  loadFrom(data) {
    const nodes = normalizeSnapshotNodes(data);
    for (const n of nodes) {
      if (!n.id) continue;
      this._state.set(n.id, {
        status: normalizeRegistryStatus(n.status),
        requests: n.requests || 0,
        successes: n.successes || 0,
        failures: n.failures || 0,
        totalLatencyMs: n.totalLatencyMs || 0,
        lastError: n.lastError || null,
        exhaustedAt: n.exhaustedAt || null,
      });
    }
  }

  serialize() {
    const nodes = [];
    for (const [id, s] of this._state.entries()) {
      nodes.push({ id, ...s });
    }
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      nodes,
    };
  }

  get(id) {
    if (!this._state.has(id)) {
      this._state.set(id, {
        status: "active",
        requests: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        lastError: null,
        exhaustedAt: null,
      });
    }
    return this._state.get(id);
  }

  recordStart(id) {
    const s = this.get(id);
    s.requests++;
    this._dirty = true;
    return Date.now();
  }

  recordSuccess(id, startTime) {
    const s = this.get(id);
    const latency = Date.now() - startTime;
    s.status = "active";
    s.exhaustedAt = null;
    s.successes++;
    s.totalLatencyMs += latency;
    s.lastError = null;
    this._dirty = true;
  }

  recordError(id, error) {
    const s = this.get(id);
    s.failures++;
    s.lastError = error;
    this._dirty = true;
  }

  markExhausted(id, reason) {
    const s = this.get(id);
    s.status = "exhausted";
    s.exhaustedAt = Date.now();
    s.lastError = reason;
    this._dirty = true;
  }

  disable(id, reason = "manual") {
    const s = this.get(id);
    s.status = "disabled";
    s.exhaustedAt = Infinity; // Permanently exhausted until enabled
    s.lastError = `Disabled: ${reason}`;
    this._dirty = true;
  }

  enable(id) {
    const s = this.get(id);
    s.status = "active";
    s.exhaustedAt = null;
    s.lastError = null;
    this._dirty = true;
  }
}

// --- TrafficLog (Ring Buffer) ---
export class TrafficLog {
  constructor(size = 1000) {
    this.size = size;
    this.buffer = [];
    this._dirty = false;
  }

  append(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.size) {
      this.buffer.shift();
    }
    this._dirty = true;
  }

  tail(n = 100) {
    return this.buffer.slice(-n);
  }

  filter({ nodeId, status, since }) {
    return this.buffer.filter((e) => {
      if (nodeId && e.nodeId !== nodeId) return false;
      if (status !== undefined && e.status !== status) return false;
      if (since && new Date(e.ts) < new Date(since)) return false;
      return true;
    });
  }

  getEntries() {
    return this.buffer;
  }
}

// --- Routing Logic ---
export function buildRoutingSequence(map, tier, registry, options = {}) {
  const requestedTier = normalizeTier(tier);
  const nodes = Array.isArray(map) ? map : [];
  const exhaustionTtlMs = options.exhaustionTtlMs || DEFAULT_EXHAUSTION_TTL_MS;

  const primary = nodes.filter((n) => normalizeTier(n.tier) === requestedTier);
  const fallbacks = nodes.filter((n) => normalizeTier(n.tier) === "fallback");

  const isAvailable = (n) => {
    const s = registry.get(n.id);
    if (s.status === "disabled") return false;
    if (s.status === "exhausted") {
      if (s.exhaustedAt && Date.now() - s.exhaustedAt > exhaustionTtlMs) {
        s.status = "active";
        s.exhaustedAt = null;
        return true;
      }
      return false;
    }
    return true;
  };

  const byWeight = (a, b) => (b.weight || 1) - (a.weight || 1);
  const healthyPrimary = [...primary].sort(byWeight).filter(isAvailable);
  const healthyFallbacks = [...fallbacks].sort(byWeight).filter(isAvailable);

  const ordered =
    healthyPrimary.length > 0 && requestedTier !== "fallback"
      ? [...healthyPrimary, ...healthyFallbacks]
      : healthyFallbacks;

  const seen = new Set();
  return ordered.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function getApiKeyForNode(node, apiKeys) {
  const url = node.url || "";
  const bag = apiKeys || {};
  if (node.apiKey || node.api_key) return node.apiKey || node.api_key;
  const envName = node.apiKeyEnv || node.api_key_env;
  if (envName && bag[envName]) return bag[envName];
  // Cogentia system bearer (legacy AGENT_GATEWAY_* names still accepted)
  if (
    envName &&
    (/COGENTIA_API_KEY/i.test(envName) || /AGENT_GATEWAY/i.test(envName)) &&
    (bag.COGENTIA_API_KEY || bag.AGENT_GATEWAY_TOKEN)
  ) {
    return bag.COGENTIA_API_KEY || bag.AGENT_GATEWAY_TOKEN;
  }
  if (url.includes("groq.com")) return bag.GROQ_API_KEY;
  if (url.includes("openrouter.ai")) return bag.OPENROUTER_API_KEY;
  if (url.includes("together.xyz") || url.includes("together.ai")) return bag.TOGETHER_API_KEY;
  if (url.includes("openai.com")) return bag.OPENAI_API_KEY;
  if (url.includes("anthropic.com")) return bag.ANTHROPIC_API_KEY;
  if (url.includes("mistral.ai")) return bag.MISTRAL_API_KEY;
  if (url.includes("googleapis.com") || url.includes("google.com")) return bag.GEMINI_API_KEY;
  // Non-public Cogentia tool hosts (Agent CLI Gateway) often listen on :8793
  if (/:(8793)\b/.test(url) || /agent-gateway|i7-thinkpad|coding-/i.test(String(node.id || ""))) {
    return (
      bag.COGENTIA_API_KEY || bag.AGENT_GATEWAY_TOKEN || bag.AGENT_GATEWAY_INVOKE_TOKEN || null
    );
  }
  return null;
}

function normalizeNodeForMap(node) {
  const normalized = {
    ...node,
    tier: normalizeTier(node.tier),
    weight: Number.isFinite(Number(node.weight)) ? Number(node.weight) : 1,
  };
  if (!normalized.id || !normalized.model || (!normalized.url && !normalized.adapter)) {
    throw new Error("Invalid node definition: id, model, and url or adapter are required");
  }
  return normalized;
}

// --- Main Router Factory ---
export function createRouter({
  map,
  apiKeys = {},
  log = console.warn,
  registry = new NodeRegistry(),
  invokeNode = null,
}) {
  const trafficLog = new TrafficLog();

  /**
   * Routes a request to the appropriate node.
   * @param {Object} payload - The OpenAI-compatible request body.
   * @param {string} tier - The desired tier ('fast', 'strong', etc.).
   * @returns {Promise<Response>}
   */
  async function route(payload, tier = "fast") {
    const sequence = buildRoutingSequence(map, tier, registry);
    const reqId = `req_${Date.now().toString(36)}`;

    if (sequence.length === 0) {
      throw new Error("All magistral nodes exhausted or unavailable.");
    }

    for (const node of sequence) {
      const startTime = registry.recordStart(node.id);
      const isStream = payload.stream === true;

      const apiKey = getApiKeyForNode(node, apiKeys);
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const nodePayload = { ...payload, model: node.model };
      if (node.url?.includes("googleapis.com") || node.url?.includes("google.com")) {
        delete nodePayload.max_tokens;
      }

      // GPT-5 Chat Completions: legacy max_tokens → max_completion_tokens.
      // Several gpt-5.6-* SKUs only accept default temperature (1); drop other values.
      if (/^gpt-5(?:[.-]|$)/.test(String(node.model || ""))) {
        if (nodePayload.max_tokens !== undefined) {
          nodePayload.max_completion_tokens = nodePayload.max_tokens;
          delete nodePayload.max_tokens;
        }
        if (nodePayload.temperature !== undefined && Number(nodePayload.temperature) !== 1) {
          delete nodePayload.temperature;
        }
      }

      // Base log entry
      const logEntry = {
        id: reqId,
        ts: new Date().toISOString(),
        nodeId: node.id,
        tier: node.tier,
        model: node.model,
        stream: isStream,
        promptTokens: 0, // TODO: estimate?
        completionTokens: 0,
        status: 0,
        latencyMs: 0,
        error: null,
      };

      try {
        const res = invokeNode
          ? await invokeNode({ node, payload: nodePayload, headers })
          : await fetch(node.url, {
              method: "POST",
              headers,
              body: JSON.stringify(nodePayload),
            });

        if (res.status === 429 || res.status === 402 || res.status === 403) {
          registry.markExhausted(node.id, `HTTP ${res.status}`);
          logEntry.error = `Exhausted: HTTP ${res.status}`;
          logEntry.latencyMs = Date.now() - startTime;
          logEntry.status = res.status;
          trafficLog.append(logEntry);
          log(`[Magistral] Node ${node.id} exhausted (${res.status}), trying next…`);
          continue;
        }

        if (!res.ok) {
          registry.recordError(node.id, `HTTP ${res.status}`);
          logEntry.error = `HTTP Error: ${res.status}`;
          logEntry.latencyMs = Date.now() - startTime;
          logEntry.status = res.status;
          trafficLog.append(logEntry);
          log(`[Magistral] Node ${node.id} error (${res.status}), trying next…`);
          continue;
        }

        registry.recordSuccess(node.id, startTime);
        logEntry.status = res.status;

        // Handle Non-Streaming (Buffer & Parse)
        if (!isStream) {
          const data = await res.json();
          logEntry.latencyMs = Date.now() - startTime;
          if (data.usage) {
            logEntry.promptTokens = data.usage.prompt_tokens;
            logEntry.completionTokens = data.usage.completion_tokens;
          }
          // Capture preview (first 200 chars of content)
          const content = data.choices?.[0]?.message?.content || "";
          logEntry.preview = content.slice(0, 200);

          // Strict Cognitive Packet Accounting Trace
          try {
            const providerName =
              node.adapter === "acp_stdio"
                ? "codex-acp"
                : node.url?.includes("openai.com")
                  ? "openai"
                  : node.url.includes("groq.com")
                    ? "groq"
                    : node.url.includes("mistral.ai")
                      ? "mistral"
                      : "provider";
            const packet =
              payload._packet ||
              createCognitivePacket({
                mandate_id: payload._mandate_id || "mandate:magistral:router",
                treatment_id: reqId,
                account_id: payload._account_id || "https://jhn.baronsmariani.org/",
                initial_node_id: "node:fracta:magistral",
                initial_instance_id: node.id,
                payload: {
                  title: payload.messages?.[0]?.content?.slice(0, 80) || "Magistral Request",
                },
              });
            const { spendingEntry } = appendPacketSpending(packet, {
              capability: "ai/chat-completion",
              provider: providerName,
              model: node.model,
              prompt_tokens: logEntry.promptTokens || 0,
              completion_tokens: logEntry.completionTokens || 0,
            });
            logEntry.provisionalCostUsd = spendingEntry.provisional_cost.coefficient;
            logEntry.packetId = packet.packet_id;
            data._cop_packet_id = packet.packet_id;
            data._cop_provisional_cost_usd = spendingEntry.provisional_cost.coefficient;
          } catch (e) {}

          trafficLog.append(logEntry);
          log(
            `[Magistral] ✓ Routed via ${node.id} (${node.tier}) | Cost: $${logEntry.provisionalCostUsd ? (Number(logEntry.provisionalCostUsd) / 1e8).toFixed(8) : "0"}`
          );

          const resHeaders = new Headers(res.headers);
          if (logEntry.packetId) resHeaders.set("X-COP-Packet-ID", logEntry.packetId);
          if (logEntry.provisionalCostUsd)
            resHeaders.set(
              "X-COP-Provisional-Cost-USD",
              (Number(logEntry.provisionalCostUsd) / 1e8).toFixed(8)
            );

          return new Response(JSON.stringify(data), {
            status: res.status,
            statusText: res.statusText,
            headers: resHeaders,
          });
        }

        // Handle Streaming (Intercept & Count)
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let gatheredTokens = 0;
        let previewBuffer = "";
        let sseBuffer = "";

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() || "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
                    try {
                      const json = JSON.parse(trimmed.slice(6));
                      if (json.usage) {
                        logEntry.promptTokens = json.usage.prompt_tokens;
                        logEntry.completionTokens = json.usage.completion_tokens;
                      } else if (json.choices?.[0]?.delta?.content) {
                        gatheredTokens++; // Rough count of chunks/tokens
                        if (previewBuffer.length < 200) {
                          previewBuffer += json.choices[0].delta.content;
                        }
                      }
                    } catch {}
                  }
                }

                controller.enqueue(value);
              }
            } catch (err) {
              controller.error(err);
              logEntry.error = "Stream interrupted";
            } finally {
              controller.close();
              logEntry.latencyMs = Date.now() - startTime;
              if (!logEntry.completionTokens) logEntry.completionTokens = gatheredTokens;
              logEntry.preview = previewBuffer.slice(0, 200);

              // Strict Cognitive Packet Accounting Trace for Stream
              try {
                const providerName =
                  node.adapter === "acp_stdio"
                    ? "codex-acp"
                    : node.url?.includes("openai.com")
                      ? "openai"
                      : node.url.includes("groq.com")
                        ? "groq"
                        : node.url.includes("mistral.ai")
                          ? "mistral"
                          : "provider";
                const packet =
                  payload._packet ||
                  createCognitivePacket({
                    mandate_id: payload._mandate_id || "mandate:magistral:router",
                    treatment_id: reqId,
                    account_id: payload._account_id || "https://jhn.baronsmariani.org/",
                    initial_node_id: "node:fracta:magistral",
                    initial_instance_id: node.id,
                  });
                const { spendingEntry } = appendPacketSpending(packet, {
                  capability: "ai/chat-completion",
                  provider: providerName,
                  model: node.model,
                  prompt_tokens: logEntry.promptTokens || 0,
                  completion_tokens: logEntry.completionTokens || 0,
                });
                logEntry.provisionalCostUsd = spendingEntry.provisional_cost.coefficient;
                logEntry.packetId = packet.packet_id;
              } catch (e) {}

              trafficLog.append(logEntry);
              log(
                `[Magistral] ✓ Stream via ${node.id} completed (${logEntry.completionTokens} toks) | Cost: $${logEntry.provisionalCostUsd ? (Number(logEntry.provisionalCostUsd) / 1e8).toFixed(8) : "0"}`
              );
            }
          },
        });

        return new Response(stream, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      } catch (err) {
        logEntry.latencyMs = Date.now() - startTime;
        logEntry.error = err.message;
        logEntry.status = 0;
        trafficLog.append(logEntry);

        registry.recordError(node.id, err.message);
        log(`[Magistral] Node ${node.id} network error: ${err.message}, trying next…`);
      }
    }

    throw new Error("All magistral nodes routing sequence exhausted.");
  }

  function addNode(node) {
    const normalized = normalizeNodeForMap(node);
    if (map.find((n) => n.id === normalized.id)) throw new Error("Node ID already exists");
    map.push(normalized);
    registry.get(normalized.id);
    return normalized;
  }

  function removeNode(nodeId) {
    const index = map.findIndex((n) => n.id === nodeId);
    if (index !== -1) {
      map.splice(index, 1);
      return true;
    }
    return false;
  }

  function getMap() {
    return map;
  }

  return { route, registry, trafficLog, addNode, removeNode, getMap };
}

export async function probeProviderModels(baseUrl, apiKey) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`Probe failed: ${res.status}`);
  return res.json();
}
