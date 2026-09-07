import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "../src/router.js";

test("Magistral Router Strict Cognitive Packet Accounting Integration", async (t) => {
  await t.test(
    "emits X-COP-Packet-ID and X-COP-Provisional-Cost-USD headers on completion",
    async () => {
      const mockMap = [
        {
          id: "mock-openai-fast",
          url: "https://api.openai.com/v1/chat/completions",
          model: "gpt-5.4-nano",
          tier: "fast",
          weight: 10,
        },
      ];

      // Mock fetch returning OpenAI chat completion response
      globalThis.fetch = async (url, opts) => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl-mock123",
            object: "chat.completion",
            created: Date.now(),
            model: "gpt-5.4-nano",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "Hello! Governed packet accounting test." },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const router = createRouter({
        map: mockMap,
        apiKeys: { OPENAI_API_KEY: "sk-mock-key" },
        log: () => {},
      });

      const res = await router.route(
        {
          messages: [{ role: "user", content: "Test prompt for strict accounting trace" }],
        },
        "fast"
      );

      assert.equal(res.status, 200);
      const body = await res.json();

      // Verify COP Packet accounting response fields
      assert.ok(body._cop_packet_id);
      assert.ok(body._cop_packet_id.startsWith("urn:cop:packet:"));
      assert.ok(body._cop_provisional_cost_usd);

      // Verify HTTP Headers
      assert.ok(res.headers.get("X-COP-Packet-ID"));
      assert.ok(res.headers.get("X-COP-Provisional-Cost-USD"));
    }
  );

  await t.test(
    "accounting failure enters explicit recoverable degraded state instead of silent discard (Issue #45 P0)",
    async () => {
      const mockMap = [
        {
          id: "mock-openai-fast",
          url: "https://api.openai.com/v1/chat/completions",
          model: "gpt-5.4-nano",
          tier: "fast",
          weight: 10,
        },
      ];

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl-mock-err",
            object: "chat.completion",
            model: "gpt-5.4-nano",
            choices: [{ message: { role: "assistant", content: "ok" } }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      let capturedError = null;
      let capturedLogEntry = null;

      const router = createRouter({
        map: mockMap,
        apiKeys: { OPENAI_API_KEY: "sk-mock-key" },
        log: () => {},
        onAccountingError: (err, logEntry) => {
          capturedError = err;
          capturedLogEntry = logEntry;
        },
      });

      // Pass an invalid _packet that causes appendPacketSpending to fail
      const res = await router.route(
        {
          messages: [{ role: "user", content: "Test prompt triggering accounting failure" }],
          _packet: { spending: "invalid_not_array" },
        },
        "fast"
      );

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-COP-Accounting-Status"), "failed_degraded");
      assert.ok(res.headers.get("X-COP-Accounting-Error"));

      // Verify callback received the explicit failure
      assert.ok(capturedError);
      assert.ok(capturedLogEntry);
      assert.equal(capturedLogEntry.accountingStatus, "failed_degraded");
      assert.ok(capturedLogEntry.unaccountedEffect);
      assert.equal(capturedLogEntry.unaccountedEffect.model, "gpt-5.4-nano");
      assert.equal(capturedLogEntry.unaccountedEffect.prompt_tokens, 20);
      assert.equal(capturedLogEntry.unaccountedEffect.completion_tokens, 10);
    }
  );
});
