---
title: Superseded Supabase migrations
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

# Superseded Supabase migrations

Files in this directory are retained as audit material but are intentionally outside
`supabase/migrations/`: they must never be selected by `supabase db push`.

`20260901110000_civic_wiki_and_kudocracy_baseline.sql` was reviewed in Inseme #59 and found unsafe
and incomplete before its first deployment. In particular, it granted cross-instance authenticated
writes, used destructive foreign-key cascades for civic records, and did not match the Wiki runtime
contract. Its replacement must be a new, tested baseline after the membership, capability and
mandate boundaries are established.

Do not copy a file from this directory back into `migrations/`. The pre-deployment guard reads
`../deployment-policy.json` and fails if a superseded migration reappears or has been applied
remotely.
