---
title: 🏗️ Architecture Project Context (AI-Ready)
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: fr
document_role: archive
document_kind: architecture
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

# 🏗️ Architecture Project Context (AI-Ready)

> Ce fichier est auto-généré. Il sert de carte de contexte pour les outils de Vibe Coding et les
> LLM.

## 🛠 Tech Stack

- React
- Supabase
- Netlify Edge Functions
- TailwindCSS
- Monorepo

## 📂 Structure des Applications

- **apps/cyrnea**: Application principale
- **apps/inseme**: Application principale
- **apps/platform**: Application principale

## 🧩 Cartographie des Briques (`packages/`)

Toutes les briques suivent le pattern : `src/` pour la logique et `public/prompts/` pour les
identités de l'IA.

## 🗺 Arborescence Simplifiée (Répertoires uniquement)

```text
├── .vscode/
├── apps/
│   ├── cyrnea/
│   │   ├── .netlify/
│   │   │   ├── blobs-serve/
│   │   │   ├── functions-internal/
│   │   │   ├── functions-serve/
│   │   │   │   ├── gen-wiki-optimize-title/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   ├── gen-wiki-propose/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   ├── gen-wiki-propose-ai/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   ├── gen-wiki-resolve/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   ├── gen-wiki-search/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   ├── gen-wiki-sync/
│   │   │   │   │   └── netlify/
│   │   │   │   │       └── functions/
│   │   │   │   └── prolog-executor/
│   │   │   │       └── netlify/
│   │   │   │           └── functions/
│   │   │   └── v1/
│   │   │       └── functions/
│   │   ├── apps/
│   │   │   └── cyrnea/
│   │   │       └── .netlify/
│   │   │           ├── edge-functions-serve/
│   │   │           ├── functions-internal/
│   │   │           └── v1/
│   │   │               └── functions/
│   │   ├── netlify/
│   │   │   ├── edge-functions/
│   │   │   └── functions/
│   │   ├── playwright-report/
│   │   ├── public/
│   │   │   ├── briques/
│   │   │   │   ├── actes/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── democracy/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── legal/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── fil/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── ophelia/
│   │   │   │   │   └── prompts/
│   │   │   │   │       ├── capabilities/
│   │   │   │   │       ├── identity/
│   │   │   │   │       ├── modes/
│   │   │   │   │       ├── roles/
│   │   │   │   │       └── tasks/
│   │   │   │   └── wiki/
│   │   │   │       └── prompts/
│   │   │   └── prompts/
│   │   ├── scripts/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   └── lib/
│   │   ├── test-results/
│   │   └── tests/
│   │       ├── assets/
│   │       ├── integration/
│   │       └── unit/
│   ├── inseme/
│   │   ├── .netlify/
│   │   │   ├── blobs-serve/
│   │   │   ├── functions-internal/
│   │   │   ├── functions-serve/
│   │   │   │   └── config/
│   │   │   │       └── src/
│   │   │   │           └── netlify/
│   │   │   │               └── functions/
│   │   │   └── v1/
│   │   │       └── functions/
│   │   ├── archive/
│   │   │   └── firebase-version/
│   │   │       └── public/
│   │   ├── dist/
│   │   │   ├── assets/
│   │   │   ├── docs/
│   │   │   ├── images/
│   │   │   └── prompts/
│   │   ├── netlify/
│   │   │   ├── edge-functions/
│   │   │   └── functions/
│   │   ├── public/
│   │   │   ├── briques/
│   │   │   │   ├── actes/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── democracy/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── legal/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── fil/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── images/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   └── widget/
│   │   │   │   ├── ophelia/
│   │   │   │   │   └── prompts/
│   │   │   │   │       ├── capabilities/
│   │   │   │   │       ├── identity/
│   │   │   │   │       ├── modes/
│   │   │   │   │       ├── roles/
│   │   │   │   │       └── tasks/
│   │   │   │   └── wiki/
│   │   │   │       └── prompts/
│   │   │   ├── docs/
│   │   │   ├── images/
│   │   │   └── prompts/
│   │   ├── scripts/
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   └── config/
│   │   │   ├── components/
│   │   │   │   └── SaaS/
│   │   │   ├── lib/
│   │   │   │   └── config/
│   │   │   └── package/
│   │   └── supabase/
│   │       ├── .temp/
│   │       ├── applied-migrations/
│   │       └── migrations/
│   └── platform/
│       ├── .githooks/
│       ├── .netlify/
│       │   ├── blobs-serve/
│       │   ├── functions-internal/
│       │   ├── functions-serve/
│       │   │   ├── api/
│       │   │   ├── facebook-avatar/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── facebook-data-deletion/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── facebook-deauthorize/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── facebook-deletion-status/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── facebook-oembed/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── generateShareText/
│       │   │   ├── ingest-content/
│       │   │   ├── instance-lookup/
│       │   │   │   └── src/
│       │   │   │       └── netlify/
│       │   │   │           └── functions/
│       │   │   ├── instances-list/
│       │   │   │   └── src/
│       │   │   │       └── netlify/
│       │   │   │           └── functions/
│       │   │   ├── job-runner/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── ngrok-control/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── oauth-complete/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── oauth-providers/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── oauth-start/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── optimize-wiki-title/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── public_browser/
│       │   │   │   ├── public/
│       │   │   │   │   ├── docs/
│       │   │   │   │   │   ├── conseils/
│       │   │   │   │   │   │   └── cache/
│       │   │   │   │   │   │       └── canon/
│       │   │   │   │   │   │           ├── DELIB/
│       │   │   │   │   │   │           └── ODJ/
│       │   │   │   │   │   └── officiel/
│       │   │   │   │   ├── images/
│       │   │   │   │   ├── prompts/
│       │   │   │   │   └── widget/
│       │   │   │   └── src/
│       │   │   │       └── netlify/
│       │   │   │           └── functions/
│       │   │   ├── rgpd-delete/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── rgpd-export/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── schema-versions/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── sync-schema-version/
│       │   │   │   └── packages/
│       │   │   │       └── cop-host/
│       │   │   │           └── src/
│       │   │   │               └── config/
│       │   │   ├── sync-wiki/
│       │   │   ├── wiki-propose/
│       │   │   └── wiki-resolve/
│       │   └── v1/
│       │       └── functions/
│       ├── .storybook/
│       ├── .supabase/
│       ├── .trae/
│       │   └── rules/
│       ├── .vscode/
│       ├── .zed/
│       ├── backend/
│       ├── datasets/
│       ├── dist/
│       │   ├── assets/
│       │   ├── docs/
│       │   │   ├── conseils/
│       │   │   │   └── cache/
│       │   │   │       └── canon/
│       │   │   │           ├── DELIB/
│       │   │   │           └── ODJ/
│       │   │   └── officiel/
│       │   ├── images/
│       │   ├── prompts/
│       │   └── widget/
│       ├── docs/
│       ├── hf-space/
│       ├── instances/
│       ├── mcp/
│       │   ├── agents/
│       │   ├── cop/
│       │   └── test/
│       ├── netlify/
│       │   ├── edge-functions/
│       │   │   └── lib/
│       │   │       ├── document_search/
│       │   │       ├── lib/
│       │   │       ├── providers/
│       │   │       ├── tools/
│       │   │       └── utils/
│       │   └── functions/
│       ├── public/
│       │   ├── briques/
│       │   │   ├── actes/
│       │   │   │   ├── docs/
│       │   │   │   ├── images/
│       │   │   │   ├── prompts/
│       │   │   │   └── widget/
│       │   │   ├── democracy/
│       │   │   │   ├── docs/
│       │   │   │   ├── images/
│       │   │   │   ├── legal/
│       │   │   │   ├── prompts/
│       │   │   │   └── widget/
│       │   │   ├── fil/
│       │   │   │   ├── docs/
│       │   │   │   ├── images/
│       │   │   │   ├── prompts/
│       │   │   │   └── widget/
│       │   │   ├── ophelia/
│       │   │   │   └── prompts/
│       │   │   │       ├── capabilities/
│       │   │   │       ├── identity/
│       │   │   │       ├── modes/
│       │   │   │       ├── roles/
│       │   │   │       └── tasks/
│       │   │   └── wiki/
│       │   │       └── prompts/
│       │   ├── docs/
│       │   │   ├── conseils/
│       │   │   │   └── cache/
│       │   │   │       └── canon/
│       │   │   │           ├── DELIB/
│       │   │   │           └── ODJ/
│       │   │   ├── officiel/
│       │   │   └── prompts/
│       │   │       ├── capabilities/
│       │   │       ├── identity/
│       │   │       ├── modes/
│       │   │       ├── roles/
│       │   │       └── tasks/
│       │   ├── images/
│       │   ├── prompts/
│       │   └── widget/
│       ├── scripts/
│       │   ├── ingestion/
│       │   │   └── corte/
│       │   │       └── lib/
│       │   └── lib/
│       ├── seeds/
│       │   ├── association/
│       │   ├── bar/
│       │   ├── municipality/
│       │   └── university/
│       ├── src/
│       │   ├── briques/
│       │   │   └── wiki/
│       │   ├── common/
│       │   │   ├── agents/
│       │   │   ├── config/
│       │   │   ├── db/
│       │   │   ├── schema/
│       │   │   └── services/
│       │   ├── components/
│       │   │   ├── admin/
│       │   │   ├── bob/
│       │   │   │   ├── questions/
│       │   │   │   └── v2/
│       │   │   ├── cafe/
│       │   │   ├── collector/
│       │   │   ├── common/
│       │   │   ├── consultations/
│       │   │   ├── features/
│       │   │   ├── federation/
│       │   │   ├── fil/
│       │   │   ├── gazette/
│       │   │   ├── incidents/
│       │   │   ├── kudocracy/
│       │   │   ├── layout/
│       │   │   ├── missions/
│       │   │   ├── ophelia/
│       │   │   ├── rgpd/
│       │   │   ├── social/
│       │   │   ├── tasks/
│       │   │   ├── user/
│       │   │   └── wiki/
│       │   ├── config/
│       │   ├── contexts/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── netlify/
│       │   │   ├── edge-functions/
│       │   │   └── functions/
│       │   ├── old-edge_functions/
│       │   ├── pages/
│       │   │   ├── admin/
│       │   │   └── consultations/
│       │   ├── services/
│       │   │   └── api/
│       │   ├── styles/
│       │   └── wip-edge-functions/
│       ├── supabase/
│       │   └── migrations/
│       │       ├── cop/
│       │       │   └── applied/
│       │       ├── old_applied/
│       │       └── old_unused/
│       └── widget/
├── docs/
├── models/
│   └── .cache/
│       └── huggingface/
│           └── download/
├── packages/
│   ├── brique-actes/
│   │   ├── public/
│   │   │   ├── docs/
│   │   │   ├── images/
│   │   │   ├── prompts/
│   │   │   └── widget/
│   │   ├── src/
│   │   │   ├── edge/
│   │   │   ├── lib/
│   │   │   └── pages/
│   │   └── tests/
│   ├── brique-blog/
│   │   └── src/
│   │       ├── components/
│   │       │   └── gazette/
│   │       ├── edge/
│   │       └── pages/
│   ├── brique-communes/
│   │   ├── scripts/
│   │   │   └── ingestion/
│   │   │       └── corte/
│   │   │           └── lib/
│   │   └── src/
│   │       ├── lib/
│   │       └── pages/
│   ├── brique-cyrnea/
│   │   └── src/
│   │       ├── components/
│   │       ├── lib/
│   │       └── pages/
│   ├── brique-democracy/
│   │   └── tests/
│   ├── brique-fil/
│   │   ├── public/
│   │   │   ├── docs/
│   │   │   ├── images/
│   │   │   ├── prompts/
│   │   │   └── widget/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── edge/
│   │   │   ├── lib/
│   │   │   └── pages/
│   │   └── tests/
│   ├── brique-group/
│   │   └── src/
│   │       ├── components/
│   │       ├── functions/
│   │       ├── hooks/
│   │       └── pages/
│   ├── brique-kudocracy/
│   │   ├── public/
│   │   │   ├── docs/
│   │   │   ├── images/
│   │   │   ├── legal/
│   │   │   ├── prompts/
│   │   │   └── widget/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   ├── consultations/
│   │   │   │   └── kudocracy/
│   │   │   ├── edge/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── pages/
│   │   └── tests/
│   ├── brique-map/
│   │   └── src/
│   │       ├── components/
│   │       │   └── layers/
│   │       ├── edge/
│   │       ├── lib/
│   │       └── pages/
│   ├── brique-ophelia/
│   │   ├── components/
│   │   │   └── chat/
│   │   ├── data/
│   │   ├── docs/
│   │   ├── edge/
│   │   │   ├── lib/
│   │   │   │   └── prompts/
│   │   │   └── roles/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── public/
│   │   │   └── prompts/
│   │   │       ├── capabilities/
│   │   │       ├── identity/
│   │   │       ├── modes/
│   │   │       ├── roles/
│   │   │       └── tasks/
│   │   ├── tests/
│   │   └── utils/
│   ├── brique-tasks/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── missions/
│   │       │   └── tasks/
│   │       ├── edge/
│   │       ├── lib/
│   │       └── pages/
│   ├── brique-wiki/
│   │   ├── public/
│   │   │   └── prompts/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── edge/
│   │   │   ├── functions/
│   │   │   ├── lib/
│   │   │   ├── pages/
│   │   │   └── styles/
│   │   └── tests/
│   ├── cop-chat/
│   │   └── src/
│   ├── cop-cli/
│   │   └── src/
│   ├── cop-core/
│   │   ├── dist/
│   │   └── src/
│   ├── cop-host/
│   │   ├── docs/
│   │   ├── scripts/
│   │   └── src/
│   │       ├── client/
│   │       ├── components/
│   │       ├── config/
│   │       ├── contexts/
│   │       ├── hooks/
│   │       ├── lib/
│   │       ├── runtime/
│   │       └── scripts/
│   ├── cop-kernel/
│   │   ├── src/
│   │   │   └── storage-implementations/
│   │   │       ├── __tests__/
│   │   │       └── sql/
│   │   │           ├── __tests__/
│   │   │           │   ├── mysql/
│   │   │           │   ├── postgres/
│   │   │           │   └── sqlite/
│   │   │           ├── mysql/
│   │   │           │   └── __mocks__/
│   │   │           ├── postgres/
│   │   │           └── sqlite/
│   │   └── test/
│   ├── cop-prolog/
│   │   └── src/
│   ├── kudocracy/
│   │   └── src/
│   │       └── legal/
│   ├── models/
│   │   ├── scripts/
│   │   ├── src/
│   │   └── tests/
│   ├── ophelia/
│   ├── room/
│   │   ├── components/
│   │   │   └── chat/
│   │   ├── data/
│   │   ├── docs/
│   │   ├── hooks/
│   │   │   └── chat/
│   │   ├── lib/
│   │   │   ├── ai/
│   │   │   └── media/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   └── utils/
│   └── ui/
│       └── src/
│           └── components/
├── scripts/
└── supabase/
    └── migrations/

```

## 📜 Règles de Contribution (Vibe Coding)

1. **Prompts** : Toujours vérifier `public/briques/[nom]/prompts/` avant de modifier le comportement
   d'un agent.
2. **Génération** : Les dossiers `generated/` sont ignorés par Git, ne pas y placer de code manuel.
3. **Edge Functions** : Prioriser les Netlify Edge Functions dans `netlify/edge-functions/`.

---

_Dernière mise à jour : 11/01/2026 23:18:41_
