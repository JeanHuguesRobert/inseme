const WRITABLE_TABLES = new Set([
  "cop_handlers",
  "cop_logical_agents",
  "cop_tasks",
  "cop_steps",
  "cop_events",
  "cop_artifacts",
]);

import {
  createCopEventEnvelope,
  validateCopEventEnvelope,
} from "../../../../packages/cop-core/src/cop-event-envelope.js";

function requireDatabase(database) {
  if (!database || typeof database.prepare !== "function") {
    throw new TypeError("a DatabaseSync-compatible database is required");
  }
}

function validColumn(column) {
  return /^[a-z][a-z0-9_]*$/.test(column);
}

function parsePermissions(value) {
  try {
    const permissions = JSON.parse(value);
    return Array.isArray(permissions) &&
      permissions.every((permission) => typeof permission === "string")
      ? permissions
      : null;
  } catch {
    return null;
  }
}

function parseStoredEnvelope(row) {
  try {
    const envelope = JSON.parse(row.metadata).cop_event_envelope;
    const validation = validateCopEventEnvelope(envelope, { requirePositiveSeq: true });
    return validation.ok ? envelope : null;
  } catch {
    return null;
  }
}

function rollbackQuietly(database) {
  try {
    database.exec("ROLLBACK");
  } catch {
    // No active transaction; preserve the original error.
  }
}

/**
 * Durable local COP event store backed by the existing portable `cop_events`
 * table. It stores a full signed/hashed envelope inside metadata so legacy
 * runtime events remain readable but are never rewritten. BEGIN IMMEDIATE
 * serializes each topic-sequence decision in SQLite.
 *
 * `append` keeps one event in its own immediate transaction and still commits
 * a no-op when that event is refused. `transaction` appends several events
 * under one immediate transaction and rolls the whole batch back when any
 * requested append is not ok, or when the callback throws. It does not issue
 * a nested BEGIN.
 */
