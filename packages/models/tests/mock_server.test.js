import test from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LLM_SCRIPT = path.join(__dirname, "..", "src", "llm.js");
const MOCK_PORT = 8082;

test("Mock Server Queries Test", async (t) => {
  let mockServer;

  // Setup a mock OpenAI-compatible server
  t.before(() => {
    return new Promise((resolve) => {
      mockServer = http.createServer((req, res) => {
        if (req.url === "/v1/models") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ object: "list", data: [{ id: "mock-model" }] }));
        } else if (req.url === "/v1/chat/completions" && req.method === "POST") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              choices: [{ message: { content: "System Active" } }],
            })
          );
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      mockServer.listen(MOCK_PORT, resolve);
    });
  });

  t.after(() => {
    if (mockServer) mockServer.close();
  });

  await t.test("llm.js status should report ONLINE when mock server is up", async () => {
    const proc = spawn("node", [
      LLM_SCRIPT,
      "status",
      "--port",
      MOCK_PORT,
      "--model",
      "test-dummy.gguf",
    ]);
    let output = "";
    proc.stdout.on("data", (data) => (output += data));

    return new Promise((resolve) => {
      proc.on("exit", (code) => {
        assert.strictEqual(code, 0);
        assert.ok(output.includes("ONLINE"), `Should be ONLINE, got: ${output}`);
        resolve();
      });
    });
  });

  await t.test("llm.js test command should successfully query mock server", async () => {
    const proc = spawn("node", [
      LLM_SCRIPT,
      "test",
      "--port",
      MOCK_PORT,
      "--model",
      "test-dummy.gguf",
    ]);
    let output = "";
    proc.stdout.on("data", (data) => (output += data));

    return new Promise((resolve) => {
      proc.on("exit", (code) => {
        assert.strictEqual(code, 0);
        assert.ok(output.includes("System Active"), `Should receive mock response, got: ${output}`);
        resolve();
      });
    });
  });
});
