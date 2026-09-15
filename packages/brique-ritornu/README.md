---
title: '@inseme/brique-ritornu'
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: fr
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

# @inseme/brique-ritornu

Ritornu est la brique de **retrofit patrimonial sélectif** : sous mandat humain, elle reprend une
publication personnelle (export, URL publique, copie fournie), en conserve la preuve **privée sur la
plateforme**, normalise le corps éditorial, puis prépare une remise au corpus soumise à revue.

Statut : `experimental` (M0 packages + M1 Substack + **MCP multi-host**).

## MCP hub (ChatGPT, Claude, Grok, Cursor, …)

**Prefer the federated server** — it exposes the large **Cogentia.js** tool surface (search, packs,
issues, CLI, index…) **plus** Ritornu retrofit tools:

```bash
cd packages/brique-ritornu
node bin/inseme-mcp.js          # stdio — full hub (recommended)
node bin/inseme-mcp-http.js     # HTTP POST /mcp
node bin/ritornu-mcp.js         # Ritornu-only subset
```

Requires a running Cogentia daemon for corpus tools (`COGENTIA_DAEMON_URL`, default
`http://127.0.0.1:8790`).

Full setup: [docs/MCP.md](docs/MCP.md). Template: [`.mcp.json`](.mcp.json).

## Frontière

```text
source personnelle (URL publique | export | copie)
  -> capture privée (Supabase bucket, jamais Git)
  -> candidat normalisé
  -> décision humaine de routage
  -> remise au corpus ou rejet
```

## Stockage plateforme (pas de disque « local » workstation)

Inseme s’exécute sur **Netlify (functions / edge)** + **Supabase**. Ritornu n’utilise donc **pas**
`~/.local/share/…` comme stockage de production.

| Backend         | Usage                                                      |
| --------------- | ---------------------------------------------------------- |
| `SupabaseStore` | Production — bucket privé `ritornu-private` (configurable) |
| `MemoryStore`   | Tests + desktop MCP dry-run when Supabase env is absent    |

Preuves et paquets : `captures/`, `transcriptions/`, `candidates/`, `handoffs/` **dans le bucket**,
`visibility: private`. Aucune URL publique n’est générée pour les captures.

Migration : `apps/platform/supabase/migrations/20260724120000_ritornu_private_storage.sql`

## M0 — paquets déterministes

| Élément              | Emplacement                       |
| -------------------- | --------------------------------- |
| Schémas versionnés   | `schemas/*.schema.json`           |
| Normalisation + diff | `src/normalize.js`, `src/diff.js` |
| Pipeline + handoff   | `src/pipeline.js`                 |
| Fixture Substack     | `fixtures/substack-backup/`       |

## M1 — adaptateur Substack (URL publique)

Contraintes respectées :

- **une URL** par invocation (`/p/slug`) ;
- conservation de l’URL demandée + **canonique** (tracking retiré) ;
- extraction HTML ciblée (article/main) + nettoyage de bruit ;
- **aucune** API non documentée, **aucun** cookie/auth, **aucun** suivi de liens internes ;
- indisponibilité **explicite** (`unavailable`) avec replis : export officiel, copie fournie,
  navigation assistée.

Outil COP (compilateur de briques) :

- handler : `src/edge/tool-prepare-substack.js`
- nom : `prepare_substack_post`
- chemin généré typique : `/api/tools/ritornu/prepare_substack_post`

```js
import {
  prepareSubstackPublicUrl,
  createStoreFromRuntime,
  createHandoff,
} from "@inseme/brique-ritornu";

// Edge / Netlify runtime
const store = createStoreFromRuntime(runtime); // requires runtime.supabase
const prepared = await prepareSubstackPublicUrl({
  url: "https://example.substack.com/p/backup",
  store,
});
// prepared.candidate is review-request; raw HTML only in private bucket
```

## Invariants

- mandat humain explicite, publication par publication ;
- stockage privé plateforme (Supabase), hors Git ;
- pas de collecte récursive, graphe social, commentaires, réactions ;
- pas de contournement CAPTCHA / paywall / auth / rate-limit ;
- aucune écriture Git ou GitHub directe ;
- handoff = proposition (patch / fichier), jamais un commit.

## États de travail

`capture` → `candidate` → `review-request` → `handoff` → `watch-change`

## Tests

```bash
cd packages/brique-ritornu
node --test ./tests/*.test.js
```

## Suite

- **M2** — Facebook permalink + export Meta
- **M3** — surface de revue / remise corpus
- **M4** — exports officiels et `watch-change`

Voir [issue #26](https://github.com/JeanHuguesRobert/inseme/issues/26).
