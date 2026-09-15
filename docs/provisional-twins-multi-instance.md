---
title: Provisional Twins & Fractal Multi-Instance Architecture
document_role: specification
document_kind: architecture
visibility: public
lifecycle_state: approved
language: en
update_policy: UP-DEFAULT-REVIEWED
issue: https://github.com/JeanHuguesRobert/inseme/issues/57
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
status: working-paper
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Provisional Twins & Fractal Multi-Instance Architecture

## 1. Overview & Problem Statement

Inseme originally assumed a heavy 1:1 mapping between a Digital Twin instance and a dedicated
Supabase/infrastructure deployment:

```text
Instance ──► Dedicated Supabase Project ──► Dedicated instance_config Table
```

While required for high-autonomy Personal Digital Twins, this model is too heavy for large fleets of
lightweight agents, sub-agents, or provisional community representations.

The **Provisional Twin** pattern introduces a **fractal, multi-instance hosting model**:

- A lightweight Twin instance may exist initially with **no verified Principal**
  (`principal_id = null`).
- It is **hosted by another Twin/instance** (e.g. Agent JHN / Corsica Twin) from which it inherits
  capacity and configuration defaults.
- It represents a Subject using only bounded public/provisioned information.
- It can be progressively hydrated with traces and later **claimed / promoted** toward a sovereign
  Personal Twin without changing its semantic identity.

---

## 2. Definitional Taxonomies

To prevent semantic conflation, the following concepts are strictly distinguished:

| Concept                                           | Definition                                                                                                      | Invariant                                                                |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Physical Deployment Instance**                  | The underlying computing/database infrastructure (e.g., Supabase project, Node process, Netlify host).          | Multiple logical twins can share one physical deployment.                |
| **Logical Twin Instance**                         | The durable software agent identity defined by an immutable canonical `id` (UUID) in the `instances` registry.  | Identity survives hosting migration and infrastructure promotion.        |
| **Host Relationship (`host_instance_id`)**        | The directed link from a hosted instance to the parent instance providing execution capacity and configuration. | Recursive/fractal. Cycle-detected and fails closed.                      |
| **Principal Binding (`principal_id`)**            | The verified human, legal entity, or authority that owns and commands the Twin.                                 | For provisional twins, `principal_id = null`.                            |
| **Subject Representation (`subject_ref`)**        | The real-world person, collective, or entity that the Twin represents or models.                                | Representation does not imply personal authority or mandate.             |
| **External Source Identity (`ExternalIdentity`)** | The identity record on an external network (e.g., provider `'x'`, numeric ID `'12345'`).                        | Independent of Twin provisioning. Discovery does not equal provisioning. |
| **Hydration Depth (H0–H3)**                       | The depth and coverage of information ingested about the Subject.                                               | Orthogonal to infrastructure promotion level.                            |
| **Promotion Isolation Level (L0–L4)**             | The level of physical/storage isolation of the Twin.                                                            | Orthogonal to hydration depth.                                           |

---

## 3. Configuration & Capacity Inheritance

Effective configuration resolution traverses recursively upwards through the `host_instance_id`
chain:

```text
resolve(instance, key):
  1. Look for key scoped to instance in instance_config
  2. If absent and key is inheritable, resolve(host_instance_id, key)
  3. Continue recursively up to root sentinel ('00000000-0000-0000-0000-000000000001')
  4. Fallback to default
```

### Core Invariants

> **Capacity Invariant:** A Twin inherits capacity (LLM models, embeddings, tool definitions,
> quotas, service endpoints) from its host until it acquires its own.

> **Authority Invariant:** Hosting is **not authority-transitive**. Configuration and capacity are
> inherited; **authority, mandates, identities, and private memory are never inherited** merely
> because one Twin hosts another.

### Non-Inheritable Configuration Keys

Certain identity-bound configuration keys are strictly isolated and never leak to child instances:

- `bot_name`
- `community_name`
- `community_code`
- `app_url`
- `canonical_slug`
- `twin_root_ref`
- `represented_subject_ref`
- `owner_email`
- `owner_subject_ref`

---

## 4. Discovery vs. Provisioning vs. Hydration

