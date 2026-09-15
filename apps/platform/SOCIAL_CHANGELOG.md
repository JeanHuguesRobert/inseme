---
title: Social Features - Changelog
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

# Social Features - Changelog

## Fichiers créés

### Migration SQL

- ✅ `supabase/migrations/20251119_create_social_tables.sql` - Migration complète avec tables,
  indexes, triggers, RLS

### Libraries

- ✅ `src/lib/metadata.js` - Helpers génériques pour manipulation JSONB metadata
- ✅ `src/lib/socialMetadata.js` - Helpers spécifiques social (groups, posts, comments, reactions)

### Components - Groups

- ✅ `src/components/social/GroupList.jsx` - Liste de groupes avec filtres par type
- ✅ `src/components/social/GroupCard.jsx` - Carte d'affichage d'un groupe
- ✅ `src/components/social/GroupDetail.jsx` - Page détail avec membres et posts du groupe
- ✅ `src/components/social/GroupForm.jsx` - Formulaire création/édition groupe

### Components - Posts

- ✅ `src/components/social/PostEditor.jsx` - Éditeur de post (nouveau/édition)
- ✅ `src/components/social/PostList.jsx` - Liste de posts avec filtres
- ✅ `src/components/social/PostCard.jsx` - Carte d'affichage d'un article
- ✅ `src/components/social/PostView.jsx` - Vue détaillée d'un article avec commentaires

### Components - Comments & Reactions

- ✅ `src/components/social/CommentThread.jsx` - Thread de commentaires imbriqués avec real-time
- ✅ `src/components/social/CommentForm.jsx` - Formulaire de saisie de commentaire
- ✅ `src/components/social/ReactionPicker.jsx` - Sélecteur emoji avec compteurs et real-time

### Pages

- ✅ `src/pages/Social.jsx` - Page d'accueil social avec tabs (Tout/Groupes/Posts)
- ✅ `src/pages/GroupPage.jsx` - Wrapper pour GroupDetail
- ✅ `src/pages/GroupCreate.jsx` - Wrapper pour GroupForm (création)
- ✅ `src/pages/PostPage.jsx` - Wrapper pour PostView
- ✅ `src/pages/PostCreate.jsx` - Wrapper pour PostEditor (création)

### Documentation

- ✅ `SOCIAL_FEATURES.md` - Documentation complète du système
- ✅ `SOCIAL_QUICKSTART.md` - Guide de démarrage rapide
- ✅ `SOCIAL_CHANGELOG.md` - Ce fichier

## Fichiers modifiés

### Routing

- ✅ `src/App.jsx`
  - Ajout imports : Social, GroupPage, GroupCreate, PostPage, PostCreate
  - Ajout routes : /social, /groups/new, /groups/:id, /posts/new, /posts/:id
  - Ajout lien menu : "Social (Forums & Blogs)"

### Intégrations cross-features

- ✅ `src/pages/WikiPage.jsx`
  - Ajout bouton "💬 Discuter" pour créer post lié à wiki_page

- ✅ `src/pages/Proposition.jsx`
  - Ajout bouton "💬 Discuter" pour créer post lié à proposition

### Auth

- ✅ `src/lib/supabase.js`
  - Ajout hook `useAuth()` pour récupérer user actuel et écouter changements auth

## Tables créées/modifiées

### Nouvelles tables

- ✅ `reactions` - Réactions emoji sur posts/comments
- ✅ `read_tracking` - Suivi de lecture (pour futures notifications)
- ✅ `activity_log` - Audit trail des actions

### Tables existantes étendues

- ✅ `groups` - Ajout metadata (groupType, location, etc.)
- ✅ `posts` - Ajout metadata (postType, title, groupId, linkedType/linkedId, isPinned, isLocked,
  viewCount)
- ✅ `comments` - Ajout metadata (parentCommentId, isEdited, editedAt)
- ✅ `group_members` - Déjà existante, utilisée telle quelle
- ✅ `users` - Pas modifiée, utilisée pour relations

### Colonnes standardisées sur toutes tables

- ✅ `metadata jsonb DEFAULT '{"schemaVersion": 1}'`
- ✅ `created_at timestamptz DEFAULT now()`
- ✅ `updated_at timestamptz DEFAULT now()`
- ✅ Trigger `set_updated_at` sur toutes les tables

## RLS Policies créées

### `reactions`

- ✅ SELECT public (anyone_select_reactions)
- ✅ INSERT authenticated (authenticated_insert_reactions)
- ✅ DELETE own (users_delete_own_reactions)

### `read_tracking`

- ✅ SELECT own (users_select_own_tracking)
- ✅ INSERT own (users_insert_own_tracking)
- ✅ UPDATE own (users_update_own_tracking)

### `activity_log`

- ✅ SELECT public (anyone_select_activity)
- ✅ INSERT authenticated (authenticated_insert_activity)

### Tables existantes (groups, posts, comments, group_members)

