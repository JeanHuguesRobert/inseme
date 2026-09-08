import assert from "node:assert/strict";
import test from "node:test";
import { createFractalogActRecord } from "../../../../packages/cop-core/src/fractalog.js";
import { validateFractalogIngressRecord } from "./jhn-fractalog.js";

function record() {
  return createFractalogActRecord({
    record_id: "flr:ingress:1",
    act_id: "act:ingress:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    owner_instance_id: "00000000-0000-0000-0000-000000000001",
    time: { recorded_at: "2026-09-08T12:00:00.000Z" },
  });
}

test("FractaLog ingress accepts a structurally complete central document", () => {
  assert.equal(validateFractalogIngressRecord(record()), true);
});

test("FractaLog ingress requires the central owner UUID and intact document hash", () => {
  const withoutOwner = record();
  withoutOwner.owner_instance_id = null;
  const withoutHash = record();
  withoutHash.integrity.document_hash = "not-a-hash";
  assert.equal(validateFractalogIngressRecord(withoutOwner), false);
  assert.equal(validateFractalogIngressRecord(withoutHash), false);
});
