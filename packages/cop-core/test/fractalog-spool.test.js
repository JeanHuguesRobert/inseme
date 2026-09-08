import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  inspectFractalogSpool,
  drainFractalogSpool,
  formatSpoolInspectionReport,
  formatSpoolDrainReport,
  formatDuration,
} from "../src/fractalog-spool.js";
import { createFractalogActRecord, fractalogRecordToCopEnvelope } from "../src/fractalog.js";
import { createCopEventPersistPipeline } from "../src/cop-event-persist.js";

const CLI = path.resolve(__dirname, "../bin/fractalog-spool.js");

function sampleRecord(overrides = {}) {
  return createFractalogActRecord({
    record_id: "flr:test:1",
    act_id: "act:test:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    governed_chain: { logical_agent_ref: "agent:jhn", capability: "navigation.page.observe" },
    trace: { source: "test" },
    time: { recorded_at: "2026-09-08T10:00:00.000Z" },
    ...overrides,
  });
}

function createMockIngressStore() {
  const events = [];
  const byIdempotency = new Map();
  return {
    events,
    byIdempotency,
    async append(envelope) {
      if (envelope.idempotency_key && byIdempotency.has(envelope.idempotency_key)) {
        return {
          ok: true,
          duplicate: true,
          event: byIdempotency.get(envelope.idempotency_key),
        };
      }
      events.push(envelope);
      if (envelope.idempotency_key) {
        byIdempotency.set(envelope.idempotency_key, envelope);
      }
      return { ok: true, duplicate: false, event: envelope };
    },
  };
}

