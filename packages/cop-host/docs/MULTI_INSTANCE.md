---
title: Architecture Multi-Instance Inseme
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

# Architecture Multi-Instance Inseme

Ce document décrit le fonctionnement du multi-instance pour les applications de l'écosystème Inseme (SaaS, Platform, Inseme).

## Concept

L'architecture repose sur une instance "Hub" qui sert de registre pour toutes les autres instances. Chaque instance possède sa propre base de données Supabase et sa propre configuration.

## Flux de Résolution d'Instance

Lorsqu'une requête arrive sur une Edge Function ou une fonction Node.js :

1.  **Chargement du Hub** : Le système charge initialement la configuration de l'instance "Hub" (définie par les variables d'environnement `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` par défaut).
2.  **Détection de l'Instance** : Le nom de l'instance cible est extrait :
    - Du sous-domaine (ex: `client1.inseme.org` -> instance `client1`).
    - D'un paramètre de requête ou d'un en-tête (ex: `X-Ophelia-Instance`).
3.  **Lookup dans le Registre** : Une requête est faite sur la table `instances` (ou via une RPC `lookup_instance`) de l'instance Hub pour récupérer les paramètres de connexion de l'instance cible (URL Supabase, Clés, etc.).
4.  **Rechargement de la Configuration** : Si une instance cible est identifiée, le système "recharge" sa configuration :
    - Il crée un nouveau client Supabase pointant vers l'instance cible.
    - Il vide le cache de configuration actuel.
    - Il charge la table `instance_config` depuis la base de données de l'instance cible.
5.  **Exécution** : Le code s'exécute normalement, mais toutes les requêtes Supabase et les appels à `getConfig()` utilisent désormais les données de l'instance cible.

## Composants Clés

### `cop-host` (Runtime & Config)

Le package `cop-host` centralise la logique de résolution :

- **`packages/cop-host/src/runtime/edge.js`** : Contient `handleInstanceResolution` pour les Edge Functions.
- **`packages/cop-host/src/config/instanceConfig.core.js`** : Gère le cache global de configuration et le mécanisme de rechargement.
- **`packages/cop-host/src/lib/template.js`** : Gère la substitution des variables (ex: `{{ CITY_NAME }}`) qui sont désormais spécifiques à chaque instance.

### Injection d'En-têtes

Pour permettre au frontend de connaître l'instance résolue, les Edge Functions injectent des en-têtes `X-Ophelia-*` dans la réponse :

- `X-Ophelia-Instance` : ID de l'instance.
- `X-Ophelia-Instance-Name` : Nom de l'instance.
- `X-Ophelia-Supabase-URL` : URL de l'instance cible.
- `X-Ophelia-Supabase-Anon-Key` : Clé publique de l'instance cible.

## Configuration des Domaines

Le système de résolution de sous-domaine supporte plusieurs domaines de base (ex: `lepp.fr`, `inseme.org`). Tout ce qui se trouve avant le domaine de base est considéré comme le nom de l'instance.

Exemple :

- `corte.lepp.fr` -> instance `corte`
- `test.inseme.org` -> instance `test`

## Substitution de Métadonnées (SEO)

Le fichier `index.html` est modifié dynamiquement au moment de la livraison par l'Edge Function `app-entry.js`. Les placeholders comme `{{ CITY_NAME }}` sont remplacés par les valeurs définies dans la table `instance_config` de l'instance résolue.

## Variables de Configuration Supportées

Toutes les variables présentes dans la table `instance_config` de l'instance sont accessibles via `getConfig(key)`. Les variables suivantes sont automatiquement substituées dans les fichiers Markdown et HTML :

- `CITY_NAME` : Nom de la ville ou collectivité.
- `PARTY_NAME` : Nom de l'organisation ou du parti.
- `APP_URL` : URL racine de l'application.
- `FACEBOOK_APP_ID` : ID de l'application Facebook pour le partage.
- `BOT_NAME` : Nom du bot conversationnel (si applicable).

## Développement Local

Pour tester le multi-instance en local :

1.  Utilisez un outil comme `ngrok` ou modifiez votre fichier `hosts` pour simuler des sous-domaines (ex: `corte.localhost`).
2.  Assurez-vous que l'instance Hub est accessible via les variables d'environnement locales.
3.  L'en-tête `X-Ophelia-Instance` peut être forcé manuellement pour les tests API.
