import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const brief = readFileSync("docs/issue121-portable-handler-resume.md", "utf8");
test("cold Compute handler can load canonical resume brief from repository checkout", () => {
  assert.match(brief, /https:\/\/github\.com\/JeanHuguesRobert\/inseme\/issues\/121/);
  assert.match(brief, /portable-agent-guidance-and-classification\.md/);
  assert.match(brief, /capability_truth/);
  assert.match(brief, /changed_artifact_or_explicit_no_effect/);
  assert.match(brief, /no_mandate_widening/);
});
test("read-only Compute profile does not claim provider-side effect enforcement", () => {
  assert.match(brief, /node-test profile is read-only/);
  assert.match(brief, /advisory preflight/);
});
test("source brief retains F4.5 and recovery evidence pointers", () => {
  assert.match(brief, /F4\.5: local reference gateway tests/);
  assert.match(brief, /6077504144/);
  assert.match(brief, /optimistic_refresh_and_reconcile/);
});
