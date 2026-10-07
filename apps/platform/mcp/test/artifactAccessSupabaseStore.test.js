import assert from "node:assert/strict";
import test from "node:test";

import { createArtifactAccessSupabaseStore } from "./artifactAccessSupabaseStore.js";

function fakeClient() {
  const calls = [];
  const tokenRow = {
    token_ref: "sha256:" + "1".repeat(64),
    recipient_ref: "recipient-1",
    context_ref: "cc-last-chance",
    artifact_ref: "cc-petition/current-review",
    expires_at: "2027-01-01T00:00:00.000Z",
    disabled_at: null,
  };

  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      if (name === "artifact_access_purge_expired") return { data: [{ events_deleted: 2, tokens_deleted: 1 }], error: null };
      return { data: tokenRow, error: null };
    },
    from: (table) => {
      calls.push({ kind: "from", table });
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        is() { return chain; },
        gt() { return chain; },
        async maybeSingle() { return { data: tokenRow, error: null }; },
      };
      return chain;
    },
  };
}

test("registerToken sends only the one-way token_ref to Supabase", async () => {
  const client = fakeClient();
  const store = createArtifactAccessSupabaseStore(client);
  const token = "A".repeat(32);

  const result = await store.registerToken({
    token,
    recipient_ref: "recipient-1",
    context_ref: "cc-last-chance",
    artifact_ref: "cc-petition/current-review",
    expires_at: "2027-01-01T00:00:00.000Z",
  });

  const call = client.calls.find((item) => item.kind === "rpc");
  assert.equal(call.name, "artifact_access_token_register");
  assert.match(call.args.p_token_ref, /^sha256:[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(call.args).includes(token));
  assert.equal(result.token_ref, call.args.p_token_ref);
});

test("appendEvent preserves minimal canonical event shape", async () => {
  const client = fakeClient();
  const store = createArtifactAccessSupabaseStore(client);

  const result = await store.appendEvent({
    token: "B".repeat(32),
    event: "LANDING",
    artifact_ref: "cc-petition/current-review",
    timestamp: "2026-10-07T14:00:00.000Z",
  });

  assert.deepEqual(Object.keys(result.event), ["schema", "token_ref", "event", "timestamp", "artifact_ref"]);
  const call = client.calls.find((item) => item.name === "artifact_access_event_append");
  assert.equal(call.args.p_event.event, "LANDING");
  assert.ok(!("ip" in call.args.p_event));
  assert.ok(!("user_agent" in call.args.p_event));
});

test("purgeExpired delegates retention enforcement to service-only RPC", async () => {
  const client = fakeClient();
  const store = createArtifactAccessSupabaseStore(client);
  const result = await store.purgeExpired("2027-01-02T00:00:00.000Z");
  assert.deepEqual(result, [{ events_deleted: 2, tokens_deleted: 1 }]);
});
