import assert from "node:assert/strict";
import test from "node:test";

import { maybeCreateArtifactAccessRouterFromEnv } from "../cop/artifactAccessRouter.js";

test("Watch the Watchers HTTP surface is inert unless explicitly configured", () => {
  assert.equal(maybeCreateArtifactAccessRouterFromEnv({}), null);
});

test("explicit enablement refuses missing service-role credentials", () => {
  assert.throws(
    () => maybeCreateArtifactAccessRouterFromEnv({
      WATCHERS_CONFIG_JSON: JSON.stringify({
        schema: "watch-the-watchers/config-v1",
        state: "REVIEW",
        artifact_ref: "cc-petition/current-review",
        review_url: "https://example.test/review.pdf",
      }),
    }),
    /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
  );
});

test("explicit enablement refuses malformed configuration JSON", () => {
  assert.throws(
    () => maybeCreateArtifactAccessRouterFromEnv({
      WATCHERS_CONFIG_JSON: "{",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
    }),
    /must be valid JSON/,
  );
});
