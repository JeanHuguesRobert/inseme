/** Local synchronous COP event store for Node 22+; uses experimental node:sqlite.
 * Each append is a SQLite transaction with unique topic/sequence and idempotency.
 * Intended for isolated pilot tests; do not deploy as a production service without review.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createSqliteBudgetProjection } from './sqlite-budget-projection.js';
import { createCopEventEnvelope, validateCopEventEnvelope } from './cop-event-envelope.js';

export function createSqliteCopEventStore(filename) {
  const db = new DatabaseSync(filename, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS cop_events (
      event_id TEXT PRIMARY KEY, topic TEXT NOT NULL, seq INTEGER NOT NULL,
      idem TEXT UNIQUE, envelope TEXT NOT NULL,
      UNIQUE(topic, seq)
    );`);
  db.exec(`CREATE TABLE IF NOT EXISTS cop_topic_commitments (
    topic TEXT PRIMARY KEY, seq INTEGER NOT NULL, head TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );`);
  const readHead = db.prepare('SELECT seq,head,recorded_at FROM cop_topic_commitments WHERE topic=?');
  const upsertHead = db.prepare('INSERT INTO cop_topic_commitments(topic,seq,head,recorded_at) VALUES (?,?,?,?) ON CONFLICT(topic) DO UPDATE SET seq=excluded.seq,head=excluded.head,recorded_at=excluded.recorded_at');
  db.exec(`CREATE TABLE IF NOT EXISTS cop_store_migrations (key TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS cop_sealed_budget_topics (topic TEXT PRIMARY KEY);`);
  const migrated=db.prepare('SELECT 1 FROM cop_store_migrations WHERE key=?');
  const markMigrated=db.prepare('INSERT INTO cop_store_migrations(key) VALUES(?)');
  if (!migrated.get('topic-commitments-and-seals-v1')) {
    const missingTopics=db.prepare(`SELECT DISTINCT e.topic FROM cop_events e
      LEFT JOIN cop_topic_commitments c ON c.topic=e.topic WHERE c.topic IS NULL`).all();
    const migrationRows=db.prepare('SELECT envelope FROM cop_events WHERE topic=? ORDER BY seq');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const {topic} of missingTopics) {
        let head='',seq=0,recordedAt='';
        for (const {envelope} of migrationRows.all(topic)) {
          const event=JSON.parse(envelope);
          head=`sha256:${createHash('sha256').update(head).update(envelope).digest('hex')}`;
          seq=event.topic.seq;
          recordedAt=event.time?.recorded_at || event.time?.occurred_at || '';
        }
        upsertHead.run(topic,seq,head,recordedAt);
      }
      db.exec(`INSERT OR IGNORE INTO cop_sealed_budget_topics(topic)
        SELECT DISTINCT topic FROM cop_events WHERE topic LIKE 'execution-budget:%'
        AND json_extract(envelope,'$.event_type')='ExecutionBudgetSeal'`);
      markMigrated.run('topic-commitments-and-seals-v1');
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  const budgetProjection=createSqliteBudgetProjection(db,topic=>readHead.get(topic));
  const byIdem = db.prepare('SELECT envelope FROM cop_events WHERE idem=?');
  const nextSeq = db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS n FROM cop_events WHERE topic=?');
  const insert = db.prepare('INSERT INTO cop_events(event_id,topic,seq,idem,envelope) VALUES (?,?,?,?,?)');
  const topicRows = db.prepare('SELECT envelope FROM cop_events WHERE topic=? ORDER BY seq');
  const allRows = db.prepare('SELECT envelope FROM cop_events ORDER BY topic,seq');
  const sealLookup=db.prepare('SELECT 1 FROM cop_sealed_budget_topics WHERE topic=?');
  const markSealed=db.prepare('INSERT OR IGNORE INTO cop_sealed_budget_topics(topic) VALUES(?)');
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
        const previousHead = readHead.get(event.topic.id);
        if ((previousHead?.seq || 0) === seq-1) {
          const head = createHash('sha256').update(previousHead?.head || '').update(JSON.stringify(event)).digest('hex');
          upsertHead.run(event.topic.id, seq, `sha256:${head}`, event.time?.recorded_at || event.time?.occurred_at || '');
        }
        budgetProjection.apply(event);
        if (event.event_type==='ExecutionBudgetSeal' && event.topic.id.startsWith('execution-budget:')) markSealed.run(event.topic.id);
        db.exec('COMMIT');
        return { ok: true, duplicate: false, event };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    topicCommitment(id) { return readHead.get(id) || null; },
    budgetProjection(topic) { return budgetProjection.get(topic); },
    seedBudgetProjection(topic,state) { return budgetProjection.seed(topic,state); },
    eventByIdempotency(key) { const row=byIdem.get(key); return row ? JSON.parse(row.envelope) : null; },
    listTopic(id) { return topicRows.all(id).map(r => JSON.parse(r.envelope)); },
    replay() { return allRows.all().map(r => JSON.parse(r.envelope)); },
    close() { db.close(); },
  };
}
