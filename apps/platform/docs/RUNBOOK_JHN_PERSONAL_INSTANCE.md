---
title: Runbook — Instance personnelle JHN
subtitle: 'Priorité dogfooding : jhn.baronsmariani.org sur Inseme, sans toucher lepp.fr'
author: Jean Hugues Noël Robert, baron Mariani
date: '2026-07-19'
version: '0.1'
license: CC BY-SA 4.0
language: fr
status: working-runbook
document_role: operational
visibility: public
related_documents:
  - ../../research/instance_map.md
  - ../../research/personal_instance_democracy_and_non_capturable_match.md
  - ../instances/jhn.example.json
  - ../instances/QUICKSTART.md
  - https://github.com/JeanHuguesRobert/inseme/issues/17
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Runbook — Instance personnelle JHN

## Objectif

Disposer **en priorité** d’une instance personnelle pour Jean Hugues Noël Robert (JHN)
(`instance_id` verrouillé : **`jhn`** — voir [instance_map.md](../../research/instance_map.md) ;
première instance collective = **`pertitellu-corte`** / lepp.fr, non confondre) :

| Élément                    | Cible                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| URL publique               | `https://jhn.baronsmariani.org`                                                 |
| Code                       | monorepo **inseme**, app `apps/platform`                                        |
| Base de données            | **nouveau** projet Supabase (pas la DB Corte)                                   |
| Site Netlify               | **nouveau** site (ou site dédié preview/prod), **pas** le site lepp.fr / survey |
| lepp.fr / Pertitellu Corte | **inchangé** jusqu’à bascule ultérieure                                         |

Doctrine :
[personal_instance_democracy_and_non_capturable_match.md](../../research/personal_instance_democracy_and_non_capturable_match.md)  
Vertical
slice agents / TwinRoot : [inseme#17](https://github.com/JeanHuguesRobert/inseme/issues/17) (après
smoke de l’instance).

---

## Stratégie de déploiement (jour 1)

### Mode recommandé : mono-instance

Pour aller vite sans hub multi-tenant :

```text
Netlify (site inseme-jhn)
  env SUPABASE_*  →  projet Supabase JHN uniquement
  domaine         →  jhn.baronsmariani.org

Si le resolver extrait le sous-domaine "jhn" et ne trouve pas
d’entrée registry, il retombe sur la config env par défaut
= le même projet JHN. Comportement acceptable en mono-instance.
```

### Mode ultérieur : multi-apex + registry

Quand Corte basculera, un **hub** portera `instance_registry` avec au minimum :

```text
subdomain   = jhn
host_domain = baronsmariani.org   # (champ à généraliser ; metadata en attendant)
supabase_*  = projet JHN
```

et d’autres lignes pour `corte` / `*.lepp.fr`.

**Ne pas bloquer le jour 1 sur le hub.**

---

## Checklist globale

### A. Prérequis comptes

- [ ] Accès GitHub `JeanHuguesRobert/inseme`
- [ ] Accès Supabase (org C.O.R.S.I.C.A. ou perso)
- [ ] Accès Netlify (team qui hébergera le site **JHN**, pas forcément le site lepp.fr)
- [ ] Accès DNS `baronsmariani.org` (Cloudflare ou registrar)

### B. Supabase JHN

- [ ] Projet créé
- [ ] Migrations / schéma appliqués
- [ ] Vault `instance_config` seed JHN
- [ ] Auth : email (et providers choisis) configurés
- [ ] URL site autorisée dans Auth redirect URLs
- [ ] Compte admin JHN

### C. Netlify inseme → JHN

- [ ] Site lié au repo **inseme**
- [ ] Build base `apps/platform`
- [ ] Variables d’env = projet Supabase **JHN**
- [ ] Deploy preview ou production OK

### D. DNS

- [ ] `jhn.baronsmariani.org` → site Netlify JHN
- [ ] TLS OK
- [ ] **lepp.fr non modifié**

### E. Smoke

