/**
 * Shared-host runtime client.
 *
 * A HostRuntime is an installed technical resource, not a principal or a
 * LogicalAgent.  It becomes material execution only when a governed COP
 * handler invokes it under an active mandate and an execution budget.
 */
import { spawn as nodeSpawn } from "node:child_process";
import { platform } from "node:process";
import { connectAcpStdio, createReadOnlyPermissionPolicy } from "@inseme/magistral/acp";

const MAX_CAPTURE_BYTES = 128_000;
export function createHostRuntimeClient({ runtimes = [], spawnImpl = nodeSpawn } = {}) {
  const catalog = new Map(runtimes.map(normalizeRuntime).map((runtime) => [runtime.id, runtime]));

  return {
    list() {
      return [...catalog.values()].map(publicRuntime);
    },

    resolve({ capability, execution_surface = null } = {}) {
      if (!capability) throw new TypeError("capability is required");
      return [...catalog.values()]
        .filter((runtime) => runtime.enabled && runtime.capabilities.includes(capability))
        .filter((runtime) => !execution_surface || runtime.execution_surface === execution_surface)
        .map(publicRuntime);
    },

    async probe(id) {
      const runtime = requireRuntime(catalog, id);
      const result = await runProcess(spawnImpl, runtime.command, runtime.probe_args, {
        timeout_ms: runtime.probe_timeout_ms,
      });
      return {
        runtime: publicRuntime(runtime),
        available: result.exit_code === 0 && !result.timed_out,
        version: compactText(result.stdout),
        error:
          result.exit_code === 0 && !result.timed_out
            ? null
            : compactText(result.stderr || result.stdout),
      };
    },

    /** Return the existing COP handler shape; authority remains outside this client. */
    asHandler(id, defaults = {}) {
      const runtime = requireRuntime(catalog, id);
      return {
        id: runtime.handler_instance_ref,
        capability: defaults.capability || runtime.capabilities[0],
        invoke: (input) =>
          this.invoke({
            runtime_id: id,
            prompt: String(input?.message || ""),
            working_directory: defaults.working_directory,
          }),
      };
    },

    async invoke({ runtime_id, prompt, working_directory } = {}) {
      const runtime = requireRuntime(catalog, runtime_id);
      if (!runtime.enabled) throw new Error(`runtime_disabled:${runtime_id}`);
      if (!prompt) throw new TypeError("prompt is required");
      if (!working_directory) throw new TypeError("working_directory is required");
      if (runtime.adapter === "acp_stdio") {
        const result = await runAcpSession(spawnImpl, runtime, { prompt, working_directory });
        return {
          text: result.text,
          handler_profile_ref: runtime.handler_profile_ref,
          handler_instance_ref: runtime.handler_instance_ref,
          execution_surface: "acp",
          context_inheritance: runtime.context_inheritance,
          runtime_id: runtime.id,
          execution_usage: { max_steps: 1, max_elapsed_ms: result.elapsed_ms },
          permission_trace: result.permission_trace,
        };
      }
      if (runtime.adapter === "opencode_run_json") {
        const result = await runProcess(
          spawnImpl,
          runtime.command,
          [
            "run",
            "--pure",
            "--dir",
            working_directory,
            "--model",
            runtime.model,
            "--agent",
            runtime.agent,
            "--format",
            "json",
            prompt,
          ],
          { timeout_ms: runtime.invoke_timeout_ms, cwd: working_directory, env: runtime.env }
        );
        const status = result.timed_out
          ? "timed_out"
          : result.exit_code === 0
            ? "completed"
            : "failed";
        return {
          text: openCodeText(result.stdout),
          status,
          terminal: true,
          exit_code: result.exit_code,
          error: status === "completed" ? null : compactText(result.stderr || result.stdout),
          handler_profile_ref: runtime.handler_profile_ref,
          handler_instance_ref: runtime.handler_instance_ref,
          execution_surface: runtime.execution_surface,
          context_inheritance: runtime.context_inheritance,
          runtime_id: runtime.id,
          execution_usage: { max_steps: 1, max_elapsed_ms: result.elapsed_ms },
        };
      }
      if (runtime.adapter !== "codex_exec_jsonl") {
        throw new Error(`unsupported_runtime_adapter:${runtime.adapter}`);
      }

      const result = await runProcess(
        spawnImpl,
        runtime.command,
        [
          "exec",
          "--ephemeral",
          "--json",
          "--sandbox",
          runtime.sandbox,
          "--cd",
          working_directory,
          prompt,
        ],
        { timeout_ms: runtime.invoke_timeout_ms }
      );
      if (result.exit_code !== 0 || result.timed_out) {
        throw new Error(
          `runtime_invocation_failed:${runtime_id}:${compactText(result.stderr || result.stdout)}`
        );
      }
      return {
        text: compactText(result.stdout),
        handler_profile_ref: runtime.handler_profile_ref,
        handler_instance_ref: runtime.handler_instance_ref,
        execution_surface: runtime.execution_surface,
        context_inheritance: runtime.context_inheritance,
        runtime_id: runtime.id,
        execution_usage: { max_steps: 1, max_elapsed_ms: result.elapsed_ms },
      };
    },
  };
}

