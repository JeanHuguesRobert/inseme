import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createSqliteCopEventStore } from '../src/sqlite-cop-event-store.js';
import { createEventSourcedExecutionBudgetLedger, recordExecutionBudgetGrant } from '../src/execution-budget.js';
import { reserveEventSourcedDelegatedBudget } from '../src/delegated-budget.js';

const worker = new URL('./fixtures/delegation-sqlite-worker.js', import.meta.url);
const run = (db, child, units, key, env = {}) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', worker.pathname, db, child, String(units), key], { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  p.stdout.on('data', x => stdout += x);
  p.stderr.on('data', x => stderr += x);
  p.on('error', reject);
  p.on('close', status => resolve({ status, stdout, stderr }));
});

describe('process termination between parent reserve and child grant', () => {
  it('recovers after deliberate process exit with no duplicate debit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cop-crash-'));
    const file = join(dir, 'events.sqlite');
    try {
      const initial = createSqliteCopEventStore(file);
      recordExecutionBudgetGrant(initial, { budget_id: 'root', mandate_ref: 'mandate:root@v1', principal_ref: 'person:owner', limits: { max_steps: 10 } });
      initial.close();
      const stopped = await run(file, 'crashed', 6, 'crashed', { COP_STOP_AFTER_PARENT_RESERVE: '1' });
      assert.equal(stopped.status, 0, stopped.stderr);
      const restarted = await run(file, 'crashed', 6, 'crashed');
      assert.equal(restarted.status, 0, restarted.stderr);
      assert.equal(JSON.parse(restarted.stdout).ok, true);
      const store = createSqliteCopEventStore(file);
      const parent = createEventSourcedExecutionBudgetLedger({ store, budget_id: 'root', limits: { max_steps: 10 }, require_authority_grant: true });
      assert.equal(parent.snapshot().reserved.max_steps, 6);
      store.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('SQLite-backed delegated budget recovery', () => {
  it('serializes concurrent separate processes, then recovers after restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cop-delegate-'));
    const dbfile = join(dir, 'events.sqlite');
    try {
      const db = createSqliteCopEventStore(dbfile);
      recordExecutionBudgetGrant(db, { budget_id: 'root', mandate_ref: 'mandate:root@v1', principal_ref: 'person:owner', limits: { max_steps: 10 } });
      db.close();
      const [a, b] = await Promise.all([run(dbfile, 'a', 7, 'a'), run(dbfile, 'b', 7, 'b')]);
      assert.equal(a.status, 0, a.stderr);
      assert.equal(b.status, 0, b.stderr);
      const results = [JSON.parse(a.stdout), JSON.parse(b.stdout)];
      assert.equal(results.filter(x => x.ok).length, 1);
      assert.equal(results.filter(x => x.error === 'budget_exhausted').length, 1);
      const reopened = createSqliteCopEventStore(dbfile);
      const parent = createEventSourcedExecutionBudgetLedger({ store: reopened, budget_id: 'root', limits: { max_steps: 10 }, require_authority_grant: true });
      assert.equal(parent.snapshot().reserved.max_steps, 7);
      const winner = results.find(x => x.ok).child;
      const recovered = reserveEventSourcedDelegatedBudget({ store: reopened, parent_ledger: parent, child_budget_id: winner,
        child_mandate_ref: `mandate:${winner}@v1`, principal_ref: 'person:owner', allocation: { max_steps: 7 }, idempotency_key: winner });
      assert.equal(recovered.ok, true);
      assert.equal(recovered.duplicate, true);
      assert.equal(recovered.close().ok, true);
      assert.equal(parent.snapshot().available.max_steps, 10);
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
