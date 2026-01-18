import test from "node:test";
import assert from "node:assert";
import { SOVEREIGN_MODELS, REMOTE_MODELS, getModelByTag } from "../registry.js";

test("Registry Integrity Test", async (t) => {
  await t.test("SOVEREIGN_MODELS should contain essential models", () => {
    assert.ok(SOVEREIGN_MODELS["qwen-2.5-coder-1.5b"], "Qwen 2.5 Coder should be present");
    assert.ok(SOVEREIGN_MODELS["llama-3.2-3b"], "Llama 3.2 3B should be present");
  });

  await t.test("Models should have required properties", () => {
    for (const [id, model] of Object.entries(SOVEREIGN_MODELS)) {
      assert.ok(model.name, `Model ${id} should have a name`);
      assert.ok(model.filename, `Model ${id} should have a filename`);
      assert.ok(model.url, `Model ${id} should have a url`);
      assert.ok(model.context_window, `Model ${id} should have a context_window`);
    }
  });

  await t.test("getModelByTag should filter models correctly", () => {
    const coders = getModelByTag("coder");
    assert.ok(coders.length > 0, "Should find at least one coder model");
    assert.ok(
      coders.every((m) => m.tags.includes("coder")),
      "All returned models should have the tag"
    );
  });

  await t.test("REMOTE_MODELS should have fast and advanced tiers", () => {
    assert.ok(REMOTE_MODELS.fast, "Fast tier should exist");
    assert.ok(REMOTE_MODELS.advanced, "Advanced tier should exist");
    assert.ok(REMOTE_MODELS.fast.openai, "OpenAI fast model should exist");
  });
});
