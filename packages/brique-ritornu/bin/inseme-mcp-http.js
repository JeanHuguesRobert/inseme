#!/usr/bin/env node
/**
 * Inseme federated MCP — HTTP JSON-RPC.
 *
 *   PORT=8793 node bin/inseme-mcp-http.js
 *   POST /mcp   GET /health   GET /tools
 *
 * Optional: RITORNU_MCP_TOKEN / INSEME_MCP_TOKEN bearer auth.
 */

import http from "node:http";
import { createHubMcp } from "../src/mcp/hub.js";
import { HUB_SERVER_NAME, HUB_SERVER_VERSION } from "../src/mcp/hub.js";

const hub = createHubMcp(process.env);
const port = Number(process.env.PORT || process.env.INSEME_MCP_PORT || 8793);
const host = process.env.INSEME_MCP_HOST || "127.0.0.1";
const token = String(process.env.INSEME_MCP_TOKEN || process.env.RITORNU_MCP_TOKEN || "").trim();
const corsOrigin = process.env.INSEME_CORS_ORIGIN || process.env.RITORNU_CORS_ORIGIN || "*";

const server = http.createServer(async (req, res) => {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const cockpit = await hub.callTool("inseme_cockpit", {});
      return sendJson(res, 200, cockpit);
    }
    if (req.method === "GET" && url.pathname === "/tools") {
      return sendJson(res, 200, { tools: hub.listTools() });
    }
    if (req.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) {
      return sendJson(res, 200, {
        name: HUB_SERVER_NAME,
        version: HUB_SERVER_VERSION,
        transport: "http-jsonrpc",
        post: "/mcp",
        tool_count: hub.listTools().length,
      });
    }
    if (req.method === "POST" && url.pathname === "/mcp") {
      if (!authorize(req)) return sendJson(res, 401, { error: "unauthorized" });
      const body = await readJson(req);
      // FBF 2026-11-23: keep MCP 2026-07-28 routing and version headers
      // visible to the hub; otherwise mismatched versions silently pass.
      const transport = {
        protocolVersionHeader: String(req.headers["mcp-protocol-version"] || ""),
        mcpMethod: String(req.headers["mcp-method"] || ""),
        mcpName: String(req.headers["mcp-name"] || ""),
      };
      // FBF: July 2026 Streamable HTTP headers are mandatory and match the body.
      // Legacy POST clients retain the earlier permissive transport contract.
      function headerError(message) {
        const declared = message?.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
        if (declared !== "2026-07-28" && transport.protocolVersionHeader !== "2026-07-28")
          return null;
        const method = String(message?.method || "");
        const expectedName = method === "tools/call" || method === "prompts/get"
          ? message?.params?.name
          : method === "resources/read" ? message?.params?.uri
          : ["tasks/get", "tasks/update", "tasks/cancel"].includes(method)
            ? message?.params?.taskId : null;
        if (transport.protocolVersionHeader !== "2026-07-28" ||
            transport.mcpMethod !== method ||
            (expectedName != null && transport.mcpName !== String(expectedName))) {
          return {
            jsonrpc: "2.0", id: message?.id ?? null,
            error: { code: -32020, message: "MCP HTTP headers missing or inconsistent" },
          };
        }
        return null;
      }
      if (Array.isArray(body)) {
        const results = [];
        for (const message of body) {
          const response = headerError(message) || await hub.handleJsonRpc(message, transport);
          if (response) results.push(response);
        }
        return sendJson(res, 200, results);
      }
      const response = headerError(body) || await hub.handleJsonRpc(body, transport);
      if (!response) {
        res.writeHead(202);
        return res.end();
      }
      return sendJson(res, response?.error?.code === -32020 ? 400 : 200, response);
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(res, 500, {
      content: [{ type: "text", text: error.message }],
      isError: true,
    });
  }
});

server.listen(port, host, () => {
  process.stderr.write(
    `[${HUB_SERVER_NAME}] HTTP on http://${host}:${port}  tools=${hub.listTools().length}  POST /mcp\n`
  );
});

function authorize(req) {
  if (!token) return true;
  const header = String(req.headers.authorization || "");
  if (header === `Bearer ${token}`) return true;
  const alt = String(req.headers["x-inseme-token"] || req.headers["x-ritornu-token"] || "");
  return alt === token;
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Inseme-Token, X-Ritornu-Token, MCP-Protocol-Version, Mcp-Method, Mcp-Name"
  );
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
