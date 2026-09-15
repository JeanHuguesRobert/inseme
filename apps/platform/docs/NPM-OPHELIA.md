---
title: Package npm Ophélia – Documentation rapide
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

# Package npm Ophélia – Documentation rapide

## Objectif

Permettre l’intégration d’Ophélia dans toute application Node.js/JavaScript via un package npm
simple, typé, et documenté.

## Structure prévue

- Dossier : `packages/ophelia/`
- Exporte :
  - `ask(question, options)` : réponse unique
  - `stream(question, cb, options)` : réponse en streaming
  - `getSources()` : sources documentaires
- Typage TypeScript
- Documentation intégrée (JSDoc)

## Exemple d’utilisation

```js
import { ask } from "ophelia";

const answer = await ask("Quelle est la capitale de la Corse ?");
console.log(answer);
```

## API

### `ask(question, options)`

- `question` (string, requis)
- `options` (object, optionnel) :
  - `history` (array)
  - `provider`, `model`, `modelMode`
  - `apiKey` (string, recommandé)
- Retourne : `{ answer, metadata, sources }`

### `stream(question, cb, options)`

- `cb` : callback appelée à chaque chunk de texte
- Retourne : rien (asynchrone)

### `getSources()`

- Retourne : tableau des sources documentaires

## Installation

```
npm install ophelia
```

## Configuration

- Par défaut, utilise l’API REST centrale (`/api/ophelia`)
- Clé API à fournir via `options.apiKey` ou variable d’environnement

## À venir

- Publication sur npm
- Exemples d’intégration (CLI, Next.js, Electron…)
- Tests unitaires et d’intégration
- Support ESM/CJS

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
