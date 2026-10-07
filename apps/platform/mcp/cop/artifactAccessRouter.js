import express from "express";
import { createClient } from "@supabase/supabase-js";

import { createWatchTheWatchersHandler } from "../../../../scripts/watch-the-watchers-http.js";
import { createArtifactAccessSupabaseStore } from "./artifactAccessSupabaseStore.js";

export function createArtifactAccessRouter({
  config,
  supabaseClient,
  now,
} = {}) {
  if (!config) throw new Error("watchers_config_required");
  if (!supabaseClient) throw new Error("watchers_supabase_client_required");

  const store = createArtifactAccessSupabaseStore(supabaseClient);
  const handler = createWatchTheWatchersHandler({
    config,
    lookupToken: (token) => store.lookupToken(token),
    appendEvent: (event) => store.appendEvent(event),
    now,
  });

  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));

  router.all("/a/:token", bridge(handler));
  router.all("/a/:token/open", bridge(handler));
  router.all("/a/:token/redirect", bridge(handler));

  return router;
}

export function maybeCreateArtifactAccessRouterFromEnv(env = process.env) {
  const raw = env.WATCHERS_CONFIG_JSON;
  if (!raw) return null;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("WATCHERS_CONFIG_JSON requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error("WATCHERS_CONFIG_JSON must be valid JSON");
  }

  const supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return createArtifactAccessRouter({ config, supabaseClient });
}

function bridge(handler) {
  return async (req, res, next) => {
    try {
      const origin = `${req.protocol || "http"}://${req.get("host") || "localhost"}`;
      const result = await handler({
        method: req.method,
        url: new URL(req.originalUrl || req.url, origin).toString(),
      });

      res.status(result.status);
      for (const [name, value] of Object.entries(result.headers || {})) {
        res.setHeader(name, value);
      }
      res.send(result.body);
    } catch (error) {
      next(error);
    }
  };
}
