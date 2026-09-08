---
title: "COP Mission Stigmergy and Rational Exploration"
subtitle: "Technical bridge between Mission, The Possible, continuations, stigmergic traces, FractaLog, and corpus return"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
date: "2026-07-10"
last_modified_at: "2026-09-08"
status: "working-note"
document_role: "source"
document_kind: "technical-architecture-note"
visibility: "public"
lifecycle_state: "working"
language: "en"
related_documents:
  - "packages/cop-core/Architecture.md"
  - "packages/cop-kernel/docs/task-step-continuation-lineage.md"
  - "research/cop_fractalog_profile.md"
  - "barons-Mariani/research/rational_odysseys_the_possible.md"
  - "barons-Mariani/research/presencology.md"
  - "FractaVolta/research/fractalog.md"
  - "FractaVolta/research/ownership_packets_and_cop.md"
tags:
  - cop
  - mission
  - continuation
  - stigmergy
  - fractalog
  - cognitive-packets
  - the-possible
  - rational-exploration
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "explicit-metadata"
classification_confidence: "medium"
---

# COP Mission Stigmergy and Rational Exploration

## 1. Purpose

COP has primitives for packets, events, artifacts, tasks, steps, continuations, traces and resumable workflows. A **Mission** is the higher-level mandate-bearing envelope for rational exploration of **The Possible**.

```text
Mission = mandate + possible-space + agents + capabilities + traces + return protocol
```

A Task executes. A Mission explores.

## 2. Core definitions

A **possible-space** is the region of The Possible being explored by a Mission. A **stigmergic trace** is a structured marker left so later intelligence may orient, reinforce, contradict, avoid, resume or synthesize. A **return protocol** defines how exploration becomes useful to the Corpus through debrief, trace sorting, artifact promotion, map update, preservation of dead ends, theory candidates and continuations.

## 3. Mission versus execution primitives

| Concept | Main question |
|---|---|
| Mission | Why explore, for whom, and under which mandate? |
| Cognitive Packet | What cognitive work is travelling and being processed? |
| Task | What should be done now? |
| Step | What executable move occurs? |
| Continuation | Where can this process resume? |
| Artifact | What survived the work? |
| FractaLog projection | What accountable trace view can be reconstructed/federated? |
| Stigmergic Trace | What should guide later intelligence? |

A Mission does not replace packets or Tasks and must not become a second source ledger for their execution facts.

## 4. FractaLog source-local correction

Mission-level FractaLog references are **projection references**, not assertions that one separate Mission log physically contains the source truth of every packet-borne act.

For packet-borne work:

```text
Cognitive Packet
  └── source trace facts / direct content-addressed references
            ↓
      FractaLog projector
            ↓
      Mission trace view
```

Therefore a Mission MAY expose:

```json
{
  "fractalogProjectionRef": "urn:fractalog:projection:mission:..."
}
```

but the authoritative trace facts for processing of packet `P` remain in or directly content-addressed by `P`.

This preserves the general invariant:

> **Put source facts where the accountable act occurs; federate and consolidate by projection.**

Non-packet acts — human decisions, custody transfers, legal acts or infrastructure events — may have other legitimate accountable sources. Mission views federate them without pretending they all originated in packets.

## 5. Mythic grammar

| Image | COP primitive |
|---|---|
| Odyssey | Mission lifecycle |
| Ithaca | Corpus return point |
| Sea | Possible-space |
| Island | Branch / hypothesis / domain |
| Ariadne's thread | Continuation / provenance / trace-back |
| Logbook | FractaLog projection over accountable sources |
| Base camp | Mission coordination and custody substrate |
| Argonauts | Multi-agent crew |
| Flotilla | Distributed agentic architecture |
| Theory | Stabilized high-level synthesis |

The grammar aids human understanding; it is not required for machine execution.

## 6. Minimal Mission model

```json
{
  "type": "COPMission",
  "schemaVersion": "cop.mission.v0",
  "missionId": "urn:cop:mission:...",
  "principalIdentityId": "did:example:principal",
  "missionKind": "rational_exploration",
  "possibleSpaceRef": "urn:cop:possible-space:...",
  "status": "active",
  "tracePolicyRef": "urn:cop:policy:mission-trace:v0",
  "returnProtocolRef": "urn:cop:policy:return-to-corpus:v0",
  "baseCampRef": "urn:cop:basecamp:...",
  "ownershipPolicyRef": "urn:cop:policy:mission-ownership:v0",
  "fractalogProjectionRef": "urn:fractalog:projection:mission:..."
}
```

