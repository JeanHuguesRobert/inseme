# COP Accounting Z0 — grant with journal, 2026-10-16

Migration applied on JHN: `cop_epoch_budget_grant_journal`.

`cop_grant_epoch_budget(epoch_id,budget_ref,mandate_ref,unit,amount,actor,authority_ref)` performs the creation of a budget row and an append-only `accounting.budget.granted` event inside one PostgreSQL transaction. It checks epoch open, mandate equality, positive grant and nonempty authority reference; duplicate identical grant is recognized, conflicting regrant refused.

**Evidence:** tested in JHN in rollback-only subtransaction, including a matching replay, then verified 0 persisted budgets. No spending authorization was issued.

**Security/semantics limit:** `authority_ref` is currently a *reference assertion* only, not an independently verified mandate. Direct table grants and legacy `cop_reserve_epoch_budget` / `cop_settle_epoch_budget` still offer possible bypass to privileged roles; there is **no enforcement guarantee yet** that every reserve/settle is journaled. Do not call #163 complete.

**Next FBF:** make these budget operations non-bypassable at the database boundary, while preserving `SECURITY INVOKER`, permissions and transaction atomicity; inspect privilege grants before changing them. Add SQL migrations to source control and multi-session concurrency test. No synthetic budget should be left active.
