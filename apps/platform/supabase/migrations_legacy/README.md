---
title: Migrations legacy (archive)
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Migrations legacy (archive)

These SQL files come from the historical Survey / Corte multi-tenant evolution
(`old_applied`, `old_unused`, early COP fragments, etc.).

They are **not** applied by the Supabase CLI migration runner.

## Why archived

- File names and nesting did not match the standard `YYYYMMDDHHMMSS_name.sql` pipeline.
- Many scripts assume an already-rich municipal schema.
- Blank personal instances (e.g. project **JHN**) start from a clean baseline under
  `../migrations/`.

## How to reintroduce

1. Extract a coherent subset.
2. Create a **new** timestamped migration under `../migrations/` with additive SQL only.
3. `supabase db push` against the linked project.
4. Never re-enable this folder as the CLI migrations path.

## Active path

```text
apps/platform/supabase/migrations/   ← CLI applies these
apps/platform/supabase/migrations_legacy/  ← reference only
```
