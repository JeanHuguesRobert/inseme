/** Minimal ACP v1 stdio executor for the Deno Magistral pilot. */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const providerQueue = createAcpProviderQueue();

export async function invokeAcpStdio({ node, payload }) {
  if (payload.stream) return invokeAcpStdioStream({ node, payload });
  const slot = await acquireProviderSlot(node);
  try {
    const { body } = await executeAcpStdio({ node, payload });
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    slot.release();
  }
}

function invokeAcpStdioStream({ node, payload }) {
  const stream = new ReadableStream({
    async start(controller) {
      const id = `acp-${Date.now().toString(36)}`;
      const emit = (event, data) =>
        controller.enqueue(
          encoder.encode(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`)
        );
      let streamed = "";
      const slot = await acquireProviderSlot(node, {
        onEnqueued: ({ queue_position }) => {
          emit("magistral_trace", {
            protocol: "magistral.public-trace/v1",
            step: "acp.queue",
            queue_position,
            waited_ms: 0,
            state: "waiting",
          });
        },
      });
      if (slot.queue_position > 0) {
        emit("magistral_trace", {
          protocol: "magistral.public-trace/v1",
          step: "acp.queue_acquired",
          queue_position: slot.queue_position,
          waited_ms: slot.waited_ms,
          state: "acquired",
        });
      }
      executeAcpStdio({
        node,
        payload,
        onSessionUpdate: (params) => {
          const update = params?.update || {};
          // ACP agents can emit private thinking beside user-visible message
          // chunks.  The public Guide may show that progress exists, but never
          // its content nor a derived fragment.
          const fragment = isReasoningUpdate(update) ? "" : extractText(update);
          if (fragment) {
            streamed += fragment;
            emit(null, openAiChunk({ id, model: node.model, content: fragment }));
          }
          emit("magistral_trace", publicAcpTrace(params));
        },
      })
        .then(({ body }) => {
          const complete = String(body.choices?.[0]?.message?.content || "");
          if (complete.startsWith(streamed) && complete.length > streamed.length) {
            emit(
              null,
              openAiChunk({
                id,
                model: node.model,
                content: complete.slice(streamed.length),
              })
            );
          }
          emit(
            null,
            openAiChunk({
              id,
              model: node.model,
              finishReason: body.choices?.[0]?.finish_reason || "stop",
            })
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        })
        .catch((error) => {
          emit("magistral_trace", {
            protocol: "magistral.public-trace/v1",
            step: "acp.failed",
            error: String(error?.message || error).slice(0, 240),
          });
          controller.error(error);
        })
        .finally(() => {
          slot.release();
        });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * ACP coding agents are installed, stateful capabilities.  A provider-level
 * FIFO queue protects one such installation from competing Guide/HTTP clients;
 * callers never need to coordinate among themselves.
 */
async function acquireProviderSlot(node, options) {
  return providerQueue.acquire(node, options);
}

export function createAcpProviderQueue() {
  const providerQueues = new Map();
  return { acquire };

  async function acquire(node, { onEnqueued = () => {} } = {}) {
    const key = String(node.id || `${node.command || "acp"}:${node.cwd || ""}`);
    let queue = providerQueues.get(key);
    if (!queue) {
      queue = { tail: Promise.resolve(), depth: 0 };
      providerQueues.set(key, queue);
    }
    const queuePosition = queue.depth;
    queue.depth += 1;
    if (queuePosition > 0) onEnqueued({ queue_position: queuePosition });
    const startedAt = Date.now();
    const previous = queue.tail;
    let releaseGate;
    const done = new Promise((resolve) => {
      releaseGate = resolve;
    });
    queue.tail = previous.then(() => done);
    await previous;
    let released = false;
    return {
      queue_position: queuePosition,
      waited_ms: Date.now() - startedAt,
      release() {
        if (released) return;
        released = true;
        queue.depth -= 1;
        releaseGate();
      },
    };
  }
}

async function executeAcpStdio({ node, payload, onSessionUpdate = () => {} }) {
  if (!node.command || !node.cwd) {
    throw new Error("acp_stdio_command_and_cwd_required");
  }
  if (!isAbsolutePath(node.command) || !isAbsolutePath(node.cwd)) {
    throw new Error("acp_stdio_requires_absolute_command_and_isolated_cwd");
  }
  const child = new globalThis.Deno.Command(node.command, {
    args: node.args || [],
    cwd: node.cwd,
    // A locally installed coding agent is often authenticated through its
    // normal user environment.  Add the policy marker; do not erase that
    // environment while doing so.
    env: {
      ...globalThis.Deno.env.toObject(),
      ...(node.env || {}),
      INITIAL_AGENT_MODE: "read-only",
    },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let nextId = 0;
  let buffer = "";
  let text = "";
  const pending = new Map();
  const writer = child.stdin.getWriter();
  const requestTimeoutMs = boundedTimeout(node.request_timeout_ms, 30_000);
  const promptTimeoutMs = boundedTimeout(node.prompt_timeout_ms, 120_000);
  const request = (method, params, timeoutMs = requestTimeoutMs) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`acp_request_timeout:${method}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      writer
        .write(encoder.encode(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`))
        .catch((error) => {
          const entry = pending.get(id);
          pending.delete(id);
          entry?.reject(error);
        });
    });
  const reader = child.stdout.getReader();
  const consume = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        if (message.method === "session/update") {
          const update = message.params?.update;
          if (!isReasoningUpdate(update)) text += extractText(update);
          onSessionUpdate(message.params);
        } else if (message.method === "session/request_permission") {
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: readOnlyPermission(message.params, node.cwd),
              })}\n`
            )
          );
        } else if (message.id !== undefined && pending.has(message.id)) {
          const entry = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) {
            // inseme#105 / inseme#109: the useful diagnostic (quota
            // messages, retry timing, provider-specific error codes) lives
            // in error.data, not error.message -- a generic "Internal
            // error" collapsed here cost an entire investigation session
            // to decode manually. Attach the full object so callers
            // (router.js) can classify and log it properly.
            const err = new Error(message.error.message || "acp_request_failed");
            err.acpError = message.error;
            entry.reject(err);
          } else {
            entry.resolve(message.result);
          }
        }
      }
    }
  })();
  try {
    const init = await request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "magistral", version: "1.0.0" },
    });
    if (init?.protocolVersion !== 1) {
      throw new Error("acp_protocol_version_mismatch");
    }
    const session = await request("session/new", {
      cwd: node.cwd,
      mcpServers: [],
    });
    const prompt =
      payload.messages
        ?.map((message) => `[${message.role || "user"}] ${String(message.content || "")}`)
        .join("\n\n") || "";
    const result = await request(
      "session/prompt",
      {
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: prompt }],
      },
      promptTimeoutMs
    );
    if (init.agentCapabilities?.sessionCapabilities?.close) {
      await request("session/close", { sessionId: session.sessionId });
    }
    const body = {
      id: `acp-${Date.now().toString(36)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: node.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text.trim() },
          finish_reason: result?.stopReason || "stop",
        },
      ],
    };
    return { body };
  } finally {
    for (const entry of pending.values()) {
      entry.reject(new Error("acp_connection_closed"));
    }
    writer.releaseLock();
    child.kill("SIGTERM");
    // npm's Windows .cmd shims may leave their child Node process alive after
    // their wrapper exits.  Never let cleanup make the public HTTP request
    // hang forever; direct Node entrypoints remain the recommended config.
    await Promise.race([consume.catch(() => {}), delay(1_000)]);
  }
}

function openAiChunk({ id, model, content, finishReason = null }) {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: content ? { content } : {},
        finish_reason: finishReason,
      },
    ],
  };
}

function publicAcpTrace(params = {}) {
  const update = params.update || {};
  const kind = String(update.sessionUpdate || update.kind || "update");
  if (isReasoningUpdate(update)) {
    return {
      protocol: "magistral.public-trace/v1",
      step: "acp.reasoning",
      visibility: "withheld",
      reason: "internal_model_reasoning_not_exported",
    };
  }
  return {
    protocol: "magistral.public-trace/v1",
    step: "acp.session_update",
    kind,
    tool_call_id: update.toolCallId || null,
    status: update.status || null,
    // A session-info title can contain the assembled system prompt and public
    // context. Titles are useful only for a concrete operational tool call.
    title:
      update.toolCallId || update.toolCall ? update.title || update.toolCall?.title || null : null,
  };
}

function isReasoningUpdate(update = {}) {
  const kind = String(update.sessionUpdate || update.kind || "");
  return /(?:reasoning|thought)/i.test(kind);
}

function extractText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(extractText).join("");
  if (typeof value.text === "string") return value.text;
  if (value.content !== undefined) return extractText(value.content);
  return "";
}

function isAbsolutePath(value) {
  return typeof value === "string" && (/^\//.test(value) || /^[A-Za-z]:[\\/]/.test(value));
}

function readOnlyPermission(params = {}, root) {
  const call = params.toolCall || {};
  const input = call.rawInput || {};
  const option = (params.options || []).find(
    (item) => item?.kind === "allow_once" && item.optionId
  );
  if (
    call.kind !== "execute" ||
    !option ||
    !isInsideRoot(input.cwd, root) ||
    !isReadCommand(input.command)
  ) {
    return { outcome: "cancelled" };
  }
  return { outcome: "selected", optionId: option.optionId };
}

function isInsideRoot(candidate, root) {
  if (!isAbsolutePath(candidate) || !isAbsolutePath(root)) return false;
  const normalizedCandidate = candidate.replace(/\\/g, "/").toLowerCase();
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  return (
    normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
}

function isReadCommand(command) {
  if (typeof command !== "string" || /[|&;><`]|\$\(|\r|\n/.test(command)) {
    return false;
  }
  const tokens = command.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const executable = tokens[0]?.replace(/^['"]|['"]$/g, "").toLowerCase();
  const subcommand = tokens[1]?.toLowerCase();
  if (
    ["rg", "ls", "dir", "pwd", "type", "head", "tail", "get-childitem", "get-content"].includes(
      executable
    )
  ) {
    return executable !== "rg" || !tokens.some((token) => /^--pre(?:=|$)/.test(token));
  }
  return (
    executable === "git" &&
    ["status", "diff", "log", "show", "branch", "ls-files", "grep"].includes(subcommand) &&
    !tokens.some((token) => /^(--ext-diff|--textconv)$/.test(token))
  );
}

function boundedTimeout(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(5_000, Math.min(240_000, numeric)) : fallback;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
