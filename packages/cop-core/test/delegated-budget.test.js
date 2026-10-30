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
