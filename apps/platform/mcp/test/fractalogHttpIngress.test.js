import assert from "node:assert/strict";
import test from "node:test";
import { createFractalogActRecord } from "../../../../packages/cop-core/src/fractalog.js";
import { createFractalogHttpIngress } from "../cop/fractalogHttpIngress.js";

function record() {
  return createFractalogActRecord({
    record_id: "flr:http:1",
    act_id: "act:http:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    owner_instance_id: "00000000-0000-0000-0000-000000000001",
    time: { recorded_at: "2026-09-08T12:00:00.000Z" },
  });
}

test("FractaLog HTTP ingress sends the dedicated capability and accepts a matching receipt", async () => {
  const expected = record();
  let request;
  const ingress = createFractalogHttpIngress({
    url: "https://jhn.example/api/jhn-fractalog",
    capability: "test-capability",
    fetchImpl: async (...args) => {
      request = args;
      return new Response(
        JSON.stringify({
          accepted: true,
          record_id: expected.record_id,
          document_hash: expected.integrity.document_hash,
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    },
  });
  const receipt = await ingress(expected);
  assert.equal(receipt.accepted, true);
  assert.equal(request[1].headers.authorization, "Bearer test-capability");
  assert.deepEqual(JSON.parse(request[1].body), expected);
});

test("FractaLog HTTP ingress rejects a receipt for a different document", async () => {
  const expected = record();
  const ingress = createFractalogHttpIngress({
    url: "https://jhn.example/api/jhn-fractalog",
    capability: "test-capability",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          accepted: true,
          record_id: "flr:other",
          document_hash: expected.integrity.document_hash,
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      ),
  });
  assert.deepEqual(await ingress(expected), {
    accepted: false,
    status: 201,
    error: "fractalog_receipt_mismatch",
  });
});
