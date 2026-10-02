#!/usr/bin/env node
/**
 * Standalone End-to-End Test for External Continuation Resumption (Inseme #113).
 *
 * Proves the full vertical slice:
 * 1. Continuation declaration & portable projection (unfenced template)
 * 2. External agent response (fenced cogentia.step_result/v1 comment)
 * 3. Repository webhook delivery with HMAC verification & allowlist
 * 4. Observable COP Event normalization & pure recognition (observed → correlated → accepted → returned)
 * 5. Replay idempotency & reconciliation convergence (no double progression)
 * 6. Suspended computation resumption via COP kernel / scheduler
 * 7. Entity admission check: zero new core entities
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  COPBus,
  COPScheduler,
  createContinuationDescriptor,
  resumeContinuationFromReturnedEvent,
} from "../packages/cop-kernel/src/index.js";

import {
  evaluateGithubIngress,
  mapDeliveryToCopEvent,
} from "../packages/cop-core/src/github-ingress.js";

import {
  CONTINUATION_RESULT_ADMISSION,
  CONTINUATION_RESULT_PROFILE,
  continuationContextFromRecords,
  declaredContinuationRecord,
  projectContinuationForExternalHandler,
  recognizeMappedContinuationResults,
} from "../packages/cop-core/src/continuation-result.js";

console.log("==========================================================================");
console.log("    TESTING EXTERNAL CONTINUATION RESUMPTION E2E (INSEME #113)            ");
console.log("==========================================================================");

const SECRET = "test-webhook-secret-113";
const REPOSITORY = "JeanHuguesRobert/inseme";
const CHALLENGE = "chal-issue113-e2e-proof";
const CONTINUATION_ID = "ctn_issue113_e2e_001";
const EXPECTED_ANSWER = "Content-addressed LRU with TTL decay and cryptographic receipts.";

// [Test 1] Emit real continuation descriptor & declaration record
console.log("\n[Test 1] Emitting real continuation descriptor & declaration record...");
const continuation = createContinuationDescriptor({
  continuationId: CONTINUATION_ID,
  resumeTo: "handler:fractanet_analyzer",
  resumeIntent: "analyze-caching-policy",
  correlationId: CHALLENGE,
  state: {
    question: "What is the optimal caching policy for Fractanet edge nodes?",
    targetRepository: REPOSITORY,
  },
  meta: {
    topicId: "topic:fractanet:caching",
    correlation: { challenge: CHALLENGE },
  },
});

assert.equal(continuation.continuationId, CONTINUATION_ID);
assert.equal(continuation.type, "cop/continuation");

const declared = declaredContinuationRecord({
  continuation_id: CONTINUATION_ID,
  correlation: { challenge: CHALLENGE },
  resumeTo: "handler:fractanet_analyzer",
  state: continuation.state,
  expected_result: { schema: "cogentia.step_result/v1" },
  lifecycle: "suspended",
});

assert.equal(declared.idempotency_key, `continuation:${CONTINUATION_ID}:declared`);
assert.equal(declared.payload.profile, "cop/continuation");
assert.equal(declared.epistemic_status, "declared");
console.log("  ✓ Continuation descriptor created and declared record prepared.");

// [Test 2] Generate portable projection for external agent
console.log("\n[Test 2] Generating portable projection for external conversational agent...");
const projection = projectContinuationForExternalHandler(
  {
    continuation_id: CONTINUATION_ID,
    correlation: { challenge: CHALLENGE },
    state: { question: "What is the optimal caching policy for Fractanet edge nodes?" },
    expected_result: { schema: "cogentia.step_result/v1" },
    requiredCapabilities: ["cognitive.judgment"],
  },
  {
    return_paths: [{ surface: "github", repository: REPOSITORY, resource: "issue:113" }],
  }
);

assert.equal(projection.media_type, "text/markdown");
assert.ok(projection.body.includes(CONTINUATION_ID));
assert.ok(projection.body.includes(CHALLENGE));
assert.ok(projection.body.includes("Template, not itself a result:"));
assert.ok(!projection.body.includes("```"), "Projection template must remain unfenced");
console.log("  ✓ Portable projection generated (unfenced template, no accidental auto-answer).");

// [Test 3] Full Roundtrip: Webhook Ingress → Correlated Returned Event → Kernel Resumption
console.log(
  "\n[Test 3] Full Roundtrip: Webhook Ingress → Correlated Returned Event → Resumption..."
);
const bus = new COPBus();
const scheduler = new COPScheduler(bus);

let handlerExecuted = false;
let handlerReceivedData = null;

scheduler.setExecutionContext({
  handlerResolver: async (handlerRef) => {
    if (handlerRef === "handler:fractanet_analyzer") {
      return {
        execute: async ({ continuation, resumeMessage, triggeringEvent, payload }) => {
          handlerExecuted = true;
          handlerReceivedData = { continuation, resumeMessage, triggeringEvent, payload };
          return {
            status: "resolved",
            answer: payload?.yield?.answer || payload?.candidateResult?.result?.answer,
          };
        },
      };
    }
    return null;
  },
});

scheduler.start();

try {
  scheduler.register(continuation);

  const storeEvents = [declared];

  // Ordinary external agent produces answer comment on GitHub
  const commentBody = [
    "Here is the requested analysis for Fractanet:",
    "```yaml",
    "protocol: cogentia.step_result/v1",
    `continuation_id: ${CONTINUATION_ID}`,
    `challenge: ${CHALLENGE}`,
    "status: answered",
    "cognitive_producer: Claude-3.7-Sonnet",
    "result:",
    `  answer: ${EXPECTED_ANSWER}`,
    "```",
  ].join("\n");

  const webhookPayload = {
    action: "created",
    repository: { full_name: REPOSITORY },
    sender: { login: "external-agent-bot" },
    issue: { number: 113 },
    comment: {
      id: 7001,
      node_id: "IC_7001",
      html_url: `https://github.com/${REPOSITORY}/issues/113#issuecomment-7001`,
      body: commentBody,
      updated_at: new Date().toISOString(),
    },
  };

  const rawBody = JSON.stringify(webhookPayload);
  const signature = "sha256=" + createHmac("sha256", SECRET).update(rawBody).digest("hex");

  // Webhook ingress evaluation
  const initialContext = continuationContextFromRecords(storeEvents, []);
  const ingressDecision = evaluateGithubIngress({
    headers: {
      "x-github-delivery": "deliv-webhook-001",
      "x-github-event": "issue_comment",
      "x-hub-signature-256": signature,
    },
    payload: webhookPayload,
    rawBody,
    webhookSecret: SECRET,
    allowlist: [REPOSITORY],
    options: { continuationContext: initialContext },
  });

  assert.equal(ingressDecision.ok, true);
  assert.equal(ingressDecision.outcome, "mapped");
  assert.ok(ingressDecision.continuation_recognition);
  assert.equal(ingressDecision.continuation_recognition.reports[0].matched, true);
  assert.equal(ingressDecision.continuation_recognition.reports[0].progresses, true);
  assert.equal(ingressDecision.continuation_recognition.reports[0].progression, "returned");

  const proposedPhases = ingressDecision.continuation_recognition.proposed_events.map(
    (e) => e.payload.phase
  );
  assert.deepEqual(proposedPhases, ["observed", "correlated", "accepted", "returned"]);

  const returnedEvent = ingressDecision.continuation_recognition.proposed_events.find(
    (e) => e.payload.phase === "returned"
  );
  assert.ok(returnedEvent);
  assert.equal(returnedEvent.payload.candidate_result.result.answer, EXPECTED_ANSWER);
  assert.equal(returnedEvent.payload.candidate_result.challenge, undefined, "Challenge stripped");
  assert.equal(returnedEvent.payload.provenance.cognitive_producer_claimed, "Claude-3.7-Sonnet");
  assert.equal(returnedEvent.payload.provenance.cognitive_producer_verified, false);

  for (const proposed of ingressDecision.continuation_recognition.proposed_events) {
    storeEvents.push(proposed);
  }

  // Publish returned event to bus
  await bus.publish(returnedEvent);

  assert.equal(handlerExecuted, true, "Suspended computation resumed and executed");
  assert.equal(handlerReceivedData.continuation.continuationId, CONTINUATION_ID);
  assert.equal(
    handlerReceivedData.payload?.candidateResult?.result?.answer ||
      handlerReceivedData.payload?.yield?.answer,
    EXPECTED_ANSWER
  );
  assert.equal(scheduler.pending.has(CONTINUATION_ID), false, "Continuation removed from pending");
  console.log("  ✓ Webhook delivery mapped → correlated → accepted → returned → kernel resumed.");
} finally {
  scheduler.stop();
}

// [Test 4] Duplicate delivery idempotency & reconciliation convergence
console.log("\n[Test 4] Testing duplicate delivery idempotency & reconciliation convergence...");
const duplicateCommentBody = [
  "```yaml",
  "protocol: cogentia.step_result/v1",
  `continuation_id: ${CONTINUATION_ID}`,
  `challenge: ${CHALLENGE}`,
  "status: answered",
  "cognitive_producer: ChatGPT",
  "result:",
  `  answer: ${EXPECTED_ANSWER}`,
  "```",
].join("\n");

const webhookDelivery = {
  delivery_id: "deliv-webhook-first",
  event_name: "issue_comment",
  action: "created",
  repository_name: REPOSITORY,
  sender_login: "agent",
};
const commentPayload = {
  action: "created",
  repository: { full_name: REPOSITORY },
  sender: { login: "agent" },
  issue: { number: 113 },
  comment: { id: 8001, body: duplicateCommentBody },
};

const webhookEvent = mapDeliveryToCopEvent(webhookDelivery, commentPayload);

// First delivery progresses to returned
const firstContext = continuationContextFromRecords([declared], []);
const firstBatch = recognizeMappedContinuationResults([webhookEvent], firstContext);
assert.equal(firstBatch.reports[0].progresses, true);
assert.equal(firstBatch.reports[0].progression, "returned");

// Second identical delivery (replayed webhook)
const contextAfterReturn = continuationContextFromRecords(
  [declared],
  firstBatch.proposed_events.map((e) => ({ payload: e.payload }))
);
const replayBatch = recognizeMappedContinuationResults([webhookEvent], contextAfterReturn);
assert.equal(replayBatch.reports[0].idempotent, true);
assert.equal(replayBatch.reports[0].progresses, false);
assert.equal(replayBatch.proposed_events.length, 0, "Replay proposes 0 new events");

// Bounded reconciliation rediscovery with new delivery ID but same comment ID
const reconcileDelivery = {
  delivery_id: "deliv-reconcile-gap-fill",
  event_name: "issue_comment",
  action: "created",
  repository_name: REPOSITORY,
  sender_login: "agent",
};
const reconciledEvent = mapDeliveryToCopEvent(reconcileDelivery, commentPayload);
const reconcileBatch = recognizeMappedContinuationResults([reconciledEvent], contextAfterReturn);

assert.equal(reconcileBatch.reports[0].idempotent, true);
assert.equal(reconcileBatch.reports[0].progresses, false);
assert.equal(reconcileBatch.proposed_events.length, 0, "Reconciliation does not double-progress");
console.log("  ✓ Duplicate delivery and reconciliation rediscovery both strictly idempotent.");

// [Test 5] Direct bridge helper
console.log("\n[Test 5] Testing resumeContinuationFromReturnedEvent direct bridge...");
let executedDirectly = false;
const directContinuation = {
  continuationId: "ctn_direct_002",
  resumeTo: "handler:direct_evaluator",
  state: { step: "review" },
};

const returnedEventDirect = {
  event_type: "cop.event/v1",
  topic_id: "continuation:ctn_direct_002",
  actor_id: "cop:continuation-result-recognizer",
  payload: {
    profile: CONTINUATION_RESULT_PROFILE,
    phase: "returned",
    continuation_id: "ctn_direct_002",
    candidate_result: {
      protocol: "cogentia.step_result/v1",
      continuation_id: "ctn_direct_002",
      status: "answered",
      result: { answer: "Direct bridge execution successful" },
    },
    provenance: {
      delivery_verified: true,
      surface: "github",
      cognitive_producer_claimed: "Codex",
      cognitive_producer_verified: false,
    },
  },
};

const bridgeResult = await resumeContinuationFromReturnedEvent({
  continuation: directContinuation,
  returnedEvent: returnedEventDirect,
  handlerResolver:
    async () =>
    async ({ resumeMessage, payload }) => {
      executedDirectly = true;
      return {
        status: "resolved",
        verified: payload?.yield?.answer === "Direct bridge execution successful",
      };
    },
});

assert.equal(bridgeResult.resumed, true);
assert.equal(bridgeResult.lifecycle, "resumed");
assert.equal(executedDirectly, true);
assert.equal(bridgeResult.yield.answer, "Direct bridge execution successful");
assert.equal(bridgeResult.execution.result.verified, true);
console.log("  ✓ Direct bridge executed handler with verified yield payload.");

// [Test 6] Entity Admission Invariants
console.log("\n[Test 6] Checking Entity Admission Invariants...");
assert.equal(CONTINUATION_RESULT_ADMISSION.new_core_entity, false);
assert.equal(CONTINUATION_RESULT_ADMISSION.profile, "cop.continuation-result/v1");
assert.deepEqual(CONTINUATION_RESULT_ADMISSION.reused, [
  "cop.event/v1",
  "cop/continuation artifact",
  "normalized adapter event",
]);
assert.deepEqual(CONTINUATION_RESULT_ADMISSION.not_emitted, [
  "cop.continuation.resume",
  "resolved",
  "assimilated",
]);
console.log("  ✓ No new core entities; strictly adheres to COP Entity Admission Test.");

console.log("\n==========================================================================");
console.log("✓ ALL EXTERNAL CONTINUATION RESUMPTION E2E TESTS PASSED (100% SUCCESS)");
console.log("==========================================================================");
