import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scenarioPath = join(testDirectory, "..", "scenarios", "janus-resolution-booster.js");

function runScenario(resolution) {
  const env = { ...process.env };
  if (resolution) env.JANUS_RESOLUTION = resolution;
  else delete env.JANUS_RESOLUTION;

  const run = spawnSync(process.execPath, [scenarioPath], {
    encoding: "utf8",
    env,
  });

  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

function assertProspectivePhase(output) {
  const { assertion, resolution_continuation: continuation } = output;
  const janus = assertion.meta.janus;

  assert.equal(assertion.schema, "cop.assertion/v1");
  assert.equal(janus.decisive, true);
  assert.ok(janus.recorded_at);
  assert.ok(janus.revision_conditions.length > 0);
  assert.ok(janus.resolution_expectation.criterion);
  assert.ok(janus.resolution_expectation.horizon);

  assert.equal(continuation.type, "cop/continuation");
  assert.equal(continuation.conditions.resumeAfter, janus.resolution_expectation.horizon);
  assert.equal(continuation.state.assertion_ref, assertion.assertion_id);
  assert.equal(continuation.meta.janus.assertion_ref, assertion.assertion_id);
}

test("COP/Janus Booster preserves prospective and retrospective evidence semantics", () => {
  const prospective = runScenario();
  assert.equal(prospective.phase, "prospective");
  assertProspectivePhase(prospective);
  assert.equal(Object.hasOwn(prospective, "settling_trace"), false);
  assert.equal(Object.hasOwn(prospective, "evidence_relation"), false);

  for (const relationType of ["supports", "contradicts"]) {
    const resolved = runScenario(relationType);
    assert.equal(resolved.phase, "retrospective-resolution");
    assertProspectivePhase(resolved);

    const prospectiveRecordedAt = resolved.assertion.meta.janus.recorded_at;
    const observedAt = resolved.settling_trace.resolution_hints.observed_at;
    const relation = resolved.evidence_relation;

    assert.equal(resolved.settling_trace.schema, "cop.trace-ref/v1");
    assert.equal(relation.schema, "cop.evidence-relation/v1");
    assert.equal(relation.relation_type, relationType);
    assert.equal(relation.assertion_id, resolved.assertion.assertion_id);
    assert.deepEqual(relation.trace_ref, resolved.settling_trace);
    assert.equal(relation.recorded_at, observedAt);
    assert.equal(relation.meta.janus.prospective_recorded_at, prospectiveRecordedAt);
    assert.ok(
      Date.parse(prospectiveRecordedAt) < Date.parse(observedAt),
      "the prospective assertion must be recorded before the resolving trace is observed"
    );
    assert.equal(Object.hasOwn(relation, "result"), false);
  }
});