/**
 * Generic ACP-over-stdio runtime. ACP describes technical execution only;
 * it never supplies COP identity, mandate, or budget authority.
 */
export function acpStdioRuntime({
  id,
  command,
  args = [],
  handler_instance_ref,
  handler_profile_ref = "handler-profile:coding-agent-acp",
  capabilities = ["coding.assist.read"],
  host_ref = "host:local",
  probe_args = ["--version"],
  env = {},
  mcp_servers = [],
  allow_mcp_server,
  permission_policy = "read-only",
  context_inheritance = "none",
  invoke_timeout_ms = 240_000,
} = {}) {
  if (!id || !command || !handler_instance_ref) {
    throw new TypeError("id, command and handler_instance_ref are required");
  }
  return {
    id,
    command,
    args,
    env,
    handler_instance_ref,
    handler_profile_ref,
    host_ref,
    execution_surface: "acp",
    adapter: "acp_stdio",
    capabilities,
    probe_args,
    mcp_servers,
    allow_mcp_server,
    permission_policy,
    context_inheritance,
    invoke_timeout_ms,
    enabled: true,
  };
}

/**
 * The host-local Codex ACP descriptor. Its account-bound working context is
 * useful but declared as situated; COP artifacts remain the durable fallback.
 */
export function codexAcpRuntime({
  command = platform === "win32" ? "codex-acp.cmd" : "codex-acp",
  id = "runtime:local:codex-acp",
  host_ref = "host:local",
  handler_instance_ref = "handler:local:codex-acp",
  capabilities = ["coding.assist.read"],
  env = {},
  mcp_servers = [],
  allow_mcp_server,
} = {}) {
  return acpStdioRuntime({
    id,
    command,
    // Codex ACP may be authenticated to a powerful personal account. This
    // integration starts from the least-privileged available mode; callers
    // needing broader effects must introduce a separate, governed profile.
    env: { INITIAL_AGENT_MODE: "read-only", ...env },
    handler_instance_ref,
    handler_profile_ref: "handler-profile:coding-agent-acp-codex",
    capabilities,
    context_inheritance: "ambient-host",
    probe_args: ["--version"],
    host_ref,
    mcp_servers,
    allow_mcp_server,
    permission_policy: "read-only",
  });
}

export function fractaCodexRuntime({
  command,
  handler_instance_ref = "handler:fracta:codex@v0.144.5",
} = {}) {
  if (!command) throw new TypeError("command is required");
  return {
    id: "runtime:fracta:codex",
    handler_instance_ref,
    handler_profile_ref: "handler-profile:coding-agent-cli",
    execution_surface: "cli",
    adapter: "codex_exec_jsonl",
    context_inheritance: "ambient-host",
    command,
    capabilities: ["coding.assist.read"],
    sandbox: "read-only",
    probe_args: ["--version"],
    probe_timeout_ms: 5_000,
    invoke_timeout_ms: 240_000,
    enabled: true,
  };
}

export function openCodeMagistralRuntime({
  command = "opencode",
  id = "runtime:local:opencode-magistral",
  host_ref = "host:local",
  handler_instance_ref = "handler:local:opencode-magistral",
  model = "magistral/fallback",
  agent = "magistral-once",
  env = {},
  invoke_timeout_ms = 45_000,
} = {}) {
  return {
    id,
    command,
    env,
    handler_instance_ref,
    handler_profile_ref: "handler-profile:coding-agent-cli-opencode",
    host_ref,
    execution_surface: "cli",
    adapter: "opencode_run_json",
    context_inheritance: "cop-artifact",
    model,
    agent,
    capabilities: ["coding.assist.read"],
    probe_args: ["--version"],
    probe_timeout_ms: 5_000,
    invoke_timeout_ms,
    enabled: true,
  };
}

