import path from "node:path";
import process from "node:process";

/**
 * Host-local ACP map for OpenCode (sst/opencode).
 *
 * Unlike local-codex-acp.js and local-claude-acp.js, OpenCode is not itself
 * a model vendor -- it is a provider-agnostic coding agent whose
 * `opencode acp` subcommand speaks ACP natively (no separate adapter
 * package). Verified empirically (2026-09-26, see inseme#106) via a raw
 * ACP probe (initialize -> session/new -> session/prompt): `opencode acp`
 * has NO `--model` CLI flag (unlike an earlier, unverified assumption in
 * this issue) -- model selection is a `session/new` response config
 * option (`configOptions[].id === "model"`), not a launch argument. The
 * same probe completed a real prompt correctly, at $0 cost, using
 * OpenCode's own hosted default model ("opencode/big-pickle") with no
 * provider credential configured at all.
 *
 * This first cut therefore does not attempt to select a specific
 * OpenRouter model via this map -- doing so would require either an
 * `opencode.json` project config dropped into the isolated workspace
 * directory (deploy-time artifact, not a Magistral secret) or driving the
 * session/new config-option RPC from acp-executor.js (not yet
 * implemented there). It runs with OpenCode's own default model and
 * OPENROUTER_API_KEY available in the environment for when a project
 * config opts into an OpenRouter-backed model later.
 *
 * Default tier is "fallback": provider redundancy when the primary
 * coding-agent node (Codex) is exhausted or unavailable, not competing
 * with it for the same traffic. All host identity and paths stay in
 * environment variables, never in a portable map or a committed secret
 * file.
 */
export function createLocalOpencodeAcpMap(env = process.env, platform = process.platform) {
  const configuredCommand = String(env.OPENCODE_ACP_COMMAND || "").trim();
  const cwd = String(env.MAGISTRAL_OPENCODE_ACP_WORKSPACE || "").trim();
  const tier = String(env.MAGISTRAL_OPENCODE_ACP_TIER || "fallback").trim();
  const pathApi = pathFor(platform);
  if (!configuredCommand)
    throw new Error("OPENCODE_ACP_COMMAND is required for map local-opencode-acp");
  if (!pathApi.isAbsolute(configuredCommand))
    throw new Error("OPENCODE_ACP_COMMAND must be an absolute path");
  if (!cwd || !pathApi.isAbsolute(cwd)) {
    throw new Error(
      "MAGISTRAL_OPENCODE_ACP_WORKSPACE must be an absolute path to an isolated public directory"
    );
  }
  if (!tier) throw new Error("MAGISTRAL_OPENCODE_ACP_TIER must not be empty");

  return [
    {
      id: "local-opencode-acp",
      adapter: "acp_stdio",
      command: configuredCommand,
      args: ["acp"],
      cwd,
      // Descriptive only (surfaced in /v1/magistral/metrics); does not
      // configure OpenCode's actual model, see file header.
      model: String(env.MAGISTRAL_OPENCODE_ACP_MODEL || "opencode-default").trim(),
      tier,
      blueprint_id: "public-guide",
      weight: 1,
      prompt_timeout_ms: boundedTimeout(env.MAGISTRAL_OPENCODE_ACP_TIMEOUT_MS, 120_000),
      // Same rationale as the other local ACP maps: an inherited
      // corporate/system proxy can make the local subprocess's cloud
      // connection stall even though the host itself is online.
      env: createAcpEnvironment(env),
    },
  ];
}

function createAcpEnvironment(env) {
  const apiKey = String(env.OPENROUTER_API_KEY || "").trim();
  const base = apiKey ? { OPENROUTER_API_KEY: apiKey } : {};
  if (String(env.MAGISTRAL_OPENCODE_ACP_INHERIT_PROXY || "") === "1") return base;
  return {
    ...base,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    all_proxy: "",
    NO_PROXY: "*",
    no_proxy: "*",
  };
}

function pathFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function boundedTimeout(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(5_000, Math.min(240_000, numeric)) : fallback;
}

// Named export stays testable without requiring a local OpenCode
// installation or a real OpenRouter key.
export default process.env.OPENCODE_ACP_COMMAND ? createLocalOpencodeAcpMap() : [];
