/**
 * packages/cop-host/src/runtime/function.js
 *
 * Helper for Netlify Functions (Node.js runtime) to handle dynamic instance resolution.
 * Similar to how Edge Functions handle it, but adapted for the Node.js context.
 */

import { existsSync, statSync } from "fs";
import {
  loadInstanceConfig,
  getConfig as getInstanceConfig,
} from "../config/instanceConfig.backend.js";
import { createDebugTrace } from "../lib/debug.js";
import { Contract } from "../lib/contract.js";

/**
 * Resolves the target instance based on the request (Standard Request or Netlify Event).
 * Loads the configuration into the global scope if not already loaded (or forces reload).
 *
 * @param {Request|Object} request - The standard Request object or Netlify Function event
 * @param {Object} [options]
 * @param {boolean} [options.forceReload=true] - Force reloading config (crucial for multi-tenant isolation in Node)
 * @returns {Promise<Object|null>} The loaded configuration or null if not found
 */
export async function resolveInstanceFromRequest(request, options = {}) {
  Contract.require(
    request,
    "Request object is required for instance resolution"
  );

  const { forceReload = true, debug } = options;

  let host;
  // Handle standard Request object (Netlify V2)
  if (request instanceof Request) {
    host =
      request.headers.get("host") || request.headers.get("x-forwarded-host");
  }
  // Handle legacy Event object (Netlify V1)
  else if (request.headers) {
    host = request.headers.host || request.headers.Host;
  }

  if (!host) {
    if (debug) debug.log("No Host header found in request");
    console.warn("[cop-host] No Host header found in request");
    return null;
  }

  // Normalize localhost
  if (host.includes(":")) host = host.split(":")[0];

  try {
    if (debug) debug.startTimer(`resolveInstance:${host}`);
    const config = await loadInstanceConfig(forceReload, { hostname: host });
    if (debug) debug.stopTimer(`resolveInstance:${host}`);

    // POST-CONDITION: If successful, we returned the config
    return config;
  } catch (error) {
    if (debug)
      debug.error(`Failed to resolve instance for host ${host}`, error);
    console.error(
      `[cop-host] Failed to resolve instance for host ${host}:`,
      error
    );
    return null;
  }
}

/**
 * Helper to get the current instance config (if already resolved).
 */
export function getCurrentInstance() {
  return getInstanceConfig();
}

/**
 * Standard Function Wrapper for Briques.
 * Automatically resolves the SaaS Instance before executing the handler.
 *
 * @param {Function} handler - async (req, context) => Response
 * @returns {Function} Wrapped handler
 */
export function defineFunction(handler) {
  Contract.require(typeof handler === "function", "Handler must be a function");

  return async (req, context) => {
    Contract.require(req, "Incoming request is missing");

    // Netlify Functions (Node.js) use process.env
    const env = {
      get: (key) => process.env[key],
    };

    const debug = createDebugTrace(env);

    // 1. Resolve SaaS Instance context
    const config = await resolveInstanceFromRequest(req, { debug });

    // Activation du debug si configuré dans l'instance
    if (
      getInstanceConfig("DEBUG") === "true" ||
      getInstanceConfig("DEBUG") === true
    ) {
      debug.setEnabled(true);
    }

    if (!config) {
      debug.log("Processing request without resolved instance.");
      console.warn("[cop-host] Processing request without resolved instance.");
    }

    // 2. Execute Handler
    try {
      debug.startTimer("handler");
      const response = await handler(req, { ...context, debug });
      debug.stopTimer("handler");

      Contract.ensure(
        response instanceof Response,
        "Handler must return a standard Response object"
      );

      // Si la réponse est JSON et que le debug est activé, on injecte les traces
      if (
        debug.enabled &&
        response.headers.get("content-type")?.includes("application/json")
      ) {
        try {
          const data = await response.json();
          data._debug = debug.getTrace();
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: response.headers,
          });
        } catch (e) {
          return response;
        }
      }

      return response;
    } catch (error) {
      debug.error("Handler execution failed", error);
      console.error("[cop-host] Handler error:", error);

      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error.message,
          _debug: debug.enabled ? debug.getTrace() : undefined,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
}