```text
External Source (e.g. X / RSS / Mastodon)
    │
    ▼
ExternalIdentity (provider, provider_subject_id, handle)
    │
    ▼ [Relevance Filter & Policy]
ensureProvisionalTwin(external_identity, host_instance, policy)
    │
    ▼ [Lazy Materialization]
Provisional Twin (status: 'provisional', principal_id: null)
    │
    ├──► PublicTrace (Evidence: source-backed observations)
    └──► DerivedClaim (Inferences: model_id, confidence, provenance)
```

1. **Discovery is Cheap and Broad:** Crawlers can discover thousands of `ExternalIdentity` records
   without creating logical Twins.
2. **Provisioning is Lazy:** `ensureProvisionalTwin(...)` is idempotent and creates a minimal
   logical instance only when relevance thresholds are met.
3. **Public Traces are Evidence, NOT Beliefs:** Public posts and interactions are stored in
   `public_traces`. Derived topics or stances are stored in `derived_claims` with explicit model
   attribution and confidence. Imported public content is never presented as first-person assertions
   of the Twin.

---

## 5. Relational Layer: Cogentigram, Relatogram & Cognitive Interpreter

The multi-twin ecosystem connects individual representations via explicit relational primitives
defined in Cogentia research:

```text
┌───────────────────────────┐                     ┌───────────────────────────┐
│       Twin A (Host)       │                     │    Twin B (Provisional)   │
│  Cogentigram_A (Internal) │                     │  Cogentigram_B (Internal) │
└─────────────┬─────────────┘                     └─────────────┬─────────────┘
              │                                                 │
              └────────────────► ┌─────────────┐ ◄──────────────┘
                                 │ Relatogram  │
                                 │   R_AB(t)   │
                                 └──────┬──────┘
                                        │
                                        ▼
                           ┌─────────────────────────┐
                           │   Cognitive Interpreter │
                           │  (Impedance Matching)   │
                           └─────────────────────────┘
```

1. **Cogentigram vs. Relatogram:**
   - A **Cogentigram** models the intrinsic cognitive structure and beliefs of a single Twin. For a
     Provisional Twin, this is initially sparse and bounded by ingested `PublicTrace` evidence
     ($H_1$–$H_2$).
   - A **Relatogram ($R_{AB}(t)$)** models the **interface and accumulated interaction history
     between two specific Twins** ($A$ and $B$). It is not a unilateral dossier of $B$ stored by
     $A$; it records bidirectional communication parameters:
     - Established shared vocabulary and local definitions.
     - Asymmetric cognitive impedance ($Z(A \rightarrow B) \neq Z(B \rightarrow A)$).
     - **Successful repair history:** prior misunderstandings and the exact reformulations that
       successfully resolved them.
2. **Cognitive Interpreter across Multi-Instance Nodes:**
   - The Cognitive Interpreter uses the Relatogram to adapt representations (granularity,
     vocabulary, intermediate reasoning steps) during agent-to-agent exchanges (e.g. Agent John
     interacting with a provisional municipal twin in Olé Olé), ensuring semantic fidelity while
     minimizing communication impedance.
3. **Identity & Relational Persistence:**
   - When a Provisional Twin is claimed and promoted ($L_0 \rightarrow L_4$), its accumulated
     Relatograms with sibling and host twins survive the infrastructure migration, preserving
     relational continuity.

---

## 6. Promotion (L0–L4) & Hydration (H0–H3) Dimensions

### Infrastructure Promotion Levels

- **L0:** Row/config only within host execution loop.
- **L1:** Logical instance in shared multi-tenant database (`instances` + `instance_config`).
- **L2:** Dedicated schema / stronger tenant isolation.
- **L3:** Dedicated Supabase / Postgres database project.
- **L4:** Autonomous physical host deployment.

### Information Hydration Depth

- **H0:** External identity pointer only.
- **H1:** Public profile metadata (bio, name, avatars).
- **H2:** Bounded recent public traces (posts, public interactions).
- **H3:** Extended corpus, interaction history, and relational graph.

---

## 6. Security, RLS & Multi-Tenancy

- **Secret Isolation:** Shared `instance_config` rows with `is_secret = true` are inaccessible to
  unauthorized roles and can only be read by the authenticated Principal of that specific instance.
- **Fail-Closed Cycle Protection:** Circular host graphs are detected and broken immediately,
  falling back safely to default configuration.
- **Cache Invalidation:** Effective configuration caches must be keyed by
  `(instance_id, effective_config_version)` and invalidated upon instance reparenting or
  configuration mutation.
