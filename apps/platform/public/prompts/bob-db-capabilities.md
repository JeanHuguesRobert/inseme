---
title: Capacités SQL d'Ophélia (v1)
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

# Capacités SQL d'Ophélia (v1)

> **Objectif :** fournir à la fois aux humains et aux agents IA un aide-mémoire unique sur ce que le
> chatbot peut interroger aujourd'hui via l'outil `sql_query` (lecture seule).

## 1. Directives et outils disponibles

| Directive / Option                          | Effet                                                                                                  | Notes                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `mode=debug`                                | Active les journaux détaillés, y compris l'affichage de chaque requête SQL dans le flux de discussion. | À utiliser lors de l'investigation ou pour expliquer les calculs à l'utilisateur.                            |
| `db=postgresql://user:pass@host:5432/base;` | Change temporairement la base Postgres interrogée.                                                     | Facultatif. Sans cette directive, on reste sur la base Supabase par défaut.                                  |
| `sql_query` (outil)                         | Exécute une requête SQL **SELECT uniquement** sur la base active.                                      | Toutes les requêtes sont automatiquement encapsulées avec un `LIMIT` (max 500) pour éviter les débordements. |

**Important :** aucune opération d'écriture n'est permise dans cette v1 (`INSERT`, `UPDATE`,
`DELETE`, `ALTER`, etc.). Toute tentative sera bloquée.

## 2. Schéma condensé à connaître

Les tables suivantes sont déjà optimisées pour la lecture via `sql_query`. Utiliser les exemples
pour guider la génération de requêtes.

| Domaine                      | Table                                                                 | Colonnes clés / notes                                                                   | Exemples de requêtes                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversations                | `chat_interactions`                                                   | `id`, `user_id`, `question`, `answer`, `sources`, `metadata`, `created_at`              | Dernières questions : `SELECT user_id, question, created_at FROM chat_interactions ORDER BY created_at DESC LIMIT 10;`                      |
| Paramètres chatbot           | `chatbot_settings`                                                    | `welcome_message`, `fallback_message`, `max_sources`, `metadata`                        | Voir les réglages actifs : `SELECT welcome_message, fallback_message FROM chatbot_settings ORDER BY updated_at DESC LIMIT 1;`               |
| Contributions                | `posts`, `comments`, `reactions`                                      | Champs textuels + `metadata` JSONB                                                      | Derniers commentaires : `SELECT post_id, content, created_at FROM comments ORDER BY created_at DESC LIMIT 5;`                               |
| Groupes / missions           | `groups`, `group_members`, `missions_*` (dans `tasks`/`propositions`) | Utiliser les colonnes `metadata` pour filtrer par type (ex : `metadata->>'groupType'`). | Groupes « gazette » : `SELECT id, name FROM groups WHERE metadata->>'groupType' = 'gazette';`                                               |
| Transparence municipale      | `municipal_transparency`                                              | `commune_name`, `population`, indicateurs booléens                                      | Communes qui diffusent les conseils : `SELECT commune_name FROM municipal_transparency WHERE livestreamed = true ORDER BY updated_at DESC;` |
| Propositions & votes         | `propositions`, `proposition_tags`, `votes`                           | `status`, `metadata`, `created_at`                                                      | Top 3 votes : `SELECT proposition_id, COUNT(*) AS total_votes FROM votes GROUP BY proposition_id ORDER BY total_votes DESC LIMIT 3;`        |
| Wiki / connaissances locales | `wiki_pages`, `knowledge_chunks`, `document_sources`                  | `slug`, `title`, `metadata`, `text`                                                     | Derniers articles : `SELECT slug, title, updated_at FROM wiki_pages ORDER BY updated_at DESC LIMIT 5;`                                      |

> 💡 Astuce : les colonnes JSONB (`metadata`, `payload`, `result`) se consultent via
> `metadata->>'clé'` (texte) ou `metadata->'bloc'->>'clé'` (imbriqué).

## 3. Bonnes pratiques pour les agents

1. **Toujours vérifier les directives** : si l'utilisateur fournit des instructions explicites
   (`provider=`, `mode=`, `db=`), les respecter avant d'appeler un outil.
2. **Limiter la taille des résultats** : si la requête peut retourner beaucoup de lignes, ajouter
   ses propres `ORDER BY ... LIMIT n` explicites pour garder la réponse lisible.
3. **Expliquer les requêtes en mode debug** : lorsque `mode=debug` est actif, résumer en langage
   naturel ce que le SQL fait pour aider l'utilisateur à apprendre.
4. **Sanitiser les entrées utilisateur** : ne pas coller directement du texte utilisateur dans un
   `WHERE` sans vérification. Préférer des filtres explicites (statuts connus, booléens, etc.).
5. **Toujours signaler l'absence de données** : si la requête retourne 0 ligne, informer
   l'utilisateur et proposer une alternative (autre filtre, outil différent, etc.).

## 4. Étapes futures (roadmap)

- ✅ V1 lecture seule (ce document).
- 🔄 Prochaine étape : outiller l'introspection automatique (fichier JSON ou API) afin qu'Ophélia
  puisse récupérer ce contenu à la demande.
- 🔒 V2 : actions contrôlées (création de tâches/propositions) via procédures stockées sécurisées.
- 🧠 V3 : auto-diagnostic des permissions et recommandations de workflows (combiner `vector_search`,
  `sql_query`, et futurs outils d'action).

---

Ce document étant public (format Markdown), il peut être :

- **Lu par un humain** pour comprendre les capacités actuelles.
- **Ingesté par un agent IA** (copie dans le prompt système, vectorisation, etc.) pour guider
  Ophélia lors de futures tâches.