`fractalogProjectionRef` is intentionally named as a projection. It MAY be omitted when a Mission view can be derived directly from packet/source indexes.

## 7. Possible-space, Presence and maps

COP should not freeze a canonical ontology of Presence. Presencology remains the general source discipline. Mission maps are projections of a multidimensional possible-space, not claims to contain The Possible.

Useful distinct layers include:

```text
Potentiality Map  -> where exploration appears promising
Presence Map      -> where explorers are / were / may be
Trace Map         -> what earlier exploration left behind
Constraint Map    -> what inhibits or bounds movement / actualization
```

```text
PresenceDensity != Potentiality
Presence != Trace
Map != The Possible
```

A flotilla may also orient through a **Latent Functional Map** distributed across packet state, presences, stigmergic traces, continuations, artifacts, environmental state and interaction rules. No central map is required to contain the whole functional knowledge.

## 8. Stigmergic traces

A stigmergic trace should be short, actionable, contestable, source-linked, freshness-aware, decay-aware and mission-scoped.

Recommended kinds include:

```text
trace.direction
trace.danger
trace.dead_end
trace.promising
trace.verified
trace.unverified
trace.contradiction
trace.landmark
trace.bridge
trace.resource
trace.open_question
trace.return_required
trace.synthesis_candidate
```

Stigmergic traces are guidance artifacts, not conclusions and not substitutes for the accountable source trace of the act that produced them.

## 9. Trace decay and reinforcement

Stigmergy needs forgetting. Policies may include `no_decay`, `fixed_ttl`, `decay_unless_reinforced`, `legal_hold`, `until_superseded` and `review_required`.

A trace that becomes central should be promoted into an Artifact or map projection while preserving provenance to its source.

Decay applies to a stigmergic trace's default routing and attentional influence,
not to the source-trace history of the act or observation it summarizes. An
expired or cold guidance signal must not continue to authorize action merely
because it once mattered. Conversely, reactivation of a cold or frozen signal
for a current Mission should record its present reason and remain admissible
only under the current mandate, evidence, and risk regime.

## 10. Mission lifecycle

Useful lifecycle events include creation, mandate, start, agent assignment, capability grant, task creation, path opening, trace creation/reinforcement/contradiction, continuation suspension/resumption, checkpoints, debrief, artifact promotion, theory-candidate creation, closure and archive.

Events should be replayable and compatible with the source-local FractaLog model.

## 11. Agent roles and flotilla architecture

Possible roles include Scout, Cartographer, Verifier, Contradictor, Synthesizer, Archivist, Captain and Base Camp. Agents may be human, software, AI-assisted, institutional or hybrid.

The Mission model should favor flotilla-like resilience when appropriate: partial knowledge, distributed exploration and local-loss tolerance, provided dispersion, rendezvous, signal, trace, map-merge, return and succession rules exist.

## 12. Base camp

Base camp is a Mission continuity substrate. It should know or project which agents and packets are active, which continuations are suspended, which traces exist, which capabilities are active, which projection segments are sealed, which return obligations are pending and what succession rules apply.

Base camp may anchor or cache FractaLog projections. It does not become the source of packet-borne trace facts merely by aggregating them.

## 13. Return to Corpus

A Mission is not complete until it returns something useful: documented failure, stable artifact, map update, continuation set, open questions, corpus note, public report or theory candidate.

The return to Ithaca is not a return to the initial state. The packet, Mission, Corpus and actors may all have changed through exploration. The return protocol preserves what was learned without erasing the journey that produced it.

## 14. Ownership and custody

Mission exploration may own, hold, control, reference, use, produce, transfer or merely observe objects. These relations must not be collapsed.

FractaLog custody concerns preservation and access to accountable traces/projections; ownership remains an adjacent FractaNet/COP concern.

## 15. Theory candidates

A theory candidate is a high-level synthesis extracted from traces, artifacts, contradictions, observations and failures. It must reference its evidence base and must never silently replace it.

## 16. Implementation checklist

```text
COPMission schema
packet/source trace linkage
fractalogProjectionRef semantics
COPPossibleSpace schema
generic Presence references
stigmergic trace schema
trace lifecycle and decay
mission lifecycle events
base-camp projections
mission-agent assignment
mission return protocol
artifact promotion
ownership/custody relations
FractaLog source-local compatibility
corpus integration hooks
```

## 17. Compact invariant

```text
Task executes.
Mission explores.
Packet carries cognitive work and its accountable source trace.
Presence locates.
Stigmergic trace orients.
Continuation preserves return.
FractaLog projects and proves.
Base camp coordinates and remembers by reference/projection.
Corpus receives.
Theory reconfigures.
```
