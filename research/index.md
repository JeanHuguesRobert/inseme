---
title: Research Index — Inseme
description: 'The deployable platform — bricks, COP runtime, and the civic-tech infrastructure of #PERTITELLU'
layout: default
nav_order: 1
last_modified_at: 2026-07-19T00:00:00.000Z
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: 2026-05-13T00:00:00.000Z
creator: Jean Hugues Noël Robert, baron Mariani
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/index.md
document_role: index
document_kind: research-index
visibility: public
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: research-index
classification_confidence: strong
author: unknown
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
update_policy: UP-DEFAULT-REVIEWED
language: en
status: working-paper
---


# Research Index — Inseme

## Foundation

Inseme is the **deployable platform** of the public Cogentia corpus and the #PERTITELLU civic-tech
agenda. Where the sibling research repos (`barons-Mariani`, `marenostrum`, `cogentia`,
`FractaVolta`, `Inox`, `ubikia`) carry the _doctrine_, _methodology_, _runtime substrate_, and
_publication layer_, inseme carries the _running infrastructure_:

- The **COP (Cognitive Orchestration Protocol)** runtime — see
  [`packages/cop-core/Architecture.md`](../packages/cop-core/Architecture.md), the canonical
  protocol specification for Event / Topic / Task / Step / Artifact / Continuation primitives.
- The **brique pattern** — modular packages orchestrated by COP; see
  [`docs/MODULAR_SYSTEM.md`](../docs/MODULAR_SYSTEM.md) and
  [`packages/cop-host/BRIQUE_SPEC.md`](../packages/cop-host/BRIQUE_SPEC.md).
- The **multi-instance deployment model** — Kudocracy.Survey (`apps/platform`), the Agora
  (`apps/inseme`), Cyrnea (`apps/cyrnea`).
- The **AI mediator (Ophélia)** as a _neutral mirror_ (no authority, surfaces tension, never
  imposes).

The reference Supabase schema (`apps/platform/supabase/migrations/20251206_add_cop_core.sql`) is the
operational substrate any brique projects onto.

---

