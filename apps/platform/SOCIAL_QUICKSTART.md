---
title: Guide de démarrage - Social Features
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

# Guide de démarrage - Social Features

## Étape 1 : Exécuter la migration SQL

Dans le tableau de bord Supabase (SQL Editor) :

```sql
-- Copier-coller le contenu de : supabase/migrations/20251119_create_social_tables.sql
-- Puis exécuter
```

Ou via CLI :

```bash
supabase db push
```

## Étape 2 : Vérifier les tables

Dans l'onglet "Table Editor" de Supabase, vous devriez voir :

- ✅ `reactions`
- ✅ `read_tracking`
- ✅ `activity_log`

Et les tables existantes avec colonnes `metadata` et timestamps :

- ✅ `groups` (metadata, created_at, updated_at)
- ✅ `posts` (metadata, created_at, updated_at)
- ✅ `comments` (metadata, created_at, updated_at)

## Étape 3 : Tester dans l'interface

### Accéder à la page Social

```
http://localhost:5173/social
```

### Créer un groupe

1. Cliquer sur "+ Créer un groupe"
2. Remplir le formulaire :
   - Nom : "Quartier Centre-ville"
   - Type : Quartier
   - Location : "Centre-ville, Corte"
   - Description : "Groupe des habitants..."
3. Soumettre
4. Vérifier dans `groups` table

### Créer un article dans le groupe

1. Sur la page du groupe, cliquer "+ Nouvelle publication"
2. Type : Discussion (Forum)
3. Titre : "Test de discussion"
4. Contenu : "Ceci est un test..."
5. Soumettre
6. Vérifier dans `posts` table avec `metadata->>'groupId'`

### Commenter

1. Sur la page du post, écrire un commentaire
2. Soumettre
3. Répondre au commentaire (bouton "Répondre")
4. Vérifier dans `comments` table avec `metadata->>'parentCommentId'`

### Réagir avec emoji

1. Sur un article ou commentaire, cliquer sur l'emoji picker (😀)
2. Choisir un emoji
3. Vérifier dans `reactions` table

### Créer un article lié à une page Wiki

1. Aller sur une page Wiki existante
2. Cliquer sur "💬 Discuter"
3. Cela ouvre l'éditeur avec `linkedType=wiki_page` et `linkedId=...`
4. Publier
5. Vérifier `metadata->>'linkedType'` et `metadata->>'linkedId'`

## Étape 4 : Vérifier les permissions (RLS)

### Test en mode non-connecté

1. Se déconnecter de Supabase Auth
2. Aller sur `/social`
3. ✅ Devrait voir les groupes publics
4. ✅ Devrait voir les posts
5. ❌ Ne devrait PAS voir "+ Créer un groupe" ou "+ Nouvelle publication"

### Test soft delete

1. Connecté, créer un article
2. Le supprimer (bouton "Supprimer")
3. Vérifier dans `posts` : `metadata->>'isDeleted'` = `true`
4. ✅ Le post ne devrait plus apparaître dans la liste
5. Mais existe toujours en BDD (soft delete)

## Étape 5 : Vérifier les intégrations

### Menu principal

1. Vérifier le lien "Social (Forums & Blogs)" dans le menu burger
2. Cliquer dessus → Devrait aller sur `/social`

### Pages Wiki

1. Aller sur `/wiki/[une-page]`
2. Vérifier le bouton "💬 Discuter" à côté de "Partager"
3. Cliquer → Devrait ouvrir éditeur de post avec lien pré-rempli

### Pages Proposition

1. Aller sur `/propositions/[une-id]`
2. Vérifier le bouton "💬 Discuter" en haut à droite
3. Cliquer → Devrait ouvrir éditeur de post avec lien pré-rempli

## Requêtes SQL utiles pour debug

### Voir tous les groupes avec metadata

```sql
SELECT id, name, created_at, metadata
FROM groups
WHERE metadata->>'isDeleted' IS NULL OR metadata->>'isDeleted' = 'false'
ORDER BY created_at DESC;
```

### Voir posts d'un groupe

```sql
SELECT p.id, p.metadata->>'title' as title, p.created_at, u.email
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.metadata->>'groupId' = 'uuid-du-groupe'
  AND (p.metadata->>'isDeleted' IS NULL OR p.metadata->>'isDeleted' = 'false')
ORDER BY p.created_at DESC;
```

### Voir commentaires d'un article avec threads

```sql
SELECT
  c.id,
  c.content,
  c.metadata->>'parentCommentId' as parent_id,
  c.created_at,
  u.email
FROM comments c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.post_id = 'uuid-du-post'
  AND (c.metadata->>'isDeleted' IS NULL OR c.metadata->>'isDeleted' = 'false')
ORDER BY c.created_at ASC;
```

### Voir réactions sur un article

```sql
SELECT emoji, COUNT(*) as count
FROM reactions
WHERE target_type = 'post' AND target_id = 'uuid-du-post'
GROUP BY emoji
ORDER BY count DESC;
```

### Voir membres d'un groupe

```sql
SELECT u.email, gm.created_at, gr.role
FROM group_members gm
LEFT JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = 'uuid-du-groupe'
ORDER BY gm.created_at ASC;
```

## Troubleshooting

### Erreur "relation does not exist"

→ La migration n'a pas été exécutée. Retour à Étape 1.

### Erreur "permission denied for table"

→ RLS policies pas créées. Vérifier que toute la migration a été exécutée.

### Posts ne s'affichent pas

→ Vérifier `metadata->>'isDeleted'` n'est pas `true` → Vérifier RLS policies avec
`SELECT * FROM posts` en mode admin

### useAuth hook erreur

→ Vérifier que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont dans `.env` → Voir aussi
`docs/CONFIGURATION_VAULT.md` pour le système de configuration centralisé

### Commentaires imbriqués ne s'affichent pas

→ Vérifier que `metadata->>'parentCommentId'` est bien un UUID valide → Vérifier la fonction
`buildCommentTree()` dans `CommentThread.jsx`

### Réactions ne se mettent pas à jour

→ Vérifier la souscription real-time dans `ReactionPicker.jsx` → Vérifier que le channel Supabase
est bien actif (onglet Realtime dans dashboard)

## Prochaines étapes

Une fois le système fonctionnel :

1. **Tester avec vrais utilisateurs** :
   - Créer quelques groupes pour différents quartiers de Corte
   - Inviter des citoyens à rejoindre et discuter
   - Observer les patterns d'utilisation

2. **Modération** :
   - Désigner des admins de groupe
   - Tester le verrouillage de posts (`isLocked`)
   - Tester l'épinglage de posts importants

3. **Contenus** :
   - Créer des posts de blog pour actualités municipales
   - Lier discussions aux propositions Kudocracy
   - Lier discussions aux pages Wiki importantes

4. **Évolutions** :
   - Ajouter notifications (email ou in-app)
   - Ajouter recherche full-text
   - Implémenter upload d'images
   - Ajouter badges/récompenses pour contributeurs actifs
