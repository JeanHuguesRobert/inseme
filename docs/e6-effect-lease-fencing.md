---
title: "E6 — Lease generations and stale-handler fencing"
date: 2026-10-08
document_role: operational
document_kind: reality-test
visibility: public
lifecycle_state: verified-limited
---

# E6: lease epoch fencing policy

After E5 proved independent jobs can contend for one Git ref, E6 models *reusable* effect reservation semantics separately from that implementation:

- `cop.effect-lease/v1` carries stable effect ID, holder, monotonically increasing generation, expected canonical revision, expected target revision and expiration.
- `inspectEffectLease()` rejects stale generation, expired lease, withdrawn intent, already-satisfied desired state, missing authoritative observation, unexpected canonical or target revision, and expired mandate/budget checks.
- An eligible inspection returns **`preflight_only`** and `provider_atomic_check_required: true`: it never commits an effect and never grants authority based only on memory.

7/7 synthetic tests passed by GitHub Compute:
https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6067315357

Files:
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/effect-lease-fence.js
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/effect-lease-fence.test.js

## Limits and next boundary

The inspected values are caller-supplied observations. E6 **does not** establish an atomic lease authority, compare-and-swap, cross-provider transactional fencing or real stale-writer resistance. A handler can be paused immediately after preflight. It must not proceed to an irreversible side effect unless that provider can check the *current* lease epoch and destination revision atomically as part of that side effect, or the operation uses a narrower idempotent/compensatable policy.

A Git tag's atomic *creation* from E5 is a one-shot reservation, not a renewable lease, and deletion/recreation can undermine naïve reuse. Avoid presenting it as a distributed lock with fencing.

The chat agent's conversational memory may index the lease reference but is not the canonical authority for its epoch, status or freshness.

Follow-up design: choose a durable store with an actual atomic conditional update interface; attach generation to each effect request; enforce terminal status in a durable append-only journal; record separate claim and completion receipts; simulate pauses/revocations between claim and write. If provider lacks conditional write semantics, fail closed or constrain operation to idempotent effect types.

## Lease resource obligation — accounting correction (2026-10-08)

A lease **always** consumes or commits resources, even if its marginal currency charge is zero or its quantity is unavailable. This is not merely a price tag. It may consume API call quota, retention/storage, allocated concurrency, scheduler checks, renewal traffic, agent or human attention, risk and opportunity costs. A zero price in EUR does not prove zero resources. Unknown quantity MUST remain `status: unknown`, never an invented zero.

`cop.lease-resource-obligation/v1` is required by `makeEffectLease`. Each resource dimension uses `observed | estimated | unknown`; numeric values are required for observed and estimated, prohibited for unknown. A budget reference and outstanding settlement are recorded. At preflight, an explicit current reservation and authorization for unknown-cost risk are separately required. No actual ledger reservation is performed by these pure functions: a real COP/Accounting ledger must record and later settle the reservation, including retries, maintenance/renewals, expiry and cancellations. Authority to proceed is not obtained by manufacturing a budget reference.

Source: https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/effect-lease-accounting.js

As a policy invariant: **no lease without accounted resource obligation, no preflight success without explicit budget authorization and reservation evidence; unknown never means free.**
