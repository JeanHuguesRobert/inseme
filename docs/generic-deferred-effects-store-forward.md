---
title: "Generic Deferred Effects and Retryability"
date: "2026-10-08"
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
---

# Deferred effects are provider independent

A failed operation carries a **retry prognosis**, not merely a success/failure bit:

- `code`: operational reason, without leaking credentials.
- `retryability`: `retryable|terminal` as currently assessed.
- `retry_after`: optional earliest retry time, **not a promise of eventual success**.
- `attempt` and `max_attempts`: bound the retry cycle.
- `next_action`: `store_and_forward|return_to_handler`.

A `cop.deferred-effect/v1` envelope captures a provider-independent capability requirement, target, operation, inputs, explicit mandate and budget references, effect idempotency key, and commit-time preconditions. A transient error can be stored and later offered to a new handler.

**Retrying is a new governed Act.** The new handler must check current mandate, budget, target revision, Packet coordination claim/epoch, access, and deduplication at the effect boundary. Storing an effect is not authorization to execute it later. Never queue an email send silently. Distinguish safe retries (idempotent) from ambiguous outcomes where the first attempt may already have taken effect.

## Store interface and backends

The envelope protocol does not mandate a store. Suitable backends include:
- COP Store with durable indexed event/outbox and eligible scheduler dispatch;
- GitHub Actions temporary artifact store (30-day outbox; bounded);
- ChatGPT Library files as persistent human/agent-recoverable **documents** when the capability and authorization are available;
- other storage providers resolved by capabilities.

ChatGPT Library can hold serialized effects, but **a Library file does not automatically trigger a retry or provide a transactional dequeue/lease/lock**. Processing requires an authorized handler, explicit automation, or scheduler with access. Library must not be used as a public queue for secrets or sensitive content. A cross-store claim and atomic idempotency guarantee is a distinct protocol.

## Layering

COP: failure prognosis, effect intent, lifecycle, authority checks, return.
Magistral: capability requirement, eligible provider selection with quotas.
Fractanet: routing of actual executor/storage capability.
Provider adapter: GitHub/Gmail/other concretions, version-safe side effects, receipts.

References:
- https://github.com/JeanHuguesRobert/inseme/issues/89
- https://github.com/JeanHuguesRobert/inseme/issues/120
- https://github.com/JeanHuguesRobert/inseme/issues/121
- https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/COP_ACCOUNTING.md
