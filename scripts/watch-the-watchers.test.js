import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCESS_EVENT_SCHEMA,
  createAccessEvent,
  createOpaqueToken,
  disclosureText,
  renderLandingHtml,
  resolveArtifactTarget,
  tokenRefFromToken,
  validateConfig,
  validateTokenMapping,
} from "./watch-the-watchers.js";

const review = {
  schema: "watch-the-watchers/config-v1",
  state: "REVIEW",
  artifact_ref: "cc-petition/current-review",
  review_url: "https://example.test/review.pdf",
};

const frozen = {
  schema: "watch-the-watchers/config-v1",
  state: "FROZEN",
  artifact_ref: "cc-petition/2026-10-07",
  frozen: {
    repository: "JeanHuguesRobert/barons-Mariani",
    release_tag: "cc-petition-2026-10-07",
    asset_filename: "requete-conseil-constitutionnel.pdf",
    sha256: "a".repeat(64),
    asset_url: "https://github.com/JeanHuguesRobert/barons-Mariani/releases/download/cc-petition-2026-10-07/requete-conseil-constitutionnel.pdf",
  },
};

test("opaque token has no readable recipient data", () => {
  const token = createOpaqueToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 22);
  validateTokenMapping({ token_ref: token, recipient_ref: "recipient-001" });
});

test("token reference is a one-way sha256 identifier", () => {
  const token = createOpaqueToken();
  const ref = tokenRefFromToken(token);
  assert.match(ref, /^sha256:[0-9a-f]{64}$/);
  assert.ok(!ref.includes(token));
  assert.equal(ref, tokenRefFromToken(token));
});

test("REVIEW never advertises frozen coordinates or sha256", () => {
  validateConfig(review);
  const target = resolveArtifactTarget(review);
  assert.equal(target.state, "REVIEW");
  assert.equal(target.sha256, null);
  assert.equal(target.canonical_escape, null);
  assert.throws(() => validateConfig({ ...review, frozen: frozen.frozen }), /review_must_not_embed_frozen_coordinates/);
});

test("FROZEN exposes one canonical immutable target", () => {
  validateConfig(frozen);
  const target = resolveArtifactTarget(frozen);
  assert.equal(target.target_url, frozen.frozen.asset_url);
  assert.equal(target.sha256, frozen.frozen.sha256);
  assert.deepEqual(target.canonical_escape, frozen.frozen);
});

test("minimal event schema contains no ambient browser metadata", () => {
  const event = createAccessEvent({
    token_ref: "opaque-token",
    event: "OPEN_PDF",
    artifact_ref: frozen.artifact_ref,
    timestamp: "2026-10-07T12:00:00.000Z",
  });
  assert.equal(event.schema, ACCESS_EVENT_SCHEMA);
  assert.deepEqual(Object.keys(event), ["schema", "token_ref", "event", "timestamp", "artifact_ref"]);
  assert.ok(!("ip" in event));
  assert.ok(!("user_agent" in event));
  assert.ok(!("referrer" in event));
});

test("event vocabulary is conservative", () => {
  for (const name of ["LANDING", "OPEN_PDF", "REDIRECT"]) {
    assert.equal(createAccessEvent({ token_ref: "t", event: name, artifact_ref: "a" }).event, name);
  }
  assert.throws(() => createAccessEvent({ token_ref: "t", event: "READ", artifact_ref: "a" }), /invalid_access_event/);
});

test("recipient-facing disclosure denies proof of reading", () => {
  assert.match(disclosureText(review), /ne prouve pas.*lu/i);
  assert.match(disclosureText(frozen), /voie canonique non instrumentée/i);
});

test("landing uses explicit POST action and no tracking primitives", () => {
  const html = renderLandingHtml({ token_ref: "opaque-token", config: frozen });
  assert.match(html, /method="post"/i);
  assert.match(html, /Ouvrir le PDF/);
  assert.match(html, /Accès canonique non instrumenté/);
  assert.doesNotMatch(html, /pixel|fingerprint|localStorage|cookie|analytics/i);
});
