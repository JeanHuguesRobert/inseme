import assert from "node:assert/strict";
import test from "node:test";
import { decideJhnHandlerAssist } from "../cop/jhnHandlerAssistDecider.js";

test("D - an explicit review/inspection request uses coding.assist.read", () => {
  const decision = decideJhnHandlerAssist({
    message: "Review this repository code and explain the bug without changing files.",
  });
  assert.equal(decision.selected_path, "handler_assisted");
  assert.equal(decision.capability_requirement.capability, "coding.assist.read");
  assert.match(decision.rationale.summary, /inspection|review/i);
  assert.equal(decision.rationale.summary.includes("coding.assist.read"), true);
});

test("E - an implementation/commit request is not silently mapped to coding.assist.read", () => {
  const decision = decideJhnHandlerAssist({
    message: "Implement this change and commit it.",
  });
  assert.equal(decision.selected_path, "handler_assisted");
  assert.equal(decision.capability_requirement.capability, "coding.assist");
  assert.notEqual(decision.capability_requirement.capability, "coding.assist.read");
});

test("mutating language wins over review language", () => {
  const decision = decideJhnHandlerAssist({
    message: "Review this repository then implement the patch and commit it.",
  });
  assert.equal(decision.selected_path, "handler_assisted");
  assert.equal(decision.capability_requirement.capability, "coding.assist");
});

test("non-coding conversation stays local_only", () => {
  const decision = decideJhnHandlerAssist({ message: "Bonjour John" });
  assert.equal(decision.selected_path, "local_only");
  assert.equal(decision.capability_requirement, null);
});

test("existing operational mutation examples keep coding.assist", () => {
  for (const message of [
    "Please fix this repository bug",
    "Please implement this repository change",
  ]) {
    const decision = decideJhnHandlerAssist({ message });
    assert.equal(decision.selected_path, "handler_assisted");
    assert.equal(decision.capability_requirement.capability, "coding.assist");
  }
});

test("does not invent coding.assist.write", () => {
  const decision = decideJhnHandlerAssist({
    message: "Implement this change and commit it.",
  });
  assert.notEqual(decision.capability_requirement.capability, "coding.assist.write");
});
