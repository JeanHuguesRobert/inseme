# Inseme – Documentation de l’architecture COP & Ophélia

## 1. Objectif général

Le projet **Inseme** vise à créer un **écosystème multi-tenant pour la gestion et la traçabilité
d’artefacts numériques**, où chaque instance représente une **personne numérique**, liée à une
personne physique ou morale.

Objectifs :

- Gestion des **rôles multiples** (membre, électeur, contributeur, usager, mandataire).
- Coopération **multi-agent** via COP (Cognitive Orchestration Protocol) avec HIL (Human in the
  Loop).
- **Traçabilité et sécurité** des données.
- Démultiplication des capacités des utilisateurs par agents IA.

---

## 2. Principales briques technologiques

### 2.1 Supabase – cœur COP

- Stockage des **embeddings et tables SQL**.
- Multi-tenant : chaque instance = une personne numérique.
- **Sécurité** : RLS, rôles, chiffrement des données sensibles.
- **Sauvegardes** : snapshots, exports SQL, historisation.

### 2.2 Obsidian – Vaults locaux

- Gestion des **notes et documentation**.
- Vaults thématiques par projet ou rôle.
- Versioning via Git ou plugins Obsidian.
- Intégration Zotero pour bibliographie.

### 2.3 Zotero – références bibliographiques

- Gestion des collections, métadonnées, PDFs.
- Une référence peut appartenir à **plusieurs collections**.
- Export BibTeX ou CSL JSON pour ingestion dans Obsidian/Supabase.
- Données sensibles stockées sur Solid si nécessaire.

### 2.4 Solid – backup et usage externe

- Hébergement **sécurisé et décentralisé** des Vaults et exports.
- Partage granulaire pour tiers ou agents IA.
- Résilience multi-site et chiffrement end-to-end.

---

## 3. Flux opérationnel

```mermaid
flowchart LR
    subgraph Notes/Docs
        OB[Obsidian Vaults] -->|Extraction/Ingestion| SB[Supabase Embeddings & SQL]
        ZT[Zotero References] -->|Export (BibTeX/JSON)| SB
    end

    subgraph Agents
        SB -->|Analyse & Action| COP[Agents COP & IA]
    end

    subgraph Backup/Secure
        OB -->|Backup| SOL[Solid Pods]
        ZT -->|Export Backup| SOL
        SB -->|Snapshot Backup| SOL
    end

    COP -->|Suggestions / Actions| OB
```

- Notes → Supabase : ingestion pour raisonnement par agents.
- Supabase → COP/Agents IA : recherche, synthèse, suivi de rôles.
- Vaults & exports → Solid : backup sécurisé et partage contrôlé.

---

## 4. Multi-tenancy et personnes numériques

- Chaque **instance COP** = une **personne numérique**.
- Liens entre instances via **rôles et relations** (membre, électeur, contributeur, usager,
  mandataire).
- Permet de gérer contributions, permissions et traçabilité de manière cohérente et sécurisée.

---

## 5. Guidage des outils de développement

Dépôt `inseme` comme **référence centralisée** pour :

- **Trae** : scripts multi-agent.
- **Windsurf** : visualisation des relations et flux.
- **VSCode** : édition des Vaults et scripts COP.
- **Google Antigravity** : supervision et export vers Solid.

---

## 6. Prochaines étapes

1. Compléter documentation SQL et embeddings Supabase.
2. Définir conventions de Vault Obsidian et collections Zotero par projet/role.
3. Automatiser exports et backups vers Solid (versioning & chiffrement).
4. Tester multi-tenancy complet avec agents COP et intégration Obsidian/Zotero/Solid.
5. Mettre en place workflow de mise à jour pour synchronisation avec tous les outils.

---

**Auteur** : Jean Hugues Robert, baron Mariani. email:jean_hugues_robert@yahoo.com **Date** :
2026-03-15
