---
title: COP FractaLog Profile
subtitle: Packet-local source traces, federated projections, custody and delayed transparency
description: Source profile for integrating FractaLog semantics into COP, with Cognitive Packets as the preferred source location for packet-borne trace facts and higher-level FractaLog views as governed projections.
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A. / Inseme
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_fractalog_profile.md
version: 0.2-draft
status: source profile draft — human validation required before COP-core extraction
date: '2026-07-06'
last_modified_at: '2026-08-16'
last_stamped_at: '2026-08-16'
license: CC BY-SA 4.0
language: en
type: source-document
source_or_derived: source-document
related_repositories:
  - JeanHuguesRobert/inseme
  - JeanHuguesRobert/FractaVolta
  - JeanHuguesRobert/barons-Mariani
  - JeanHuguesRobert/cogentia
related_documents:
  - inseme/research/cop_trace_model.md
  - FractaVolta/research/fractalog.md
  - inseme/packages/cop-kernel/docs/packet-strict-accounting-cascade.md
  - inseme/packages/cop-core/Architecture.md
  - inseme/packages/cop-core/Invariants.md
  - inseme/research/cop_memory_profile.md
  - barons-Mariani/research/traceabilite_des_actes.md
tags:
  - cop
  - fractalog
  - cognitive-packets
  - packet-local-trace
  - append-only-log
  - custody
  - delayed-transparency
  - auditability
human_validation_required: true
document_role: source
document_kind: protocol-profile
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
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


# COP FractaLog Profile

## 1. Purpose

This document defines the source-level COP profile for FractaLog.

Its central clarification is:

> **For an act performed while processing a Cognitive Packet, the preferred source location of the
> trace facts is the packet itself, or a content-addressed object directly referenced by that
> packet. FractaLog above the packet is a governed projection/federation of those source facts, not
> a second source ledger.**

This applies the same source/projection discipline already used by packet-strict accounting: facts
belong where the act and resource consumption occur; consolidated views are projections.

This does **not** require every byte of evidence to be physically embedded inline. Large, private,
encrypted, immutable or externally preserved evidence may be represented by durable
content-addressed references. The packet must retain enough provenance to make the source
relationship explicit and auditable.

## 2. Relation to COP/Core

This profile preserves COP/Core invariants and does not replace Event, Topic, Task, Step, Artifact,
Continuation, Store, Projector, Scheduler or Bus.

COP/FractaLog adds semantics for:

- packet-local source traces;
- causal and append-only trace commitments;
- higher-level log projections and federation;
- custody and ownership references;
- inheritance and succession;
- restricted visibility and delayed transparency;
- redaction without causal erasure;
- mandate-trace non-erasure.

## 3. Source facts versus projections

The profile distinguishes three layers.

### 3.1 Packet-local source trace

When a Cognitive Packet is processed, facts created by that processing SHOULD be recorded on the
packet or directly referenced from it:

```text
handler / tool / node act
        ↓
Cognitive Packet
  - lineage
  - mandate reference
  - handler / capability reference
  - timestamps / causal parents
  - spending / resource facts
  - evidence references
  - trace commitments
  - resulting artifacts / yields
```

The packet is therefore the natural travelling logbook of the cognitive work.

### 3.2 Referenced source evidence

A packet MAY point to immutable or content-addressed evidence instead of embedding it:

```text
packet.trace.evidenceRef -> sha256 / artifact / sealed object / external durable record
```

Reference indirection MUST NOT be used to erase provenance or silently replace source facts.

### 3.3 FractaLog projection

Agent, Mission, institution, federation, audit and public FractaLog views are derived from
packet-local sources and other legitimate non-packet events:

```text
packet-local traces + non-packet governed events
        ↓
projectors / indexes / causal joins
        ↓
agent FractaLog
mission FractaLog
institutional FractaLog
federation audit view
```

A projection MAY be cached, indexed, Merkle-anchored, redacted or replicated. It MUST NOT become a
competing source of truth by copying and mutating source facts independently.

## 4. Non-packet events

Not every FractaLog fact originates in a Cognitive Packet. Custody transfers, legal acts, external
observations, human decisions or infrastructure events may have their own authoritative source
artifacts/events.

The invariant is therefore not `all FractaLog facts are packets`.

It is:

> **Put source facts where the accountable act occurs; when the act is packet-borne cognitive work,
> keep its source trace packet-local; consolidate higher-level views by projection.**

## 5. Packet trace profile

A minimal packet-borne trace extension may contain:

