import assert from "node:assert/strict";
import test from "node:test";
import {
  requiredCapabilityOf,
  satisfiesCapabilityRequirement,
} from "../cop/capabilityRequirement.js";

test("exact equality is the only satisfaction rule", () => {
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist.read" },
      { capability: "coding.assist.read" }
    ),
    true
  );
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist" },
      { capability: "coding.assist" }
    ),
    true
  );
});

test("coding.assist and coding.assist.read are distinct", () => {
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist" },
      { capability: "coding.assist.read" }
    ),
    false
  );
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist.read" },
      { capability: "coding.assist" }
    ),
    false
  );
});

test("prefix, suffix, and wildcard shapes fail closed", () => {
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist" },
      { capability: "coding.assist.write" }
    ),
    false
  );
  assert.equal(
    satisfiesCapabilityRequirement(
      { capability: "coding.assist.read" },
      { capability: "coding.assist.read.local" }
    ),
    false
  );
  assert.equal(
    satisfiesCapabilityRequirement({ capability: "coding.*" }, { capability: "coding.assist" }),
    false
  );
  assert.equal(
    satisfiesCapabilityRequirement({ capability: "*" }, { capability: "coding.assist.read" }),
    false
  );
});

test("missing or empty inputs fail closed", () => {
  assert.equal(satisfiesCapabilityRequirement(null, { capability: "coding.assist" }), false);
  assert.equal(satisfiesCapabilityRequirement({ capability: "coding.assist" }, null), false);
  assert.equal(
    satisfiesCapabilityRequirement({ capability: "" }, { capability: "coding.assist" }),
    false
  );
  assert.equal(
    satisfiesCapabilityRequirement({ capability: "coding.assist" }, { capability: "" }),
    false
  );
  assert.equal(satisfiesCapabilityRequirement({ capability: "coding.assist" }, {}), false);
  assert.equal(satisfiesCapabilityRequirement({}, { capability: "coding.assist" }), false);
  assert.equal(
    satisfiesCapabilityRequirement(["coding.assist"], { capability: "coding.assist" }),
    false
  );
});

test("requiredCapabilityOf reads the normalized decision field", () => {
  assert.equal(
    requiredCapabilityOf({ capability_requirement: { capability: "coding.assist.read" } }),
    "coding.assist.read"
  );
  assert.equal(requiredCapabilityOf({ capability_requirement: null }), null);
  assert.equal(requiredCapabilityOf({}), null);
});
