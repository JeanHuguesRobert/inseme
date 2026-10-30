import { describe, it, expect } from 'vitest';
import { createMemoryExecutionBudgetLedger } from '../src/execution-budget.js';
import { reserveDelegatedBudget } from '../src/delegated-budget.js';

describe('shared parent capacity across delegates', () => {
  it('prevents sibling oversubscription and settles observed child usage', () => {
    const parent = createMemoryExecutionBudgetLedger({ budget_id: 'parent', limits: { max_steps: 10 } });
    const a = reserveDelegatedBudget({ parent_ledger: parent, child_budget_id: 'a', allocation: { max_steps: 7 }, idempotency_key: 'a' });
    expect(a.ok).toBe(true);
    const b = reserveDelegatedBudget({ parent_ledger: parent, child_budget_id: 'b', allocation: { max_steps: 7 }, idempotency_key: 'b' });
    expect(b.ok).toBe(false);
    expect(b.error).toBe('budget_exhausted');
    const child = a.child_ledger;
    const work = child.reserve({ expected_version: child.snapshot().version, idempotency_key: 'task', demand: { max_steps: 4 } });
    expect(a.close().error).toBe('child_reservations_outstanding');
    expect(child.settle({ expected_version: child.snapshot().version, reservation_id: work.reservation.reservation_id, usage: { max_steps: 3 } }).ok).toBe(true);
    expect(a.close().ok).toBe(true);
    expect(parent.snapshot().settled.max_steps).toBe(3);
    expect(parent.snapshot().available.max_steps).toBe(7);
    expect(a.close().error).toBe('delegation_already_closed');
    const c = reserveDelegatedBudget({ parent_ledger: parent, child_budget_id: 'c', allocation: { max_steps: 7 }, idempotency_key: 'c' });
    expect(c.ok).toBe(true);
  });
});

import { createEventSourcedExecutionBudgetLedger, recordExecutionBudgetGrant } from '../src/execution-budget.js';
import { reserveEventSourcedDelegatedBudget } from '../src/delegated-budget.js';

function atomicStore() {
  const events = [];
  return {
    append(event) {
      const topic = event.topic?.id || event.topic_id;
      const matching = events.filter(e => (e.topic?.id || e.topic_id) === topic);
      const seq = matching.length + 1;
      if (event.topic?.seq != null && event.topic.seq !== seq) return { ok: false, error: 'version_conflict' };
      if (event.idempotency_key && events.some(e => e.idempotency_key === event.idempotency_key)) {
        return { ok: true, duplicate: true, event: events.find(e => e.idempotency_key === event.idempotency_key) };
      }
      const saved = { ...event, topic: { id: topic, seq } };
      events.push(saved);
      return { ok: true, event: saved };
    },
    listTopic(id) { return structuredClone(events.filter(e => e.topic?.id === id)); },
  };
}

describe('event-sourced delegated budget', () => {
  it('keeps sibling claims serialized across ledger restarts and reconciles unused funds', () => {
    const store = atomicStore();
    recordExecutionBudgetGrant(store, { budget_id: 'parent-durable', mandate_ref: 'mandate:parent@v1', principal_ref: 'person:owner', limits: { max_steps: 10 } });
    const parent = () => createEventSourcedExecutionBudgetLedger({ store, budget_id: 'parent-durable', limits: { max_steps: 10 }, require_authority_grant: true });
    const delegate = (child, steps, key) => reserveEventSourcedDelegatedBudget({
      store, parent_ledger: parent(), child_budget_id: child, child_mandate_ref: `mandate:${child}@v1`,
      principal_ref: 'person:owner', allocation: { max_steps: steps }, idempotency_key: key,
    });
    const a = delegate('child-a', 7, 'a');
    expect(a.ok).toBe(true);
    expect(parent().snapshot().reserved.max_steps).toBe(7);
    expect(delegate('child-b', 7, 'b').error).toBe('budget_exhausted');
    const retry = delegate('child-a', 7, 'a');
    expect(retry.ok).toBe(true);
    expect(retry.duplicate).toBe(true);
    expect(parent().snapshot().reserved.max_steps).toBe(7);
    const task = retry.child_ledger.reserve({ idempotency_key: 'task', expected_version: retry.child_ledger.snapshot().version, demand: { max_steps: 5 } });
    expect(task.ok).toBe(true);
    expect(retry.close().error).toBe('child_reservations_outstanding');
    expect(retry.child_ledger.settle({ reservation_id: task.reservation.reservation_id, expected_version: retry.child_ledger.snapshot().version, usage: { max_steps: 3 } }).ok).toBe(true);
    expect(retry.close().ok).toBe(true);
    expect(parent().snapshot().settled.max_steps).toBe(3);
    expect(delegate('child-b', 7, 'b').ok).toBe(true);
  });
});

describe('crash recovery before child grant', () => {
  it('recovers the reserved capacity without a second debit', () => {
    const store = atomicStore();
    const limits = { max_steps: 8 };
    recordExecutionBudgetGrant(store, { budget_id: 'root', mandate_ref: 'mandate:root@v1', principal_ref: 'person:p', limits });
    const parent = () => createEventSourcedExecutionBudgetLedger({ store, budget_id: 'root', limits, require_authority_grant: true });
    // Simulate the process terminating immediately after the parent reservation.
    const initial = parent().reserve({ idempotency_key: 'delegate:child:operation', expected_version: parent().snapshot().version, demand: { max_steps: 6 } });
    expect(initial.ok).toBe(true);
    expect(parent().snapshot().available.max_steps).toBe(2);
    const recovered = reserveEventSourcedDelegatedBudget({ store, parent_ledger: parent(), child_budget_id: 'child', child_mandate_ref: 'mandate:child@v1', principal_ref: 'person:p', allocation: { max_steps: 6 }, idempotency_key: 'operation' });
    expect(recovered.ok).toBe(true);
    expect(recovered.duplicate).toBe(true);
    expect(recovered.child_ledger.snapshot().has_grant).toBe(true);
    expect(parent().snapshot().reserved.max_steps).toBe(6);
    expect(recovered.close().ok).toBe(true);
    expect(parent().snapshot().available.max_steps).toBe(8);
  });
});
