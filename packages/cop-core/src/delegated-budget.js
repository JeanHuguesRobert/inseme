import { createMemoryExecutionBudgetLedger, createEventSourcedExecutionBudgetLedger, recordExecutionBudgetGrant, activeHardDimensions } from './execution-budget.js';

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

/**
 * Event-sourced delegation. Both ledgers share one COP store; the parent
 * reservation precedes the child's authoritative grant. A crash between
 * these writes leaves capacity reserved, never silently available twice.
 * Caller MUST supply a store with durable atomic compare-and-append per topic.
 */
export function reserveEventSourcedDelegatedBudget({
  store, parent_ledger, child_budget_id, child_mandate_ref,
  principal_ref, allocation, idempotency_key,
}) {
  if (!store?.append) throw new TypeError('store.append required');
  for (const [name, value] of Object.entries({ child_budget_id, child_mandate_ref, principal_ref, idempotency_key })) {
    if (typeof value !== 'string' || !value) throw new TypeError(`${name} required`);
  }
  const parent = parent_ledger.snapshot();
  if (!parent.has_grant || !parent.mandate_ref) return { ok: false, error: 'parent_budget_not_authorized' };
  const active = activeHardDimensions(parent.limits);
  if (!allocation || Object.keys(allocation).length !== active.length ||
      active.some(d => !Object.hasOwn(allocation, d) || !Number.isSafeInteger(allocation[d]) || allocation[d] < 0)) {
    return { ok: false, error: 'delegation_dimension_mismatch' };
  }
  const key = `delegate:${child_budget_id}:${idempotency_key}`;
  const reserved = parent_ledger.reserve({ idempotency_key: key,
    expected_version: parent.version, demand: allocation });
  if (!reserved.ok) return reserved;
  // An idempotent retry must not silently rebind its budget to another grant.
  if (active.some(d => reserved.reservation.demand[d] !== allocation[d])) {
    return { ok: false, error: 'delegation_retry_mismatch', reservation: reserved.reservation };
  }
  const child = createEventSourcedExecutionBudgetLedger({
    store, budget_id: child_budget_id, limits: allocation, require_authority_grant: true,
  });
  const current = child.snapshot();
  if (current.has_grant) {
    if (current.mandate_ref !== child_mandate_ref ||
        active.some(d => current.limits[d] !== allocation[d])) {
      return { ok: false, error: 'child_grant_mismatch', reservation: reserved.reservation };
    }
  } else {
    recordExecutionBudgetGrant(store, {
      budget_id: child_budget_id, mandate_ref: child_mandate_ref,
      principal_ref, limits: allocation,
    });
  }
  return {
    ok: true, duplicate: Boolean(reserved.duplicate), reservation: reserved.reservation,
    child_ledger: child,
    close() {
      const status = child.snapshot();
      if (active.some(d => status.reserved[d] !== 0)) {
        return { ok: false, error: 'child_reservations_outstanding' };
      }
      return parent_ledger.settle({ reservation_id: reserved.reservation.reservation_id,
        expected_version: parent_ledger.snapshot().version, usage: status.settled,
        idempotency_key: `delegate:close:${key}` });
    },
  };
}
