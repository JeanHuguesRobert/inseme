import path from "node:path";
import process from "node:process";

/**
 * Host-local ACP map.  All host identity and paths stay in environment
 * variables, never in a portable map or a committed secret file.
 */
export function createLocalCodexAcpMap(env = process.env, platform = process.platform) {
  const configuredCommand = String(env.CODEX_ACP_COMMAND || "").trim();
  const cwd = String(env.MAGISTRAL_CODEX_ACP_WORKSPACE || "").trim();
  const tier = String(env.MAGISTRAL_CODEX_ACP_TIER || "fractavolta-guide").trim();
  const pathApi = pathFor(platform);
  if (!configuredCommand) throw new Error("CODEX_ACP_COMMAND is required for map local-codex-acp");
  if (!cwd || !pathApi.isAbsolute(cwd)) {
    throw new Error(
      "MAGISTRAL_CODEX_ACP_WORKSPACE must be an absolute path to an isolated public directory"
    );
  }
  if (!tier) throw new Error("MAGISTRAL_CODEX_ACP_TIER must not be empty");

  const launcher = resolveLauncher(configuredCommand, platform);
  return [
    {
      id: "local-codex-acp",
      adapter: "acp_stdio",
      command: launcher.command,
      args: launcher.args,
      cwd,
      model: String(env.MAGISTRAL_CODEX_ACP_MODEL || "codex-local").trim() || "codex-local",
      tier,
      blueprint_id: "public-guide",
      weight: 1,
      prompt_timeout_ms: boundedTimeout(env.MAGISTRAL_CODEX_ACP_TIMEOUT_MS, 120_000),
      // The ACP agent is a local subprocess.  Inherited corporate/system
      // proxies can make its cloud control connection stall even though the
      // host itself is online.  Keep that dependency explicit: a deployment
      // that genuinely needs a proxy can opt in with `..._INHERIT_PROXY=1`.
      env: createAcpEnvironment(env),
    },
  ];
}

function createAcpEnvironment(env) {
  if (String(env.MAGISTRAL_CODEX_ACP_INHERIT_PROXY || "") === "1") return {};
  return {
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

function resolveLauncher(command, platform) {
  const pathApi = pathFor(platform);
  if (!pathApi.isAbsolute(command)) throw new Error("CODEX_ACP_COMMAND must be an absolute path");
  if (platform !== "win32" || !/\.cmd$/i.test(command)) return { command, args: [] };
  // Deno owns this direct Node process.  Avoid the npm .cmd wrapper, which
  // otherwise leaves a child process outside the pilot's lifecycle.
  return {
    command: process.execPath,
    args: [
      pathApi.join(
        pathApi.dirname(command),
        "node_modules",
        "@agentclientprotocol",
        "codex-acp",
        "dist",
        "index.js"
      ),
    ],
  };
}

function pathFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function boundedTimeout(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(5_000, Math.min(240_000, numeric)) : fallback;
}

// Named export stays testable without requiring a local Codex installation.
// The launcher detects the empty default map and reports the missing runtime
// configuration before it starts the pilot.
export default process.env.CODEX_ACP_COMMAND ? createLocalCodexAcpMap() : [];