function normalizeRuntime(value) {
  if (!value?.id || !value?.command || !value?.handler_instance_ref)
    throw new TypeError("runtime id, command and handler_instance_ref are required");
  return {
    ...value,
    capabilities: [...new Set(value.capabilities || [])],
    args: value.args || [],
    env: value.env || {},
    mcp_servers: value.mcp_servers || [],
    permission_policy: value.permission_policy || "deny",
    context_inheritance: normalizeContextInheritance(value.context_inheritance),
    execution_surface: value.execution_surface || "cli",
    sandbox: value.sandbox || "read-only",
    probe_args: value.probe_args || ["--version"],
    probe_timeout_ms: value.probe_timeout_ms || 5_000,
    invoke_timeout_ms: value.invoke_timeout_ms || 240_000,
    enabled: value.enabled !== false,
  };
}

function publicRuntime(runtime) {
  const safe = { ...runtime };
  delete safe.command;
  delete safe.env;
  return safe;
}

function requireRuntime(catalog, id) {
  const runtime = catalog.get(id);
  if (!runtime) throw new Error(`unknown_runtime:${id}`);
  return runtime;
}

function normalizeContextInheritance(value) {
  const normalized = value || "none";
  if (!new Set(["none", "ambient-host", "cop-artifact"]).has(normalized)) {
    throw new TypeError("context_inheritance must be none, ambient-host, or cop-artifact");
  }
  return normalized;
}

function compactText(value) {
  return String(value || "")
    .slice(0, MAX_CAPTURE_BYTES)
    .trim();
}

function runProcess(spawnImpl, command, args, { timeout_ms, cwd, env = {} }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawnImpl(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...(cwd ? { cwd } : {}),
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    let timed_out = false;
    let killTimer;
    const capture = (target, chunk) => `${target}${chunk}`.slice(0, MAX_CAPTURE_BYTES);
    child.stdout?.on("data", (chunk) => {
      stdout = capture(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = capture(stderr, chunk);
    });
    const timer = setTimeout(() => {
      timed_out = true;
      killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
      child.kill("SIGTERM");
    }, timeout_ms);
    child.once("error", (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({
        exit_code: Number.isInteger(code) ? code : 1,
        signal: signal || null,
        timed_out,
        stdout,
        stderr,
        elapsed_ms: Date.now() - started,
      });
    });
  });
}

function runAcpSession(spawnImpl, runtime, { prompt, working_directory }) {
  return (async () => {
    const started = Date.now();
    let text = "";
    const permission_trace = [];
    const requestPermission =
      runtime.permission_policy === "read-only"
        ? createReadOnlyPermissionPolicy({
            root: working_directory,
            onDecision: (entry) => permission_trace.push(entry),
          })
        : () => ({ outcome: "cancelled" });
    const client = await connectAcpStdio({
      command: runtime.command,
      args: runtime.args,
      cwd: working_directory,
      env: runtime.env,
      spawnImpl,
      clientInfo: { name: "cop-host-runtime", version: "0.1" },
      promptTimeoutMs: runtime.invoke_timeout_ms,
      requestPermission,
      onSessionUpdate: (params) => {
        text = appendCapture(text, acpText(params?.update));
      },
    });
    try {
      const session = await client.newSession({
        cwd: working_directory,
        mcpServers: runtime.mcp_servers,
        allowMcpServer: runtime.allow_mcp_server,
      });
      const result = await client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: prompt }],
      });
      text = appendCapture(text, acpText(result));
      return { text: compactText(text), elapsed_ms: Date.now() - started, permission_trace };
    } finally {
      client.terminate();
    }
  })();
}

function appendCapture(target, value) {
  return `${target}${String(value || "")}`.slice(0, MAX_CAPTURE_BYTES);
}

function openCodeText(stdout) {
  return compactText(
    String(stdout || "")
      .split("\n")
      .map((line) => {
        if (!line.trim()) return "";
        try {
          const value = JSON.parse(line);
          return acpText(value.part ?? value);
        } catch {
          return line;
        }
      })
      .join("")
  );
}

function acpText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(acpText).join("");
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  if (value.content !== undefined) return acpText(value.content);
  if (value.update) return acpText(value.update);
  if (value.message) return acpText(value.message);
  return "";
}
