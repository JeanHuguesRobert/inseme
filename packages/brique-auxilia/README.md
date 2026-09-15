---
title: brique-auxilia
author: unknown
date: '2026-06-15'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 14af0ca
  origin_date: '2026-06-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
status: working-paper
---


# brique-auxilia

> **Auxilia** — brique d'hospitalité numérique (data & power) pour téléphones portables.

Auxilia permet à une personne disposant d'une ressource critique (connexion mobile, batterie, point
de recharge) d'en partager temporairement une fraction avec une personne proche qui en manque.
Service d'hospitalité conforme à la tradition d'accueil méditerranéenne, instanciation humaine du
_store-and-forward_ des Energy Packet Networks (cadre FractaVolta).

**Spécification complète** : voir [`AUXILIA.md`](./AUXILIA.md).

## Statut

`v0.1.0` — **squelette initial**. La brique est déclarée dans `brique.config.js` mais les handlers,
pages et edge functions sont des stubs. Implémentation à conduire par Claude Code à partir de cette
base.

## Devise

> **Transparence des actes. Pudeur des personnes. Confidentialité des contenus.**

## Place dans le monorepo

`brique-auxilia` est la treizième brique de `inseme/packages/`, à côté de :

- `brique-actes`, `brique-blog`, `brique-communes`, `brique-cyrnea`,
- `brique-democracy`, `brique-fil`, `brique-group`, `brique-kudocracy`,
- `brique-map`, `brique-ophelia`, `brique-tasks`, `brique-wiki`.

Elle est consommable par les trois apps hôtes (`apps/cyrnea`, `apps/inseme`, `apps/platform`) via le
registre auto-généré `brique-registry.gen.js`.

## Architecture

Conforme à [`packages/cop-host/BRIQUE_SPEC.md`](../cop-host/BRIQUE_SPEC.md).

- **Manifeste** : `brique.config.js` à la racine, typé `BriqueConfig`.
- **Frontend** : React + JSX, pages dans `src/pages/`, icônes Phosphor.
- **Backend** : Netlify Functions (Node) dans `src/functions/`, Edge Functions (Deno) dans
  `src/edge/`.
- **Persistence** : Supabase, tables `cop_*` partagées. Pas de table propre — utilise
  `metadata jsonb` sous la clé `auxilia`. Voir `src/lib/cop-mapping.js`.
- **i18n** : `src/i18n/{fr,en,it,co}.json`. FR + EN + IT activées par défaut, CO en option.

## Mapping COP

| Concept Auxilia                | Entité COP                                            |
| ------------------------------ | ----------------------------------------------------- |
| Offre (donneur publie)         | `cop_topic` avec `metadata.auxilia.kind = "offer"`    |
| Demande (bénéficiaire signale) | `cop_topic` avec `metadata.auxilia.kind = "request"`  |
| Match (appariement)            | `cop_event` avec `metadata.auxilia.kind = "match"`    |
| Session (transfert)            | `cop_task` avec `metadata.auxilia.kind = "session"`   |
| Incident                       | `cop_event` avec `metadata.auxilia.kind = "incident"` |
| Power asset (powerbank, etc.)  | `cop_topic` avec `metadata.auxilia.kind = "asset"`    |

Schémas détaillés dans `src/lib/cop-mapping.js`.

## Routes

| Route                          | Composant         | Protégée |
| ------------------------------ | ----------------- | -------- |
| `/auxilia`                     | `AuxiliaHome.jsx` | non      |
| `/auxilia/need`                | `Need.jsx`        | non      |
| `/auxilia/give`                | `Give.jsx`        | **oui**  |
| `/auxilia/hub/:hubId`          | `Hub.jsx`         | non      |
| `/auxilia/session/:sessionId`  | `Session.jsx`     | **oui**  |
| `/auxilia/incident/:sessionId` | `Incident.jsx`    | **oui**  |
| `/auxilia/charte`              | `Charte.jsx`      | non      |
| `/auxilia/stats`               | `Stats.jsx`       | non      |

## API endpoints

**Netlify Functions** (POST sauf indication) :

- `POST /api/auxilia-create-offer`
- `POST /api/auxilia-create-request`
- `POST /api/auxilia-match-request`
- `POST /api/auxilia-accept-match`
- `POST /api/auxilia-confirm-presence` — scan QR croisé
- `POST /api/auxilia-start-session`
- `POST /api/auxilia-end-session`
- `POST /api/auxilia-report-incident`
- `CRON /api/auxilia-cleanup-expired` — quotidien 03:00 UTC
- `CRON /api/auxilia-daily-stats` — quotidien 23:55 UTC

**Edge Functions** :

- `GET  /auxilia/hub/:id/state` — état temps réel d'un hub
- `SSE  /auxilia/session/:id/events` — flux d'événements d'une session
- `GET  /auxilia/qr/:token` — résolution rapide de QR de session

## Configuration d'instance

Paramètres dans `instance_config` (voir `brique.config.js` → `configSchema`) :

| Clé                           | Type   | Défaut             | Description            |
| ----------------------------- | ------ | ------------------ | ---------------------- |
| `auxilia_default_hub_id`      | string | —                  | UUID du hub par défaut |
| `auxilia_session_max_minutes` | int    | 15                 | Durée max session      |
| `auxilia_offer_ttl_minutes`   | int    | 30                 | TTL d'une offre        |
| `auxilia_min_battery_percent` | int    | 30                 | Seuil donneur power    |
| `auxilia_languages_enabled`   | array  | `["fr","en","it"]` | Langues actives        |
| `auxilia_sms_provider`        | string | `supabase`         | OTP SMS                |
| `auxilia_panneau_pdf_url`     | string | —                  | PDF imprimable         |

## Développement

```bash
# Depuis la racine du monorepo
pnpm install
pnpm --filter brique-auxilia lint

# Activer la brique pour une app hôte
# (voir docs/MODULAR_SYSTEM.md du monorepo)
```

## Persona pivot

Auxilia est conçue pour fonctionner d'abord pour le **visiteur en territoire inconnu** :

1. Arrive sur une place équipée (Place Paoli à Corte, par exemple).
2. Téléphone à 5 % de batterie ou plus de data.
3. Voit un panneau physique multilingue avec QR statique.
4. Scanne, inscription en moins de 30 s par OTP SMS (numéro avec son indicatif pays) ou e-mail.
5. Voit les offres du hub, sollicite une aide.
6. Rencontre le donneur sur place, scan QR croisé, transfert court.
7. Repart, peut laisser un mot de remerciement anonyme.

Le mécanisme fonctionne tout aussi bien pour les habitants entre eux (étudiant, livreur, personne
âgée), mais le visiteur est le cas-test : si Auxilia marche pour lui, elle marche pour tout le
monde.

## Licence

MIT — voir la métadonnée `license` dans [`package.json`](./package.json).

## Auteur

Jean Hugues Robert — `jhr@baronsmariani.org`

Projet soutenu par l'association C.O.R.S.I.C.A., dans le cadre du mouvement #PERTITELLU à Corte.

## Liens

- Spec complète : [`AUXILIA.md`](./AUXILIA.md)
- Contrat des briques : [`packages/cop-host/BRIQUE_SPEC.md`](../cop-host/BRIQUE_SPEC.md)
- Système modulaire `inseme` : [`docs/MODULAR_SYSTEM.md`](../../docs/MODULAR_SYSTEM.md)
- Cadre conceptuel FractaVolta :
  [github.com/JeanHuguesRobert/FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta)
