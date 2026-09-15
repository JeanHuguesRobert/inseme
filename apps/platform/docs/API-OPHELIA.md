---
title: Ophélia API REST – Documentation rapide
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

# Ophélia API REST – Documentation rapide

## Endpoint

    POST /api/ophelia
    (Netlify Function: `netlify/functions/ophelia-api.js`)

## Authentification

- Header obligatoire : `x-api-key: <clé>`
- Clé de démo par défaut : `dev-demo-key` (à changer en production)

## Payload (JSON)

```
{
  "question": "<texte de la question>",
  "conversation_history": [ ... ], // optionnel
  "provider": "...",              // optionnel
  "model": "...",                 // optionnel
  "modelMode": "..."              // optionnel
}
```

## Exemple CURL

```
curl -X POST https://<votre-domaine>/api/ophelia \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-demo-key" \
  -d '{"question": "Quelle est la capitale de la Corse ?"}'
```

## Réponse (JSON)

```
{
  "success": true,
  "answer": "La capitale de la Corse est Ajaccio.",
  "metadata": {
    "provider": "...",
    "model": "...",
    "responseTime": 123,
    "timestamp": "2025-11-20T12:34:56.789Z"
  },
  "sources": [ ... ]
}
```

## Erreurs possibles

- 401 Unauthorized : clé API manquante ou invalide
- 400 Bad Request : question manquante ou JSON invalide
- 500 Internal Server Error : erreur interne

## À venir

- Rate limiting (limite par IP/clé)
- Logs d’usage
- Documentation OpenAPI/Swagger

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
