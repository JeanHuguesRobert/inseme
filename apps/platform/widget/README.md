---
title: Widget Ophélia (embeddable)
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


<!-- widget/README.md -->

# Widget Ophélia (embeddable)

Widget web minimaliste pour intégrer Ophélia sur n’importe quel site.

## Utilisation rapide

Ajoutez ce script dans votre page HTML :

```html
<script src="/widget/ophelia-widget.js"></script>
```

Ou servez-le depuis votre domaine principal.

## Fonctionnalités

- Chatbox flottante en bas à droite
- Posez une question, réponse instantanée via l’API REST centrale
- Branding Ophélia
- Aucune dépendance externe

## Personnalisation (à venir)

- Couleurs, logo, position
- Clé API personnalisée
- Historique conversationnel

## Sécurité

- CORS à configurer côté API
- Rate limiting recommandé

---

Voir aussi : `docs/SPACE-OPHELIA.md`, `docs/API-OPHELIA.md`
