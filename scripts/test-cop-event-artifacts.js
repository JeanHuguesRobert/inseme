#!/usr/bin/env node
/**
 * Inseme #28 residual: artifacts + visibility projection + persist pipeline.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  canViewVisibility,
  createFsArtifactStore,
  createMemoryArtifactStore,
  externalizeRawBody,
  hashArtifactBody,
  projectEventForViewer,
} from "../packages/cop-core/src/cop-event-artifacts.js";
import {
  createCopEventEnvelope,
  hashPayload,
} from "../packages/cop-core/src/cop-event-envelope.js";
import { createCopEventPersistPipeline } from "../packages/cop-core/src/cop-event-persist.js";
import {
  createMemoryCopEventStore,
  createNdjsonCopEventSpool,
} from "../packages/cop-core/src/cop-event-spool.js";
import {
  artifactStoragePath,
  buildCopEventAppendArgs,
  buildGithubDeliveryRow,
  shouldExternalizeRawBody,
} from "../packages/cop-core/src/cop-event-supabase-shape.js";

console.log("==========================================================================");
console.log("    COP ARTIFACTS + VISIBILITY + PERSIST (#28 residual)");
console.log("==========================================================================");

console.log("\n[Test 1] Memory artifact store...");
const memArt = createMemoryArtifactStore();
const put = memArt.put(JSON.stringify({ hello: "world" }), {
  content_type: "application/json",
});
assert.equal(put.ok, true);
assert.ok(put.artifact_ref.startsWith("artifact:"));
assert.equal(put.payload_hash, hashArtifactBody(JSON.stringify({ hello: "world" })));
const got = memArt.get(put.artifact_ref);
assert.ok(got);
assert.equal(got.body.toString("utf8"), JSON.stringify({ hello: "world" }));
console.log("  ✓ put/get content-addressed");

console.log("\n[Test 2] FS artifact store...");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cop-art-"));
try {
  const fsArt = createFsArtifactStore({ rootDir: path.join(tmp, "blobs") });
  const p2 = fsArt.put("large-body-content-for-file-store", {
    content_type: "text/plain",
  });
  assert.equal(p2.ok, true);
  const g2 = fsArt.get(p2.artifact_ref);
  assert.equal(g2.body.toString("utf8"), "large-body-content-for-file-store");
  console.log("  ✓ fs artifact store");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("\n[Test 3] externalize threshold...");
const small = externalizeRawBody("tiny", memArt, { threshold_bytes: 100 });
assert.equal(small.externalized, false);
assert.equal(small.artifact_ref, null);
const big = externalizeRawBody("x".repeat(200), memArt, { threshold_bytes: 100 });
assert.equal(big.externalized, true);
assert.ok(big.artifact_ref);
console.log("  ✓ threshold externalization");

console.log("\n[Test 4] visibility projection preserves causal existence...");
const sealed = createCopEventEnvelope({
  topic_id: "t-vis",
  visibility: "sealed",
  payload: { secret_summary: "nope", summary: "hidden" },
  epistemic_status: "observed",
});
const openViewer = projectEventForViewer(sealed, { viewer_clearance: "open" });
assert.equal(openViewer.visibility_allowed, false);
assert.equal(openViewer.payload, null);
assert.equal(openViewer.event_id, sealed.event_id);
assert.equal(openViewer.payload_hash, sealed.payload_hash);
assert.ok(openViewer.payload_redacted);

const sealedViewer = projectEventForViewer(sealed, { viewer_clearance: "sealed" });
assert.equal(sealedViewer.visibility_allowed, true);
assert.deepEqual(sealedViewer.payload, sealed.payload);

assert.equal(canViewVisibility("open", "open"), true);
assert.equal(canViewVisibility("restricted", "open"), false);
assert.equal(canViewVisibility("restricted", "restricted"), true);
console.log("  ✓ restricted/sealed redaction + existence preserved");

console.log("\n[Test 5] persist pipeline store + spool degraded...");
const store = createMemoryCopEventStore();
const spoolDir = fs.mkdtempSync(path.join(os.tmpdir(), "cop-spool-p-"));
try {
  const spool = createNdjsonCopEventSpool({
    filePath: path.join(spoolDir, "q.ndjson"),
  });
  const arts = createMemoryArtifactStore();
  const pipe = createCopEventPersistPipeline({
    store,
    spool,
    artifacts: arts,
    artifact_threshold_bytes: 10,
  });

  const result = await pipe.persistGithubDelivery({
    delivery: {
      delivery_id: "del-1",
      event_name: "push",
      action: null,
      repository_name: "org/repo",
      sender_login: "bob",
      installation_id: 9,
    },
    payload: { ref: "refs/heads/main", commits: [{ id: "abc" }] },
    rawBody: JSON.stringify({
      ref: "refs/heads/main",
      commits: [{ id: "abc" }],
      pad: "y".repeat(50),
    }),
    visibility: "restricted",
  });
  assert.equal(result.ok, true);
  assert.ok(result.event.topic.seq >= 1);
  assert.ok(result.artifact_ref, "large body externalized");

  const dup = await pipe.persistGithubDelivery({
    delivery: {
      delivery_id: "del-1",
      event_name: "push",
      repository_name: "org/repo",
      sender_login: "bob",
    },
    payload: { ref: "refs/heads/main", commits: [] },
    rawBody: "{}",
  });
  assert.equal(dup.duplicate, true);

  // Force spool: broken store
  const broken = {
    append() {
      return { ok: false, error: "forced_fail" };
    },
  };
  const pipe2 = createCopEventPersistPipeline({
    store: broken,
    spool,
    artifacts: arts,
  });
  const deg = await pipe2.persistGithubDelivery({
    delivery: {
      delivery_id: "del-2",
      event_name: "issues",
      repository_name: "org/repo",
      sender_login: "bob",
      action: "opened",
    },
    payload: { issue: { number: 1, title: "t" } },
    rawBody: "{}",
  });
  assert.equal(deg.ok, false);
  assert.equal(deg.spooled, true);
  console.log("  ✓ pipeline append + idempotent + spool on failure");
} finally {
  fs.rmSync(spoolDir, { recursive: true, force: true });
}

console.log("\n[Test 6] Supabase shape helpers...");
const row = buildGithubDeliveryRow({
  deliveryId: "d",
  eventName: "push",
  action: null,
  repositoryName: "a/b",
  installationId: 1,
  senderLogin: "u",
  signatureHeader: "sha256:x",
  payloadHash: "ab".repeat(32),
  artifactRef: "artifact:x",
});
assert.equal(row.payload_sha256.startsWith("sha256:"), true);
const args = buildCopEventAppendArgs({
  topicId: "github:a/b",
  actorId: "github:u",
  originRef: "github:delivery:d",
  payload: { summary: "s" },
  meta: {},
  idempotencyKey: "k",
  payloadHash: hashPayload({ summary: "s" }),
  visibility: "restricted",
});
assert.equal(args.p_topic_id, "github:a/b");
assert.equal(args.p_on_behalf_of_instance_id, "00000000-0000-0000-0000-000000000001");
assert.equal(shouldExternalizeRawBody(9000), true);
assert.equal(shouldExternalizeRawBody(100), false);
assert.ok(artifactStoragePath("aa".repeat(32), "del").includes("github-webhooks/"));
console.log("  ✓ supabase row/rpc shapes");

console.log("\n==========================================================================");
console.log("✓ ALL ARTIFACT / VISIBILITY / PERSIST TESTS PASSED");
console.log("==========================================================================");
