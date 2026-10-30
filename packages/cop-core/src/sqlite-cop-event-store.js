/** Local synchronous COP event store for Node 22+; uses experimental node:sqlite.
 * Each append is a SQLite transaction with unique topic/sequence and idempotency.
 * Intended for isolated pilot tests; do not deploy as a production service without review.
 */
import { DatabaseSync } from 'node:sqlite';
import { createCopEventEnvelope, validateCopEventEnvelope } from './cop-event-envelope.js';

export function createSqliteCopEventStore(filename) {
  const db = new DatabaseSync(filename, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS cop_events (
      event_id TEXT PRIMARY KEY, topic TEXT NOT NULL, seq INTEGER NOT NULL,
      idem TEXT UNIQUE, envelope TEXT NOT NULL,
      UNIQUE(topic, seq)
    );`);
  const byIdem = db.prepare('SELECT envelope FROM cop_events WHERE idem=?');
  const nextSeq = db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS n FROM cop_events WHERE topic=?');
  const insert = db.prepare('INSERT INTO cop_events(event_id,topic,seq,idem,envelope) VALUES (?,?,?,?,?)');
  const topicRows = db.prepare('SELECT envelope FROM cop_events WHERE topic=? ORDER BY seq');
  const allRows = db.prepare('SELECT envelope FROM cop_events ORDER BY topic,seq');
  const sealLookup = db.prepare("SELECT 1 FROM cop_events WHERE topic=? AND json_extract(envelope, '$.event_type')='ExecutionBudgetSeal' LIMIT 1");
  return {
    kind: 'sqlite',
    append(partial) {
      const event = createCopEventEnvelope(partial);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (event.idempotency_key) {
          const previous = byIdem.get(event.idempotency_key);
          if (previous) {
            db.exec('COMMIT');
            return { ok: true, duplicate: true, event: JSON.parse(previous.envelope) };
          }
        }
        if (event.topic.id.startsWith('execution-budget:') && sealLookup.get(event.topic.id)) {
          db.exec('ROLLBACK');
          return { ok: false, error: 'budget_topic_sealed' };
        }
        const seq = nextSeq.get(event.topic.id).n;
        if (event.topic.seq > 0 && event.topic.seq !== seq) {
          db.exec('ROLLBACK');
          return { ok: false, error: 'topic_seq_conflict' };
        }
        event.topic.seq = seq;
        const verdict = validateCopEventEnvelope(event, { requirePositiveSeq: true });
        if (!verdict.ok) {
          db.exec('ROLLBACK');
          return { ok: false, error: 'invalid_envelope', errors: verdict.errors };
        }
        insert.run(event.event_id, event.topic.id, seq, event.idempotency_key || null, JSON.stringify(event));
        db.exec('COMMIT');
        return { ok: true, duplicate: false, event };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    listTopic(id) { return topicRows.all(id).map(r => JSON.parse(r.envelope)); },
    replay() { return allRows.all().map(r => JSON.parse(r.envelope)); },
    close() { db.close(); },
  };
}
