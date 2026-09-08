import { describe, it, expect } from "vitest";
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

describe("FractaLog", () => {
  it("retains unknown document fields and derives projections", () => {
    const record = sample({
      owner_instance_id: "00000000-0000-0000-0000-000000000001",
      on_behalf_of_instance_ref: "instance:pertitellu-corte",
      on_behalf_of_instance_id: "00000000-0000-0000-0000-000000000010",
    });
    expect(validateFractalogActRecord(record).ok).toBe(true);
    expect(record.unknown_future_field.retained).toBe(true);
    expect(fractalogProjection(record)).toEqual({
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

  it("detects a changed canonical document", () => {
    const record = sample();
    record.effect = { destination: "changed after append" };
    expect(validateFractalogActRecord(record)).toEqual({
      ok: false,
      errors: ["integrity.document_hash_mismatch"],
    });
  });

  it("limits records to named semantic Act phases", () => {
    expect(() => sample({ act_phase: "maybe" })).toThrow(/act_phase/);
  });
});