describe("FractaLog Spool Monitor and Drainer", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fractalog-spool-test-"));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("formatDuration helper", () => {
    it("formats durations accurately", () => {
      expect(formatDuration(500)).toBe("0s");
      expect(formatDuration(15000)).toBe("15s");
      expect(formatDuration(135000)).toBe("2m 15s");
      expect(formatDuration(7320000)).toBe("2h 2m");
      expect(formatDuration(90000000)).toBe("1d 1h");
    });
  });

  describe("inspectFractalogSpool", () => {
    it("returns an empty report when spool target does not exist", () => {
      const nonExistent = path.join(tmpDir, "missing-dir");
      const report = inspectFractalogSpool(nonExistent);

      expect(report.exists).toBe(false);
      expect(report.total_records).toBe(0);
      expect(report.valid_count).toBe(0);
      expect(report.corrupted_count).toBe(0);
      expect(report.oldest_record).toBeNull();
    });

    it("audits a spool directory containing JSON records and NDJSON streams", () => {
      const r1 = sampleRecord({
        record_id: "flr:1",
        act_phase: "attempt",
        time: { recorded_at: "2026-09-08T09:00:00.000Z" },
      });
      const r2 = sampleRecord({
        record_id: "flr:2",
        act_phase: "committed",
        time: { recorded_at: "2026-09-08T09:30:00.000Z" },
      });
      const r3 = sampleRecord({
        record_id: "flr:3",
        act_phase: "observed",
        time: { recorded_at: "2026-09-08T10:00:00.000Z" },
      });

      // Write r1 as standalone .json
      fs.writeFileSync(path.join(tmpDir, "rec1.json"), JSON.stringify(r1, null, 2), "utf8");

      // Write r2 and r3 in an .ndjson stream
      const env2 = fractalogRecordToCopEnvelope(r2);
      const env3 = fractalogRecordToCopEnvelope(r3);
      fs.writeFileSync(
        path.join(tmpDir, "spool.ndjson"),
        `${JSON.stringify(env2)}\n${JSON.stringify(env3)}\n`,
        "utf8"
      );

      const inspection = inspectFractalogSpool(tmpDir, {
        now: new Date("2026-09-08T11:00:00.000Z"),
      });

      expect(inspection.exists).toBe(true);
      expect(inspection.total_files).toBe(2);
      expect(inspection.total_records).toBe(3);
      expect(inspection.valid_count).toBe(3);
      expect(inspection.corrupted_count).toBe(0);

      expect(inspection.oldest_record.record_id).toBe("flr:1");
      expect(inspection.oldest_record.age_human).toBe("2h 0m");
      expect(inspection.newest_record.record_id).toBe("flr:3");
      expect(inspection.newest_record.age_human).toBe("1h 0m");

      expect(inspection.phase_counts.attempt).toBe(1);
      expect(inspection.phase_counts.committed).toBe(1);
      expect(inspection.phase_counts.observed).toBe(1);
    });

    it("detects syntax corruption and document hash tampering", () => {
      // 1. Broken JSON syntax
      fs.writeFileSync(path.join(tmpDir, "broken.ndjson"), "{ bad json\n", "utf8");

      // 2. Hash mismatch
      const rGood = sampleRecord({ record_id: "flr:tampered" });
      const rTampered = {
        ...rGood,
        act_kind: "unauthorized.mutation",
        // document_hash is now invalid because act_kind changed!
      };
      fs.writeFileSync(path.join(tmpDir, "tampered.json"), JSON.stringify(rTampered), "utf8");

      const inspection = inspectFractalogSpool(tmpDir);

      expect(inspection.total_records).toBe(2);
      expect(inspection.valid_count).toBe(0);
      expect(inspection.corrupted_count).toBe(2);
      expect(inspection.corrupted[0].errors[0]).toContain("json_syntax_error");
      expect(inspection.corrupted[1].errors[0]).toContain("integrity.document_hash_mismatch");
    });
  });

  describe("drainFractalogSpool", () => {
    it("simulates forward in dry-run mode without modifying spool files", async () => {
      const r = sampleRecord({ record_id: "flr:dry" });
      const filePath = path.join(tmpDir, "dry.json");
      fs.writeFileSync(filePath, JSON.stringify(r), "utf8");

      const store = createMockIngressStore();
      const drain = await drainFractalogSpool(tmpDir, store, { dryRun: true });

      expect(drain.ok).toBe(true);
      expect(drain.dry_run).toBe(true);
      expect(drain.forwarded).toBe(1);
      expect(store.events.length).toBe(0); // Store was NOT touched
      expect(fs.existsSync(filePath)).toBe(true); // File was NOT deleted
    });

    it("drains valid spooled records into store and unlinks transferred files", async () => {
      const r1 = sampleRecord({ record_id: "flr:drain-1", act_phase: "attempt" });
      const r2 = sampleRecord({ record_id: "flr:drain-2", act_phase: "committed" });

      const file1 = path.join(tmpDir, "r1.json");
      const file2 = path.join(tmpDir, "r2.ndjson");
      fs.writeFileSync(file1, JSON.stringify(r1), "utf8");
      fs.writeFileSync(file2, `${JSON.stringify(r2)}\n`, "utf8");

      const store = createMockIngressStore();
      const drain = await drainFractalogSpool(tmpDir, store);

      expect(drain.ok).toBe(true);
      expect(drain.forwarded).toBe(2);
      expect(drain.failed).toBe(0);
      expect(drain.remaining).toBe(0);
      expect(store.events.length).toBe(2);

      // Files should be purged
      expect(fs.existsSync(file1)).toBe(false);
      expect(fs.existsSync(file2)).toBe(false);
    });

    it("handles batch size limits by rewriting NDJSON stream with remaining records", async () => {
      const r1 = sampleRecord({ record_id: "flr:batch-1" });
      const r2 = sampleRecord({ record_id: "flr:batch-2" });
      const r3 = sampleRecord({ record_id: "flr:batch-3" });

      const ndjsonPath = path.join(tmpDir, "stream.ndjson");
      fs.writeFileSync(
        ndjsonPath,
        `${JSON.stringify(r1)}\n${JSON.stringify(r2)}\n${JSON.stringify(r3)}\n`,
        "utf8"
      );

      const store = createMockIngressStore();

      // Drain batch of 1
      const drain1 = await drainFractalogSpool(tmpDir, store, { batchSize: 1 });
      expect(drain1.ok).toBe(true);
      expect(drain1.forwarded).toBe(1);
      expect(drain1.remaining).toBe(2);
      expect(store.events.length).toBe(1);
      expect(fs.existsSync(ndjsonPath)).toBe(true);

      // Verify file now only has r2 and r3
      const remainingInspection = inspectFractalogSpool(tmpDir);
      expect(remainingInspection.valid_count).toBe(2);
      expect(remainingInspection.records.map((r) => r.record_id)).toEqual([
        "flr:batch-2",
        "flr:batch-3",
      ]);

      // Drain remaining
      const drain2 = await drainFractalogSpool(tmpDir, store);
      expect(drain2.ok).toBe(true);
      expect(drain2.forwarded).toBe(2);
      expect(drain2.remaining).toBe(0);
      expect(store.events.length).toBe(3);
      expect(fs.existsSync(ndjsonPath)).toBe(false);
    });

    it("idempotently handles duplicate records already in destination store", async () => {
      const r = sampleRecord({ record_id: "flr:duplicate" });
      const env = fractalogRecordToCopEnvelope(r);

      const store = createMockIngressStore();
      // Pre-populate store
      await store.append(env);
      expect(store.events.length).toBe(1);

      // Spool has the exact same record
      fs.writeFileSync(path.join(tmpDir, "dup.json"), JSON.stringify(r), "utf8");

      const drain = await drainFractalogSpool(tmpDir, store);
      expect(drain.ok).toBe(true);
      expect(drain.forwarded).toBe(1);
      expect(drain.duplicates).toBe(1);
      expect(store.events.length).toBe(1); // No duplicate append
      expect(fs.existsSync(path.join(tmpDir, "dup.json"))).toBe(false);
    });

    it("quarantines corrupted records so they do not block subsequent valid drains", async () => {
      const rValid = sampleRecord({ record_id: "flr:valid-one" });
      const ndjsonPath = path.join(tmpDir, "mixed.ndjson");
      const badLine = '{ "bad_syntax_here": ';

      fs.writeFileSync(ndjsonPath, `${badLine}\n${JSON.stringify(rValid)}\n`, "utf8");

      const store = createMockIngressStore();
      const drain = await drainFractalogSpool(tmpDir, store, { quarantine: true });

      expect(drain.ok).toBe(true);
      expect(drain.forwarded).toBe(1);
      expect(drain.quarantined).toBe(1);
      expect(store.events.length).toBe(1);

      // Check quarantine directory created and contains bad line
      const quarantineDir = path.join(tmpDir, "quarantine");
      expect(fs.existsSync(quarantineDir)).toBe(true);
      const qFiles = fs.readdirSync(quarantineDir);
      expect(qFiles.length).toBe(1);
      const qContent = fs.readFileSync(path.join(quarantineDir, qFiles[0]), "utf8");
      expect(qContent).toContain("bad_syntax_here");

      // The original mixed.ndjson should now be cleaned or removed
      expect(fs.existsSync(ndjsonPath)).toBe(false);
    });
  });

  describe("Diagnostics Formatting", () => {
    it("formats human-readable inspection report", () => {
      const r = sampleRecord({ record_id: "flr:sample" });
      fs.writeFileSync(path.join(tmpDir, "rec.json"), JSON.stringify(r), "utf8");

      const report = inspectFractalogSpool(tmpDir);
      const text = formatSpoolInspectionReport(report);

      expect(text).toContain("FRACTALOG DEGRADED FALLBACK SPOOL STATUS");
      expect(text).toContain("Target Spool:");
      expect(text).toContain("Total Records:   1");
      expect(text).toContain("✓ Valid:       1");
      expect(text).toContain("flr:sample");
    });

    it("formats human-readable drain report", () => {
      const report = {
        spool_target: tmpDir,
        dry_run: false,
        total_spooled: 5,
        forwarded: 5,
        duplicates: 1,
        failed: 0,
        quarantined: 1,
        remaining: 0,
        ok: true,
      };

      const text = formatSpoolDrainReport(report);
      expect(text).toContain("FRACTALOG SPOOL DRAIN REPORT");
      expect(text).toContain("Status:          ✓ SUCCESS");
      expect(text).toContain("✓ Forwarded:   5 (duplicates acknowledged: 1)");
      expect(text).toContain("⚠️ Quarantined: 1");
    });
  });

  describe("CLI Runner", () => {
    it("runs 'status' subcommand via subprocess and outputs JSON", () => {
      const r = sampleRecord({ record_id: "flr:cli:1" });
      fs.writeFileSync(path.join(tmpDir, "rec.json"), JSON.stringify(r), "utf8");

      const stdout = execFileSync(process.execPath, [CLI, "status", tmpDir, "--json"], {
        encoding: "utf8",
      });

      const parsed = JSON.parse(stdout);
      expect(parsed.exists).toBe(true);
      expect(parsed.total_records).toBe(1);
      expect(parsed.valid_count).toBe(1);
    });

    it("runs 'drain --dry-run' subcommand via subprocess", () => {
      const r = sampleRecord({ record_id: "flr:cli:2" });
      fs.writeFileSync(path.join(tmpDir, "rec.json"), JSON.stringify(r), "utf8");

      const stdout = execFileSync(process.execPath, [CLI, "drain", tmpDir, "--dry-run", "--json"], {
        encoding: "utf8",
      });

      const parsed = JSON.parse(stdout);
      expect(parsed.dry_run).toBe(true);
      expect(parsed.forwarded).toBe(1);
      expect(parsed.ok).toBe(true);
    });
  });
});
