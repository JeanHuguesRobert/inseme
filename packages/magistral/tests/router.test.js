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
