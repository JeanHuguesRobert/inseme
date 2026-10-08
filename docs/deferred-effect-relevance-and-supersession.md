---
title: "Deferred effects: temporal validity, supersession and concurrent completion"
date: "2026-10-08"
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
---

# Store & Forward is not execute-later-at-any-cost

A deferred effect is a *candidate intention*, not an immutable command that must eventually be executed. While waiting, the desired state, mandate, budget, source generation, external target revision, or temporal window can change. Another handler may already have achieved the same outcome. The forwarder MUST re-evaluate current relevance, not just the technical retryability of the earlier failure.

Independent outcomes:
- `satisfied_elsewhere`: another act achieved the intended effect. Record evidence and mark it resolved without replay.
- `obsolete/expired`: known validity window has passed.
- `obsolete/superseded`: a later intention supersedes the stored one, even if no original expiry was known.
- `reconcile`: target revision or Packet generation has changed; a handler must compare current desired state before preparing a new act.
- `deferred`: fresh observations unavailable or retry time not reached.
- `blocked`: authority, budget or claim are missing.
- `eligible_preflight_only`: no observed obstacle, but still **not** authorization to apply the Act without an atomic effect-boundary check.

Fields in the generic envelope include optional `valid_until`, `expected_target_revision`, `expected_packet_generation`, and an idempotency key. Supersession is an observed state / Event, not a mutation of historical records.

This joins #120 generic Store & Forward with #121 Packet coordination and with COP/Accounting. A future durable effect-store projection must index targets, deduplicate semantic desired states (not merely identical requests), track supersession, and preserve append-only causal evidence.

**Warning:** `evaluateDeferredEffect` is a synchronous preflight taking caller-supplied observations. It does not prevent a race between checking state and applying an effect in GitHub/Gmail. A F4 transactional fence and provider-specific conditional mutation remain necessary.

References:
- https://github.com/JeanHuguesRobert/inseme/issues/120
- https://github.com/JeanHuguesRobert/inseme/issues/121
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/deferred-effect.js
