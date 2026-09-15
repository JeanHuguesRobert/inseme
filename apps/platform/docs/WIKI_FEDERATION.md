---
title: Wiki Federation — Metadata & Conventions
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

# Wiki Federation — Metadata & Conventions

This document describes the metadata schema and the read/write semantics implemented for a
hierarchical federation of wiki instances. All data is saved inside the `metadata` JSON column of
existing tables — no SQL schema changes.

## Metadata schema (wiki_pages.metadata)

The library expects (and writes) the following structure under `metadata`:

```jsonc
{
  "is_proposed": true, // Marqueur pour les pages suggérées par l'IA (en attente de validation)
  "ai_generated": true, // Indique que le contenu initial a été rédigé par Ophélia
  "updated_at": "ISO-DATE",
  "wiki_page": {
    "page_key": "charte-participation",
    "status": "active | draft | archived | proposed_upstream",
    "origin_hub_id": "corte",
    "parent_revision_global_id": "instance:nice:charte-participation",
    "global_id": "global:charte-participation" | "instance:corte:charte-participation"
  }
}
```

## Conventions Inseme

### 1. Pages de Room (Assemblées)
Chaque assemblée Inseme est associée à une page wiki via son slug : `room:${room_slug}`. Cette page sert de "Mémoire de travail" pour la room.

### 2. Outils Ophélia
Ophélia dispose de l'outil `propose_wiki_page` qui lui permet de :
- Synthétiser les débats d'une assemblée.
- Créer une nouvelle page avec le flag `is_proposed: true`.
- Ces pages apparaissent dans le Wiki mais avec un bandeau indiquant qu'elles doivent être validées/éditées par les citoyens.

Conventions:

- `page_key`: functionnal identifier for the page (defaults to `slug`).
- `status`: controls visibility in `resolvePage` (only `active` is returned by default).
- `origin_hub_id`: subdomain or instance id that authored/edited the page.
- `parent_revision_global_id`: global id reference to indicate lineage / adoption.
- `global_id`: canonical id across federation; `global:` for root/national pages,
  `instance:<subdomain>:<page_key>` for instances.

## read: resolvePage("slug")

- Queries local wiki pages first for `slug` / `page_key` with `status="active"`.
- If not found, climbs to the parent hub (`parentHubUrl` from instance config) and queries remote
  instance(s) until root.
- Stops at first `active` page; `archived` or `draft` are ignored unless `extended=true`.

## write: upsertLocalPage

- Always writes to the local instance (`wiki_pages` table) and sets/merges the `metadata.wiki_page`
  fields.
- Sets `origin_hub_id` to the local instance subdomain and computes `global_id` based on root vs
  instance.
- If the page is created as a fork of a parent page, `parent_revision_global_id` can be set by the
  call.

## archive: archiveLocalPageIfAdoptedUpstream

- Checks if the parent direct hub has created a page that references the local `global_id` in
  `parent_revision_global_id`.
- If found, updates local `metadata.wiki_page.status` to `archived`.

## UI & Sync

- The UI now calls `resolvePage` for reads and shows a banner if the page comes from a parent hub.
- There is a “Fork locally” action that creates a local copy via `upsertLocalPage` retaining
  `parent_revision_global_id`.
- GitHub sync (`netlify/functions/sync-wiki.js`) includes `origin_hub_id` and `global_id` in
  frontmatter and saves those metadata back to the DB.
- Serverless endpoints added: `GET /api/wiki-resolve?slug=<slug>` and `POST /api/wiki-propose`.
- `wiki-propose` marks the page proposed upstream locally; if a `parentApiKey` is provided it will
  attempt to forward a draft to the parent instance. The server also looks for a vault-stored secret
  named `parent_hub_api_key` (via `instance_config`) and prefers it for forwarding when available —
  set it in the admin VaultConfig UI or as `PARENT_HUB_API_KEY` env var.

## Notes & Next steps

- Consider adding a server-side `/api/wiki/resolve` endpoint for secure cross-instance reads and to
  support RLS/keys.
- Add unit/integration tests for `resolvePage` and `archiveLocalPageIfAdoptedUpstream` with mocked
  Supabase clients.
- Optionally create an endpoint for “propose to parent” to send a formal proposal notification to
  the parent hub.
