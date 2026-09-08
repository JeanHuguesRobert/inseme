import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createFractalogActRecord,
  fractalogRecordToCopEnvelope,
} from "../../../../packages/cop-core/src/fractalog.js";
import { createFractalogSqliteStore } from "../cop/fractalogSqliteStore.js";

function record(overrides = {}) {
  return createFractalogActRecord({
    record_id: "flr:sqlite:1",
    act_id: "act:sqlite:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    idempotency_key: "navigation:observation:1",
    time: { recorded_at: "2026-09-08T12:00:00.000Z" },
    ...overrides,
  });
}

test("FractaLog SQLite keeps immutable documents and a separate durable outbox", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const store = createFractalogSqliteStore(database);
    const first = record();
    assert.equal(store.append(first).duplicate, false);
    assert.equal(store.append(first).duplicate, true);
    assert.equal(store.pending().length, 1);
    const forwarded = await store.forward(first.record_id, async (document) => ({
      accepted: true,
      record_id: document.record_id,
      receipt_id: "receipt:central:1",
    }));
    assert.equal(forwarded.ok, true);
    assert.equal(store.outbox(first.record_id).state, "accepted");
    assert.equal(store.get(first.record_id).integrity.document_hash, first.integrity.document_hash);
  } finally {
    database.close();
  }
});

test("FractaLog SQLite leaves a failed forward pending for retry", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const store = createFractalogSqliteStore(database);
    const first = record({ record_id: "flr:sqlite:retry", idempotency_key: "navigation:retry:1" });
    store.append(first);
    const result = await store.forward(first.record_id, async () => {
      throw new Error("offline");
    });
    assert.deepEqual(result, { ok: false, error: "central_ingress_unreachable" });
    assert.equal(store.outbox(first.record_id).state, "pending");
    assert.equal(store.outbox(first.record_id).attempt_count, 1);
  } finally {
    database.close();
  }
});

test("Batch 0 reality test: records navigation observation & external observation, verifies outbox forward to COP persistence and receipt", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const store = createFractalogSqliteStore(database);

    // 1. Navigation Assistant observation (Batch 1 act kind)
    const navObservation = createFractalogActRecord({
      record_id: "flr:nav:observe:1",
      act_id: "act:nav:1",
      act_kind: "navigation.page.observe",
      act_phase: "observed",
      owner_instance_ref: "instance:jhn",
      owner_instance_id: "00000000-0000-0000-0000-000000000001",
      governed_chain: {
        principal_ref: "twin:jhn",
        logical_agent_ref: "agent:jhn",
        handler_instance_ref: "handler:browser@local",
        capability: "navigation.page.observe",
      },
      trace: {
        url: "https://lepp.fr",
        tab_id: 1,
        title: "LePP - Plateforme Citoyenne",
      },
      idempotency_key: "nav:observe:https://lepp.fr:20260908",
      time: { recorded_at: "2026-09-08T10:00:00.000Z" },
    });

    // 2. Existing observed external publication appearance (Batch 2 act kind, non-engaging observation)
    const fbObservation = createFractalogActRecord({
      record_id: "flr:pub:fb:observed:1",
      act_id: "act:pub:fb:1",
      act_kind: "publication.publish.observed",
      act_phase: "observed",
      owner_instance_ref: "instance:jhn",
      owner_instance_id: "00000000-0000-0000-0000-000000000001",
      on_behalf_of_instance_ref: "instance:pertitellu-corte",
      on_behalf_of_instance_id: "00000000-0000-0000-0000-000000000010",
      governed_chain: {
        principal_ref: "twin:jhn",
        logical_agent_ref: "agent:jhn",
        handler_instance_ref: "handler:facebook@observed",
        capability: "publication.publish.observed",
      },
      trace: {
        channel: "facebook",
        post_url: "https://www.facebook.com/groups/pertitellu/posts/123456789",
        observed_presence: true,
      },
      idempotency_key: "pub:fb:post:123456789:observed",
      time: { recorded_at: "2026-09-08T10:05:00.000Z" },
    });

    // Append both to local SQLite outbox
    const append1 = store.append(navObservation);
    const append2 = store.append(fbObservation);
    assert.equal(append1.duplicate, false);
    assert.equal(append2.duplicate, false);
    assert.equal(store.pending().length, 2);

    // Forward simulating central COP ingress
    const copEventStore = [];
    const centralIngress = async (doc) => {
      // Validate ingress document and wrap into COP envelope
      const envelope = fractalogRecordToCopEnvelope(doc);
      copEventStore.push(envelope);
      return {
        accepted: true,
        schema: "fractalog.ingress.receipt/v1",
        receipt_id: `fractalog:${doc.record_id}:${doc.integrity.document_hash}`,
        record_id: doc.record_id,
        document_hash: doc.integrity.document_hash,
        accepted_at: new Date().toISOString(),
      };
    };

    const f1 = await store.forward(navObservation.record_id, centralIngress);
    const f2 = await store.forward(fbObservation.record_id, centralIngress);

    assert.equal(f1.ok, true);
    assert.equal(f2.ok, true);
    assert.equal(store.pending().length, 0);
    assert.equal(copEventStore.length, 2);

    // Verify COP persistence integrity
    assert.equal(copEventStore[0].origin_ref, navObservation.record_id);
    assert.equal(copEventStore[0].meta.document_hash, navObservation.integrity.document_hash);
    assert.equal(copEventStore[1].origin_ref, fbObservation.record_id);
    assert.equal(
      copEventStore[1].meta.on_behalf_of_instance_id,
      "00000000-0000-0000-0000-000000000010"
    );

    // Verify idempotency on second forward
    const f1_dup = await store.forward(navObservation.record_id, centralIngress);
    assert.equal(f1_dup.ok, true);
    assert.equal(f1_dup.duplicate, true);
    assert.equal(copEventStore.length, 2); // No extra central write
  } finally {
    database.close();
  }
});
