import { createSqliteCopEventStore } from '../../src/sqlite-cop-event-store.js';
import { createEventSourcedExecutionBudgetLedger } from '../../src/execution-budget.js';
import { reserveEventSourcedDelegatedBudget } from '../../src/delegated-budget.js';
const [filename, child, amount, key] = process.argv.slice(2);
const store = createSqliteCopEventStore(filename);
const parent_ledger = createEventSourcedExecutionBudgetLedger({ store, budget_id: 'root', limits: { max_steps: 10 }, require_authority_grant: true });
if (process.env.COP_STOP_AFTER_PARENT_RESERVE === '1') {
  const outcome = parent_ledger.reserve({ idempotency_key: `delegate:${child}:${key}`,
    expected_version: parent_ledger.snapshot().version, demand: { max_steps: Number(amount) } });
  console.log(JSON.stringify({ ok: outcome.ok, error: outcome.error, child }));
  process.exit(outcome.ok ? 0 : 1); // No cleanup: process dies before the child grant.
}
const outcome = reserveEventSourcedDelegatedBudget({ store, parent_ledger, child_budget_id: child,
  child_mandate_ref: `mandate:${child}@v1`, principal_ref: 'person:owner', allocation: { max_steps: Number(amount) }, idempotency_key: key });
console.log(JSON.stringify({ ok: outcome.ok, error: outcome.error, child }));
store.close();
