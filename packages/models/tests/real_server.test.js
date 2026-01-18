import test from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LLM_SCRIPT = path.join(__dirname, "..", "src", "llm.js");
const REAL_PORT = 8083;
const REAL_MODEL = "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf";

test("Actual LLM Server Performance Test", async (t) => {
  let serverProcess;

  t.after(async () => {
    if (serverProcess) {
      console.log("Finalizing: Killing real LLM server...");
      serverProcess.kill();
      // Wait a bit for port to clear
      await new Promise((r) => setTimeout(r, 2000));
    }
  });

  await t.test("Should start real server and respond to queries", { timeout: 60000 }, async () => {
    console.log(`Starting real server with model ${REAL_MODEL} on port ${REAL_PORT}...`);

    serverProcess = spawn(
      "node",
      [
        LLM_SCRIPT,
        "start",
        "--port",
        REAL_PORT,
        "--model",
        REAL_MODEL,
        "--threads",
        "2", // limit threads for test
      ],
      {
        stdio: "pipe",
      }
    );

    // Helper to check if server is up
    const checkStatus = async () => {
      try {
        const res = await fetch(`http://localhost:${REAL_PORT}/v1/models`);
        return res.ok;
      } catch {
        return false;
      }
    };

    // Wait for server to be ready (max 45s)
    let isReady = false;
    for (let i = 0; i < 45; i++) {
      if (await checkStatus()) {
        isReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
      if (i % 5 === 0) console.log(`Waiting for LLM engine... (${i}s)`);
    }

    assert.ok(isReady, "Server failed to start within 45 seconds");
    console.log("Server is ONLINE. Running inference test...");

    // Run actual inference
    const response = await fetch(`http://localhost:${REAL_PORT}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: 'Repeat only the word "READY"' }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    assert.ok(response.ok, "Inference request failed");
    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    console.log(`LLM Response: "${content}"`);
    assert.ok(content.includes("READY"), `Response should contain "READY", got: "${content}"`);
  });
});
