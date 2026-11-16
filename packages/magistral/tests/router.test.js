import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  buildRoutingSequence,
  createMetricsSnapshot,
  createRouter,
  NodeRegistry,
} from "../src/router.js";

async function withMockServer(handler, run) {
  const server = http.createServer(handler);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("routes to the next node when a provider is exhausted", async () => {
  await withMockServer(
    (req, res) => {
      if (req.url === "/rate-limited") {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "rate limited" }));
        return;
      }

      if (req.url === "/ok") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const parsed = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              choices: [{ message: { content: `served by ${parsed.model}` } }],
              usage: { prompt_tokens: 2, completion_tokens: 3 },
            })
          );
        });
        return;
      }

      res.writeHead(404);
      res.end();
    },
    async (baseUrl) => {
      const map = [
        {
          id: "primary",
          url: `${baseUrl}/rate-limited`,
          model: "primary-model",
          tier: "fast",
          weight: 10,
        },
        {
          id: "secondary",
          url: `${baseUrl}/ok`,
          model: "secondary-model",
          tier: "fast",
          weight: 1,
        },
      ];

      const router = createRouter({ map, log: () => {} });
      const response = await router.route({
        model: "fast",
        messages: [{ role: "user", content: "hello" }],
        stream: false,
      });

      const data = await response.json();
      assert.equal(data.choices[0].message.content, "served by secondary-model");
      assert.equal(router.registry.get("primary").status, "exhausted");
      assert.equal(router.registry.get("secondary").successes, 1);

      const logs = router.trafficLog.getEntries();
      assert.deepEqual(
        logs.map((entry) => entry.status),
        [429, 200]
      );
    }
  );
});

test("does not duplicate fallback nodes when fallback tier is requested", () => {
  const registry = new NodeRegistry();
  const map = [{ id: "local", url: "http://127.0.0.1", model: "local", tier: "fallback" }];

  const sequence = buildRoutingSequence(map, "fallback", registry);

  assert.equal(sequence.length, 1);
  assert.equal(sequence[0].id, "local");
});

test("uses max_completion_tokens for GPT-5 Chat Completions nodes", async () => {
  await withMockServer(
    (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        assert.equal(parsed.model, "gpt-5.4-nano");
        assert.equal(parsed.max_tokens, undefined);
        assert.equal(parsed.max_completion_tokens, 42);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    },
    async (baseUrl) => {
      const router = createRouter({
        map: [{ id: "gpt-5", url: baseUrl, model: "gpt-5.4-nano", tier: "fast" }],
        log: () => {},
      });

      const response = await router.route({
        model: "magistral",
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 42,
      });
      assert.equal(response.status, 200);
    }
  );
});

test("serializes metrics with map metadata", () => {
  const registry = new NodeRegistry();
  const start = registry.recordStart("node-a");
  registry.recordSuccess("node-a", start - 20);

  const map = [
    {
      id: "node-a",
      url: "https://user:secret@example.test/v1/chat/completions",
      model: "test-model",
      tier: "fast",
      weight: 7,
    },
  ];

  const snapshot = createMetricsSnapshot(map, registry);

  assert.equal(snapshot.protocol, "MAGISTRAL-v1");
  assert.equal(snapshot.nodes[0].id, "node-a");
  assert.equal(snapshot.nodes[0].url, "https://***:***@example.test/v1/chat/completions");
  assert.equal(snapshot.nodes[0].requests, 1);
  assert.equal(snapshot.nodes[0].successes, 1);
  assert.equal(snapshot.nodes[0].tier, "fast");
});

test("routes a declared local adapter without requiring an HTTP URL", async () => {
  const router = createRouter({
    map: [{ id: "codex-acp", adapter: "acp_stdio", model: "codex", tier: "fast" }],
    log: () => {},
    invokeNode: async ({ node, payload }) => {
      assert.equal(node.adapter, "acp_stdio");
      assert.equal(payload.model, "codex");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ACP synthesis" } }] }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  });
  const response = await router.route({
    model: "magistral",
    messages: [{ role: "user", content: "public packet" }],
  });
  const body = await response.json();
  assert.equal(body.choices[0].message.content, "ACP synthesis");
});


test("does not fall back after a CPS browser result times out", async () => {
  let fallbackCalls = 0;
  const router = createRouter({
    map: [
      {id: "browser", model: "chatgpt-browser", tier: "chatgpt-browser",
        no_fallback_on_error: true},
      {id: "fallback", model: "fallback-model", tier: "fallback"},
    ],
    log: () => {},
    invokeNode: async ({node}) => {
      if (node.id === "browser") {
        return new Response(JSON.stringify({error: {code: "cps_result_pending"}}), {
          status: 504, headers: {"Content-Type": "application/json"},
        });
      }
      fallbackCalls++;
      return new Response(JSON.stringify({choices: [{message: {content: "fallback"}}]}), {
        status: 200,
      });
    },
  });
  const response = await router.route({model: "chatgpt-browser",
    messages: [{role: "user", content: "long task"}]}, "chatgpt-browser");
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "cps_result_pending");
  assert.equal(fallbackCalls, 0);
});

test("does not fall back on an unknown browser provider transport outcome", async () => {
  let fallbackCalls = 0;
  const router = createRouter({
    map: [
      {id: "browser", model: "chatgpt-browser", tier: "chatgpt-browser",
        no_fallback_on_error: true},
      {id: "fallback", model: "fallback-model", tier: "fallback"},
    ],
    log: () => {},
    invokeNode: async ({node}) => {
      if (node.id === "browser") throw new Error("connection closed after dispatch");
      fallbackCalls++;
      return new Response("fallback");
    },
  });
  const response = await router.route({model: "chatgpt-browser",
    messages: [{role: "user", content: "long task"}]}, "chatgpt-browser");
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "provider_outcome_unknown");
  assert.equal(fallbackCalls, 0);
});


test("keeps explicitly pinned browser provider from falling back after exhaustion", async () => {
  let fallbackCalls = 0;
  const router = createRouter({
    map: [
      {id: "browser", model: "chatgpt-browser", tier: "chatgpt-browser",
        no_fallback_on_error: true},
      {id: "fallback", model: "other", tier: "fallback"},
    ],
    log: () => {},
    invokeNode: async () => {
      fallbackCalls++;
      return new Response(JSON.stringify({choices:[{message:{content:"wrong model"}}]}),
        {status:200});
    },
  });
  router.registry.markExhausted("browser", "provider temporarily unavailable");
  await assert.rejects(
    router.route({model:"chatgpt-browser",messages:[{role:"user",content:"hello"}]},
      "chatgpt-browser"),
    /All magistral nodes exhausted or unavailable/
  );
  assert.equal(fallbackCalls, 0);
});


test("forwards a stable retry key only to the pinned browser provider", async () => {
  const router = createRouter({
    map: [{id:"browser",url:"http://127.0.0.1:8798/v1/chat/completions",
      model:"chatgpt-browser",tier:"chatgpt-browser",no_fallback_on_error:true}],
    log:()=>{},
    invokeNode:async ({headers})=>{
      assert.equal(headers["X-Client-Request-Id"],"client-123");
      return new Response(JSON.stringify({choices:[{message:{content:"ok"}}]}),
        {status:200,headers:{"Content-Type":"application/json"}});
    },
  });
  const response=await router.route({model:"chatgpt-browser",
    _client_request_id:"client-123",messages:[{role:"user",content:"test"}]},
  "chatgpt-browser");
  assert.equal(response.status,200);
});
