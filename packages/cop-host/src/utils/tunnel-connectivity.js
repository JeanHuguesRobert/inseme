/**
 * packages/cop-host/src/utils/tunnel.js
 * Utilities for detecting and checking tunnel/proxy connectivity.
 * Works in both Node.js and Deno (Edge) environments.
 */

export function getProxyEnv() {
  let proxy;
  // Deno
  if (typeof globalThis !== "undefined" && globalThis.Deno && globalThis.Deno.env) {
    proxy = globalThis.Deno.env.get("HTTP_PROXY") || globalThis.Deno.env.get("HTTPS_PROXY");
  }
  // Node.js
  else if (typeof globalThis !== "undefined" && globalThis.process && globalThis.process.env) {
    proxy = globalThis.process.env.HTTP_PROXY || globalThis.process.env.HTTPS_PROXY;
  }
  return proxy;
}

export async function checkTunnel(proxyUrl) {
  if (!proxyUrl) return true; // No proxy, valid.

  let hostname, port;
  try {
    const url = new URL(proxyUrl);
    hostname = url.hostname;
    port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);
  } catch (e) {
    console.warn(`[tunnel-check] Invalid proxy URL: ${proxyUrl}`);
    return false;
  }

  // Deno Environment
  if (typeof globalThis !== "undefined" && globalThis.Deno) {
    try {
      const conn = await globalThis.Deno.connect({ hostname, port });
      conn.close();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Node.js Environment
  // We use dynamic import for 'net' to avoid static analysis issues in Deno
  try {
    const net = await import("net");
    return new Promise((resolve) => {
      const socket = net.connect(port, hostname);
      socket.setTimeout(1000); // 1s timeout

      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        resolve(false);
      });
    });
  } catch (e) {
    console.error("[tunnel-check] Failed to import 'net' module in Node environment", e);
    return false;
  }
}

export function printTunnelWarning(proxyUrl) {
  const border = "================================================================================";
  const msg = `⚠️  WARNING: Proxy configured at ${proxyUrl} but unreachable.`;

  // Use colors if possible (Node usually supports it, Deno too)
  const yellow = "\x1b[33m";
  const reset = "\x1b[0m";

  console.warn(`\n${yellow}${border}`);
  console.warn(msg);
  console.warn(`This will likely cause Deno/Netlify Edge Functions to fail with "os error 10061".`);
  console.warn(`ACTION: Check if your tunnel is running OR comment out HTTP_PROXY in .env`);
  console.warn(`${border}${reset}\n`);
}

/**
 * Main helper to be called on startup.
 * Checks env vars, tests connectivity, and warns if failed.
 */
export async function checkAndWarn() {
  const proxy = getProxyEnv();
  if (proxy) {
    const isReachable = await checkTunnel(proxy);
    if (!isReachable) {
      printTunnelWarning(proxy);
    }
  }
}
