---
title: COP persistence — source, artifact, projection
date: '2026-08-07'
document_role: operational
document_kind: method
visibility: public
related_issue: https://github.com/JeanHuguesRobert/inseme/issues/28
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
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


# COP persistence — source vs artifact vs projection

Short implementation note for #28 (append-only event profile).

| Kind                 | Role                                           | Mutability                                             | Examples                                                          |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| **Source (event)**   | Durable fact of an accountable act             | Append-only; corrections = new events                  | `cop.event/v1` envelope in `cop_event_log` or memory/NDJSON store |
| **Inbound delivery** | Provider-native receipt before/while normalize | Append-only delivery row; processing state may advance | `github_webhook_deliveries`                                       |
| **Artifact**         | Heavy/raw bytes by reference                   | Immutable blob; event keeps hash + ref                 | Raw webhook body in object store; `artifact_ref` + `payload_hash` |
| **Spool**            | Local degraded durability                      | Append NDJSON; replay into durable store               | `createNdjsonCopEventSpool`                                       |
| **Projection**       | Rebuildable view                               | Disposable / rebuild anytime                           | Activity feed, search index, embeddings                           |
| **Cache**            | Performance only                               | Disposable                                             | Edge CDN, in-process maps                                         |

**Rules**

1. Projections never become the source of truth.
2. Hiding content (`visibility`) must not erase causal existence of the event row.
3. Receipt ≠ acceptance: delivery can be `received` without an authorized act.
4. Identity/mandate policy is #30; this profile only stores evidence.

## Runtime pieces (2026-08-07)

| Component                                             | Role                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `createMemoryCopEventStore` / NDJSON spool            | Local / test / degraded Node paths                        |
| `createMemoryArtifactStore` / `createFsArtifactStore` | Immutable raw bodies by hash                              |
| `projectEventForViewer`                               | Restricted visibility without erasing event rows          |
| `createCopEventPersistPipeline`                       | delivery → artifact → store; store fail → spool           |
| `cop_event_append` (SQL)                              | Atomic `topic_seq` on Supabase                            |
| Edge `github-webhook.js`                              | HMAC → delivery → optional storage artifact → RPC → spool |

See `docs/cop-append-only-mvp-status.md` for #28 closeout evidence.
