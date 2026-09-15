---
title: Wiki Ingestion Guide
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

# Wiki Ingestion Guide

This document explains how to use the `scripts/ingest_wiki_pages.js` script to index Markdown pages
from `public/docs` into the `knowledge_chunks` table.

## Prerequisites

- `OPENAI_API_KEY` configured (via `.env` or vault - see `docs/CONFIGURATION_VAULT.md`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured
- Migration `001_rag_infrastructure.sql` applied

## Examples

```bash
node scripts/ingest_wiki_pages.js --dir public/docs --dry-run
node scripts/ingest_wiki_pages.js --dir public/docs --force --recursive
node scripts/ingest_wiki_pages.js --dir public/docs --slug fiche-identite-corte.md
```

Optional flags:

- `--dry-run`: don't insert into Supabase, shows what would be done
- `--force`: force reindex even if content didn't change
- `--recursive`: traverse subdirectories
- `--limit N`: process at most N files

This script reuses the same chunking and embedding strategy as the other ingestion scripts, and
writes into the `knowledge_chunks` table with `source_type = 'wiki_page'`.
