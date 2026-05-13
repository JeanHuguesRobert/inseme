---
title: "Research Index — Inseme"
description:
  "The deployable platform — bricks, COP runtime, and the civic-tech infrastructure of #PERTITELLU"
layout: default
nav_order: 1
last_modified_at: 2026-05-13
---

# Research Index — Inseme

## Foundation

Inseme is the **deployable platform** of the four-repo Cogentia corpus and the #PERTITELLU
civic-tech agenda. Where the four canonical research repos (`barons-Mariani`, `marenostrum`,
`cogentia`, `FractaVolta`) carry the _doctrine_ and _methodology_, inseme carries the _running
infrastructure_:

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
[barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/index.md)._

---

## Published

_Platform-level specifications and architectural documents._

| Title                                                                                                                     | Location  | Date    |
| ------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| [COP — Cognitive Orchestration Protocol (Architecture)](../packages/cop-core/Architecture.md) _(canonical protocol spec)_ | this repo | 2025-12 |
| [COP Invariants — non-negotiable rules of the protocol](../packages/cop-core/Invariants.md)                               | this repo | 2025-12 |
| [COP Manifesto](../packages/cop-core/Manifesto.md)                                                                        | this repo | 2025-12 |
| [COP FAQ](../packages/cop-core/FAQ.md)                                                                                    | this repo | 2025-12 |
| [COP Comparison with other orchestration frameworks](../packages/cop-core/COMPARISON.md)                                  | this repo | 2025-12 |
| [COP Roadmap](../packages/cop-core/ROADMAP.md)                                                                            | this repo | 2025-12 |
| [Modular System Architecture — the Brique pattern](../docs/MODULAR_SYSTEM.md)                                             | this repo | 2025-12 |
| [BRIQUE_SPEC — the brique manifest contract](../packages/cop-host/BRIQUE_SPEC.md)                                         | this repo | 2025-12 |
| [Multi-Instance Architecture](../packages/cop-host/docs/MULTI_INSTANCE.md)                                                | this repo | 2025-12 |

---

## Referenced

_Hosted elsewhere, intellectually connected here._

| Title                                                                                                                                                                                                 | Location       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [Discours de la seconde méthode](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/second_method.md) _(founding doctrine — names cogentia.js as canonical tooling)_               | barons-Mariani |
| [DHITL — Democratic Humans in the Loop](https://github.com/JeanHuguesRobert/marenostrum/blob/main/DHITL.md) _(architectural axiom — Layer 4 = cognitive infrastructure where inseme briques operate)_ | marenostrum    |
| [Cogentia Commons MVP Specification](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_commons_mvp_spec.md) _(targets inseme as `brique-cogentia-commons`, see §12)_           | cogentia       |
| [Cogentia Workflows](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_workflows.md)                                                                                           | cogentia       |
| [Packetized Gravity Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/PGN.md) _(physical infrastructure layer the platform may eventually run on)_                                  | FractaVolta    |

---

## In Progress

- `@inseme/brique-cogentia-commons` — the Cogentia Commons brique, specified in
  [cogentia/research/](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/);
  implementation pending.
- COP v0.3+ extensions — federation events (`cop_nodes`, `cop_agents`, `cop_events` per
  `apps/platform/supabase/migrations/cop/applied/schema_v0-2-0.sql`).
- Per-instance deployment hardening — multi-instance auth, vault, federation consultations.

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
