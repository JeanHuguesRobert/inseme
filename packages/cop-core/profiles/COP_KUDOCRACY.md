---
title: COP/Kudocracy Profile
version: '0.1'
status: operational-note — seed
date: '2026-06-19'
author: Jean Hugues Noël Robert
license: CC BY-SA 4.0
language: en
derived_from: ../../research/cop_identity_kudocracy_profile.md
requires:
  - COP/Core
  - COP/HITL
  - COP/Identity
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
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


# COP/Kudocracy Profile

## Purpose

This profile defines a first protocol surface for public collective decisions in Kudocracy.

It derives from `research/cop_identity_kudocracy_profile.md` and should remain non-intrusive toward COP/Core.

## Initial artifact types

```text
kudocracy/public-decision
kudocracy/influence-trace
kudocracy/protection-report
kudocracy/proposal-version
```

## Initial invariants

1. Public collective decisions are immutable artifacts.
2. Corrections are represented by new events, never by mutation.
3. A public decision must reference a proposal version.
4. The acting subject, subject kind, capacity and mandate context must be explicit.
5. AI agents and digital twins may suggest, explain or compare; they must not be confused with living human decision-makers.
6. Publicity of the civic act must not imply publicity of all private data.

## Continuations

1. Add JSON schemas.
2. Add TypeScript types.
3. Add validation helpers.
4. Add projections for public decision ledgers.
5. Add protection-report workflows.
