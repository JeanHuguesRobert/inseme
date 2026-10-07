import assert from "node:assert/strict";
import test from "node:test";

import { generateAccessUrl } from "./watch-the-watchers-generate-url.js";

test("generates an opaque individualized URL without readable recipient data", () => {
  const token = "A".repeat(32);
  const generated = generateAccessUrl({
    base_url: "https://example.test/artifact-access",
    recipient_ref: "cc-recipient-001",
    context_ref: "cc-review-2026-10-07",
    artifact_ref: "barons-Mariani@23ffa196:requete-conseil-constitutionnel.md",
    expires_at: "2099-01-01T00:00:00.000Z",
    token,
  });

  assert.equal(
    generated.url,
    "https://example.test/artifact-access/a/" + token,
  );
  assert.ok(!generated.url.includes("cc-recipient-001"));
  assert.ok(!generated.url.includes("cc-review-2026-10-07"));
  assert.match(generated.token_ref, /^sha256:[0-9a-f]{64}$/);
  assert.equal(generated.registration.recipient_ref, "cc-recipient-001");
  assert.equal(generated.secret_bearer_capability, true);
});

test("generation is deterministic for a supplied token", () => {
  const input = {
    base_url: "https://example.test/artifact-access/",
    recipient_ref: "r1",
    artifact_ref: "review:abc",
    expires_at: "2099-01-01T00:00:00.000Z",
    token: "B".repeat(32),
  };
  const a = generateAccessUrl(input);
  const b = generateAccessUrl(input);
  assert.equal(a.url, b.url);
  assert.equal(a.token_ref, b.token_ref);
});

test("requires an explicit bounded expiry", () => {
  assert.throws(
    () => generateAccessUrl({
      base_url: "https://example.test",
      recipient_ref: "r1",
      artifact_ref: "review:abc",
      token: "C".repeat(32),
    }),
    /expires_at_required/,
  );
});

test("rejects non-http capability URLs", () => {
  assert.throws(
    () => generateAccessUrl({
      base_url: "file:///tmp",
      recipient_ref: "r1",
      artifact_ref: "review:abc",
      expires_at: "2099-01-01T00:00:00.000Z",
      token: "D".repeat(32),
    }),
    /invalid_base_url_protocol/,
  );
});