- [ ] Page d’accueil charge
- [ ] Login / session
- [ ] Vault / admin accessible
- [ ] Pas d’erreurs 500 massives sur fonctions critiques

### F. Ensuite (hors ce runbook jour 1)

- [ ] TwinRoot / constitution / mandats (#17)
- [ ] Plan bascule Pertitellu Corte

---

## Phase 0 — Config locale (fichier d’instance)

1. Copier le modèle :

```bash
cd apps/platform
cp instances/jhn.example.json instances/jhn.json
```

2. Éditer `instances/jhn.json` : coller `supabase_url` et `supabase_anon_key` **après** création du
   projet.  
   **Ne jamais committer** `jhn.json` avec des secrets service-role.  
   Le fichier exemple reste sans secrets ; `jhn.json` devrait rester gitignoré s’il contient des
   clés (sinon n’y mettre que l’anon key publique).

3. Vérifier le schéma actuel (contrainte legacy) :

```text
community_type = "association"   # enum actuel ; métadonnées portent le sens personal-twin
```

Les champs `deployment_kind`, `subject_kind`, `host_domain` sont dans le JSON / vault en
**métadonnées** jusqu’à extension formelle du schéma (#17).

---

## Phase 1 — Projet Supabase JHN

### 1.0 Projet créé (dogfooding 2026-07)

| Champ         | Valeur                                                                |
| ------------- | --------------------------------------------------------------------- |
| Project ref   | `ndiysuhzmztatpxbkezn`                                                |
| Project URL   | `https://ndiysuhzmztatpxbkezn.supabase.co`                            |
| Bootstrap     | **SQL Editor manuel** (CLI Supabase non fiable sur la machine de dev) |
| Config locale | `instances/jhn.json` + `.env` (gitignorés)                            |

**Clés API :** Supabase expose désormais `sb_publishable_…` / `sb_secret_…` **en plus** des JWT
legacy `anon` / `service_role`. Les deux formats coexistent. Pour `apps/platform` + Netlify Edge :

- jour 1 : essayer la publishable key dans `VITE_SUPABASE_ANON_KEY` ;
- si auth / Realtime / edge bloquent : Dashboard → **Settings → API Keys** → copier aussi le JWT
  **anon** `eyJ…` et l’utiliser dans les env.

Ne **pas** coller de `service_role` / `sb_secret_` dans le chat, le git, ou le front.

### 1.1 Création (référence si recréation)

1. https://supabase.com/dashboard → **New project**
2. Organisation : C.O.R.S.I.C.A. (ou la vôtre)
3. Nom suggéré : `inseme-jhn` ou `ophelia-jhn`
4. Région : `eu-west-3` (Paris)
5. Mot de passe DB : stocké hors git (gestionnaire de secrets)
6. Noter :
   - Project URL : `https://xxxxx.supabase.co`
   - publishable **et/ou** `anon` JWT
   - secret **ou** `service_role` (**secret**, Netlify only)

### 1.2 Schéma — chemin **CLI Supabase** (standard)

Page blanche → **migrations versionnées** + `db push`. Pas de collage SQL Editor pour les
évolutions.

```powershell
cd C:\tweesic\inseme\apps\platform
# déjà linké sur JHN (●)
supabase migration list
# Database password = mot de passe Postgres du projet (création Supabase)
supabase db push
supabase migration list   # local = remote
```

#### Layout

```text
supabase/config.toml                 # supabase init
supabase/migrations/                 # UNIQUEMENT ce que le CLI applique
  20260720040000_baseline_personal_instance.sql
  20260720040100_jhn_instance_identity.sql
  20260720043000_jhn_instance_config_from_pertitellu_public.sql  # features/map/chatbot (sans secrets)
supabase/migrations_legacy/          # archive Survey/Corte — référence, non appliquée
supabase/schema.sql                  # dump de contexte, NE PAS exécuter
```

**Vault / Pertitellu :** les clés **publiques** (features, map, branding) viennent d’une migration
curatée.  
Les **secrets** (API keys, OAuth, `service_role`) viennent de `inseme/.env` → vault via script
(comme sur Pertitellu).  
Pas de copie croisée des secrets _d’un autre projet Supabase_.

> **À mémoriser (design)** : le vault existe pour éviter l’enfer du copier-coller de clés dans
> Netlify. Réf. canonique : [`CONFIGURATION_VAULT.md`](./CONFIGURATION_VAULT.md).

#### Secrets → vault (edge functions)

Les edge/backend lisent `instance_config` avec le client **service_role** (Netlify env :
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` du projet JHN).  
Les autres clés (OpenAI, Anthropic, …) doivent être **dans le vault**, pas seulement dans le `.env`
local.

```powershell
cd C:\tweesic\inseme\apps\platform
# 1) Mettre SERVICE_ROLE JHN dans inseme/.env si absent :
#    supabase projects api-keys --project-ref ndiysuhzmztatpxbkezn
# 2) Dry-run puis apply — copie complète des clés non vides / non-placeholder du .env
node scripts/push-env-to-vault.js
node scripts/push-env-to-vault.js --apply --verbose
```

Politique « copie complète » : tout ce qui est réellement disponible dans `inseme/.env` (prefixes +
mappings) part dans le vault. Placeholders vides (`ANTHROPIC_API_KEY=`, `your_…`, `sesame`) ne sont
**pas** poussés (sinon le code croit avoir une clé).

RLS : les lignes `is_secret=true` ne sont **pas** lisibles en anon/authenticated (migration
`…_instance_config_secret_rls`).  
Service role contourne le RLS (edge admin).

#### Ajouter une évolution de schéma (discipline)

```powershell
cd C:\tweesic\inseme\apps\platform
supabase migration new ma_evolution
# éditer le fichier créé sous supabase/migrations/
supabase db push
```

Ne **pas** modifier à la main le SQL Editor cloud pour le schéma (sauf urgence documentée +
`db pull` / migration de rattrapage).

**Critère d’acceptation Phase 1.2 :** `migration list` aligné ; tables `users` et `instance_config`
présentes ; seed JHN lisible.

### 1.3 Seed vault JHN

Exécuter le SQL fourni dans :

```text
instances/sql/jhn-vault.example.sql
```

(adapter email, noms, couleurs si besoin).

Valeurs d’identité attendues :

| key               | value (indicatif)                       |
| ----------------- | --------------------------------------- |
| community_name    | Jean Hugues Noël Robert / Baron Mariani |
| community_type    | association _(legacy enum)_             |
| community_tagline | Instance personnelle JHN                |
| bot_name          | Ophélia (ou nom dédié)                  |
| contact_email     | jhr@baronsmariani.org (ou email admin)  |
| deployment_kind   | personal _(metadata / config)_          |
| host_domain       | baronsmariani.org                       |
| app_url           | https://jhn.baronsmariani.org           |

### 1.4 Auth

Dans Supabase → Authentication → URL configuration :

```text
Site URL:     https://jhn.baronsmariani.org
Redirect URLs:
  https://jhn.baronsmariani.org/**
  http://localhost:5173/**
  http://localhost:8888/**
```

Activer au minimum **Email**. Providers OAuth : seulement si redirect configurés.

### 1.5 Premier admin

1. S’inscrire via l’UI une fois l’app jointe.
2. En SQL (service role / SQL Editor) :

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'VOTRE_EMAIL@example.com';
```

(Ajuster le nom de table/colonne si le schéma réel diffère — vérifier `\d users` / Table Editor.)

---

## Phase 2 — Local smoke (avant Netlify)

### Secrets / env (politique actuelle)

| Fichier                         | Rôle                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `inseme/.env` (racine monorepo) | **Source de vérité** secrets workstation                    |
| `apps/platform/.env`            | Copie publique Vite (URL + anon) pour dogfooding JHN        |
| `.env.pertitellu.local`         | Backup local de l’ancien alignement Pertitellu (gitignored) |

Ne pas laisser `SUPABASE_URL` sur le projet Pertitellu (`opnotbjrb…`) tout en travaillant JHN
(`ndiysuh…`).  
Ne **jamais** coller un `SERVICE_ROLE` Pertitellu avec une URL JHN.

Contrôle sans écriture :

```powershell
cd C:\tweesic\inseme\apps\platform
node scripts/sync-secrets.js          # dry-run par défaut
```

Écritures (opt-in) : `--apply` (merge `.env` only) ; `--apply --vault` pour pousser le vault.

```bash
cd C:\tweesic\inseme   # monorepo
pnpm install
# Depuis la racine ou apps/platform selon scripts
pnpm platform:dev
# ou : cd apps/platform && pnpm dev
```

Créer / aligner `apps/platform/.env` (non commité) — idéalement miroir de la racine :

```env
SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # serveur / functions only — projet JHN uniquement
```

Tests :

- [ ] `http://localhost:5173/` charge
- [ ] `http://localhost:5173/?instance=jhn` ne casse pas (mono-instance)
- [ ] Signup (email réel ou domaine autorisé — `@example.com` peut être refusé)
- [ ] Login
- [ ] Section admin / vault si présente

#### Auth smoke notes (2026-07-20)

1. `pnpm platform:dev` must be `pnpm --filter platform run dev` (fixed in root `package.json`).
2. Projet Auth : confirmation email **activée** par défaut → login renvoie `email_not_confirmed`
   jusqu’à confirmation.
3. Contournement dogfooding (CLI, pas SQL Editor) :

```powershell
cd C:\tweesic\inseme\apps\platform
supabase db query --linked "UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'VOTRE@email';"
```

4. Ou désactiver _Confirm email_ dans Dashboard → Authentication → Providers → Email (ok pour
   instance perso / dev).
5. Trigger `handle_new_user` crée `public.users` (rôle `user`) au signup.
6. Promo admin (après login OK) :

```powershell
supabase db query --linked "UPDATE public.users SET role = 'admin' WHERE email = 'VOTRE@email';"
```

7. `sb_publishable_…` fonctionne pour REST/Auth sur ce projet ; tables `users` + `instance_config`
   répondent 200.
8. Warning Vite possible (scan `cop-kernel` / `createStackCallPacket`) : pré-bundling skippé,
   HTML/modules principaux servis — suivre si une page COP casse.

---

## Phase 3 — Site Netlify (inseme, pas lepp.fr)

### 3.1 Créer un **nouveau** site

1. Netlify → Add new site → Import from Git → `JeanHuguesRobert/inseme`
2. Branch : `main` (ou branche de dogfooding)
3. Build settings :

| Setting           | Value                                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base directory    | `apps/platform`                                                                                                                                                                                                        |
| Build command     | `pnpm install --frozen-lockfile` au root monorepo peut exiger config monorepo ; en pratique souvent : depuis base, `cd ../.. && pnpm install && pnpm --filter platform build` — **ajuster** selon le premier build log |
| Publish directory | `apps/platform/dist` (ou `dist` si base = apps/platform)                                                                                                                                                               |

Le `netlify.toml` du monorepo sous `apps/platform` fixe déjà :

```toml
base = "apps/platform"
command = "npm run build"   # préférer pnpm si le site est configuré pnpm
publish = "dist"
```

Si le monorepo exige pnpm workspaces, configurer **Package manager = pnpm** et éventuellement :

```text
Build command: pnpm install && pnpm run build
```

avec base `apps/platform`, ou un script racine `pnpm platform:build` si vous l’ajoutez.

### 3.2 Variables d’environnement Netlify

Même jeu que `.env` local, **projet JHN uniquement** :

```text
SUPABASE_URL
VITE_SUPABASE_URL
SUPABASE_ANON_KEY
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Ne **pas** coller les clés du projet Corte / lepp.fr.

### 3.3 Domaine custom

1. Netlify → Domain management → Add domain : `jhn.baronsmariani.org`
2. Suivre les records DNS indiqués (CNAME vers `*.netlify.app` ou cible fournie)
3. Attendre certificat TLS

### 3.4 Interdiction explicite

```text
❌ Ne pas changer le repo lié du site lepp.fr (survey)
❌ Ne pas pointer *.lepp.fr vers ce site tant que la bascule Corte n’est pas planifiée
❌ Ne pas réutiliser la DB Supabase de Corte pour JHN
```

---

## Phase 4 — DNS baronsmariani.org

Chez le DNS de `baronsmariani.org` :

```text
Type   Name    Value
CNAME  jhn     <target-netlify-du-site-jhn>
```

(ou record A/ALIAS selon Netlify DNS).

Vérifications :

```text
https://jhn.baronsmariani.org
# certificat valide, app charge, login OK
```

`baronsmariani.org` apex / www : hors scope (peut rester site statique / autre).

---

## Phase 5 — Smoke production

| Test                                                       | OK ? |
| ---------------------------------------------------------- | ---- |
| Home charge                                                |      |
| Login email                                                |      |
| Session persistante                                        |      |
| Admin / rôle admin                                         |      |
| Vault affiche community_name JHN                           |      |
| Pas de fuite de config Corte (noms Pertitellu, etc.)       |      |
| Functions critiques (si utilisées) ne 500-ent pas en masse |      |

Noter la date du smoke et le commit `inseme` déployé.

---

## Phase 6 — Après le smoke (hors jour 1)

Ordre conseillé :

1. Documenter le **project-ref** Supabase JHN et le **siteId** Netlify (hors git secrets).
2. Ouvrir / poursuivre [inseme#17](https://github.com/JeanHuguesRobert/inseme/issues/17) : TwinRoot,
   mandats, agents.
3. Étendre `instance-schema` / registry avec `deployment_kind`, `host_domain`.
4. **Seulement ensuite** : plan de bascule Pertitellu Corte (survey → inseme), en s’appuyant sur ce
   qui a marché pour JHN.

---

## Dépannage rapide

| Symptôme                          | Piste                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| Build monorepo échoue (workspace) | Installer depuis racine inseme ; pnpm ; vérifier `base` Netlify     |
| Écran blanc / erreur Supabase     | Env VITE\_\* manquantes ou mauvaises clés                           |
| Auth redirect invalid             | URLs Auth Supabase                                                  |
| branding Corte                    | Vault non seedé ou mauvais projet Supabase                          |
| `jhn` not found en multi-instance | Normal sans registry ; mono-instance doit fallback env              |
| lepp.fr cassé                     | Vous avez touché le mauvais site Netlify — restaurer le site survey |

---

## Fichiers associés

| Fichier                                                                                                                                    | Rôle                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [instances/jhn.example.json](../instances/jhn.example.json)                                                                                | Modèle de config (sans secrets)           |
| [instances/sql/jhn-vault.example.sql](../instances/sql/jhn-vault.example.sql)                                                              | Seed vault                                |
| [instances/QUICKSTART.md](../instances/QUICKSTART.md)                                                                                      | Provisioning générique (legacy community) |
| [research/personal_instance_democracy_and_non_capturable_match.md](../../research/personal_instance_democracy_and_non_capturable_match.md) | Doctrine                                  |

---

## Résumé en une page

```text
1. Créer Supabase inseme-jhn
2. Appliquer schéma + seed vault JHN
3. .env local → smoke pnpm platform:dev
4. Nouveau site Netlify → repo inseme → env JHN
5. DNS jhn.baronsmariani.org → ce site
6. Admin + smoke prod
7. (plus tard) TwinRoot / mandats
8. (encore plus tard) bascule Corte / lepp.fr
```

_Challenge via issues. Ne pas confondre instance personnelle et instance de redevabilité._