export function createSqliteCopEventStore(database) {
  requireDatabase(database);
  let transactionDepth = 0;

  function topicEvents(topicId) {
    return database
      .prepare(
        "SELECT id, metadata FROM cop_events WHERE topic_id = ? ORDER BY recorded_at ASC, id ASC"
      )
      .all(topicId)
      .map(parseStoredEnvelope)
      .filter(Boolean)
      .sort((left, right) => left.topic.seq - right.topic.seq);
  }

  function allEnvelopes() {
    return database
      .prepare("SELECT id, metadata FROM cop_events ORDER BY recorded_at ASC, id ASC")
      .all()
      .map(parseStoredEnvelope)
      .filter(Boolean)
      .sort(
        (left, right) =>
          left.topic.id.localeCompare(right.topic.id) || left.topic.seq - right.topic.seq
      );
  }

  function replayEvents({ after_event_id } = {}) {
    const events = allEnvelopes();
    if (!after_event_id) return events;
    const index = events.findIndex((event) => event.event_id === after_event_id);
    return index < 0 ? events : events.slice(index + 1);
  }

  function appendPrepared(partial) {
    const prepared = createCopEventEnvelope(partial);
    const validation = validateCopEventEnvelope(prepared, { requirePositiveSeq: false });
    if (!validation.ok) return { ok: false, error: "invalid_envelope", errors: validation.errors };

    const existing = allEnvelopes();
    if (prepared.idempotency_key) {
      const duplicate = existing.find(
        (event) => event.idempotency_key === prepared.idempotency_key
      );
      if (duplicate) return { ok: true, duplicate: true, event: duplicate };
    }
    if (database.prepare("SELECT id FROM cop_events WHERE id = ?").get(prepared.event_id)) {
      return { ok: false, error: "event_id_conflict" };
    }
    const events = topicEvents(prepared.topic.id);
    const nextSeq = events.length + 1;
    if (prepared.topic.seq > 0 && prepared.topic.seq !== nextSeq) {
      return {
        ok: false,
        error: "topic_seq_conflict",
        errors: [`expected_seq_${nextSeq}`, `got_seq_${prepared.topic.seq}`],
      };
    }
    prepared.topic.seq = nextSeq;
    const finalValidation = validateCopEventEnvelope(prepared, { requirePositiveSeq: true });
    if (!finalValidation.ok) {
      return { ok: false, error: "invalid_envelope", errors: finalValidation.errors };
    }
    database
      .prepare(
        "INSERT INTO cop_events (id, topic_id, task_id, type, payload, metadata, occurred_at, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        prepared.event_id,
        prepared.topic.id,
        null,
        prepared.event_type,
        JSON.stringify(prepared.payload),
        JSON.stringify({ cop_event_envelope: prepared }),
        prepared.time.occurred_at ?? prepared.time.recorded_at,
        prepared.time.recorded_at
      );
    return { ok: true, duplicate: false, event: structuredClone(prepared) };
  }

  function requireOwnTransaction() {
    if (transactionDepth !== 0) {
      throw new Error("nested COP SQLite transaction is not supported");
    }
  }

  const store = {
    kind: "sqlite",

    append(partial) {
      requireOwnTransaction();
      database.exec("BEGIN IMMEDIATE");
      transactionDepth = 1;
      try {
        const result = appendPrepared(partial);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        rollbackQuietly(database);
        throw error;
      } finally {
        transactionDepth = 0;
      }
    },

    /**
     * Append every event requested by `fn` under one immediate transaction.
     * A non-ok append result rolls the batch back even when `fn` returns
     * normally. A throw rolls the batch back and propagates.
     *
     * @param {(transactionalStore: object) => unknown} fn
     */
    transaction(fn) {
      if (typeof fn !== "function") throw new TypeError("transaction callback is required");
      requireOwnTransaction();
      database.exec("BEGIN IMMEDIATE");
      transactionDepth = 1;
      const refusals = [];
      const transactionalStore = {
        kind: "sqlite-transaction",
        append(partial) {
          const result = appendPrepared(partial);
          if (!result || result.ok !== true) {
            refusals.push(result || { ok: false, error: "transaction_append_refused" });
          }
          return result;
        },
        listTopic(topicId) {
          return topicEvents(topicId);
        },
        replay(options) {
          return replayEvents(options);
        },
        update() {
          throw new Error("COP Event Log is strictly append-only. UPDATE forbidden.");
        },
        delete() {
          throw new Error("COP Event Log is strictly append-only. DELETE forbidden.");
        },
      };
      try {
        const value = fn(transactionalStore);
        if (refusals.length > 0) {
          database.exec("ROLLBACK");
          const errors = refusals.flatMap((refusal) =>
            refusal.errors?.length
              ? refusal.errors
              : [refusal.error || "transaction_append_refused"]
          );
          return {
            ok: false,
            rolledBack: true,
            error: refusals[0].error || "transaction_append_refused",
            errors,
            refusals,
            value,
          };
        }
        database.exec("COMMIT");
        return { ok: true, rolledBack: false, value };
      } catch (error) {
        rollbackQuietly(database);
        throw error;
      } finally {
        transactionDepth = 0;
      }
    },

    listTopic(topicId) {
      return topicEvents(topicId);
    },

    replay(options) {
      return replayEvents(options);
    },

    update() {
      throw new Error("COP Event Log is strictly append-only. UPDATE forbidden.");
    },

    delete() {
      throw new Error("COP Event Log is strictly append-only. DELETE forbidden.");
    },
  };

  return store;
}

/**
 * A local SQLite adapter for the portable COP runtime.
 *
 * It deliberately has no mandate-mutation method: mandate issuance, renewal,
 * suspension and revocation are separate, explicitly authorised administrative
 * operations. The runtime only reads their current state and fails closed when
 * a row is malformed or absent.
 */
export function createSqliteCopRuntimeStore(database) {
  requireDatabase(database);

  return {
    eventStore: createSqliteCopEventStore(database),
    executor: {
      insert(table, row) {
        if (!WRITABLE_TABLES.has(table)) throw new TypeError(`COP table is not writable: ${table}`);
        const columns = Object.keys(row);
        if (columns.length === 0 || !columns.every(validColumn))
          throw new TypeError("COP row has invalid columns");
        const placeholders = columns.map(() => "?").join(", ");
        database
          .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
          .run(...Object.values(row));
        return row;
      },
    },

    async resolveMandate(mandateRef) {
      if (typeof mandateRef !== "string" || mandateRef.length === 0) return null;
      const row = database
        .prepare(
          "SELECT mandate_ref, version, status, issuer_ref, grantee_ref, permissions, scope, issued_at, not_before, expires_at, revoked_at, metadata FROM cop_mandates WHERE mandate_ref = ?"
        )
        .get(mandateRef);
      const permissions = row && parsePermissions(row.permissions);
      if (!row || !permissions) return null;
      return {
        ref: row.mandate_ref,
        version: row.version,
        status: row.status,
        issuerRef: row.issuer_ref,
        granteeRef: row.grantee_ref,
        permissions,
        scope: row.scope,
        issuedAt: row.issued_at,
        notBefore: row.not_before,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        metadata: row.metadata,
      };
    },
  };
}
