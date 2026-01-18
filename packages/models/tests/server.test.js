import test from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI_SCRIPT = path.join(__dirname, "..", "src", "ai.js");
const TEST_PORT = 8081; // Port différent pour les tests

test("Sovereign AI Integration Test", async (t) => {
  let serverProcess;

  t.after(async () => {
    if (serverProcess) {
      console.log("Stopping test server...");
      serverProcess.kill();
    }
  });

  await t.test("Server should fail to start without model parameter", async () => {
    const proc = spawn("node", [AI_SCRIPT, "start", "--port", TEST_PORT]);

    return new Promise((resolve) => {
      proc.on("exit", (code) => {
        assert.strictEqual(
          code,
          1,
          "Server should exit with error code 1 when model parameter is missing"
        );
        resolve();
      });
    });
  });

  await t.test("Server should find dummy model in /models", async () => {
    // test-dummy.gguf a été créé dans /models
    const proc = spawn("node", [
      AI_SCRIPT,
      "status",
      "--port",
      TEST_PORT,
      "--model",
      "test-dummy.gguf",
    ]);
    let output = "";
    proc.stdout.on("data", (data) => (output += data));
    proc.stderr.on("data", (data) => (output += data));

    return new Promise((resolve) => {
      proc.on("exit", (code) => {
        // Si le modèle est trouvé, la commande status s'exécute normalement (même si OFFLINE)
        // Si le modèle n'était pas trouvé, resolveModel ferait un exit(1) avec un message spécifique
        assert.ok(!output.includes("Model not found"), "Should find the dummy model");
        resolve();
      });
    });
  });

  await t.test("Server help command should display usage", async () => {
    const proc = spawn("node", [AI_SCRIPT, "--help"]);
    let output = "";
    proc.stdout.on("data", (data) => (output += data));

    return new Promise((resolve) => {
      proc.on("exit", (code) => {
        assert.strictEqual(code, 0);
        assert.ok(output.includes("Usage:"), "Help should display usage info");
        assert.ok(output.includes("--model"), "Help should mention --model");
        resolve();
      });
    });
  });

  await t.test('Server status command should report "OFFLINE" when not running', async () => {
    const proc = spawn("node", [AI_SCRIPT, "status", "--port", TEST_PORT]);
    let output = "";
    proc.stdout.on("data", (data) => (output += data));
    proc.stderr.on("data", (data) => (output += data));

    return new Promise((resolve) => {
      proc.on("exit", () => {
        assert.ok(
          output.includes("OFFLINE"),
          `Status should report OFFLINE, got: "${output.trim()}"`
        );
        resolve();
      });
    });
  });

  // Note: On ne peut pas tester l'inférence réelle sans un fichier GGUF présent
  // Mais on peut tester la structure des commandes de contrôle
});