```json
{
  "fractalog": {
    "schemaVersion": "cop.fractalog.packet-trace.v0",
    "source": "packet-local",
    "actorRef": "urn:cop:agent:...",
    "mandateRef": "urn:cop:mandate:...",
    "parentEventIds": ["urn:cop:event:..."],
    "evidenceRefs": ["urn:cop:artifact:..."],
    "visibility": "open|redacted|restricted|sealed|escrowed",
    "previousCommitment": "sha256-...",
    "traceCommitment": "sha256-..."
  }
}
```

The exact runtime schema remains experimental. This document freezes the semantic direction, not
these field names.

## 6. Lifecycle and governance events

Lifecycle and governance events remain append-only. Initial vocabulary includes:

```text
fractalog.log.created
fractalog.log.segment.sealed
fractalog.log.root.anchored
fractalog.custody.assigned
fractalog.custody.transferred
fractalog.ownership.ref_attached
fractalog.log.inherited
fractalog.redaction.applied
fractalog.context.added
fractalog.correction.added
fractalog.restriction.applied
fractalog.restriction.review_scheduled
fractalog.restriction.review_performed
fractalog.restriction.released
fractalog.mandate_trace.sealed
```

A lifecycle projection must be explainable by replaying its source events and packet traces.

## 7. Restricted trace model

Content visibility and trace existence are distinct.

| Level        | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `open`       | Trace and permitted content are accessible.                             |
| `redacted`   | Trace exists; selected content is masked.                               |
| `restricted` | Access requires authorization.                                          |
| `sealed`     | Integrity/existence may be attestable while content is closed.          |
| `escrowed`   | Public disclosure is delayed while an accountable source record exists. |

Rule:

> Restricted visibility may hide content. It must not silently erase the causal existence of an
> engaging act.

## 8. Redaction, custody and delayed transparency

Redaction is a new governed act or projection, never an in-place rewrite of committed source
history.

Custody, ownership, controller and successor roles remain distinct. Moving custody of an evidence
object does not change the causal source relationship recorded by the packet.

Restricted traces SHOULD carry a review path with authority, reason, scope, review deadline,
extension conditions and release/audit semantics. Secrecy may defer access; it must not destroy
memory.

## 9. Mandate-trace non-erasure

The profile distinguishes private data, collateral personal data and mandate traces. Private or
collateral data may be minimized, redacted or access-limited according to applicable policy. An
engaging mandate trace must remain causally accountable even when its content is restricted.

## 10. Federation and fractality

FractaLog remains fractal, but fractality is primarily a property of **views and commitments**, not
a requirement to maintain independent mutable source ledgers at every level.

```text
packet source traces
  ↓
local causal projection
  ↓
Mission / agent projection
  ↓
institution / node projection
  ↓
federation roots and proofs
```

Higher levels SHOULD aggregate references, roots and proofs when possible rather than absorb all
lower-level content.

## 11. Conformance requirements

A conformant implementation SHOULD:

1. keep packet-borne source trace facts on or directly referenced by the owning Cognitive Packet;
2. avoid duplicating those facts into an independently mutable FractaLog source ledger;
3. preserve causal provenance across projections;
4. represent higher-level FractaLog state as replayable projections/federations;
5. preserve append-only correction semantics;
6. distinguish content visibility from trace existence;
7. preserve mandate-trace accountability;
8. make content-addressed indirection explicit when evidence is not inline;
9. preserve custody, delayed-transparency and review semantics;
10. support deterministic reconstruction of the visible projection for a given policy and source set
    where feasible.

## 12. Non-conformant patterns

```text
copying packet trace facts into a second ledger and later treating the copy as the source
mutating a higher-level projection without a source act
losing packet lineage when consolidating logs
using external evidence references without durable provenance
hard-deleting an engaging mandate trace without accountable destruction/tombstone semantics
using restricted status to remove auditability rather than restrict access
```

## 13. Open implementation questions

1. Which packet schema fields should become normative in `cop-core`?
2. Which trace commitments should be mandatory versus profile-specific?
3. How should packets reference encrypted or legally segregated evidence?
4. Which projector builds Mission/agent FractaLog views?
5. How should Merkle anchoring compose packet-local commitments without duplicating payloads?
6. Which non-packet event families remain first-class FractaLog sources?
7. What regression fixture proves that packet-local source semantics survive handler substitution
   and projection rebuild?

## 14. Continuation

Next actions:

1. Align `FractaVolta/research/fractalog.md` terminology with packet-local source semantics without
   discarding its governance model.
2. Remove the implication that `COPMission.fractalogRef` denotes a separate source ledger; retain it
   only as a projection/view reference if useful.
3. Add a conformance fixture using packet traces, projection rebuild and a deliberate attempted
   source/projection divergence.
4. Verify consistency with packet-strict accounting.
