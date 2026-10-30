import { createMemoryExecutionBudgetLedger, activeHardDimensions } from './execution-budget.js';

/** Reference adapter: parent capacity is reserved before any child grant. */
export function reserveDelegatedBudget({ parent_ledger, child_budget_id, allocation, idempotency_key }) {
  if (!parent_ledger || typeof parent_ledger.reserve !== 'function') throw new TypeError('parent_ledger required');
  if (typeof child_budget_id !== 'string' || !child_budget_id) throw new TypeError('child_budget_id required');
  if (typeof idempotency_key !== 'string' || !idempotency_key) throw new TypeError('idempotency_key required');
  const parent = parent_ledger.snapshot();
  const active = activeHardDimensions(parent.limits);
  if (!allocation || Object.keys(allocation).length !== active.length ||
      active.some(d => !Object.hasOwn(allocation, d) || !Number.isSafeInteger(allocation[d]) || allocation[d] < 0)) {
    return { ok: false, error: 'delegation_dimension_mismatch' };
  }
  const reserved = parent_ledger.reserve({ idempotency_key: `delegate:${idempotency_key}`,
    expected_version: parent.version, demand: allocation });
  if (!reserved.ok) return reserved;
  if (reserved.duplicate) return { ok: false, error: 'delegation_already_reserved', reservation: reserved.reservation };
  const child = createMemoryExecutionBudgetLedger({ budget_id: child_budget_id, limits: allocation });
  let closed = false;
  return {
    ok: true, reservation: reserved.reservation, child_ledger: child,
    close() {
      if (closed) return { ok: false, error: 'delegation_already_closed' };
      const state = child.snapshot();
      if (active.some(d => state.reserved[d] !== 0)) return { ok: false, error: 'child_reservations_outstanding' };
      const settled = parent_ledger.settle({ reservation_id: reserved.reservation.reservation_id,
        expected_version: parent_ledger.snapshot().version, usage: state.settled });
      if (settled.ok) closed = true;
      return settled;
    },
  };
}
