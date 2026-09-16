/**
 * Packet-Backed Projection conformance tests for Interaction Cases (Inseme #77).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import {
  PACKET_DELETE,
  PROJECTION_VERSION,
  applyProjectedUpdate,
  exportPacket,
  hashPacket,
  importPacket,
  inflate,
  mergePreservingUnknown,
  parsePacketYaml,
  project,
} from "../src/projections/interactionCase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures", "interaction-packets");

function loadFixture(name) {
  const filePath = path.join(FIXTURES, name);
  const yamlText = fs.readFileSync(filePath, "utf8");
  return { yamlText, packet: parsePacketYaml(yamlText), filePath };
}

describe("interactionCase Packet-Backed Projection (#77)", () => {
  test("imports real Git/YAML packets with heterogeneous shapes", () => {
    const rich = loadFixture("2026-08-08-la-gaude-old-at0045.yaml");
    const simple = loadFixture("2026-05-04-session_marenostrum.yaml");
    const mid = loadFixture("2026-07-21-relance_gelenbe_cpn.yaml");

    const richRow = importPacket(rich.yamlText, {
      repository: "JeanHuguesRobert/JeanHuguesRobert",
      path: "interaction_packets/packets/2026/2026-08-08-la-gaude-old-at0045.yaml",
      gitRef: "main",
    });
    const simpleRow = importPacket(simple.packet, {
      repository: "JeanHuguesRobert/JeanHuguesRobert",
      path: "interaction_packets/packets/2026/2026-05-04-session_marenostrum.yaml",
    });
    const midRow = importPacket(mid.packet);

    assert.equal(richRow.packet_id, "2026-08-08-001");
    assert.equal(richRow.status, "active");
    assert.equal(richRow.disclosure, "D2");
    assert.match(richRow.subject, /OLD/);
    assert.match(richRow.primary_channel, /email/);
    assert.match(richRow.counterparty_label, /La Gaude/);
    assert.equal(richRow.created_at, "2026-08-08");
    assert.equal(richRow.last_updated_at, "2026-08-11");
    assert.equal(richRow.next_followup_at, null); // not auto-derived from next_watch
    assert.equal(richRow.channel_kind, "email");
    assert.ok(richRow.next_watch_count > 0);
    assert.ok(richRow.status_label); // from current_status.label when no statut
    assert.equal(richRow.projection_version, PROJECTION_VERSION);
    assert.equal(richRow.packet.historical_context.length, 3);
    assert.equal(richRow.source_ref.repository, "JeanHuguesRobert/JeanHuguesRobert");
    assert.ok(richRow.source_ref.content_hash.startsWith("sha256:"));

    // Older shape: French narrative statut, no machine status/created
    assert.equal(simpleRow.packet_id, "2026-05-04-001");
    assert.equal(simpleRow.status, null);
    assert.equal(simpleRow.status_label, "réponse reçue : négative");
    assert.equal(simpleRow.status_display, "réponse reçue : négative");
    assert.equal(simpleRow.created_at, "2026-05-04"); // date_envoi fallback
    assert.equal(simpleRow.channel_kind, "email");
    assert.equal(simpleRow.disclosure, "D3");
    assert.match(simpleRow.subject, /MareNostrum/);
    assert.equal(simpleRow.packet.statut, "réponse reçue : négative");
    assert.ok(
      simpleRow.ambiguities.some((a) => a.field === "status"),
      "must report ambiguous status/statut mapping"
    );

    assert.equal(midRow.packet_id, "2026-07-21-002");
    assert.equal(midRow.status, "active");
    assert.equal(midRow.disclosure, "D3");
    assert.ok(midRow.packet.methodological_note);
  });

  test("Pattern conformance: project → modify → inflate → merge → project", () => {
    const { packet: P0 } = loadFixture("2026-08-08-la-gaude-old-at0045.yaml");
    P0.future_extension = {
      deliberately_unknown_to_projection: true,
      nested: { value: "must survive" },
    };

    const C0 = project(P0);
    const C1 = { ...C0, status: "waiting_reply" };
    const { partial: deltaP } = inflate(
      { status: "waiting_reply" },
      { fieldBindings: C0.field_bindings }
    );
    const P1 = mergePreservingUnknown(P0, deltaP);
    const C1b = project(P1);

    assert.equal(C1b.status, "waiting_reply");
    assert.equal(C1b.status, C1.status);
    assert.deepEqual(
      P1.future_extension,
      P0.future_extension,
      "unknown(P0) must equal unknown(P1)"
    );
    assert.deepEqual(P1.timeline, P0.timeline);
    assert.deepEqual(P1.historical_context, P0.historical_context);
    assert.deepEqual(P1.next_watch, P0.next_watch);
    assert.equal(P1.methodological_note.ai_assistance, true);
  });

  test("unknown-field preservation across SQL-like projected write", () => {
    const synthetic = {
      id: "2026-09-16-synthetic-001",
      type: "interaction_packet",
      status: "active",
      disclosure: "D3",
      sujet: "Synthetic Reality Test",
      canal: "email",
      interlocuteur: "Fixture Counterparty",
      created: "2026-09-16",
      last_updated: "2026-09-16",
      timeline: [{ date: "2026-09-16", event: "created" }],
      future_extension: {
        deliberately_unknown_to_projection: true,
        nested: { value: "must survive" },
      },
    };

    const row0 = importPacket(synthetic, {
      repository: "local/fixture",
      path: "synthetic.yaml",
    });
    const result = applyProjectedUpdate(
      row0,
      { status: "closed" },
      { expectedRevision: 1, changedBy: "agent:test" }
    );

    assert.equal(result.ok, true);
    assert.equal(result.row.status, "closed");
    assert.equal(result.row.revision, 2);
    assert.deepEqual(result.row.packet.future_extension, synthetic.future_extension);
    assert.deepEqual(result.row.packet.timeline, synthetic.timeline);

    const exported = exportPacket(result.row);
    assert.equal(exported.status, "closed");
    assert.deepEqual(exported.future_extension, synthetic.future_extension);
    assert.notEqual(
      JSON.stringify(exported),
      JSON.stringify(synthetic),
      "semantic export may differ from original object after update"
    );
  });

  test("NULL != absent != explicit delete", () => {
    const packet = {
      id: "null-absent-delete-001",
      status: "active",
      disclosure: "D3",
      sujet: "Keep me",
      canal: "email",
      interlocuteur: "Someone",
      next_followup_at: "2026-10-01",
      mystery_field: { keep: true },
    };

    // absent: omit key from changed columns → no Packet change
    const absentInflate = inflate({ status: "active" }, { fieldBindings: { subject: "sujet" } });
    assert.equal(Object.prototype.hasOwnProperty.call(absentInflate.partial, "sujet"), false);
    const afterAbsent = mergePreservingUnknown(packet, absentInflate.partial);
    assert.equal(afterAbsent.sujet, "Keep me");
    assert.equal(afterAbsent.next_followup_at, "2026-10-01");

    // SQL NULL: inflate null → merge preserves existing Packet property
    const nullInflate = inflate({ next_followup_at: null });
    assert.equal(nullInflate.partial.next_followup_at, null);
    assert.ok(nullInflate.meta.null_fields.includes("next_followup_at"));
    const afterNull = mergePreservingUnknown(packet, nullInflate.partial);
    assert.equal(
      afterNull.next_followup_at,
      "2026-10-01",
      "SQL NULL must not erase Packet property by default"
    );

    // explicit delete
    const deleteInflate = inflate({ next_followup_at: PACKET_DELETE });
    assert.equal(isDelete(deleteInflate.partial.next_followup_at), true);
    const afterDelete = mergePreservingUnknown(packet, deleteInflate.partial);
    assert.equal(Object.prototype.hasOwnProperty.call(afterDelete, "next_followup_at"), false);
    assert.deepEqual(afterDelete.mystery_field, { keep: true });

    // optional write_null policy
    const writeNull = mergePreservingUnknown(
      packet,
      { next_followup_at: null },
      { nullPolicy: "write_null" }
    );
    assert.equal(writeNull.next_followup_at, null);
  });

  test("optimistic revision rejects stale writes", () => {
    const row = importPacket({
      id: "rev-001",
      status: "active",
      disclosure: "D1",
      sujet: "Revision test",
      canal: "github",
      interlocuteur: "bot",
    });
    assert.equal(row.revision, 1);

    const stale = applyProjectedUpdate(row, { status: "closed" }, { expectedRevision: 0 });
    assert.equal(stale.ok, false);
    assert.equal(stale.reason, "revision_mismatch");
    assert.equal(stale.row.status, "active");

    const ok = applyProjectedUpdate(row, { status: "closed" }, { expectedRevision: 1 });
    assert.equal(ok.ok, true);
    assert.equal(ok.row.revision, 2);
    assert.equal(ok.revisionEntry.previous_revision, 1);
    assert.equal(ok.revisionEntry.case_id, "rev-001");
  });

  test("row-local history for case A does not require case B", () => {
    const rowA = importPacket({
      id: "case-A",
      status: "active",
      disclosure: "D3",
      sujet: "A",
      canal: "email",
      interlocuteur: "A-party",
    });
    const rowB = importPacket({
      id: "case-B",
      status: "active",
      disclosure: "D3",
      sujet: "B",
      canal: "email",
      interlocuteur: "B-party",
    });

    const histories = { A: [], B: [] };
    const actRef = "act:shared-batch-1";

    const a1 = applyProjectedUpdate(
      rowA,
      { status: "waiting" },
      { expectedRevision: 1, actRef, changedBy: "agent:test" }
    );
    histories.A.push(a1.revisionEntry);

    const b1 = applyProjectedUpdate(
      rowB,
      { status: "closed" },
      { expectedRevision: 1, actRef, changedBy: "agent:test" }
    );
    histories.B.push(b1.revisionEntry);

    assert.equal(histories.A.length, 1);
    assert.equal(histories.A[0].case_id, "case-A");
    assert.equal(histories.B[0].case_id, "case-B");
    assert.equal(histories.A[0].act_ref, actRef);
    assert.equal(histories.B[0].act_ref, actRef);
    // Reconstruct A without reading B
    assert.equal(histories.A[0].patch.columns.status, "waiting");
    assert.notEqual(histories.A[0].case_id, histories.B[0].case_id);
  });

  test("write-back uses sujet binding instead of inventing subject", () => {
    const { packet } = loadFixture("2026-08-08-la-gaude-old-at0045.yaml");
    const row = project(packet);
    assert.equal(row.field_bindings.subject, "sujet");

    const updated = applyProjectedUpdate(
      row,
      { subject: "Updated subject line" },
      { expectedRevision: 1 }
    );
    assert.equal(updated.ok, true);
    assert.equal(updated.row.packet.sujet, "Updated subject line");
    assert.equal(
      Object.prototype.hasOwnProperty.call(updated.row.packet, "subject"),
      false,
      "must not invent parallel English subject key when sujet was the source"
    );
  });

  test("export is semantic Packet, not original YAML bytes", () => {
    const { yamlText, packet } = loadFixture("2026-07-21-relance_gelenbe_cpn.yaml");
    const row = importPacket(yamlText, {
      repository: "JeanHuguesRobert/JeanHuguesRobert",
      path: "interaction_packets/packets/2026/2026-07-21-relance_gelenbe_cpn.yaml",
    });
    const exported = exportPacket(row);
    assert.equal(exported.id, packet.id);
    assert.equal(exported.disclosure, packet.disclosure);
    assert.notEqual(JSON.stringify(exported), yamlText);
    assert.equal(hashPacket(exported), row.packet_hash);
  });
});

function isDelete(value) {
  return value && value.__packet_delete__ === true;
}
