import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const pilot = resolve(packageRoot, "pilots", "reference-js", "src", "main.js");
const fakeAcp = resolve(here, "fixtures", "fake-acp-agent.js");

test("Deno Magistral pilot routes an authenticated OpenAI request to an ACP stdio node", async () => {
  const port = await freePort();
  const token = "test-magistral-token";
  const child = spawn("deno", ["run", "-A", "--no-lock", pilot], {
    cwd: packageRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stdin.end(
    JSON.stringify({
      runtime: { host: "127.0.0.1", port },
      input: {
        map: [
          {
            id: "fake-acp",
            adapter: "acp_stdio",
            command: process.execPath,
            args: [fakeAcp],
            cwd: packageRoot,
            model: "fake-acp-model",
            tier: "fast",
            blueprint_id: "coding",
            weight: 1,
          },
        ],
      },
      secrets: { MAGISTRAL_API_KEY: token },
    })
  );

  try {
    await waitFor(
      () => output.includes("MAGISTRAL_READY:"),
      10_000,
      () => output
    );
    const serviceInfo = await fetch(`http://127.0.0.1:${port}/service-info`);
    assert.equal(serviceInfo.status, 200);
    assert.equal(serviceInfo.headers.get("server"), "Magistral");
    assert.equal(
      serviceInfo.headers.get("link"),
      '</service-info>; rel="describedby"; type="application/json"'
    );
    const serviceInfoBody = await serviceInfo.json();
    assert.equal(serviceInfoBody.protocol, "cogentia.service-identity/v1");
    assert.equal(serviceInfoBody.service.id, "magistral");
    assert.equal(serviceInfoBody.capabilities[0].adapter, "acp_stdio");
    const serviceInfoHead = await fetch(`http://127.0.0.1:${port}/service-info`, {
      method: "HEAD",
    });
    assert.equal(serviceInfoHead.status, 200);
    assert.equal(serviceInfoHead.headers.get("server"), "Magistral");
    assert.equal(await serviceInfoHead.text(), "");
    const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hello" }] }),
    });
    assert.equal(unauthorized.status, 401);
    const unauthorizedEmbedding = await fetch(`http://127.0.0.1:${port}/v1/embeddings`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"text-embedding-3-small",input:"test-no-credential"}),
    });
    assert.equal(unauthorizedEmbedding.status,401);
    assert.equal((await unauthorizedEmbedding.json()).error.code,"magistral_unauthorized");
    const authorizedEmbedding = await fetch(`http://127.0.0.1:${port}/v1/embeddings`,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({model:"text-embedding-3-small",input:"test-only"}),
    });
    assert.notEqual(authorizedEmbedding.status,401); // service may be disabled, never provider call without config

    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hello" }] }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.model, "fake-acp-model");
    assert.equal(body.choices?.[0]?.message?.content, "fake ACP answer");

    const streamed = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "fast",
        stream: true,
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    assert.equal(streamed.status, 200);
    assert.match(streamed.headers.get("content-type") || "", /text\/event-stream/);
    const events = await readSse(streamed);
    assert.ok(
      events.some(
        (event) => event.name === "magistral_trace" && event.data.step === "acp.session_update"
      )
    );
    assert.ok(
      events.some(
        (event) =>
          event.name === "magistral_trace" &&
          event.data.step === "acp.reasoning" &&
          event.data.visibility === "withheld"
      )
    );
    assert.equal(
      events.some((event) =>
        String(event.data?.choices?.[0]?.delta?.content || "").includes("private fake thought")
      ),
      false
    );
    assert.equal(
      events.some((event) =>
        String(event.data?.title || "").includes("private fake system prompt")
      ),
      false
    );
    assert.ok(
      events.some((event) => event.data?.choices?.[0]?.delta?.content === "fake ACP answer")
    );
    assert.ok(events.some((event) => event.done));
  } finally {
    child.kill("SIGTERM");
  }
});

test(
  "Deno Magistral pilot streams an actual local Codex ACP response when explicitly enabled",
  {
    skip:
      process.env.RUN_CODEX_ACP_MAGISTRAL_INTEGRATION === "1"
        ? false
        : "set RUN_CODEX_ACP_MAGISTRAL_INTEGRATION=1 to use the locally authenticated Codex ACP installation",
  },
  async () => {
    const configuredCommand = process.env.CODEX_ACP_COMMAND;
    assert.ok(configuredCommand, "CODEX_ACP_COMMAND must be an absolute codex-acp launcher path");
    const launcher = resolveWindowsCodexAcpShim(configuredCommand);
    const cwd = await mkdtemp(join(tmpdir(), "magistral-public-acp-"));
    const port = await freePort();
    const token = "local-thinkpad-acp-test";
    const child = spawn("deno", ["run", "-A", "--no-lock", pilot], {
      cwd: packageRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stdin.end(
      JSON.stringify({
        runtime: { host: "127.0.0.1", port },
        input: {
          map: [
            {
              id: "local-thinkpad-codex-acp",
              adapter: "acp_stdio",
              command: launcher.command,
              args: launcher.args,
              cwd,
              model: "codex-local",
              tier: "coding",
              blueprint_id: "public-guide",
              weight: 1,
              prompt_timeout_ms: 120_000,
            },
          ],
        },
        secrets: { MAGISTRAL_API_KEY: token },
      })
    );

    try {
      await waitFor(
        () => output.includes("MAGISTRAL_READY:"),
        10_000,
        () => output
      );
      const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: "coding",
          stream: true,
          messages: [
            {
              role: "user",
              content:
                "Reply with exactly ACP_CODEX_LOCAL_OK. Do not read files, run tools, or make changes.",
            },
          ],
        }),
      });
      assert.equal(response.status, 200, output);
      assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
      const events = await readSse(response);
      const content = events
        .map((event) => event.data?.choices?.[0]?.delta?.content || "")
        .join("");
      assert.equal(content, "ACP_CODEX_LOCAL_OK");
      assert.ok(
        events.some((event) => event.name === "magistral_trace"),
        "the stream must include public ACP operational trace events"
      );
      assert.ok(
        events.some((event) => event.done),
        "the OpenAI-compatible stream must terminate with [DONE]"
      );
    } finally {
      child.kill("SIGTERM");
      await rm(cwd, { recursive: true, force: true });
    }
  }
);

function resolveWindowsCodexAcpShim(command) {
  if (!/\.cmd$/i.test(command)) return { command, args: [] };
  // An npm .cmd launcher forks Node through cmd.exe.  Use the equivalent
  // package entrypoint so Deno owns the ACP process it must later stop.
  return {
    command: process.execPath,
    args: [
      join(
        dirname(command),
        "node_modules",
        "@agentclientprotocol",
        "codex-acp",
        "dist",
        "index.js"
      ),
    ],
  };
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function readSse(response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const name = block.match(/^event: (.+)$/m)?.[1] || "message";
      const raw = block.match(/^data: (.+)$/m)?.[1] || "";
      return raw === "[DONE]" ? { name, done: true } : { name, data: JSON.parse(raw) };
    });
}

async function waitFor(predicate, timeoutMs, describe) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`pilot_start_timeout:${describe()}`);
}
