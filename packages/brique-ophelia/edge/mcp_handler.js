/**
 * packages/brique-ophelia/edge/mcp_handler.js
 * Pont MCP (Model Context Protocol) sur Netlify Edge.
 * Utilise Supabase Realtime comme bus de message pour coupler GET (SSE) et POST (RPC).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ALL_TOOLS, executeInternalTool } from "./lib/tools.js";

export async function handleMCPRequest(request, runtime) {
  const { json, error, getConfig } = runtime;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseKey = getConfig("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. GET - Établir le flux SSE
  if (request.method === "GET" && !sessionId) {
    const newSessionId = crypto.randomUUID();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Envoyer l'URL du endpoint pour les messages POST (spec MCP SSE)
        const endpointUrl = `${url.origin}${url.pathname}?sessionId=${newSessionId}`;
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));

        // S'abonner aux messages pour cette session
        const channel = supabase.channel(`mcp:${newSessionId}`);
        channel
          .on("broadcast", { event: "message" }, ({ payload }) => {
            controller.enqueue(
              encoder.encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          })
          .subscribe();

        // Garder la connexion ouverte
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch (e) {
            clearInterval(keepAlive);
          }
        }, 15000);
      },
      cancel() {
        // Cleanup
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // 2. POST - Traiter les messages JSON-RPC
  if (request.method === "POST" && sessionId) {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== "2.0") return error("Invalid JSON-RPC", 400);

    let result = null;
    let mcpError = null;

    try {
      switch (method) {
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: { name: "ophelia-mcp", version: "1.0.0" },
          };
          break;

        case "tools/list":
          result = {
            tools: ALL_TOOLS.map((t) => ({
              name: t.function.name,
              description: t.function.description,
              inputSchema: t.function.parameters,
            })),
          };
          break;

        case "tools/call": {
          const toolName = params.name;
          const args = params.arguments;
          // Mock runtime for internal execution
          const mockRuntime = {
            getConfig: (key) => getConfig(key),
            sql: null, // Would need dynamic injection
            supabase: supabase,
          };
          const output = await executeInternalTool(mockRuntime, toolName, args, {});
          result = {
            content: [
              { type: "text", text: typeof output === "string" ? output : JSON.stringify(output) },
            ],
          };
          break;
        }

        case "resources/list": {
          // Fetch wiki pages
          const { data: wiki } = await supabase.from("wiki_pages").select("id, title");
          result = {
            resources: wiki.map((page) => ({
              uri: `wiki://${page.id}`,
              name: page.title,
              description: `Page wiki: ${page.title}`,
              mimeType: "text/markdown",
            })),
          };
          break;
        }

        case "resources/read": {
          const uri = params.uri;
          const wikiId = uri.replace("wiki://", "");
          const { data: page } = await supabase
            .from("wiki_pages")
            .select("content")
            .eq("id", wikiId)
            .single();
          result = {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: page?.content || "Page non trouvée.",
              },
            ],
          };
          break;
        }

        case "prompts/list":
          result = {
            prompts: [
              { name: "mediator", description: "Ophélia en mode médiatrice de débat." },
              { name: "analyst", description: "Ophélia en mode analyse de données et SQL." },
              { name: "scribe", description: "Ophélia en mode rédaction de comptes rendus." },
              { name: "guardian", description: "Ophélia en mode protection des règles." },
            ],
          };
          break;

        case "prompts/get": {
          const roleId = params.name;
          // Simplified prompt retrieval
          result = {
            description: `Prompt pour le rôle ${roleId}`,
            messages: [{ role: "user", content: `Agis en tant que ${roleId}.` }],
          };
          break;
        }

        case "notifications/initialized":
          return new Response(null, { status: 202 });

        default:
          mcpError = { code: -32601, message: "Method not found" };
      }
    } catch (e) {
      mcpError = { code: -32603, message: e.message };
    }

    const response = { jsonrpc: "2.0", id };
    if (mcpError) response.error = mcpError;
    else response.result = result;

    // Publier la réponse sur le canal SSE via Supabase
    console.log(`[MCP] 📤 Sending response for ID ${id} to session ${sessionId}`);
    await supabase.channel(`mcp:${sessionId}`).send({
      type: "broadcast",
      event: "message",
      payload: response,
    });

    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  return error("Not Found", 404);
}