- ✅ Policies ajoutées pour public read, authenticated write, owner edit/delete
- ✅ Filtrage soft delete via `metadata->>'isDeleted' IS NULL OR metadata->>'isDeleted' = 'false'`

## Features implémentées

### Groupes/Communautés

- ✅ Créer groupe (quartier, association, forum, communauté)
- ✅ Lister groupes avec filtres par type
- ✅ Détail groupe avec membres et posts
- ✅ Rejoindre/quitter groupe
- ✅ Groupes privés avec approbation
- ✅ Rôles admin/member
- ✅ Soft delete groupes

### Posts/Publications

- ✅ Créer post (blog, forum, annonce)
- ✅ Posts standalone ou dans groupe
- ✅ Lier post à wiki_page ou proposition
- ✅ Lister posts avec filtres (type, groupe, entité liée)
- ✅ Épingler/verrouiller posts (modération)
- ✅ Compteur de vues
- ✅ Tags sur posts
- ✅ Soft delete posts
- ✅ Édition posts

### Commentaires

- ✅ Commenter sur posts
- ✅ Réponses imbriquées (threads)
- ✅ Édition commentaires avec marqueur "modifié"
- ✅ Soft delete commentaires
- ✅ Real-time updates (Supabase subscriptions)

### Réactions

- ✅ 7 emojis supportés (👍 👎 ❤️ 😂 🤔 🎉 👀)
- ✅ Réactions sur posts ET commentaires
- ✅ Compteurs par emoji
- ✅ Toggle réaction (ajouter/retirer)
- ✅ Highlight réactions de l'utilisateur actuel
- ✅ Real-time updates

### Navigation

- ✅ Page d'accueil /social avec tabs
- ✅ Lien menu principal
- ✅ Boutons "Discuter" sur Wiki et Propositions
- ✅ Breadcrumbs dans vues détaillées
- ✅ Liens croisés (groupe → posts, post → groupe)

### Sécurité

- ✅ RLS policies strictes
- ✅ Public read pour transparence
- ✅ Authenticated write
- ✅ Owner edit/delete
- ✅ Soft delete (audit trail)
- ✅ Validation metadata

### UX/UI

- ✅ Loading states
- ✅ Error handling
- ✅ Empty states ("Aucun groupe pour l'instant")
- ✅ Responsive design (Tailwind CSS)
- ✅ Icônes contextuelles (📝 💬 🏘️ etc.)
- ✅ Badges visuels (Épinglé, Verrouillé, Bloqué)

## Stats

- **Fichiers créés** : 19
- **Fichiers modifiés** : 4
- **Composants React** : 13
- **Pages** : 5
- **Tables créées** : 4
- **Tables étendues** : 3
- **RLS Policies** : ~20
- **Helpers/Utils** : 2
- **Lignes de code** : ~2500+
- **Documentation** : 3 fichiers MD

## Tests recommandés

- [ ] Créer un groupe de chaque type
- [ ] Créer des posts dans et hors groupes
- [ ] Tester commentaires imbriqués (3 niveaux min)
- [ ] Tester réactions multiples (plusieurs users, plusieurs emojis)
- [ ] Tester soft delete (groupe, post, commentaire)
- [ ] Tester posts liés (wiki + proposition)
- [ ] Tester modération (pin, lock)
- [ ] Tester permissions RLS (connecté vs non-connecté)
- [ ] Tester real-time (ouvrir 2 onglets, commenter, réagir)
- [ ] Tester responsive (mobile, tablet, desktop)

## Évolutions futures possibles

- [ ] Notifications (email, in-app)
- [ ] Recherche full-text (posts, comments)
- [ ] Upload images (Supabase Storage)
- [ ] Markdown editor avec preview
- [ ] Mentions @ dans commentaires
- [ ] Hashtags # recherchables
- [ ] Rapports/signalements (modération communautaire)
- [ ] Abonnements/follows (groupes, posts, users)
- [ ] Analytics (posts populaires, users actifs)
- [ ] Export/archive conversations
- [ ] API publique (REST/GraphQL)
- [ ] Progressive Web App (PWA)
- [ ] Mode sombre
- [ ] Accessibilité ARIA
- [ ] i18n (français/corse)

## Migration deployment

1. Backup database existante
2. Exécuter `20251119_create_social_tables.sql`
3. Vérifier tables et policies créées
4. Tester CRUD operations en dev
5. Tester RLS avec différents users
6. Deploy frontend (build + netlify)
7. Smoke tests en production
8. Monitoring erreurs (Sentry, etc.)

## Notes importantes

- ✅ Base de données vide → migration immédiate OK
- ✅ Pattern JSONB metadata permet évolutions sans migrations futures
- ✅ Soft delete préserve historique pour audit
- ✅ Real-time Supabase utilisé pour UX reactive
- ✅ Pas de breaking changes sur tables existantes
- ✅ Compatible avec Kudocracy, Wiki, Bob existants
