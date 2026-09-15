---
title: Inseme
author: unknown
date: '2026-06-22'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: e40bdb9
  origin_date: '2026-06-22'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# Inseme

Inseme is an open-source monorepo for civic participation, collective intelligence, and durable
cognitive orchestration. It contains deployable applications, reusable civic modules ("briques"),
the Cognitive Orchestration Protocol (COP), AI mediation and routing components, and the research
documents that explain how those pieces fit together.

The repository is not a single finished product. It is an active engineering and research workspace:
the three host applications are usable development surfaces, the brique ecosystem has mixed
maturity, COP Core is the protocol specification, and `cop-kernel` is still a prototype
reference-runtime candidate.

Inseme is developed in Corte, Corsica, in connection with the **#PERTITELLU** civic initiative and
with support from **C.O.R.S.I.C.A.** and the **Institut Mariani**. Its software is intended to
remain politically neutral: it provides infrastructure for citizens, collectives, and institutions
rather than supporting a party, candidate, or electoral campaign.

## Start Here

| Need                                 | Entry point                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand the repository            | [`research/index.md`](research/index.md) and [`docs/MODULAR_SYSTEM.md`](docs/MODULAR_SYSTEM.md)                                             |
| Run the broad civic platform         | [`apps/platform`](apps/platform) with `pnpm platform:dev`                                                                                   |
| Run the Inseme Agora                 | [`apps/inseme`](apps/inseme) with `pnpm inseme:dev`                                                                                         |
| Run Cyrnea                           | [`apps/cyrnea`](apps/cyrnea) with `pnpm cyrnea:dev`                                                                                         |
| Read the COP specification           | [`packages/cop-core/README.md`](packages/cop-core/README.md)                                                                                |
| Inspect the COP runtime profile      | [`packages/cop-kernel/PROFILE.md`](packages/cop-kernel/PROFILE.md)                                                                          |
| Exercise COP continuations           | [`sandbox/cop-continuation-bac-a-sable`](sandbox/cop-continuation-bac-a-sable)                                                              |
| Inspect AI routing                   | [`packages/magistral/STATUS.md`](packages/magistral/STATUS.md)                                                                              |
| Review current implementation status | [`research/COP_STATE_OF_PLAY.md`](research/COP_STATE_OF_PLAY.md) and [`research/CYRNEA_STATE_OF_PLAY.md`](research/CYRNEA_STATE_OF_PLAY.md) |
| Navigate the corpus                  | [`research/corpus-status.md`](research/corpus-status.md) and [`research/concepts.md`](research/concepts.md)                                 |

## Repository Architecture

### Host applications

- **`apps/platform`**: the broad civic platform (Kudocracy.Survey), including consultations, groups,
  social publishing, civic acts, maps, biodiversity, wiki/RAG, multi-instance operation,
  administration, and federation experiments.
- **`apps/inseme`**: the Agora and assembly-oriented application, focused on direct and liquid
  democracy, shared rooms, voting, wiki integration, and Ophélia mediation.
- **`apps/cyrnea`**: a PWA for bars, cafes, and community venues, combining presence, conversation,
  games, music, a local gazette, and a venue-specific Ophélia experience.

All three applications use React and Vite. Supabase supplies PostgreSQL, authentication, realtime,
and storage; Netlify functions and edge functions provide deployment and server-side integration.

### Briques

Briques are reusable functional modules composed into host applications by `cop-host`. Important
current modules include:

- `brique-actes`: civic acts, requests, proofs, responsibility, and publication workflows;
- `brique-communes`: communes, territorial data, and consultation ingestion;
- `brique-kudocracy`: voting and delegation interfaces;
- `brique-map`: GIS, citizen mapping, and biodiversity layers;
- `brique-ophelia`: AI mediation, prompts, tools, RAG, and provider integration;
- `brique-wiki`, `brique-blog`, `brique-fil`, and `brique-group`: knowledge and social publishing;
- `brique-cyrnea`: the principal venue and conviviality feature package;
- `brique-tasks` and `brique-auxilia`: task surfaces and digital hospitality experiments.

See [`packages/cop-host/BRIQUE_SPEC.md`](packages/cop-host/BRIQUE_SPEC.md) for the brique contract.
The maturity of individual briques varies; some are active application dependencies while others
remain experimental or skeletal.

### Cognitive Orchestration Protocol

COP is the repository's protocol for durable, replayable, and auditable cognitive work. Its main
concepts are **Event**, **Topic**, **Task**, **Step**, **Artifact**, and **Continuation**.

- **`packages/cop-core`** contains the canonical data model, invariants, schemas, and interfaces. It
  is a protocol specification and intentionally does not execute workflows.
- **`packages/cop-kernel`** experiments with runtime concerns: buses, schedulers, jobs, artifacts,
  continuations, storage adapters, and agent/node helpers. Its implementation profile explicitly
  classifies it as a prototype/reference-runtime candidate rather than a complete conformant
  runtime.
- **`packages/cop-host`** composes briques into applications and generates application registries.
- **`packages/cop-cli`**, `cop-prolog`, and related directories provide integration and tooling
  surfaces.
- **`sandbox/cop-continuation-bac-a-sable`** runs real `cop-kernel` primitives through resumable,
  traceable scenarios. It is the main implementation laboratory for continuations, federation,
  schedulers, and long-lived workflows.

