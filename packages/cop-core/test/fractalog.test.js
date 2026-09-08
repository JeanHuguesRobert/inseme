import { describe, it, expect } from "vitest";
import {
  createFractalogActRecord,
  fractalogProjection,
  validateFractalogActRecord,
  fractalogRecordToCopEnvelope,
  copEnvelopeToFractalogRecord,
  createFractalogRecordsFromGovernedAct,
  FRACTALOG_ACT_RECORD_SCHEMA,
} from "../src/fractalog.js";
import { recordGovernedAct } from "../src/governed-act.js";
import { createCopEventPersistPipeline } from "../src/cop-event-persist.js";
import { validateCopEventEnvelope } from "../src/cop-event-envelope.js";

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

function createMemoryStore() {
  const events = [];
  const byIdempotency = new Map();
  return {
    events,
    append(envelope) {
      if (envelope.idempotency_key && byIdempotency.has(envelope.idempotency_key)) {
        return { ok: true, duplicate: true, event: byIdempotency.get(envelope.idempotency_key) };
      }
      events.push(envelope);
      if (envelope.idempotency_key) byIdempotency.set(envelope.idempotency_key, envelope);
      return { ok: true, duplicate: false, event: envelope };
    },
  };
}

function createFailingStore() {
  return {
    append() {
      return { ok: false, error: "database_offline" };
    },
  };
}

function createMemorySpool() {
  const queue = [];
  return {
    queue,
    enqueue(envelope) {
      queue.push(envelope);
      return { ok: true, item: envelope };
    },
  };
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

  it("converts a FractaLog document into a valid cop.event/v1 envelope and extracts it back", () => {
    const record = sample({
      idempotency_key: "k:fractalog:1",
      correlation_id: "corr:test:1",
      owner_instance_id: "00000000-0000-0000-0000-000000000001",
    });
    const envelope = fractalogRecordToCopEnvelope(record);

    expect(envelope.schema).toBe("cop.event/v1");
    expect(envelope.event_type).toBe(FRACTALOG_ACT_RECORD_SCHEMA);
    expect(envelope.topic.id).toBe("act:example:1");
    expect(envelope.epistemic_status).toBe("observed");
    expect(envelope.origin_ref).toBe("flr:example:1");
    expect(envelope.actor_ref).toBe("agent:jhn");
    expect(envelope.correlation_id).toBe("corr:test:1");
    expect(envelope.idempotency_key).toBe("k:fractalog:1");
    expect(envelope.payload_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(envelope.meta.document_hash).toBe(record.integrity.document_hash);
    expect(validateCopEventEnvelope(envelope).ok).toBe(true);

    const roundTrip = copEnvelopeToFractalogRecord(envelope);
    expect(roundTrip).toEqual(record);
  });

  it("derives versioned FractaLog Act documents from a governed act chain", () => {
    const store = createMemoryStore();
    const governedResult = recordGovernedAct(store, {
      principal_ref: "twin:jhn",
      mandate_ref: "mandate:MND-JHN-001@v1",
      logical_agent_ref: "agent:jhn",
      handler_instance_ref: "handler:browser@local",
      capability: "navigation.page.observe",
      invocation_input: { url: "https://lepp.fr" },
      effect: { title: "LePP Preview", status: 200 },
      outcome: "ok",
    });

    expect(governedResult.ok).toBe(true);

    const derived = createFractalogRecordsFromGovernedAct(governedResult, {
      owner_instance_id: "00000000-0000-0000-0000-000000000001",
      on_behalf_of_instance_id: "00000000-0000-0000-0000-000000000010",
      on_behalf_of_instance_ref: "instance:pertitellu-corte",
    });

    expect(derived.records.length).toBe(3);

    // Attempt
    expect(derived.attempt.act_phase).toBe("attempt");
    expect(derived.attempt.governed_chain.capability).toBe("navigation.page.observe");
    expect(derived.attempt.owner_instance_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(derived.attempt.on_behalf_of_instance_id).toBe("00000000-0000-0000-0000-000000000010");
    expect(validateFractalogActRecord(derived.attempt).ok).toBe(true);

    // Decided (committed)
    expect(derived.decided.act_phase).toBe("committed");
    expect(derived.decided.links).toEqual([{ ref: derived.attempt.record_id, rel: "attempt" }]);
    expect(validateFractalogActRecord(derived.decided).ok).toBe(true);

    // Observed
    expect(derived.observed.act_phase).toBe("observed");
    expect(derived.observed.effect).toEqual({ title: "LePP Preview", status: 200 });
    expect(derived.observed.links).toEqual([{ ref: derived.decided.record_id, rel: "committed" }]);
    expect(validateFractalogActRecord(derived.observed).ok).toBe(true);
  });

  it("persists a FractaLog record through createCopEventPersistPipeline with spool fallback", async () => {
    const store = createMemoryStore();
    const spool = createMemorySpool();
    const pipeline = createCopEventPersistPipeline({ store, spool });

    const record = sample({
      record_id: "flr:pipeline:1",
      act_id: "act:pipeline:1",
      idempotency_key: "pipeline:fractalog:1",
    });

    // 1. Success path
    const res1 = await pipeline.persistFractalogRecord({ record });
    expect(res1.ok).toBe(true);
    expect(res1.duplicate).toBe(false);
    expect(res1.event.payload_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(res1.event.meta.document_hash).toBe(record.integrity.document_hash);
    expect(store.events.length).toBe(1);

    // 2. Duplicate idempotent append
    const res2 = await pipeline.persistFractalogRecord({ record });
    expect(res2.ok).toBe(true);
    expect(res2.duplicate).toBe(true);
    expect(store.events.length).toBe(1);

    // 3. Degraded offline spool path
    const failingPipeline = createCopEventPersistPipeline({
      store: createFailingStore(),
      spool,
    });
    const recordFail = sample({
      record_id: "flr:pipeline:fail",
      act_id: "act:pipeline:fail",
      idempotency_key: "pipeline:fractalog:fail",
    });
    const resFail = await failingPipeline.persistFractalogRecord({ record: recordFail });
    expect(resFail.ok).toBe(false);
    expect(resFail.spooled).toBe(true);
    expect(spool.queue.length).toBe(1);
    expect(spool.queue[0].payload_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(spool.queue[0].meta.document_hash).toBe(recordFail.integrity.document_hash);
  });
});
