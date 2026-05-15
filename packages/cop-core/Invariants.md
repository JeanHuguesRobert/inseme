---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Invariants.md
last_stamped_at: 2026-05-15
---

# COP Protocol Invariants

This document defines the **non-negotiable invariants** of the Cognitive Orchestration Protocol
(COP).

Any system claiming COP compliance MUST preserve these invariants.

They are architectural constraints, not implementation suggestions.

---

## 1. Immutability

**Events and Artifacts are immutable.**

Once created:

- an Event MUST never be modified or deleted,
- an Artifact MUST never be modified or deleted.

Corrections, updates, or reversals MUST be expressed as **new Events**.

Immutability guarantees:

- auditability,
- causal reasoning,
- deterministic replay,
- long-term integrity.

---

## 2. Topic-Local Ordering

All Events belong to exactly one **Topic**.

Within a Topic:

- Events are totally ordered by a monotonically increasing `topicSeq`,
- ordering MUST be strict and gap-free for persisted Events.

Across Topics:

- no global ordering is assumed,
- causal links MAY exist via explicit references.

Topic-local ordering is the foundation of replay.

---

## 3. Idempotency

Event delivery is **at-least-once**.

Therefore:

- Projectors MUST be idempotent,
- repeated processing of the same Event MUST NOT corrupt state,
- deduplication MUST rely on Event identity, not transport guarantees.

Idempotency enables:

- retries,
- fault tolerance,
- distributed execution.

---

## 4. Durability

All meaningful system state MUST be derivable from:

- the Event log,
- and the set of Artifacts.

No critical state MAY live exclusively in:

- agent memory,
- process-local variables,
- ephemeral caches.

If a system cannot be reconstructed from Events and Artifacts, it is not COP-compliant.

---

## 5. Stateless Agents

Agents MUST be stateless.

This means:

- no mutable in-memory state across events,
- no reliance on hidden local caches for correctness,
- all context must be obtained from the Store or Continuation payloads.

Stateless agents enable:

- horizontal scalability,
- restartability,
- deterministic replay,
- safe evolution of agent code.

---

## 6. Isolation via Events

Agents MUST NOT communicate directly with each other.

All coordination MUST occur via:

- Events published to the Bus,
- and Artifacts referenced by Events.

This ensures:

- loose coupling,
- clear causality,
- inspectable interactions,
- elimination of hidden dependencies.

---

## 7. Deterministic Replay

Given:

- the same ordered Event log per Topic,
- the same Artifact set,
- and deterministic Projectors,

replay MUST reconstruct the same observable state.

Non-determinism MUST be externalized as Events or Artifacts.

---

## 8. Schema Versioning

Events and Artifacts MUST carry explicit `schemaVersion` fields.

Rules:

- new versions MUST be backward-readable,
- old versions MUST remain interpretable,
- breaking changes require explicit major versioning.

Versioning protects long-term interpretability.

---

## 9. Transparency over Convenience

COP favors:

- explicitness over hidden magic,
- durability over short-term performance,
- inspectability over opaque abstractions.

If an optimization violates an invariant, it is invalid.

---

## Final Note

These invariants are what make COP different.

Violating any of them may produce a working system — but not a COP system.
