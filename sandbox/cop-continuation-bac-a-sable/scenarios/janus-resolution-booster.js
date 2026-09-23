#!/usr/bin/env node

/**
 * COP/Janus Resolution Booster
 *
 * Experimental scenario: use existing COP 2.x primitives only.
 *
 * Phase 1:
 *   decisive prospective Assertion
 *   + meta.janus ResolutionExpectation
 *   + COP Continuation parked until the horizon
 *
 * Optional Phase 2:
 *   JANUS_RESOLUTION=supports|contradicts|contextualizes
 *   creates an external TraceRef and an EvidenceRelation back to the
 *   original prospective Assertion.
 *
 * This scenario deliberately does NOT modify cop-core schemas.
 */

import {
  createAssertion,
  createExternalTraceRef,
  createEvidenceRelation,
} from "../../../packages/cop-core/src/trace.js";
import { createContinuationDescriptor } from "../../../packages/cop-kernel/src/continuation.js";

const now = new Date();
const horizon =
  process.env.JANUS_HORIZON ||
  new Date(now.getTime() + 5 * 60 * 1000).toISOString();

const assertion = createAssertion({
  assertion_id: process.env.JANUS_ASSERTION_ID || "ast:janus-booster-demo",
  claim: {
    kind: "prospective-continuation-claim",
    continuation_ref: "cp:janus-booster-demo/continuation:A",
    expected_outcome:
      "The selected continuation will produce the expected bounded outcome by the declared horizon.",
  },
  epistemic_status: "hypothesized",
  subject_ref: "cp:janus-booster-demo",
  asserted_by: "handler:janus-resolution-booster",
  asserted_at: now.toISOString(),
  meta: {
    janus: {
      decisive: true,
      recorded_at: now.toISOString(),
      revision_conditions: [
        "A qualified later trace materially contradicts the expected outcome.",
        "The expected outcome is not observable under the declared resolution criterion by horizon.",
      ],
      resolution_expectation: {
        criterion:
          "Resolve against a later trace that directly bears on whether the expected bounded outcome occurred.",
        horizon,
      },
    },
  },
});

const resolutionContinuation = createContinuationDescriptor({
  resumeTo: "handler:janus-resolution-review",
  resumeIntent: "resolve-decisive-prospective-assertion",
  state: {
    assertion_ref: assertion.assertion_id,
    resolution_expectation: assertion.meta.janus.resolution_expectation,
  },
  resumeAfter: horizon,
  waitForEvents: ["cop.trace.observed", "cop.assertion.evidence-added"],
  label: "COP/Janus resolution follow-up",
  meta: {
    janus: {
      role: "resolution-owner",
      assertion_ref: assertion.assertion_id,
      experiment: "cop-janus-booster",
    },
  },
});

const output = {
  phase: "prospective",
  assertion,
  resolution_continuation: resolutionContinuation,
};

const resolutionType = process.env.JANUS_RESOLUTION || null;

if (resolutionType) {
  const allowed = ["supports", "contradicts", "contextualizes"];
  if (!allowed.includes(resolutionType)) {
    throw new Error(
      `JANUS_RESOLUTION must be one of: ${allowed.join(", ")}`
    );
  }

  const observedAt = new Date().toISOString();
  const settlingTrace = createExternalTraceRef({
    trace_id:
      process.env.JANUS_TRACE_ID ||
      `urn:janus-booster:trace:${Date.now()}`,
    locator: process.env.JANUS_TRACE_LOCATOR || null,
    resolution_hints: {
      experiment: "cop-janus-booster",
      observed_at: observedAt,
    },
  });

  const evidenceRelation = createEvidenceRelation({
    relation_type: resolutionType,
    trace_ref: settlingTrace,
    assertion_id: assertion.assertion_id,
    strength: process.env.JANUS_STRENGTH || "plausible",
    justification: {
      resolution_criterion:
        assertion.meta.janus.resolution_expectation.criterion,
      note:
        process.env.JANUS_JUSTIFICATION ||
        "Demo qualification of a later trace against the prospective assertion.",
    },
    asserted_by: "handler:janus-resolution-review",
    recorded_at: observedAt,
    meta: {
      janus: {
        experiment: "cop-janus-booster",
        resolution_horizon: horizon,
        prospective_recorded_at: assertion.meta.janus.recorded_at,
      },
    },
  });

  output.phase = "retrospective-resolution";
  output.settling_trace = settlingTrace;
  output.evidence_relation = evidenceRelation;
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