_A map of what is, what is in progress, and what could be._ _See sibling indexes in
[cogentia](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/index.md),
[MareNostrum](https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/index.md),
[FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/index.md),
[barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/index.md),
[Inox](https://github.com/JeanHuguesRobert/Inox/blob/master/research/index.md),
[Ubikia](https://github.com/JeanHuguesRobert/ubikia/blob/main/research/index.md). Entry point:
[profile / meta-node](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/index.md)._

---

## Published

_Platform-level specifications and architectural documents._

| Title                                                                                                                                                                                                                                                                                                               | Location  | Date        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| [Instance map — locked names and regimes](instance_map.md) _(Pertitellu first collective; JHN personal TwinRoot; Guide infant surface)_                                                                                                                                                                            | this repo | 2026-07-29  |
| [User ↔ Personal Twin link on collective instances](user_personal_twin_link.md) _(planned: optional membership→twin address; email correlation; personal-twin email authoritative for later follow — [inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34))_                                                                 | this repo | 2026-08-08  |
| [Personal Twin access policy](personal_twin_access_policy.md) _(visitor / registered / peer / delegate / owner; agent + server enforcement — [inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35))_                                                                                                                                    | this repo | 2026-08-08  |
| [Interactions Registry & multichannel messaging](interactions_registry_and_multichannel_messaging.md) _(email spine + fragmented channels; Twin desk; cross-repo — [inseme#36](https://github.com/JeanHuguesRobert/inseme/issues/36) · [JHR#2](https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2) · [cogentia#84](https://github.com/JeanHuguesRobert/cogentia/issues/84))_ | this repo | 2026-08-08  |
| [Personal Twin public intelligence core](personal_twin_public_intelligence_core.md) _(John public ⊇ Guide; factor OpenAI + MCP + CLI + web UX — [inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37) · [cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85))_                                                                                                                              | this repo | 2026-08-08  |
| [ActivityPub Edge — Inseme / Fractanet Federation Boundary](activitypub_edge.md) _(architecture decision: ActivityPub as federated projection, Fedify as reference implementation, multi-tenancy, mandates, and guarantees)_ | this repo | 2026-07-31  |
| [Lien avec C.O.R.S.I.C.A. et l’Institut Mariani](acorsica-institut-mariani.md) _(institutional boundary note — Inseme, C.O.R.S.I.C.A. and Institut Mariani)_                                                                                                                                                        | this repo | 2026-06-03  |
| [COP — Cognitive Orchestration Protocol (Architecture)](../packages/cop-core/Architecture.md) _(canonical protocol spec)_                                                                                                                                                                                           | this repo | 2025-12     |
| [COP Invariants — non-negotiable rules of the protocol](../packages/cop-core/Invariants.md)                                                                                                                                                                                                                         | this repo | 2025-12     |
| [COP Manifesto](../packages/cop-core/Manifesto.md)                                                                                                                                                                                                                                                                  | this repo | 2025-12     |
| [COP FAQ](../packages/cop-core/FAQ.md)                                                                                                                                                                                                                                                                              | this repo | 2025-12     |
| [COP Comparison with other orchestration frameworks](../packages/cop-core/COMPARISON.md)                                                                                                                                                                                                                            | this repo | 2025-12     |
| [COP Roadmap](../packages/cop-core/ROADMAP.md)                                                                                                                                                                                                                                                                      | this repo | 2025-12     |
| [Reactive Cognitive COP Extension](reactive_cognitive_cop_extension.md) _(Toubkal/Inox/COP source document: Packet Attractors, pressure strategies, control/data plane)_                                                                                                                                            | this repo | 2026-06-01  |
| [Packet Attractor — Fractanet Distributed Demand and Capability Routing](packet_attractor_fractanet.md) _(canonical COP-side crystallization: attractor matching, intermittent nodes, Fractanet blackboard, `cop/packet-attractor`)_                                                                               | this repo | 2026-07-03  |
| [COP Reactive Cognitive Extension](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md) _(operational COP-core protocol note derived from the source document)_                                                                                                                                                    | this repo | 2026-06-01  |
| [COP Implementation Profiles](../packages/cop-core/ImplementationProfiles.md) _(working-note — documentation convention for concrete COP implementations; companion to the kernel profile)_                                                                                                                         | this repo | 2026-06-01  |
| [COP Identity / Kudocracy Profile](cop_identity_kudocracy_profile.md) _(source document — subjects, capacities, mandates, public civic acts and civic audit traces for Kudocracy-sensitive COP profiles)_                                                                                                           | this repo | 2026-06-19  |
| [COP Memory Profile](cop_memory_profile.md) _(source document — pragmatic memory layer for COP profiles, identified things, traces, and operational recurrence)_                                                                                                                                                    | this repo | 2026-06-21  |
| [COP Memory — Map and Territory](cop_memory_map_territory.md) _(source document — representation, approximation, manipulable maps, and situated judgment for COP memory)_                                                                                                                                           | this repo | 2026-06-21  |
| [COP Memory Metadata and Recursive Trace Layers](cop_memory_metadata_recursion.md) _(source document — metadata recursion, trace layers, and auditability of memory representations)_                                                                                                                               | this repo | 2026-06-21  |
| [COP Memory — Necessity and Local Equilibrium](cop_memory_necessity_local_equilibrium.md) _(source document — necessity, entropy, negentropy, free energy, and local equilibrium for COP memory)_                                                                                                                   | this repo | 2026-06-21  |
| [COP FractaLog Profile](cop_fractalog_profile.md) _(source document — agent-bound logs, custody, inheritance, restricted traces and delayed transparency for COP)_                                                                                                                                                  | this repo | 2026-07-06  |
| [Modular System Architecture — the Brique pattern](../docs/MODULAR_SYSTEM.md)                                                                                                                                                                                                                                       | this repo | 2025-12     |
| [BRIQUE_SPEC — the brique manifest contract](../packages/cop-host/BRIQUE_SPEC.md)                                                                                                                                                                                                                                   | this repo | 2025-12     |
| [Multi-Instance Architecture](../packages/cop-host/docs/MULTI_INSTANCE.md)                                                                                                                                                                                                                                          | this repo | 2025-12     |
| [Corpus Status](corpus-status.md) _(living view — auto-refreshed by `cogentia.js corpus-status`)_                                                                                                                                                                                                                   | this repo | refreshable |
| [Concept Index](concepts.md) _(typed concept registry — mapped by `cogentia.js concepts`)_                                                                                                                                                                                                                          | this repo | refreshable |
| [COP State of Play — Asynchronous Orchestration & Traceability](COP_STATE_OF_PLAY.md) _(living document — focus on async, event-driven, strongly traceable aspects of COP; sync apps temporarily deprioritized)_                                                                                                    | this repo | 2026-05     |
| [Cyrnea State of Play](CYRNEA_STATE_OF_PLAY.md) _(living assessment for the bar/conviviality app — AI + human collaborator reference)_                                                                                                                                                                              | this repo | 2026-05-28  |
| [COOP — Tutorial and Near-Specification](coop_tutorial.md) _(auto-generated tutorial v0.1 — COP kernel, cognitive packet router, reusable helpers (cogentiaRoutePacket etc.), hybrid policy layer (bus agent + JobScheduler), bac-à-sable usage, emissions, resets; sufficient for extension or re-implementation)_ | this repo | 2026-06-04  |
| [Instance personnelle, démocratie et match non achetable](personal_instance_democracy_and_non_capturable_match.md) _(strategic positioning — personal TwinRoot vs personal-agent race; private life vs mandataire obligations; OpenClaw-class runtimes under mandate; non-capturable match invariants)_ | this repo | 2026-07-19  |

---

## Referenced

_Hosted elsewhere, intellectually connected here._

| Title                                                                                                                                                                                                                 | Location         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| [Discours de la seconde méthode](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/second_method.md) _(founding doctrine — names cogentia.js as canonical tooling)_                               | barons-Mariani   |
| [DHITL — Democratic Humans in the Loop](https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/DHITL.md) _(architectural axiom — Layer 4 = cognitive infrastructure where inseme briques operate)_        | marenostrum      |
| [Cogentia Pipeline](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/pipeline.md) _(source-to-derived packet workflow followed by the reactive cognitive artifacts)_                                   | cogentia         |
| [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md) _(envelope/payload distinction used by COP reactive cognitive artifacts)_                                   | cogentia         |
| [Cogentia Commons MVP Specification](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_commons_mvp_spec.md) _(targets inseme as `brique-cogentia-commons`, see §12)_                           | cogentia         |
| [Cogentia Workflows](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_workflows.md)                                                                                                           | cogentia         |
| [FractaLog — Fractal Append-Only Logs](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractalog.md) _(FractaNet source document for agent-bound logs, custody, inheritance and delayed transparency)_ | FractaVolta      |
| [Packetized Gravity Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/PGN.md) _(physical infrastructure layer the platform may eventually run on)_                                         | FractaVolta      |
| [Inox — language and runtime substrate](https://github.com/JeanHuguesRobert/Inox/blob/master/research/inox-spec.md) _(concatenative stack VM; future implementation target for `cop-core` and edge briques)_          | Inox             |
| [Reactive Sets in Inox — Native Implementation Path](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md) _(native runtime path for the reactive cognitive layer)_ | Inox             |
| [Jean Hugues Noël Robert — profile / corpus entry point](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/index.md) _(meta-node — registry host, orientation, AI agent briefing)_              | JeanHuguesRobert |

---

## In Progress

- `@inseme/brique-cogentia-commons` — the Cogentia Commons brique, specified in
  [cogentia/research/](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/);
  implementation pending.
- Reactive Cognitive COP extension — source and operational note created; native implementation path
  delegated to
  [Inox](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md).
- COP v0.3+ extensions — federation events (`cop_nodes`, `cop_agents`, `cop_events` per
  `apps/platform/supabase/migrations/cop/applied/schema_v0-2-0.sql`).
- Per-instance deployment hardening — multi-instance auth, vault, federation consultations.
- Native personal instance JHN + COP/Mandate vertical slice —
  [inseme#17](https://github.com/JeanHuguesRobert/inseme/issues/17); strategic positioning in
  [personal_instance_democracy_and_non_capturable_match.md](personal_instance_democracy_and_non_capturable_match.md).
- Migration lepp.fr deploy source survey → inseme (`apps/platform`) — plan pending as companion to
  personal-instance work.

---

## Open Possibilities

_Ideas that trotte — no commitment, no deadline._

- A formal "brique developer guide" consolidating BRIQUE_SPEC + concrete examples from
  `brique-actes`, `brique-wiki`, `brique-democracy`.
- An "Ophélia mediator profile" — operational semantics of the AI mediator as it interfaces with
  brique-exposed tools.
- A `brique-` template generator (`cogentia.js init-brique <name>` or equivalent).

---

_Priority established by first public commit. License: open-source per individual file/package._
_Fork to explore alternatives. Challenge via issues._
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Research Index — barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/index.md)
- [Research Index — Cogentia](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/index.md)
- [Research Index — FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/index.md)
- [Research Index — Inox](https://github.com/JeanHuguesRobert/Inox/blob/master/research/index.md)
- [Inseme](../README.md)
- [Corpus Start Here — Carte globale du Corpus](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/corpus-map.md)
- [Research Index — Jean Hugues Noël Robert (Profile / Entry Point)](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/index.md)
- [Research Index — MareNostrum](https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/index.md)
<!-- END_AUTO: backlinks -->
## Newly indexed working corpus (July 2026)

- [COP Mission Stigmergy and Rational Exploration](cop_mission_stigmergy_exploration.md)
- [Instance personnelle, démocratie et match non achetable](personal_instance_democracy_and_non_capturable_match.md)

<!-- BEGIN_AUTO: index_catalog -->
## Corpus catalog

*Generated navigation. Editorial sections above remain human-maintained.*

| Document | Role | Updated |
|---|---|---|
| [Add AGENTS.md for controlled multi-agent work on Inseme](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00005.md) | source | unknown |
| [Add GitHub App webhook ingress and Digital Twin activity projection](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00029.md) | source | unknown |
| [Add replay tests for cop-kernel Task Step Continuation state](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00007.md) | source | unknown |
| [Agent JHN as coding-capable twin — claim and grounding (no design yet)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00052.md) | source | unknown |
| [Checkpoint — Mandated Agents, Harness and capability resolution](checkpoints/2026-08-24-mandated-agents-harness-capability-resolution.md) | source | 2026-08-24 |
| [Clarify COP trace immutability, governed erasure, and stigmergic temperature](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00071.md) | source | unknown |
| [Cogentia accounting architecture — general, statutory, analytical, budgetary, and reconciliation layers](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00039.md) | source | unknown |
| [Cogentia Accounting Architecture — General, Statutory, Analytical, Budgetary, and Reconciliation Layers](cogentia_accounting_architecture.md) | source | 2026-08-08 |
| [Consequential Rossignol Reality Test — provider-attested spend, mandate-bound budget, and non-silent reset](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00068.md) | source | unknown |
| [COP 2.x — Trace-Centric architecture migration for the Reactive Corpus](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00061.md) | source | unknown |
| [COP Composition: complete high-level combinators over Continuations](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00056.md) | source | unknown |
| [COP Experimental Packet Kernel](cop_packet_kernel/README.md) | source | 2026-07-20 |
| [COP Experimental Packet Kernel — Schemas, generated types and conformance vectors](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00021.md) | source | unknown |
| [COP institutional profile: registers, publication, appeal and actor-neutral act provenance](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00040.md) | source | unknown |
| [COP memory substrate: mneme profile and portable recovery scenarios](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00027.md) | source | unknown |
| [COP Mneme Memory Profile](cop_mneme_memory_profile.md) | source | 2026-07-31 |
| [COP Packet Closure — storage mobility, causal frontier, and governed effects](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00058.md) | source | unknown |
| [COP pre-operational clean break: handlers, mandates, and execution identity](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00031.md) | source | unknown |
| [COP Reality Test — minimal executable Cognitive Packet round trip](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00054.md) | source | unknown |
| [COP reference runtime hardening: make cop-kernel the executable profile](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00018.md) | source | unknown |
| [COP Reference Runtime Plan](cop_reference_runtime_plan.md) | source | 2026-07-29 |
| [COP security regression family — reachable ≠ admissible ≠ authorized](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00066.md) | source | unknown |
| [COP Trace Model — Trace as Unified Epistemic and Computational Substrate](cop_trace_model.md) | source | 2026-09-06 |
| [COP Trace-Centric migration — contradiction review, migration hazards and conformance attacks](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00065.md) | source | unknown |
| [COP Trace-Centric migration — kernel schemas, references and provenance relations](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00063.md) | source | unknown |
| [COP Trace-Centric migration — Reactive Corpus impact, invalidation and temporal projection](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00064.md) | source | unknown |
| [COP Trace-Centric migration — specification and normative architecture](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00062.md) | source | unknown |
| [COP Zero Draft — Mission-Bearing Cognitive Packet Kernel](cop_zero_draft.md) | source | 2026-07-20 |
| [COP Zero Draft — Refound COP around mission-bearing Cognitive Packets](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00020.md) | source | unknown |
| [COP: add trace lifecycle conformance fixtures for governed erasure and reactivation](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00072.md) | source | unknown |
| [COP: derive a real-time cognitive packet trace explorer](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00070.md) | source | unknown |
| [COP: Exposure and Measured Risk for bounded experimentation and external effects](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00051.md) | source | unknown |
| [COPKit — Fluidifier le copier/coller mandaté entre l’usager et le service](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00012.md) | source | unknown |
| [Cross-link: 'Carte et territoire' clarification — artifacts/projections as maps (Cogentigrams) vs. territory (Cogentia / events / acts) in COP kernel and rational exploration](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00009.md) | source | unknown |
| [Define COP implementation profiles distinct from COP Core](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00003.md) | source | unknown |
| [Detect cognitive desire paths from COP traces before reinforcing routing](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00050.md) | source | unknown |
| [DHITL — Pilotes de Corte](dhitl_pilots_corte.md) | source | 2026-07-29 |
| [Discord Edge — BYOC Reality Test for Personal and Collective Twins](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00069.md) | source | unknown |
| [Discord Edge — BYOC Reality Test for Personal and Collective Twins](discord_edge.md) | operational | 2026-09-06 |
| [Evaluate dynamic Supabase-Storage-backed serving as an alternative to prebuilt static hosting](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00053.md) | source | unknown |
| [Experiment: portable coding continuation across agents and Fractanet nodes](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00049.md) | source | unknown |
| [Explore a COP and n8n adapter](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00004.md) | source | unknown |
| [Explore a COP and n8n adapter](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00008.md) | source | unknown |
| [Explore a sovereign confederation and diplomatic treaty profile for Fractanet](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00019.md) | source | unknown |
| [Explore governed credential management skill for Agent JHN](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00043.md) | source | unknown |
| [Factorize Personal Twin public intelligence core (John ⊇ Guide; OpenAI + MCP + CLI surfaces)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00037.md) | source | unknown |
| [feat(cop-core): exportable Trace Lifecycle Invariant verifier engine ('verifyTraceLogConformance')](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00073.md) | source | unknown |
| [feat(cop-core): FractaLog degraded fallback spool monitor and forwarder ('fractalog spool status / drain')](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00074.md) | source | unknown |
| [Fractanet Packet Attractor — proto implementation handoff (pause/resume)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00013.md) | source | unknown |
| [Git-backed personal Wiki: canonical revisions, Supabase projection and multi-instance Git service](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00032.md) | source | unknown |
| [Govern instance configuration caches and periodic Vault hygiene](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00041.md) | source | unknown |
| [Implement a native JHN Inseme instance with mandated cognitive sub-instances and hibernatable agent memory](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00017.md) | source | unknown |
| [Implement append-only COP event persistence profile (Supabase + local spool)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00028.md) | source | unknown |
| [Implement Cogentia peer identity, membership, mandate enforcement, and inter-instance COP messaging](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00030.md) | source | unknown |
| [Implement COP/Fractium Live profile: information-gravity routing for Fractanet attractors](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00014.md) | source | unknown |
| [Implement Mandated Agent authority enforcement before consequential effects](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00055.md) | source | unknown |
| [Implement the day-one COP/Accounting conformance kernel](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00025.md) | source | unknown |
| [Implémenter les primitives COP nécessaires aux pilotes DHITL](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00024.md) | source | unknown |
| [Improve Magistral routing with quota-aware fallback and provider error classification](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00006.md) | source | unknown |
| [Interactions Registry + multichannel messaging as Personal Twin service](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00036.md) | source | unknown |
| [JHN implementation convergence: primary conversational front door, governed delegation, usability gate, then FixBugsFirst](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00033.md) | source | unknown |
| [LePP / pertitellu-corte — preview Fracta et migration Survey → Inseme Platform conforme COP](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00059.md) | source | unknown |
| [Magistral: federated model catalog and OrcaRouter-Lite ideas review](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00010.md) | source | unknown |
| [Module accounting durable — DB, plans comptables, bilans & analytique](cop_accounting_module_db_statements.md) | source | 2026-08-13 |
| [Olé Olé — desirability sprint: useful before users, compelling on first open](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00048.md) | source | unknown |
| [Olé Olé — invitation, progressive identity and install loop](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00046.md) | source | unknown |
| [Olé Olé MVP — implement first vertical slices from crystallized spec](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00042.md) | source | unknown |
| [Olé Olé portability spike — decouple runtime, build, hosting and ingress](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00047.md) | source | unknown |
| [Personal Twin access policy: visitor classes + conversational agent enforcement (jhn)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00035.md) | source | unknown |
| [Physical Cognitive Packet and latent agent — Casa Mariani Immortelle demonstrator](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00022.md) | source | unknown |
| [Préparer la plateforme cible pour Ophélia](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00011.md) | source | unknown |
| [Provider-neutral usage accounting — packet budgets, reconciliation, and external spend safety nets](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00038.md) | source | unknown |
| [Provisional Twins — hosted instance inheritance, shared instance_config and progressive promotion](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00057.md) | source | unknown |
| [Resume OpenCode via Magistral integration](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00067.md) | source | unknown |
| [Ritornu — créer la brique de retrofit patrimonial (squelette)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00026.md) | source | unknown |
| [Simplify COP Store under Occam's razor](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00016.md) | source | unknown |
| [Strict Accounting / No Unaccounted Effects — adversarial audit and enforcement](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00045.md) | source | unknown |
| [Study and extract Buzz agent harness patterns for Cogentia Twins](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00044.md) | source | unknown |
| [User ↔ Personal Twin link on collective instances (email-verified claim)](../.cogentia/issues/jeanhuguesrobert-inseme/issue-00034.md) | source | unknown |

<!-- END_AUTO: index_catalog -->
