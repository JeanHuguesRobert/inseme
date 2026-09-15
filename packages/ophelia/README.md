---
title: Ophélia npm package
author: unknown
date: '2025-12-25'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 5ce535d
  origin_date: '2025-12-25'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


// packages/ophelia/README.md

# Ophélia npm package

Accès simple à l’API REST centrale d’Ophélia depuis Node.js/JavaScript.

## Installation

```
npm install ./packages/ophelia
```

## Utilisation

```js
const { ask } = require("ophelia");

(async () => {
  const res = await ask("Quelle est la capitale de la Corse ?");
  console.log(res.answer);
})();
```

## Options avancées

- `history` : tableau d’historique de conversation
- `provider`, `model`, `modelMode` : personnalisation du moteur
- `apiKey` : clé API personnalisée (sinon `dev-demo-key`)
- `apiUrl` : URL API personnalisée

## Environnement

- `OPHELIA_API_URL` : URL par défaut de l’API
- `OPHELIA_API_KEY` : clé API par défaut

## À venir

- Support streaming (`stream`)
- Typage TypeScript
- Publication npm

---

Voir aussi : `docs/NPM-OPHELIA.md` et `docs/API-OPHELIA.md`
