# ROADMAP TECHNIQUE INSEME

Ce document recense les évolutions techniques structurantes identifiées lors du développement.

## 📱 PWA & Mobile Experience

### Manifeste Dynamique Multi-tenant (P2)

**Problème** : Actuellement, le `manifest.webmanifest` est statique (généré par Vite au build).

- Conséquence : Toutes les villes (instances) partagent le même nom ("Inseme") et la même icône sur
  l'écran d'accueil.
- Objectif : `bastia.inseme.app` doit s'installer comme "Inseme Bastia", `corte.inseme.app` comme
  "Inseme Corte".

**Solution technique** :

1. Intercepter `/manifest.webmanifest` via l'Edge Function (`instance-resolver.js`).
2. Identifier l'instance via le sous-domaine.
3. Générer le JSON à la volée en injectant :
   - `name`: `Inseme ${CityName}`
   - `short_name`: `Inseme ${CityCode}`
   - `theme_color`: Couleur primaire de l'instance
   - `background_color`: Couleur de fond de l'instance
   - `icons`: Icônes (SVG/PNG) spécifiques récupérées depuis la configuration de l'instance
     (Supabase).
4. Servir ce JSON avec le bon Content-Type.
5. **Pré-requis** : Étendre le schéma de configuration `instance_config` pour stocker les assets PWA
   (icône, couleurs) par ville.

### SEO & Indexation (P2)

**Problème** : `robots.txt` et `sitemap.xml` sont actuellement absents (404) ou exclus du résolveur.

- Conséquence : Indexation incontrôlée (ou impossible) des instances.
- Objectif : Servir des fichiers dynamiques selon l'instance.

**Solution technique** :

- `robots.txt` : Doit indiquer le Sitemap dynamique
  (`Sitemap: https://${subdomain}.inseme.app/sitemap.xml`) et gérer les règles d'exclusion (ex:
  interdire l'indexation des instances de staging/dev).
- `sitemap.xml` : Doit lister les URLs publiques valides pour l'instance donnée (Fil d'actu, Actes,
  Pages statiques).

### Cas d’usage : Actes au Bar Cyrnea (P3)

**Idée produit** : Permettre de parler du « dernier conseil municipal » directement dans le bar
(Cyrnea) en s’appuyant sur la brique Actes (recherche d’actes, demandes, files d’attente, etc.).

- Objectif : Connecter l’ambiance « bar » (Cyrnea) aux données civiques locales (Actes) pour
  fluidifier le passage de la discussion informelle à l’information institutionnelle vérifiée.
- Pistes :
  - Exposer dans Cyrnea des entrées de navigation ou rituels dédiés (« On parle du dernier conseil ?
    ») qui pointent vers des vues Actes adaptées au format bar.
  - Utiliser les tools Actes existants (`search_actes`, `get_demande_status`) dans les flows IA
    d’Ophélia Cyrnea pour répondre à des questions sur les décisions municipales.
  - Définir les limites d’usage (information, pédagogie, pas de gestion de démarches sensibles côté
    bar).

### Architecture & Build System (P3)

**Problème** : Certaines fonctions "système" (`robots.txt`, `instance-resolver`, `upload`) sont
dupliquées manuellement dans chaque app (via des stubs) alors qu'elles devraient être injectées
automatiquement.

- Conséquence : Risque de divergence entre les apps, maintenance manuelle fastidieuse, pollution du
  code source des apps.
- Objectif : Automatiser l'injection des fonctions système via `compile-briques.js` ou un concept de
  "System Brique" (ex: `brique-core`).
- **Note** : Prolog a été déplacé dans `brique-ophelia`, ce qui est une bonne pratique
  (fonctionnalité liée à une brique), mais l'upload reste une fonction d'infrastructure transverse.

### Sécurité & Stockage (P2)

**Problème** : Chemins d'upload multiples (R2 via backend, Supabase direct en fallback) avec des
garanties de sécurité et de contrôle hétérogènes.

- Objectif : Garantir qu'en production tous les uploads utilisateurs passent par une couche backend
  contrôlée (R2 / Edge Function) et que Supabase Storage direct ne soit utilisé que pour le
  développement ou des cas techniques spécifiques.
- Pistes :
  - Désactiver le fallback Supabase pour les buckets `media/proof/tmp` en production.
  - Centraliser le logging, la limitation de taille et le throttling au niveau de `/api/upload`.
  - Documenter clairement les usages autorisés de Supabase Storage direct (dev, outils internes).

### Éthique & Gouvernance d’Ophélia (P2)

**Problème** : Les prompts d’Ophélia sont éthiquement exigeants (non-partisanerie, transparence,
souveraineté humaine), mais la gouvernance (qui décide des prompts, comment ils sont révisés, quelle
est la politique de logs et de conservation) n’est pas encore formalisée ni documentée, et le cadre
légal (protection des données, droit électoral, droit de la presse) n’est pas encore explicitement
pris en compte dans la conception.

- Objectif : Rendre les règles de fonctionnement d’Ophélia aussi transparentes que ses prompts, en
  particulier pour les contextes sensibles (bar Cyrnea, débats municipaux, usages politiques), tout
  en respectant explicitement le cadre légal applicable (RGPD, règles sur les données sensibles,
  communication politique, etc.).
- Pistes :
  - Documenter la politique de logging, de conservation et d’accès aux conversations (durées,
    finalités, anonymisation éventuelle) en cohérence avec le RGPD.
  - Définir un processus de gouvernance des prompts (qui peut les modifier, validation, historique
    des changements), incluant une vérification de conformité légale pour les modifications
    sensibles.
  - Expliciter les limites d’usage d’Ophélia dans les lieux sociaux (ce qu’elle ne fait pas :
    fichage, dénonciation, profilage politique) et les relier aux interdictions / obligations
    légales pertinentes.

---

## 🏗️ Architecture & DevOps

### Gouvernance applicative via Kudocracy (P3)

**Problème** : Aujourd’hui, les décisions sur les apps (features, prompts, cas d’usage sensibles
comme Cyrnea + Actes) sont principalement prises par le développeur / président de l’association. À
terme, l’objectif est que la plateforme de vote Kudocracy permette de décider de ces choix de
manière « archi démocratique ».

- Objectif : Faire de Kudocracy le mécanisme de gouvernance des apps Inseme (configuration des
  briques, activation de fonctionnalités, évolutions d’Ophélia), en cohérence avec le projet
  politique de CORSICA.
- Pistes :
  - Définir quelles décisions applicatives peuvent / doivent passer par Kudocracy (prompts,
    activation de briques, règles d’usage dans les bars, etc.).
  - Connecter techniquement Kudocracy à la configuration des instances (briques actives, options,
    prompts overrides).
  - Prévoir des garde-fous pour les décisions très sensibles (sécurité, données personnelles) qui
    nécessitent un traitement juridique/technique spécifique.

### Nettoyage des Caches (Réalisé le 2026-01-17)

- Exclusion stricte des fichiers statiques dans le résolveur d'instance.
- Mise en place de `vite-plugin-pwa`.
