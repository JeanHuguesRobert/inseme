/**
 * Inseme federated MCP hub — maximize visible / actionable tool surface.
 *
 * Surfaces:
 *   - Cogentia MCP core (catalog owner: tools, resources, prompts, skills)
 *   - Ritornu (personal publication retrofit under mandate)
 *   - Hub meta tools (cockpit, catalog)
 */

import {
  BRIQUE_ID,
  BRIQUE_STATUS,
  NON_NEGOTIABLE_BOUNDARIES,
  SCHEMA_VERSIONS,
} from "../constants.js";
import {
  PROTOCOL_VERSION,
  SERVER_VERSION as RITORNU_MCP_VERSION,
  TOOLS as RITORNU_TOOLS,
  createMcpCore as createRitornuCore,
  jsonRpcError,
  jsonRpcResult,
  mcpToolResult,
} from "./core.js";
import {
  COGENTIA_TOOLS,
  COGENTIA_FORWARDED_METHODS,
  createCogentiaProxy,
} from "./cogentia-proxy.js";

export const HUB_SERVER_NAME = "inseme-mcp";
export const HUB_SERVER_VERSION = "0.4.0";
export const HUB_MODERN_PROTOCOL = "2026-07-28";
export const HUB_LEGACY_PROTOCOLS = new Set([PROTOCOL_VERSION, "2025-06-18", "2024-11-05"]);
export const HUB_SUPPORTED_PROTOCOLS = new Set([HUB_MODERN_PROTOCOL, ...HUB_LEGACY_PROTOCOLS]);

// FBF 2026-11-23: July 2026 is stateless: initialize belongs only to the legacy era.
// Naming a modern protocol version without its per-request wire contract was a compliance bug.
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER = "io.modelcontextprotocol/serverInfo";
const MODERN_ERROR_UNSUPPORTED_VERSION = -32022;
const HUB_LIST_TTL_MS = 60_000;

function protocolOf(message, transport = {}) {
  const meta = message?.params?._meta || {};
  const header = String(transport.protocolVersionHeader || "");
  const declared = String(meta[META_VERSION] || "");
  if (header && declared && header !== declared) return { mismatch: true };
  if (message.method === "initialize") return { modern: false };
  const version = header || declared || (message.method === "server/discover" ? HUB_MODERN_PROTOCOL : "");
  if (version && !HUB_SUPPORTED_PROTOCOLS.has(version)) return { unsupported: version };
  return { modern: version === HUB_MODERN_PROTOCOL, version };
}
function modernResult(result) {
  return {
    ...result,
    resultType: result?.resultType || "complete",
    _meta: {
      ...(result?._meta || {}),
      [META_VERSION]: HUB_MODERN_PROTOCOL,
      [META_SERVER]: { name: HUB_SERVER_NAME, version: HUB_SERVER_VERSION },
    },
  };
}


/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ fetchImpl?: typeof fetch, store?: object, cogentia?: object }} [options]
 */
