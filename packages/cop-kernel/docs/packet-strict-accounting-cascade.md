---
title: Cognitive Packet strict accounting — own vs consolidated cascade
date: '2026-08-13'
status: working
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
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


# Cognitive Packet strict accounting — own vs consolidated

## Monetary unit

**Default provisional fiat unit: USD** (`DEFAULT_MONETARY_UNIT`), because major LLM/API providers
price and bill in US dollars. Rate cards and `provisional_cost` use this default. Other resources
(CXU, energy, Kudos) keep their own units on `ExactQuantity` and must not be silently converted into
USD without an explicit valuation event.

## Lineage vocabulary (prefer non-anthropocentric terms)

| Preferred (schema)                       | Meaning                                                | Colloquial alias |
| ---------------------------------------- | ------------------------------------------------------ | ---------------- |
| **upstream** (`upstream_packet_id`)      | Packet that authorized / spawned this work             | parent           |
| **downstream** (`downstream_packet_ids`) | Packets spawned from this one                          | children         |
| **spawn_reason**                         | Why the link exists (subagent, split, tool_subtask, …) | —                |
| cascade root                             | No upstream                                            | root             |
| leaf                                     | No downstream                                          | leaf             |

Also considered: source/derived, origin/spawned, superordinate/subordinate.  
Rejected: envelope/member (clashes with envelope/payload).

API: `spawnDownstreamPacket(upstream, params)` (alias `spawnChildPacket` deprecated).

## Atomic cost unit vs hop

| Concept                      | Role                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| **ProvisionalSpending** line | Atomic cost event (tokens + provisional USD)                       |
| **Hop**                      | Routing/execution locus (node, instance)                           |
| Relation                     | A hop may have 0..N spend lines; spend lines reference `hop_index` |

**Own total ≠ “sum of hops”** as hop objects; it is **Σ spending lines** on that packet.

## Own vs consolidated (strict)

```text
own_spend(P)         = Σ P.spending[]
consolidated_spend(P) = own_spend(P)
                      + Σ_i consolidated_spend(downstream_i)
```

Rules:

1. A physical provider call has **exactly one owning packet**.
2. **Never copy** downstream `spending[]` into upstream `spending[]`.
3. Upstream only stores **ids** in `lineage.downstream_packet_ids`.
4. `consolidated_spend` is a **projection** (rollup), not a second book of postings.
5. `calculatePacketTotalSpending` remains **own-only** for backward compatibility; prefer
   `calculatePacketOwnSpending` / `calculatePacketConsolidatedSpending`.

### Double-count prevention

- Unique `spend_id` per packet (`spend:0`, …); reject duplicates.
- Optional `evidence_hash` uniqueness per packet.
- Cascade audit: each `packet_id::spend_id` key appears once across the cascade
  (`auditPacketSpendNoDoubleCount`).
- Consolidated walk refuses keys seen in more than one `own_spend`.
- Cycle detection on lineage graph.

### Identity of a spend line

```text
global_spend_key = packet_id + "::" + spend_id
```

## Mandate and budget

Still on the packet:

- `mandate_id` (required)
- `budget_reservation_id` (optional; spawn may inherit or attenuate)
- `account_id`

Spawn inherits mandate/treatment/account/reservation by default; pass overrides for attenuated
sub-mandates.

## API surface (`@inseme/cop-kernel`)

| Function                              | Role                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| `createCognitivePacket`               | Root or free packet; sets `monetary_unit_default: USD`, empty lineage |
| `spawnDownstreamPacket`               | Link upstream ↔ downstream without copying spend                      |
| `appendPacketHop`                     | Routing hop                                                           |
| `appendPacketSpending`                | Own spend line + balanced provisional txn event                       |
| `calculatePacketOwnSpending`          | Own only                                                              |
| `calculatePacketConsolidatedSpending` | Own + recursive downstream                                            |
| `auditPacketSpendNoDoubleCount`       | Multi-packet audit                                                    |
| `summarizePacketSpending`             | Report view                                                           |

## Relation to Guide surface costs

Guide `cost_estimate` is a **surface ledger**. Strict COP path is: attach each synthesis call as
`appendPacketSpending` on the active treatment packet (or a dedicated surface packet). Cascade
subagents spawn downstream packets.

## Status

Implemented in `src/accounting/packetAccounting.js` + types in `@inseme/cop-core` `packet.ts`.
Tests: `test/packetAccounting.test.js` case 7.
