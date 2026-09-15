---
title: project_rules
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

JS only, ES6, concise, expert, reuse, honest

## Monorepo Workflow
- **Netlify Dev**: Toujours lancer `netlify dev` depuis le répertoire spécifique de l'application (ex: `apps/cyrnea`) et non depuis la racine du monorepo.
- **Paths in netlify.toml**: Les chemins vers les fonctions doivent être définis depuis la racine du monorepo (ex: `apps/cyrnea/netlify/functions`).