export function createHubMcp(env = process.env, options = {}) {
  const surface = String(env.INSEME_MCP_SURFACE || "full").toLowerCase();
  const includeCogentia = surface === "full" || surface === "cogentia";
  const includeRitornu = surface === "full" || surface === "ritornu";

  const ritornu = includeRitornu
    ? createRitornuCore(env, {
        fetchImpl: options.fetchImpl,
        store: options.store,
      })
    : null;

  let cogentia = null;
  if (includeCogentia) {
    cogentia = options.cogentia || null;
    if (!cogentia) {
      try {
        cogentia = createCogentiaProxy(env);
      } catch (error) {
        cogentia = createBrokenCogentiaProxy(error.message);
      }
    }
  }

  const hubMetaTools = [
    {
      name: "inseme_cockpit",
      description:
        "Federated session bootstrap: Ritornu mandate snapshot + Cogentia views/status when available. Call first on a new host session.",
      inputSchema: {
        type: "object",
        properties: {
          include_remote: {
            type: "boolean",
            description: "Forward to cogentia_views_snapshot include_remote",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "inseme_list_surfaces",
      description:
        "List MCP tool surfaces and counts (cogentia / ritornu / hub) so agents know what is visible and actionable.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];

  function listTools() {
    const tools = [...hubMetaTools];
    if (cogentia) tools.push(...cogentia.listTools());
    if (ritornu) {
      for (const t of RITORNU_TOOLS) {
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          ...(t.annotations ? { annotations: t.annotations } : {}),
        });
      }
    }
    return tools;
  }

  function hubCapabilities(cogentiaInit) {
    const fromCogentia = cogentiaInit?.capabilities;
    if (fromCogentia && typeof fromCogentia === "object") {
      return {
        ...fromCogentia,
        tools: { listChanged: false, ...(fromCogentia.tools || {}) },
      };
    }
    return { tools: { listChanged: false } };
  }

  function initialize(params = {}) {
    const requested = String(params.protocolVersion || "");
    const toolCount = listTools().length;
    const cogentiaInit = cogentia?.initialize ? cogentia.initialize(params) : null;
    return {
      protocolVersion: HUB_LEGACY_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION,
      capabilities: hubCapabilities(cogentiaInit),
      serverInfo: { name: HUB_SERVER_NAME, version: HUB_SERVER_VERSION },
      instructions:
        `Inseme federated MCP (${toolCount} tools). ` +
        "Start with inseme_cockpit or cogentia_views_snapshot. " +
        "Cogentia owns the corpus catalog: tools/list is a subset; use resources/list, skills/list, cogentia_cli_catalog, and cogentia_pattern_list for the maximum set. " +
        "Use cogentia_search / cogentia_context_pack for corpus work; cogentia_get_lines to cite. " +
        "Use ritornu_* only under human mandate for personal publication retrofit (never auto-Git). " +
        "Cogentia mutate tools require full view + COGENTIA_MCP_ALLOW_MUTATE=1 (COGENTIA_MCP_ALLOW_OPS is accepted as an alias). " +
        "Daemon: COGENTIA_DAEMON_URL (default http://127.0.0.1:8790).",
    };
  }

  async function callTool(name, args = {}) {
    if (name === "inseme_cockpit") {
      return runCockpit(args);
    }
    if (name === "inseme_list_surfaces") {
      return {
        ok: true,
        server: HUB_SERVER_NAME,
        version: HUB_SERVER_VERSION,
        surface,
        surfaces: {
          hub: { tools: hubMetaTools.map((t) => t.name) },
          cogentia: {
            enabled: Boolean(cogentia),
            catalog: cogentia?.catalog || "cogentia-mcp-core",
            tool_count: cogentia ? cogentia.toolCount() : 0,
            catalog_size: COGENTIA_TOOLS.length,
            daemon: cogentia?.daemonUrl?.origin || cogentia?.daemonUrl || null,
            allow_ops: cogentia?.allowOps ?? false,
          },
          ritornu: {
            enabled: Boolean(ritornu),
            brique_id: BRIQUE_ID,
            brique_status: BRIQUE_STATUS,
            tool_count: includeRitornu ? RITORNU_TOOLS.length : 0,
            mcp_version: RITORNU_MCP_VERSION,
            schema_versions: SCHEMA_VERSIONS,
            boundaries: [...NON_NEGOTIABLE_BOUNDARIES],
          },
        },
        total_tools: listTools().length,
      };
    }

    if (cogentia?.hasTool(name)) {
      return cogentia.callTool(name, args);
    }
    if (ritornu) {
      const ritornuNames = new Set(RITORNU_TOOLS.map((t) => t.name));
      if (ritornuNames.has(name)) {
        return ritornu.callTool(name, args);
      }
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  async function runCockpit(args = {}) {
    const out = {
      ok: true,
      server: HUB_SERVER_NAME,
      version: HUB_SERVER_VERSION,
      surface,
      generated_at: new Date().toISOString(),
      ritornu: null,
      cogentia: null,
      next_steps: [],
    };

    if (ritornu) {
      try {
        out.ritornu = await ritornu.callTool("ritornu_health", {});
        out.next_steps.push(
          "For personal publication retrofit: ritornu_prepare_substack or ritornu_normalize_provided under mandate."
        );
      } catch (error) {
        out.ritornu = { ok: false, error: error.message };
      }
    }

    if (cogentia) {
      try {
        out.cogentia = {
          health: await cogentia.healthProbe(),
          views: await cogentia.callTool("cogentia_views_snapshot", {
            limit: 12,
            include_remote: args.include_remote === true,
          }),
        };
        out.next_steps.push(
          "For corpus work: cogentia_search → cogentia_context_pack → cogentia_get_lines (cite source_id / ref)."
        );
        out.next_steps.push(
          "For the full Cogentia set: resources/list, skills/list, cogentia_pattern_list, cogentia_cli_catalog."
        );
      } catch (error) {
        out.cogentia = {
          ok: false,
          error: error.message,
          hint: "Start cogentia.js daemon if corpus tools should be actionable.",
        };
        out.next_steps.push(
          "Start Cogentia daemon to unlock corpus tools (search, packs, issues, CLI)."
        );
      }
    }

    out.next_steps.push("Call inseme_list_surfaces for the full tool catalog by domain.");
    return out;
  }

  async function forwardCogentia(message, transport) {
    if (!cogentia?.handleJsonRpc) {
      if (message.method === "resources/list") return jsonRpcResult(message.id, { resources: [] });
      if (message.method === "prompts/list") return jsonRpcResult(message.id, { prompts: [] });
      if (message.method === "skills/list") return jsonRpcResult(message.id, { skills: [] });
      return jsonRpcError(message.id, -32601, "Method not found");
    }
    const response = await cogentia.handleJsonRpc(message, transport);
    if (message.method === "server/discover" && response?.result) {
      const init = initialize(message.params || {});
      response.result.instructions = init.instructions;
      response.result._meta = {
        ...(response.result._meta || {}),
        "io.modelcontextprotocol/serverInfo": {
          name: HUB_SERVER_NAME,
          version: HUB_SERVER_VERSION,
        },
        inseme: {
          hub: HUB_SERVER_NAME,
          surfaces: ["hub", cogentia ? "cogentia" : null, ritornu ? "ritornu" : null].filter(
            Boolean
          ),
        },
      };
    }
    return response;
  }

  async function handleJsonRpc(message, transport = {}) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return jsonRpcError(message?.id ?? null, -32600, "Invalid Request");
    }
    if (message.id === undefined) {
      return null;
    }
    // FBF 2026-11-23: validate the stateless modern protocol independently
    // for every request. Never silently answer an unsupported version as legacy.
    const protocol = protocolOf(message, transport);
    if (protocol.mismatch)
      return jsonRpcError(message.id, -32020, "MCP protocol header and request _meta disagree");
    if (protocol.unsupported)
      return jsonRpcError(message.id, MODERN_ERROR_UNSUPPORTED_VERSION,
        "Unsupported protocol version", { supportedVersions: [...HUB_SUPPORTED_PROTOCOLS] });
    // FBF 2026-11-23: the stateless request itself MUST carry both fields.
    // The optional clientInfo may be omitted. Discovery is also used as a
    // first probe by older hosts and remains accessible without this envelope.
    if (protocol.modern && message.method !== "server/discover") {
      const meta = message.params?._meta;
      if (meta?.[META_VERSION] !== HUB_MODERN_PROTOCOL ||
          !meta["io.modelcontextprotocol/clientCapabilities"] ||
          typeof meta["io.modelcontextprotocol/clientCapabilities"] !== "object" ||
          Array.isArray(meta["io.modelcontextprotocol/clientCapabilities"])) {
        return jsonRpcError(message.id, -32602, "Invalid modern MCP request metadata");
      }
    }
    if (transport.mcpMethod && transport.mcpMethod !== message.method)
      return jsonRpcError(message.id, protocol.modern ? -32020 : -32600, "Mcp-Method header does not match request method");
    if (transport.mcpName && message.method === "tools/call" &&
        transport.mcpName !== String(message.params?.name || ""))
      return jsonRpcError(message.id, protocol.modern ? -32020 : -32600, "Mcp-Name header does not match tool name");
    try {
      if (message.method === "initialize") {
        return jsonRpcResult(message.id, initialize(message.params || {}));
      }
      if (message.method === "ping") {
        // FBF: ping is not part of the July 2026 method set.
        return protocol.modern
          ? jsonRpcError(message.id, -32601, "Method not found")
          : jsonRpcResult(message.id, {});
      }
      if (message.method === "tools/list") {
        const result = { tools: listTools() };
        if (protocol.modern) Object.assign(result, { ttlMs: HUB_LIST_TTL_MS, cacheScope: "private" });
        return jsonRpcResult(message.id, protocol.modern ? modernResult(result) : result);
      }
      if (message.method === "tools/call") {
        const name = String(message.params?.name || "");
        const args = message.params?.arguments || {};
        const data = await callTool(name, args);
        const result = mcpToolResult(data);
        return jsonRpcResult(message.id, protocol.modern ? modernResult(result) : result);
      }
      if (COGENTIA_FORWARDED_METHODS.has(message.method)) {
        // FBF: discovery must remain functional when Cogentia is absent.
        if (message.method === "server/discover" && !cogentia?.handleJsonRpc) {
          return jsonRpcResult(message.id, modernResult({
            supportedVersions: [...HUB_SUPPORTED_PROTOCOLS],
            capabilities: { tools: { listChanged: false } },
            instructions: initialize().instructions,
            ttlMs: HUB_LIST_TTL_MS,
            cacheScope: "private",
          }));
        }
        const forwarded = await forwardCogentia(message, transport);
        if (protocol.modern && forwarded?.result)
          forwarded.result = modernResult(forwarded.result);
        return forwarded;
      }
      return jsonRpcError(message.id, -32601, "Method not found");
    } catch (error) {
      const result = {
        content: [{ type: "text", text: error?.message || String(error) }],
        isError: true,
      };
      return jsonRpcResult(message.id, protocol.modern ? modernResult(result) : result);
    }
  }

  return {
    serverName: HUB_SERVER_NAME,
    serverVersion: HUB_SERVER_VERSION,
    listTools,
    callTool,
    handleJsonRpc,
    initialize,
    ritornu,
    cogentia,
  };
}

function createBrokenCogentiaProxy(message) {
  const readable = COGENTIA_TOOLS.filter((t) => t.risk === "read");
  return {
    daemonUrl: { origin: "invalid" },
    allowOps: false,
    catalog: "unavailable",
    listTools: () =>
      readable.map((t) => ({
        name: t.name,
        description: `${t.description} [daemon config error: ${message}]`,
        inputSchema: t.inputSchema,
      })),
    callTool: async () => {
      throw new Error(`Cogentia proxy misconfigured: ${message}`);
    },
    hasTool: (name) => COGENTIA_TOOLS.some((t) => t.name === name),
    healthProbe: async () => ({ ok: false, error: message }),
    toolCount: () => readable.length,
  };
}
