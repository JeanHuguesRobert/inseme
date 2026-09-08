import {
  fractalogProjection,
  validateFractalogActRecord,
} from "../../../../packages/cop-core/src/fractalog.js";

function requireDatabase(database) {
  if (!database || typeof database.prepare !== "function") {
    throw new TypeError("a DatabaseSync-compatible database is required");
  }
}

function parseDocument(value) {
  return JSON.parse(value);
}

function parseReceipt(value) {
  return value ? JSON.parse(value) : null;
}

function now() {
  return new Date().toISOString();
}

function rollbackQuietly(database) {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
}

/**
 * Installs the local-only FractaLog tables. `fractalog_records` is immutable;
 * delivery state belongs in the separate outbox projection.
 */
export function ensureFractalogSqliteSchema(database) {
  requireDatabase(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS fractalog_records (
      record_id TEXT PRIMARY KEY,
      document_schema TEXT NOT NULL,
      document_hash TEXT NOT NULL,
      act_id TEXT NOT NULL,
      act_kind TEXT NOT NULL,
      act_phase TEXT NOT NULL,
      owner_instance_ref TEXT NOT NULL,
      on_behalf_of_instance_ref TEXT,
      recorded_at TEXT NOT NULL,
      idempotency_key TEXT,
      correlation_id TEXT,
      visibility TEXT NOT NULL,
      document TEXT NOT NULL,
      CHECK (act_phase IN ('attempt', 'committed', 'failed', 'refused', 'observed')),
      CHECK (visibility IN ('open', 'redacted', 'restricted', 'sealed', 'opaque_but_escrowed'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fractalog_records_idempotency_key
      ON fractalog_records (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS fractalog_records_owner_recorded
      ON fractalog_records (owner_instance_ref, recorded_at, record_id);
    CREATE INDEX IF NOT EXISTS fractalog_records_act
      ON fractalog_records (act_id, recorded_at, record_id);

    CREATE TABLE IF NOT EXISTS fractalog_outbox (
      record_id TEXT PRIMARY KEY REFERENCES fractalog_records(record_id) ON DELETE RESTRICT,
      state TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      last_attempt_at TEXT,
      accepted_at TEXT,
      receipt TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (state IN ('pending', 'forwarding', 'accepted', 'rejected'))
    );
    CREATE INDEX IF NOT EXISTS fractalog_outbox_pending
      ON fractalog_outbox (state, created_at, record_id);
  `);
}

export function createFractalogSqliteStore(database) {
  ensureFractalogSqliteSchema(database);

  function get(recordId) {
    const row = database
      .prepare("SELECT document FROM fractalog_records WHERE record_id = ?")
      .get(recordId);
    return row ? parseDocument(row.document) : null;
  }

  function outboxRow(recordId) {
    const row = database
      .prepare(
        "SELECT record_id, state, attempt_count, last_attempt_at, accepted_at, receipt, last_error, created_at, updated_at FROM fractalog_outbox WHERE record_id = ?"
      )
      .get(recordId);
    return row ? { ...row, receipt: parseReceipt(row.receipt) } : null;
  }

  function append(record) {
    const validation = validateFractalogActRecord(record);
    if (!validation.ok) return { ok: false, error: "invalid_record", errors: validation.errors };
    const projection = fractalogProjection(record);
    database.exec("BEGIN IMMEDIATE");
    try {
      const byRecordId = database
        .prepare("SELECT document_hash FROM fractalog_records WHERE record_id = ?")
        .get(projection.record_id);
      if (byRecordId) {
        database.exec("COMMIT");
        return byRecordId.document_hash === projection.document_hash
          ? {
              ok: true,
              duplicate: true,
              record: get(projection.record_id),
              outbox: outboxRow(projection.record_id),
            }
          : { ok: false, error: "record_id_conflict" };
      }
      if (projection.idempotency_key) {
        const byIdempotency = database
          .prepare(
            "SELECT record_id, document_hash FROM fractalog_records WHERE idempotency_key = ?"
          )
          .get(projection.idempotency_key);
        if (byIdempotency) {
          database.exec("COMMIT");
          return byIdempotency.document_hash === projection.document_hash
            ? {
                ok: true,
                duplicate: true,
                record: get(byIdempotency.record_id),
                outbox: outboxRow(byIdempotency.record_id),
              }
            : { ok: false, error: "idempotency_key_conflict" };
        }
      }
      database
        .prepare(
          `INSERT INTO fractalog_records (
            record_id, document_schema, document_hash, act_id, act_kind, act_phase,
            owner_instance_ref, on_behalf_of_instance_ref, recorded_at, idempotency_key,
            correlation_id, visibility, document
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          projection.record_id,
          projection.document_schema,
          projection.document_hash,
          projection.act_id,
          projection.act_kind,
          projection.act_phase,
          projection.owner_instance_ref,
          projection.on_behalf_of_instance_ref,
          projection.recorded_at,
          projection.idempotency_key,
          projection.correlation_id,
          projection.visibility,
          JSON.stringify(record)
        );
      const createdAt = now();
      database
        .prepare(
          "INSERT INTO fractalog_outbox (record_id, created_at, updated_at) VALUES (?, ?, ?)"
        )
        .run(projection.record_id, createdAt, createdAt);
      database.exec("COMMIT");
      return {
        ok: true,
        duplicate: false,
        record: structuredClone(record),
        outbox: outboxRow(record.record_id),
      };
    } catch (error) {
      rollbackQuietly(database);
      throw error;
    }
  }

  function pending(limit = 100) {
    return database
      .prepare(
        `SELECT r.document, o.state, o.attempt_count, o.last_attempt_at, o.last_error
         FROM fractalog_outbox o
         JOIN fractalog_records r ON r.record_id = o.record_id
         WHERE o.state = 'pending'
         ORDER BY o.created_at, o.record_id
         LIMIT ?`
      )
      .all(limit)
      .map((row) => ({ ...row, record: parseDocument(row.document) }));
  }

  async function forward(recordId, ingress) {
    if (typeof ingress !== "function") throw new TypeError("ingress must be a function");
    const record = get(recordId);
    const state = outboxRow(recordId);
    if (!record || !state) return { ok: false, error: "record_not_found" };
    if (state.state === "accepted")
      return { ok: true, duplicate: true, record, receipt: state.receipt };
    const attemptedAt = now();
    database
      .prepare(
        "UPDATE fractalog_outbox SET state = 'forwarding', attempt_count = attempt_count + 1, last_attempt_at = ?, updated_at = ? WHERE record_id = ?"
      )
      .run(attemptedAt, attemptedAt, recordId);
    try {
      const receipt = await ingress(structuredClone(record));
      if (!receipt || receipt.accepted !== true) {
        const rejectedAt = now();
        database
          .prepare(
            "UPDATE fractalog_outbox SET state = 'rejected', receipt = ?, last_error = ?, updated_at = ? WHERE record_id = ?"
          )
          .run(JSON.stringify(receipt || null), "central_receipt_rejected", rejectedAt, recordId);
        return { ok: false, error: "central_receipt_rejected", receipt: receipt || null };
      }
      const acceptedAt = now();
      database
        .prepare(
          "UPDATE fractalog_outbox SET state = 'accepted', accepted_at = ?, receipt = ?, last_error = NULL, updated_at = ? WHERE record_id = ?"
        )
        .run(acceptedAt, JSON.stringify(receipt), acceptedAt, recordId);
      return { ok: true, duplicate: false, record, receipt };
    } catch (error) {
      const failedAt = now();
      database
        .prepare(
          "UPDATE fractalog_outbox SET state = 'pending', last_error = ?, updated_at = ? WHERE record_id = ?"
        )
        .run(String(error?.message || error), failedAt, recordId);
      return { ok: false, error: "central_ingress_unreachable" };
    }
  }

  return {
    kind: "fractalog.sqlite.v1",
    append,
    get,
    pending,
    outbox: outboxRow,
    forward,
    update() {
      throw new Error("FractaLog documents are append-only. UPDATE forbidden.");
    },
    delete() {
      throw new Error("FractaLog documents are append-only. DELETE forbidden.");
    },
  };
}
