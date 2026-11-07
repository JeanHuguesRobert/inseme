---
title: 🚀 Guide de Provisioning d'Instance
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

# 🚀 Guide de Provisioning d'Instance

Ce guide documente la procédure pour déployer une nouvelle instance (ex: ville, université, association) sur la plateforme multi-instance Ophélia.

## 🏗️ Architecture
La plateforme utilise un **Hub National** (Corte/Pertitellu) et des instances secondaires isolées. Chaque instance possède sa propre base de données Supabase mais partage la même base de code (déploiement unique Netlify).

## 📋 Prérequis
1.  **Supabase** : Créer un nouveau projet (recommandé : organisation C.O.R.S.I.C.A., région `eu-west-3`).
2.  **GitHub** : Un token (`GITHUB_TOKEN`) avec des droits de création de dépôt si vous souhaitez automatiser le wiki.
3.  **DNS** : Le wildcard `*.lepp.fr` doit être configuré vers Netlify.

## 🚀 Procédure de Provisioning (Automatisée)

Le script `scripts/provision-instance.js` permet de piloter le processus de manière granulaire.

### 1. Collecte des informations
```bash
node scripts/provision-instance.js --interactive
```
Cette étape génère un fichier de configuration dans `instances/[subdomain].json`.

### 2. Création du repo Wiki (GitHub)
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-github
```
Crée un dépôt à partir du template `commune-wiki-template`.

### 3. Application du Schéma (Supabase)
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-migrations
```
Applique toutes les migrations SQL sur la nouvelle base Supabase.

### 4. Configuration du Vault
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-vault
# Dogfood / workstation → vault (copie complète des clés réelles du .env) :
# node scripts/push-env-to-vault.js --apply --verbose
```
Injecte les variables d'identité et les secrets dans la table `instance_config`.

> **Pourquoi un vault ?** Pour ne **pas** recopier toutes les clés API dans l’UI Netlify.
> Netlify ne garde que `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ; le reste est lu depuis
> `instance_config` (Node functions **et** Edge Deno). Voir **[CONFIGURATION_VAULT.md](./CONFIGURATION_VAULT.md)**.

### 5. Enregistrement dans le Hub
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-registry
```
Optionnel: Enregistre le sous-domaine dans le registry du Hub national pour la fédération.

### 6. Seeding initial du Wiki
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-seed
```
Injecte les pages wiki de base (Accueil, Transparence) basées sur le type d'instance.

---

## 🛠️ Vérification Manuelle (Human-in-the-Loop)

Après le provisioning, effectuez ces points de contrôle :

- [ ] **Accès Local** : Testez via `http://localhost:5173/?instance=[subdomain]`.
- [ ] **Accès Prod** : Vérifiez que `https://[subdomain].lepp.fr` charge correctement.
- [ ] **Ophélia** : Posez une question pour vérifier que l'IA a bien capté l'identité locale.
- [ ] **Wiki** : Vérifiez que les pages de seed sont bien modifiables.
- [ ] **Admin** : Créez un compte et passez vous en `admin` via SQL :
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'votre@email.com';
  ```

## 🔧 Maintenance
Mises à jour : Un simple `git push` sur le repo principal met à jour toutes les instances simultanément.
Modification config : Utilisez `/admin/vault` sur l'instance concernée.

---
_Document généré le 1er janvier 2026_

## Enrôlement du Principal après provisionnement (7 novembre 2026)

L'existence d'une instance `public.instances` et l'accès aux clés de service du projet **ne prouvent pas l'identité de son Principal**. L'instance fondatrice `jhn` peut être `status='autonomous'` tout en conservant `principal_id=NULL`. Ce champ référence `public.users.id`, lequel doit correspondre à un utilisateur authentifié dans **le même projet** Supabase (Auth `auth.users.id`).

**Reality Test, projet JHN (7 novembre 2026, métadonnées et comptages seulement) :** 2 `auth.users` confirmés, tous deux avec une identité Auth et un profil `public.users` au même UUID ; aucun `public.instances.principal_id` renseigné. Ne pas créer automatiquement un troisième utilisateur avant d'avoir déterminé, par une session vérifiée et des preuves indépendantes, si un compte existant correspond au Principal.

Deux stratégies sont possibles :

1. **Migration depuis Survey (héritage).** Reconstituer une relation entre deux domaines Auth distincts nécessite une assertion d'identité fédérée vérifiable (OIDC/OAuth ou authentification nouvelle), un consentement contextualisé et un appariement univoque. Ne pas copier directement `auth.users`, les hachés de mot de passe, les refresh tokens ni les identifiants de session ; les JWT d'un projet ne valent pas authentification de l'autre.
2. **Enrôlement autonome après provisioning (chemin préféré).** Dans le projet cible, utiliser d'abord le compte existant dont la session Supabase Auth est vérifiée (`auth.getUser(jwt)`). Sinon, passer par la création native Auth avec confirmation d'adresse / invitation administrateur et prise de contrôle du compte par la personne ; l'invitation émet un courrier et demeure donc une opération distincte à autoriser spécifiquement. Ensuite, exiger une **preuve indépendante de légitimité du revendiquant pour l'instance** (signature du Principal fondateur épinglée hors du domaine Supabase ou mécanisme d'approbation humain équivalent), portant sur l'UUID de compte et d'instance, une version et une durée de validité. Vérifier la présence de `public.users` au même UUID, puis effectuer une association conditionnelle `principal_id IS NULL`, sans écraser une attribution concurrente ; enregistrer un reçu de claim. Cette association n'émet **aucun mandat COP** et ne confère aucun droit de déchiffrement du coffre.

L'interface serveur autonome de préparation et de liaison est implémentée dans [`scripts/principal-enrollment.js`](../scripts/principal-enrollment.js). Elle reçoit des adaptateurs `authClient`, `adminClient` et `verifyRootClaim` **injetés par un service de confiance**. Sans vérificateur indépendant, elle refuse. `prepare()` n'écrit rien ; `claim()` ne peut écrire qu'après une session Auth et un root claim vérifiés, avec verrou optimiste sur l'instance. Il n'existe pas encore de route HTTP publique, de vérificateur de signature root opérationnel, ni de workflow de session finalisée déployé : le module ne constitue donc **pas encore une procédure d'enrôlement utilisable en production**.

**Prochaine intégration gouvernée :** choisir le compte cible à partir d'une session authentifiée présentée par le Principal, établir et épingler l'émetteur indépendant de la preuve de revendication, connecter le module à une route backend à protection CSRF, limite de débit et journal d'audit, vérifier l'absence de concurrence puis enregistrer l'attribution et son reçu. La confiance SSH/Tailscale ou la possession d'une `service_role` ne remplace jamais cette preuve. Ne créer aucun lien d'autorité entre un compte Survey et le compte JHN par simple égalité d'adresse e-mail.

Test à données fictives : `node scripts/principal-enrollment.test.js`.

Références : [Supabase Auth — Users](https://supabase.com/docs/guides/auth/users), [Admin inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
