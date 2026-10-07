import assert from "node:assert/strict";
import test from "node:test";

import { handler } from "../../netlify/profiles/jhn/functions/artifact-access.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function reset() {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
}

test.afterEach(reset);

test("fails closed when Watchers configuration is absent", async () => {
  delete process.env.WATCHERS_CONFIG_JSON;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = await handler({
    httpMethod: "GET",
    rawUrl: "https://jhn.baronsmariani.org/artifact-access/a/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  });
  assert.equal(result.statusCode, 503);
  assert.equal(result.headers["Cache-Control"], "no-store");
});

test("LANDING uses hashed token reference and renders conservative disclosure", async () => {
  process.env.WATCHERS_CONFIG_JSON = JSON.stringify({
    schema: "watch-the-watchers/config-v1",
    state: "REVIEW",
    artifact_ref: "cc-petition/review-v0.30",
    review_url: "https://example.test/review.pdf",
  });
  process.env.SUPABASE_URL = "https://db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";

  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (String(url).endsWith("/artifact_access_token_lookup")) {
      return new Response(JSON.stringify({
        token_ref: "sha256:" + "a".repeat(64),
        recipient_ref: "synthetic-1",
        artifact_ref: "cc-petition/review-v0.30",
        disabled_at: null,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ event_id: "evt-1" }), { status: 200 });
  };

  const rawToken = "A".repeat(32);
  const result = await handler({
    httpMethod: "GET",
    rawUrl: "https://jhn.baronsmariani.org/artifact-access/a/" + rawToken,
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /ne prouve pas qu’une personne a lu/i);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.p_token_ref.startsWith("sha256:"), true);
  assert.equal(JSON.stringify(calls).includes(rawToken), false);
  assert.equal(calls[1].body.p_event.event, "LANDING");
  assert.ok(!("ip" in calls[1].body.p_event));
  assert.ok(!("user_agent" in calls[1].body.p_event));
});

test("explicit OPEN_PDF action redirects only after appending event", async () => {
  process.env.WATCHERS_CONFIG_JSON = JSON.stringify({
    schema: "watch-the-watchers/config-v1",
    state: "REVIEW",
    artifact_ref: "cc-petition/review-v0.30",
    review_url: "https://example.test/review.pdf",
  });
  process.env.SUPABASE_URL = "https://db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";

  const events = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).endsWith("/artifact_access_token_lookup")) {
      return new Response(JSON.stringify({
        token_ref: "sha256:" + "b".repeat(64),
        recipient_ref: "synthetic-1",
        artifact_ref: "cc-petition/review-v0.30",
        disabled_at: null,
      }), { status: 200 });
    }
    events.push(body.p_event);
    return new Response(JSON.stringify({ event_id: "evt-2" }), { status: 200 });
  };

  const result = await handler({
    httpMethod: "POST",
    rawUrl: "https://jhn.baronsmariani.org/artifact-access/a/" + "B".repeat(32) + "/open",
  });

  assert.equal(result.statusCode, 303);
  assert.equal(result.headers.Location, "https://example.test/review.pdf");
  assert.deepEqual(events.map((e) => e.event), ["OPEN_PDF"]);
});