The current gaps and priorities are maintained in
[`research/COP_STATE_OF_PLAY.md`](research/COP_STATE_OF_PLAY.md), not hidden behind a product-ready
claim.

### AI and model routing

- **Ophélia** is the neutral AI mediator used by the applications and briques. It supports
  provider-neutral prompts, tools, RAG, local-model paths, and role-specific behavior.
- **`packages/models`** manages local and remote model definitions and the Sovereign node.
- **`packages/magistral`** provides model routing, fallback, metrics, probing, maps, logs, and a
  shared operator UI. Its current operational status is documented in
  [`packages/magistral/STATUS.md`](packages/magistral/STATUS.md).

## Current Functional Surface

The monorepo currently includes:

- consultations, proposals, voting, delegation, and assemblies;
- citizen publishing, groups, gazettes, wiki, and collaborative knowledge tools;
- civic acts, demands, proofs, deadlines, responsibility, and transparency views;
- GIS, IGN/Leaflet integration, territorial data, and a biodiversity atlas with GBIF ingestion;
- multi-instance configuration for communes, organizations, and venues;
- AI mediation, multi-provider model access, RAG, Prolog experiments, and local model routing;
- COP event, artifact, task, step, continuation, scheduler, storage, and federation experiments;
- a scenario-driven laboratory for replayable long-running human/AI workflows.

This feature inventory describes code present in the repository. It does not imply equal production
maturity across every surface.

## Development

### Prerequisites

- **Node.js 24** (the root `.node-version` is canonical; applications require `>=24 <25`);
- **pnpm 10.28.2** (declared by the root `packageManager` field);
- Netlify CLI for local function/edge-function backends;
- Supabase CLI only when working on local database migrations or services.

### Install

```bash
git clone https://github.com/JeanHuguesRobert/inseme.git
cd inseme
corepack enable
pnpm install
```

Installation runs the repository's Git-hook setup through the root `prepare` script.

### Run applications

```bash
# Frontend development servers
pnpm platform:dev
pnpm inseme:dev
pnpm cyrnea:dev

# Netlify-backed local environments
pnpm platform:backend
pnpm inseme:backend
pnpm cyrnea:backend

# Cyrnea environment diagnostics
pnpm cyrnea:doctor
```

Configuration is application-specific. Do not commit local `.env` files or provider credentials.
Start from the relevant app documentation and examples, including
[`apps/platform/.env.example`](apps/platform/.env.example) and
[`apps/platform/instances/QUICKSTART.md`](apps/platform/instances/QUICKSTART.md).

### Build

```bash
pnpm platform:build
pnpm inseme:build
pnpm cyrnea:build
```

Application builds compile their selected briques before invoking Vite.

### Focused verification

```bash
# Repository-wide JavaScript lint
pnpm lint

# COP specification and kernel
pnpm --filter @inseme/cop-core exec vitest run
pnpm --filter @inseme/cop-kernel test

# Continuation laboratory
pnpm --dir sandbox/cop-continuation-bac-a-sable test

# Cyrnea unit and integration suites
pnpm --filter @inseme/app-cyrnea test

# Magistral router
pnpm --filter @inseme/magistral test
```

Some suites require browsers, local services, credentials, or provider access. Prefer targeted
package tests while working, then broaden verification according to the changed surface.

## Biodiversity and GIS

The biodiversity module combines Leaflet/React-Leaflet, IGN layers, Supabase/PostGIS-oriented data,
GBIF imports, citizen observations, validation, filtering, and GeoJSON-facing APIs.

- [Getting started](docs/biodiversite-guide-demarrage.md)
- [Tests and validation](docs/biodiversite-tests-validation.md)
- [GIS and territorial context](docs/atlas-biodiversite-contexte-sig.md)

## Research and Corpus Context

Inseme is the deployable software surface of a larger public corpus. The neighboring repositories
carry complementary responsibilities:

| Repository                                                           | Primary role                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Cogentia](https://github.com/JeanHuguesRobert/cogentia)             | Corpus tooling, continuations, local indexing, and Cogentia Commons methodology     |
| [MareNostrum](https://github.com/JeanHuguesRobert/marenostrum)       | Strategic framework, DHITL, CXU, and Mediterranean commons research                 |
| [FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta)       | Engineering, physical/digital node infrastructure, and Fractanet deployment context |
| [barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani) | Political, institutional, and methodological source documents                       |
| [Inox](https://github.com/JeanHuguesRobert/Inox)                     | Language and runtime substrate; possible future native implementation path          |
| [Ubikia](https://github.com/JeanHuguesRobert/ubikia)                 | Derived products, editorial transformation, and publication traces                  |

The common methodological reference is the
[_Discours de la seconde méthode_](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/second_method.md).
The institutional boundary between Inseme, C.O.R.S.I.C.A., and the Institut Mariani is documented in
[`research/acorsica-institut-mariani.md`](research/acorsica-institut-mariani.md).

## Governance and Licensing

Inseme's civic infrastructure is intended to remain neutral, inspectable, and reusable. Human
validation and responsibility must remain explicit in civic, legal, institutional, and public
workflows; AI output is not automatically an enacted decision.

Licensing is declared per package and document. Most software packages use the MIT license, while
research documents commonly carry CC BY-SA 4.0 frontmatter. Check the relevant package or file
before redistribution.

**Author:** Jean Hugues Noël Robert

**Location:** Corte, Corsica

---

**#PERTITELLU | CORTI CAPITALE**
