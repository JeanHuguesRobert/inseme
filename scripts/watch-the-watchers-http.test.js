import assert from "node:assert/strict";
import test from "node:test";

import { createWatchTheWatchersHandler } from "./watch-the-watchers-http.js";

const frozen = {
  schema: "watch-the-watchers/config-v1",
  state: "FROZEN",
  artifact_ref: "cc-petition/2026-10-07",
  frozen: {
    repository: "JeanHuguesRobert/barons-Mariani",
    release_tag: "cc-petition-2026-10-07",
    asset_filename: "requete-conseil-constitutionnel.pdf",
    sha256: "b".repeat(64),
    asset_url: "https://example.test/frozen.pdf",
  },
};

function fixture() {
  const events = [];
  const handler = createWatchTheWatchersHandler({
    config: frozen,
    lookupToken: async (token) => token === "opaque-token" ? { recipient_ref: "r-1" } : null,
    appendEvent: async (event) => events.push(event),
    now: () => "2026-10-07T13:00:00.000Z",
  });
  return { handler, events };
}

test("GET landing records only LANDING and renders disclosure", async () => {
  const { handler, events } = fixture();
  const result = await handler({
    method: "GET",
    url: "https://service.test/a/opaque-token",
    headers: {
      "user-agent": "scanner",
      "x-forwarded-for": "203.0.113.7",
      referer: "https://mail.example/",
    },
  });

  assert.equal(result.status, 200);
  assert.match(result.body, /ne prouve pas qu’une personne a lu/i);
  assert.match(result.body, /Accès canonique non instrumenté/);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "LANDING");
  assert.deepEqual(Object.keys(events[0]), ["schema", "token_ref", "event", "timestamp", "artifact_ref"]);
});

test("POST open records OPEN_PDF and redirects to the configured artifact", async () => {
  const { handler, events } = fixture();
  const result = await handler({
    method: "POST",
    url: "https://service.test/a/opaque-token/open",
    headers: {},
  });

  assert.equal(result.status, 303);
  assert.equal(result.headers.location, frozen.frozen.asset_url);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "OPEN_PDF");
});

test("GET redirect records REDIRECT conservatively", async () => {
  const { handler, events } = fixture();
  const result = await handler({
    method: "GET",
    url: "https://service.test/a/opaque-token/redirect",
    headers: {},
  });

  assert.equal(result.status, 302);
  assert.equal(events[0].event, "REDIRECT");
});

test("unknown token does not disclose mapping existence or log an event", async () => {
  const { handler, events } = fixture();
  const result = await handler({
    method: "GET",
    url: "https://service.test/a/not-known",
    headers: {},
  });

  assert.equal(result.status, 404);
  assert.equal(events.length, 0);
});

test("unsupported route does not manufacture a reading event", async () => {
  const { handler, events } = fixture();
  const result = await handler({
    method: "GET",
    url: "https://service.test/a/opaque-token/read",
    headers: {},
  });

  assert.equal(result.status, 405);
  assert.equal(events.length, 0);
});
