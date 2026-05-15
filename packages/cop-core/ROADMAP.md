---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/ROADMAP.md
last_stamped_at: 2026-05-15
---

# ROADMAP — Cognitive Orchestration Protocol (COP)

This roadmap describes the **evolution of the COP ecosystem**, not a product delivery plan.

COP is a protocol. Its roadmap prioritizes **stability, correctness, and adoption** over feature
velocity.

---

## Guiding Principles

All roadmap items follow these principles:

- **Core before tooling** — the protocol must stabilize before ecosystems grow
- **Specification before implementation** — behavior is defined first, coded second
- **Additive evolution** — no breaking changes without a major version
- **Replaceable runtimes** — no dependency on a single kernel or vendor

---

## Current Status (v0.x)

### Specification

- Core data model: **stable**
- Protocol invariants: **formalized**
- Execution model: **specified**
- Continuations: **first-class, specified**
- CloudEvents mapping: **defined**
- JSON-LD semantic layer: **defined**
- Integrity and ledger model: **defined**

At this stage, COP is **architecturally complete**.

---

## Reference Implementation: cop-kernel

`cop-kernel` is the **reference implementation** of COP/Core.

Its role is:

- to validate the specification,
- to surface ambiguities or missing constraints,
- to provide a concrete execution model for adopters.

### Current focus

- Event ingestion and replay
- Deterministic projection engine
- COPStore / COPReadOnlyStore separation
- Scheduler and continuation resumption
- Agent execution contracts

The reference kernel is **not normative**.

Alternative kernels are expected and encouraged.

---

## Short-Term Roadmap (v0.x)

### 1. Specification hardening

- Freeze COP/Core v0 specification
- Clarify edge cases discovered via cop-kernel
- Add conformance tests and invariants checks

### 2. Reference kernel maturation

- Stabilize cop-kernel APIs
- Improve replay performance (snapshots, checkpoints)
- Harden failure and retry semantics

### 3. Tooling for adopters

- Minimal test harness for COP compliance
- Reference schemas and validators
- Documentation examples (non-normative)

---

## Mid-Term Roadmap (v1.0)

### 1. COP/Core v1.0

- Declare COP/Core stable
- Guarantee backward compatibility
- Establish versioning and migration rules

### 2. Profiles

- COP/HITL (human-in-the-loop)
- COP/AI (agent orchestration patterns)
- COP/Legal (audit, evidence, ledger usage)

Profiles remain optional and additive.

---

## Long-Term Roadmap

### Ecosystem

- Multiple independent COP kernels
- Framework adapters (LangGraph, Temporal, etc.)
- Visualization and inspection tools

### Institutional adoption

- Governance workflows
- Regulatory-grade audit trails
- Long-term archival of cognitive processes

### Research

- Comparative analysis of agent behavior
- Reproducible cognitive experiments
- Longitudinal studies of AI decision systems

---

## Explicit Non-Goals

The COP roadmap explicitly excludes:

- building a monolithic platform,
- competing with agent frameworks,
- embedding proprietary services,
- rapid feature churn.

COP evolves slowly by design.

---

## Final Note

The success of COP is measured by:

- how long cognitive traces remain interpretable,
- how easily systems can be replaced underneath them,
- how little the protocol needs to change over time.

The reference kernel will evolve.

The protocol should not.
