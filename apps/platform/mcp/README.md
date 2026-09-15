---
title: Prototype serveur MCP pour Ophélia
author: unknown
date: '2025-12-24'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 1cdac1c
  origin_date: '2025-12-24'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
status: working-paper
---


// mcp/README.md

# Prototype serveur MCP pour Ophélia

Ce serveur expose les ressources, outils et prompts d’Ophélia selon le Model Context Protocol (MCP),
et permet d’interroger le moteur via `/ask`.

## Lancer le serveur

```
cd mcp
npm install express cors
node server.js
```

## Endpoints MCP

- `GET /resources` : liste des ressources (wiki, Q&A, docs)
- `GET /tools` : liste des outils (search_wiki, web_search…)
- `GET /prompts` : prompts spécialisés
- `POST /ask` : proxy vers le moteur Ophélia (question, options)

## Exemple d’appel

```
curl -X POST http://localhost:3030/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Quelle est la capitale de la Corse ?"}'
```

## À venir

- Mapping dynamique des ressources et outils
- Authentification MCP
- Documentation OpenAPI
- Tests avec Claude Desktop, Continue, Cursor

---

Voir aussi : `docs/MCP-OPHELIA.md`
