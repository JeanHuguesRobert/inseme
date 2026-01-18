// apps/platform/netlify/functions/tunnel-control.js
import {
  defineFunction,
  getCurrentInstance,
} from "../../../../packages/cop-host/src/runtime/function.js";

/**
 * Netlify Function to handle tunnel control actions (like refreshing config).
 * This is called by scripts/tunnel.js when a tunnel is established or closed.
 */
export default defineFunction(async (req, { debug }) => {
  const config = getCurrentInstance();

  if (!config) {
    return new Response(JSON.stringify({ error: "Instance not resolved" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = config.tunnel_control_secret || config.ngrok_control_secret;

  const authHeader = req.headers.get("authorization");
  if (!authHeader || (secret && authHeader !== `Bearer ${secret}`)) {
    debug.log("Unauthorized tunnel-control attempt");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    // Ignore empty body
  }

  const action = body.action || "refresh";

  if (action === "refresh") {
    // Note: resolveInstanceFromRequest already forced a reload of the config
    debug.log("Tunnel control: configuration refreshed");
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Configuration refreshed",
        instance: config.community_name || "unknown",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
});
