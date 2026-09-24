import assert from "node:assert/strict";
import test from "node:test";
import {
  createHandlerAssistDecision,
  projectLegacyHandlerAssistDecision,
  runHandlerAssistSandbox,
} from "../scenarios/handler-assist-decision.js";

const fixedTime = "2026-09-24T09:00:00.000Z";

function reasonedDecision(selectedPath, suffix = selectedPath) {
  return createHandlerAssistDecision({
    decision_id: `decision:handler-assist:${suffix}`,
    selected_path: selectedPath,
    rationale_summary:
      selectedPath === "local_only"
        ? "The request can be answered from the local conversation state."
        : "The request calls for a bounded coding contribution.",
    capability_requirement:
      selectedPath === "handler_assisted" ? { capability: "coding.assist" } : null,
    decisive_assertion_refs:
      selectedPath === "handler_assisted"
        ? [`assertion:handler-assist-usefulness:${suffix}`]
        : [],
    decided_at: fixedTime,
  });
}

test("A - local_only needs no availability or authorization fact to explain the choice", () => {
  const decision = reasonedDecision("local_only");
  const result = runHandlerAssistSandbox({ decision });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].event_type, "HandlerAssistDecisionRecorded");
  assert.equal(result.events[0].payload.selected_path, "local_only");
  assert.equal(result.events[0].payload.capability_requirement, null);
  assert.equal(Object.hasOwn(result.events[0].payload, "handler_available"), false);
  assert.equal(Object.hasOwn(result.events[0].payload, "mandate"), false);
  assert.equal(Object.hasOwn(result.events[0].payload, "budget"), false);
  assert.equal(Object.isFrozen(decision), true);
  assert.equal(Object.isFrozen(decision.rationale), true);
});

test("B - desired assistance retains its reason when capability is unavailable", () => {
  const decision = reasonedDecision("handler_assisted", "unavailable");
  const result = runHandlerAssistSandbox({ decision, handler_available: false });

  assert.deepEqual(
    result.events.map((event) => event.event_type),
    ["HandlerAssistDecisionRecorded", "HandlerAssistUnavailable"]
  );
  assert.equal(
    result.events[0].payload.rationale.summary,
    "The request calls for a bounded coding contribution."
  );
  assert.equal(result.events[1].payload.reason, "required_capability_unavailable");
  assert.equal(result.events[1].causation_id, result.events[0].event_id);
});

test("C - mandate or budget refusal is downstream and does not rewrite the decision", async (t) => {
  for (const refusal of ["mandate", "budget"]) {
    await t.test(refusal, () => {
      const decision = reasonedDecision("handler_assisted", refusal);
      const result = runHandlerAssistSandbox({
        decision,
        handler_available: true,
        refusal,
      });

      assert.deepEqual(
        result.events.map((event) => event.event_type),
        [
          "HandlerAssistDecisionRecorded",
          "CapabilityAvailable",
          "HandlerAssistRefused",
        ]
      );
      assert.deepEqual(result.events[0].payload, decision);
      assert.equal(result.events[2].payload.refusal_stage, refusal);
      assert.equal(Object.hasOwn(result.events[0].payload, "authorization"), false);
    });
  }
});

test("D - execution facts remain distinct and success does not prove usefulness", () => {
  const decision = reasonedDecision("handler_assisted", "executed");
  const result = runHandlerAssistSandbox({
    decision,
    handler_available: true,
    execute: true,
  });

  assert.deepEqual(
    result.events.map((event) => event.event_type),
    [
      "HandlerAssistDecisionRecorded",
      "CapabilityAvailable",
      "CapabilityResolved",
      "CapabilityInvocation",
      "Act",
      "Trace",
    ]
  );
  assert.equal(result.events[0].payload.rationale.decisive_assertion_refs.length, 1);
  assert.equal(result.events[2].payload.handler_instance_ref, "handler-instance:coding-sandbox-1");
  assert.equal(result.events[5].payload.execution_outcome, "success");
  assert.equal(result.events[5].payload.usefulness_resolution, null);
  assert.equal(Object.hasOwn(result.events[5].payload, "evidence_relation"), false);
});

test("E - legacy booleans preserve only the choice and invent no rationale or Assertion", () => {
  for (const wantsDelegate of [false, true]) {
    const decision = projectLegacyHandlerAssistDecision({
      decision_id: `decision:legacy:${wantsDelegate}`,
      wants_delegate: wantsDelegate,
      decided_at: fixedTime,
    });

    assert.equal(
      decision.selected_path,
      wantsDelegate ? "handler_assisted" : "local_only"
    );
    assert.equal(decision.rationale.kind, "legacy_boolean");
    assert.equal(decision.rationale.summary, null);
    assert.deepEqual(decision.rationale.decisive_assertion_refs, []);
  }
});
