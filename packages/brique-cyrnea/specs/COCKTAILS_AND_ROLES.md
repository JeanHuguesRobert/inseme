# Améliorations Fonctionnelles : Rôles, Dons & Mixologie

Ce document spécifie les implémentations pour les fonctionnalités de gestion de rôle, de dons
défiscalisables et de mixologie musicale.

## 1. Gestion des Rôles (Barman ↔ Client)

Pour permettre à un utilisateur (ex: Jean-Marie) d'alterner entre "Service" (Dashboard Barman) et
"Détente" (Client App) sans changer de compte.

### Concept

- **Mode Service** : Accès complet au Dashboard, modération, contrôle musique.
- **Mode Repos** : Vue Client standard, désactivation des notifs de service, pas de droits de
  modération actifs (ou masqués).

### Implémentation

1.  **Dashboard Barman (`BarmanDashboard.jsx`)** :
    - Ajout d'un bouton "Passer en mode Client" dans l'onglet `Settings`.
    - Action : Redirection vers `/app/[roomId]` (la vue client).
2.  **Client App (`ClientMiniApp.jsx`)** :
    - Détection des droits (`currentUser.can.moderate` ou `role === 'barman'`).
    - Si droits détectés : Affichage d'un bouton "Prendre le Service" dans le profil utilisateur.
    - Action : Redirection vers `/bar/[roomId]`.

## 2. Dons d'Intérêt Général (Défiscalisables)

Permettre aux usagers de soutenir le développement de la plateforme (Non-Profit) avec un incitatif
fiscal.

### Argumentaire Fiscal (France)

- **Réduction d'impôt** : 66% du don.
- **Exemple** : Donner **30€** ne coûte réellement que **10.20€** après impôt.
- **Formule** : `Coût Réel = Don - (Don * 0.66)`.

### Flux Utilisateur

1.  Dans le widget de paiement (`FundingWidget`), l'utilisateur choisit le destinataire :
    - 🔘 **Pour l'équipe (Pourboire)** : Flux actuel (Stripe/Lydia vers compte Barman).
    - 🔘 **Pour le Projet (Défiscalisable)** : Flux vers l'asso porteuse.
2.  Si "Projet" est sélectionné :
    - Affichage du simulateur : _"Donnez 30€, ça ne vous coûte que 10€ !"_.
    - Formulaire légal (Requis pour reçu fiscal) : Nom, Prénom, Email, Adresse.
    - Paiement via lien dédié Asso.

### Données

- Table `donations_system` : `id`, `amount`, `donor_email`, `donor_details (json)`, `status`,
  `created_at`.

## 3. Mixologie Musicale (Cocktails & Vibe)

Lier l'expérience gustative à l'ambiance sonore.

### Structure de Données : `Cocktail`

```json
{
  "id": "mojito_royal",
  "name": "Mojito Royal",
  "category": "classic", // shooter, premium, mocktail
  "spirit": "rhum",
  "origin": "cuba",
  "vibe_tags": ["festif", "soleil", "danse"],
  "music_pairing": {
    "genre": "son cubano",
    "artist_suggestion": "Buena Vista Social Club",
    "bpm_range": [90, 120]
  }
}
```

### Fonctionnalités

1.  **Menu Digital Interactif (Client)** :
    - Le client consulte la carte des cocktails.
    - Chaque cocktail affiche son "Accord Musical".
    - Action : "Commander & Lancer la Vibe" (ajoute une musique liée à la playlist d'attente).

2.  **Création de Carte (Barman)** :
    - Outil pour composer la "Playlist de Cocktails" du soir.
    - Suggestions automatiques : "Tu as du Rhum ? Ajoute ces titres...".

3.  **Mode "Shooter Aléatoire"** :
    - Le client paie pour un "Shooter Mystère".
    - Le système choisit un shooter ET lance un jingle sonore/lumineux synchronisé.

### Intégration Technique

- Nouveau module `packages/brique-cyrnea/src/lib/cocktailManager.js`.
- Extension du `MusicControl` pour accepter des "Vibe Requests" venant des commandes de boissons.

## Exemple de prompt pour générer le code, généré par ChatGPT

Objectif : Générer un prototype web interactif pour la gestion dynamique de la carte des cocktails
dans le bar Cyrnea. Deux interfaces : barman et client.

Technologies : JavaScript pur, React, responsive, mobile first.

Fonctionnalités côté Barman :

Tableau de cocktails existants (nom, image, ingrédients, prix, ambiance musicale associée).

Création / modification / suppression de cocktails.

Association d’un cocktail à une playlist ou morceau (simulé par URL ou nom de fichier audio).

Visualisation des votes clients en temps réel (simulé par compteur dynamique).

Suggestions IA (placeholder Ophélia) : affichage d’un cocktail suggéré selon ambiance.

Export / import JSON des cocktails et votes.

Fonctionnalités côté Client :

Consultation de la carte des cocktails en temps réel (images, nom, description, ingrédients).

Vote pour un cocktail (bouton “J’aime”).

Suggestion de variante de cocktail (champ texte libre).

Écoute de la playlist associée (audio HTML5 ou URL simulée).

Filtrage par type de cocktail, popularité ou ambiance musicale.

Contraintes UX / UI :

Interface responsive, adaptée au mobile.

Feedback instantané lors d’un vote ou ajout/modification de cocktail.

Visualisation claire des cocktails populaires ou recommandés.

Design simple et intuitif, couleurs et typographie légères.

Données :

Stocker les cocktails et votes en mémoire pour le prototype (objet JS).

Simulation d’événements “temps réel” via setInterval ou EventEmitter pour test.

Sortie attendue :

Code HTML + CSS + JS complet, commenté, facilement testable sur un PC local.

Deux pages distinctes ou un mode basculant entre Barman / Client.

Placeholder pour IA Ophélia et playlists audio (simulation par fichiers locaux ou URL).

Bonus :

Animation légère pour votes ou suggestions IA.

Indicateurs visuels pour cocktail du jour / recommandé.

Possibilité de “simuler” 10–20 clients votant pour tester le rendu dynamique.
