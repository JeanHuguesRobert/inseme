# COP Accounting Z0 — deployed experimental double-entry journal

Status: **verified in JHN Supabase, 2026-10-15**, scoped to development epoch `z0-development-20261015`. Linked #161 and #162. This is **technical accounting** and not a certified statutory ledger.

## Classical structure

Journal (`cop_accounting_epoch_event`) → individual balanced debit/credit lines (`cop_accounting_epoch_posting`) → Grand livre (`cop_accounting_epoch_general_ledger` view) → Balance (`cop_accounting_epoch_trial_balance` view). The event and its lines are inserted by one PostgreSQL function call within one transaction. Aggregation views derive from posted lines, not mutable cached account balances.

The opening event `accounting.epoch.opened` is not itself a debit/credit transaction. It declares empty experimental opening balances, preserved but excluded historical records, no budget grant. Pre-Z0 projections are not carried forward.

## Database schema and contract

Applied migrations in JHN project:
- `cop_accounting_development_epoch_z0`: `public.cop_accounting_epoch`, `public.cop_accounting_epoch_event`, `public.cop_open_accounting_epoch(text,text,text,text)`.
- `cop_epoch_double_entry_journal`: `public.cop_accounting_epoch_posting`, `public.cop_post_epoch_journal(text,text,text,text,text,text,jsonb)`, `public.cop_accounting_epoch_general_ledger`, `public.cop_accounting_epoch_trial_balance`.

Journal insertion inputs: epoch_id, idempotency_key, actor_id, mandate_ref, budget_ref (may be null while budget system is pending), narration, lines JSON array. Each line has `account_id`, `side` (`debit|credit`), positive decimal `amount` encoded as a **string**, and `unit`. Minimum two lines; debits and credits must match **per unit**. Wrong epoch/mandate, unbalanced amounts, invalid units and conflicting idempotency payload cause an error. Duplicate exact payload returns existing event without additional postings.

SQL functions use `SECURITY INVOKER`. RLS enabled; public, anon and authenticated access revoked on new internal tables, sequences and views. `service_role` has execute on functions. No new public access policies.

## Live Reality Test

Epoch opened at 2026-10-15T21:00:01.033903Z (local Paris 23:00). Reopening same identity returned same epoch, one opening event.
A synthetic `TEST_UNIT` journal entry `z0:smoke:balanced-001` was inserted:
- debit `DEV:TEST.RESOURCE` amount `1`
- credit `DEV:TEST.OFFSET` amount `1`

Returned event_id `3`, 2 postings, duplicate false. Replaying returned event_id `3`, duplicate true. Trial balance rows read back: +1 / -1 in TEST_UNIT. A deliberately unbalanced debit 2 / credit 1 was **rejected** (exception `unbalanced_journal` caught by assertion block).

## Remaining important boundaries

- **No authority to spend is inferred.** Mandate-ref is checked against the development epoch mandate but is not a comprehensive authorization evaluator. Budget reservation/settlement (#163) not implemented, `budget_ref` currently nullable.
- Present implementation does not yet enforce immutable rows against direct privileged UPDATE/DELETE (normal callers only use granted function path); append-only policies/triggers and durable immutable event invariants need a dedicated check.
- No multi-writer concurrency or crash injection test beyond DB transactional behavior has yet been reported.
- The legacy `supabaseAccountingStore.js` still serves old tables and is not automatically upgraded; route new handlers to Z0 only after an adapter and CI tests are implemented.
- Synthetic ledger entry is a demonstration, not a monetary cost or budget commitment.
- This documentation records deployed schema and behavior; SQL migration source should be exported/reconciled with repository migration history before further changes.

This is the minimum viable general-ledger starting point, not completion of Accounting #161.
