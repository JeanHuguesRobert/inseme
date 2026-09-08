import assert from "node:assert/strict";
import test from "node:test";
import {
  createFractalogActRecord,
  fractalogProjection,
  validateFractalogActRecord,
} from "../src/fractalog.js";

function sample(overrides = {}) {
  return createFractalogActRecord({
    record_id: "flr:example:1",
    act_id: "act:example:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    governed_chain: { logical_agent_ref: "agent:jhn", capability: "navigation.page.observe" },
    trace: { source: "browser" },
    unknown_future_field: { retained: true },
    time: { recorded_at: "2026-09-08T10:00:00.000Z" },
    ...overrides,
  });
}

test("FractaLog retains unknown document fields and derives projections", () => {
  const record = sample({
    owner_instance_id: "00000000-0000-0000-0000-000000000001",
    on_behalf_of_instance_ref: "instance:pertitellu-corte",
    on_behalf_of_instance_id: "00000000-0000-0000-0000-000000000010",
  });
  assert.equal(validateFractalogActRecord(record).ok, true);
  assert.equal(record.unknown_future_field.retained, true);
  assert.deepEqual(fractalogProjection(record), {
    record_id: "flr:example:1",
    document_schema: "fractalog.act-record/v1",
    document_hash: record.integrity.document_hash,
    act_id: "act:example:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    on_behalf_of_instance_ref: "instance:pertitellu-corte",
    owner_instance_id: "00000000-0000-0000-0000-000000000001",
    on_behalf_of_instance_id: "00000000-0000-0000-0000-000000000010",
    recorded_at: "2026-09-08T10:00:00.000Z",
    idempotency_key: null,
    correlation_id: null,
    visibility: "restricted",
  });
});

test("FractaLog detects a changed canonical document", () => {
  const record = sample();
  record.effect = { destination: "changed after append" };
  assert.deepEqual(validateFractalogActRecord(record), {
    ok: false,
    errors: ["integrity.document_hash_mismatch"],
  });
});

test("FractaLog limits records to named semantic Act phases", () => {
  assert.throws(() => sample({ act_phase: "maybe" }), /act_phase/);
});
