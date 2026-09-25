import path from "node:path";
import process from "node:process";

/**
 * Host-local ACP map for Claude Code, via the official
 * @agentclientprotocol/claude-agent-acp adapter (published by the same
 * @agentclientprotocol namespace as codex-acp; formerly
 * @zed-industries/claude-code-acp, renamed upstream).
 *
 * Default tier is "fallback": this node exists for provider redundancy when
 * the primary coding-agent node (Codex) is exhausted or unavailable, not to
 * compete with it for the same traffic. All host identity and paths stay in
 * environment variables, never in a portable map or a committed secret file.
 *
 * Auth follows the same convention as local-codex-acp: no key is minted or
 * required here. The adapter wraps the Claude Agent SDK, which resolves
 * credentials the same way the interactive `claude` CLI does -- OAuth
 * session under the process's HOME (`claude setup-token` for a headless
 * host), or ANTHROPIC_API_KEY if explicitly set in the environment. Set
 * ANTHROPIC_API_KEY only if you deliberately want metered API billing
 * instead of the OAuth subscription session.
 */
export function createLocalClaudeAcpMap(env = process.env, platform = process.platform) {
  const configuredCommand = String(env.CLAUDE_ACP_COMMAND || "").trim();
  const cwd = String(env.MAGISTRAL_CLAUDE_ACP_WORKSPACE || "").trim();
  const tier = String(env.MAGISTRAL_CLAUDE_ACP_TIER || "fallback").trim();
  const pathApi = pathFor(platform);
  if (!configuredCommand)
    throw new Error("CLAUDE_ACP_COMMAND is required for map local-claude-acp");
  if (!cwd || !pathApi.isAbsolute(cwd)) {
    throw new Error(
      "MAGISTRAL_CLAUDE_ACP_WORKSPACE must be an absolute path to an isolated public directory"
    );
  }
  if (!tier) throw new Error("MAGISTRAL_CLAUDE_ACP_TIER must not be empty");

  const launcher = resolveLauncher(configuredCommand, platform);
  return [
    {
      id: "local-claude-acp",
      adapter: "acp_stdio",
      command: launcher.command,
      args: launcher.args,
      cwd,
      model: String(env.MAGISTRAL_CLAUDE_ACP_MODEL || "claude-local").trim() || "claude-local",
      tier,
      blueprint_id: "public-guide",
      weight: 1,
      prompt_timeout_ms: boundedTimeout(env.MAGISTRAL_CLAUDE_ACP_TIMEOUT_MS, 120_000),
      // Same rationale as local-codex-acp: an inherited corporate/system
      // proxy can make the local subprocess's cloud connection stall even
      // though the host itself is online. Opt in explicitly if ever needed.
      env: createAcpEnvironment(env),
    },
  ];
}

function createAcpEnvironment(env) {
  const apiKey = String(env.ANTHROPIC_API_KEY || "").trim();
  const base = apiKey ? { ANTHROPIC_API_KEY: apiKey } : {};
  if (String(env.MAGISTRAL_CLAUDE_ACP_INHERIT_PROXY || "") === "1") return base;
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

function resolveLauncher(command, platform) {
  const pathApi = pathFor(platform);
  if (!pathApi.isAbsolute(command)) throw new Error("CLAUDE_ACP_COMMAND must be an absolute path");
  if (platform !== "win32" || !/\.cmd$/i.test(command)) return { command, args: [] };
  // Same npm .cmd-wrapper caveat as local-codex-acp: avoid leaving a child
  // process outside the pilot's lifecycle on Windows.
  return {
    command: process.execPath,
    args: [
      pathApi.join(
        pathApi.dirname(command),
        "node_modules",
        "@agentclientprotocol",
        "claude-agent-acp",
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

// Named export stays testable without requiring a local Claude Code
// installation or a real auth session.
export default process.env.CLAUDE_ACP_COMMAND ? createLocalClaudeAcpMap() : [];
