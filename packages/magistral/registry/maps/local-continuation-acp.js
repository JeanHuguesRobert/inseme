import path from "node:path";
import process from "node:process";

/**
 * Host-local ACP map for the continuation-backed "Super ACP" fallback node
 * (inseme#107, part of the umbrella inseme#112).
 *
 * Unlike every other local ACP map, this node is not backed by any vendor
 * LLM SDK at all -- it resolves session/prompt by emitting a
 * cogentia.continuation.v2 object and waiting for any capable agent
 * (human or AI, any vendor) to resolve it via `cogentia continuation
 * resolve`. It exists specifically for the case where every vendor-backed
 * node (Codex, Claude, OpenCode) is simultaneously unavailable -- see
 * operium#45 / inseme#105 / inseme#106 for the incident chain that
 * motivated it.
 *
 * Default tier is "fallback", and it should be given the lowest weight of
 * any fallback node so vendor-backed providers are always preferred when
 * they work (per jhrobert's explicit instruction: "privilegier l'ACP
 * officiel quand il fonctionne").
 *
 * NOT wired into any live systemd unit as of inseme#107 -- manual/local
 * verification only until the umbrella's later sub-issues (streaming,
 * error transparency, capability surface, resolver routing) have landed
 * and a separate live-wiring decision has been made.
 *
 * Verified constraint worth flagging for that later decision:
 * pilots/reference-js/src/acp-executor.js's own boundedTimeout() clamps
 * prompt_timeout_ms to a hard 240_000ms ceiling regardless of what this
 * map requests (900_000ms default below). Through Magistral as it stands
 * today, this node would frequently time out before a human/agent
 * resolver notices and answers. Resolving that gap is exactly what
 * inseme#108 (SSE/session-update progress) is for -- a synchronous
 * 240s wait is not the intended live shape.
 */
export function createLocalContinuationAcpMap(env = process.env, platform = process.platform) {
  const configuredCommand = String(env.CONTINUATION_ACP_COMMAND || "").trim();
  const cwd = String(env.MAGISTRAL_CONTINUATION_ACP_WORKSPACE || "").trim();
  const tier = String(env.MAGISTRAL_CONTINUATION_ACP_TIER || "fallback").trim();
  const pathApi = pathFor(platform);
  if (!configuredCommand)
    throw new Error("CONTINUATION_ACP_COMMAND is required for map local-continuation-acp");
  if (!pathApi.isAbsolute(configuredCommand))
    throw new Error("CONTINUATION_ACP_COMMAND must be an absolute path");
  if (!cwd || !pathApi.isAbsolute(cwd)) {
    throw new Error(
      "MAGISTRAL_CONTINUATION_ACP_WORKSPACE must be an absolute path to an isolated public directory"
    );
  }
  if (!tier) throw new Error("MAGISTRAL_CONTINUATION_ACP_TIER must not be empty");

  return [
    {
      id: "local-continuation-acp",
      adapter: "acp_stdio",
      command: configuredCommand,
      args: [],
      cwd,
      model: "continuation-any-resolver",
      tier,
      blueprint_id: "public-guide",
      // Always the last resort: lowest weight among fallback nodes so
      // vendor-backed providers are tried first whenever they work.
      weight: 0,
      prompt_timeout_ms: boundedTimeout(env.MAGISTRAL_CONTINUATION_ACP_TIMEOUT_MS, 900_000),
      env: createAcpEnvironment(env),
    },
  ];
}

function createAcpEnvironment(env) {
  const passthrough = {};
  if (env.CONTINUATION_ACP_POLL_MS)
    passthrough.CONTINUATION_ACP_POLL_MS = env.CONTINUATION_ACP_POLL_MS;
  if (env.CONTINUATION_ACP_TIMEOUT_MS)
    passthrough.CONTINUATION_ACP_TIMEOUT_MS = env.CONTINUATION_ACP_TIMEOUT_MS;
  if (env.CONTINUATION_ACP_KIND) passthrough.CONTINUATION_ACP_KIND = env.CONTINUATION_ACP_KIND;
  if (String(env.MAGISTRAL_CONTINUATION_ACP_INHERIT_PROXY || "") === "1") return passthrough;
  return {
    ...passthrough,
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
  return Number.isFinite(numeric) ? Math.max(5_000, Math.min(24 * 60 * 60_000, numeric)) : fallback;
}

// Named export stays testable without requiring a local cogentia checkout.
export default process.env.CONTINUATION_ACP_COMMAND ? createLocalContinuationAcpMap() : [];
