---
title: Ophélia – Stratégie Marketing
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

# Ophélia – Stratégie Marketing

**Modèle : commun numérique open source (bénévolat technique, dons pour l’infrastructure)**

---

## 0. Positionnement fondamental

**Offre** : Ophélia **Tagline** : « La transparence pour toutes les communautés. »

**Nature** :

- Commun numérique civique
- 100 % open source
- 100 % non lucratif

**Principe intangible** :

> Aucun don ne rémunère un humain.  
> Les dons financent exclusivement l’infrastructure technique et les services indispensables  
> (hébergement, IA, OCR, SIG, stockage, noms de domaine, monitoring).

**Développement** :

- Code écrit par des développeurs bénévoles
- Communauté distribuée, contributive, documentée

---

## 1. Vision élargie : la couche universelle de transparence

Ophélia n’est pas seulement une solution de transparence municipale.  
C’est un **moteur universel de lisibilité des décisions collectives**, applicable à toute communauté
dotée :

- de mandats,
- de votes,
- de budgets,
- de décisions documentées.

La commune n’est qu’un cas particulier ; le modèle est général.

### 1.1 Marché adressable total (TAM)

Ophélia n’est pas un “produit” commercial, mais il s’inscrit sur un espace où des outils payants
existent déjà.

| Segment                          | Volume France | Priorité | Maturité technique     |
| -------------------------------- | ------------- | -------- | ---------------------- |
| **Communes**                     | 36 000        | ⭐⭐⭐   | Pilote → standard      |
| **Copropriétés**                 | 740 000       | ⭐⭐⭐   | Besoin massif          |
| **Associations loi 1901**        | 1 500 000     | ⭐⭐⭐   | Forte réplicabilité    |
| **CSE / Comités sociaux**        | 45 000        | ⭐⭐     | Cycle de décision long |
| **Intercommunalités (EPCI)**     | 1 250         | ⭐⭐     | Extension naturelle    |
| **Établissements scolaires**     | 60 000        | ⭐       | Long terme             |
| **SCOP / SCIC**                  | 3 500         | ⭐⭐     | Early adopters         |
| **Communautés numériques / DAO** | ∞             | ⭐       | Expérimental           |

**TAM France : > 2 millions d’organisations.**  
Ophélia ne cherche pas à capturer ce “marché”, mais à **installer un commun numérique réutilisable
partout**.

---

## 2. Modules locaux : clef stratégique

### 2.1 Constat : l’illisibilité est locale

En théorie, pour les institutions publiques, les décisions sont publiques.  
En pratique :

- formats de délibérations hétérogènes,
- PDF scannés ou natifs,
- métadonnées absentes ou incohérentes,
- méthodes de publication différentes d’une commune à l’autre,
- archives mal indexées.

> La transparence doit être locale parce que l’opacité l’est aussi.

### 2.2 Nécessité d’un module par territoire

Pour chaque commune (ou entité) réelle, il faut un **module local** :

- connecteur vers les sources (site, flux, archives PDF),
- pipeline de récupération et de nettoyage,
- OCR adapté pour les scans municipaux,
- normalisation minimale des métadonnées,
- segmentation (ordre du jour, délibérations, annexes),
- association au référentiel géographique (SIG/Géoportail),
- indexation pour le moteur IA (RAG).

Ces modules sont :

- **indispensables** (sans eux, pas de transparence réelle),
- **petits mais nombreux**,
- **localement pertinents, nationalement mutualisés**.

Chaque module local enrichit le commun national.

---

## 3. Modèle économique du commun Ophélia

### 3.1 Règle centrale

> Tout le travail humain est bénévole.  
> Tout l’argent sert à payer ce qui ne peut pas être bénévole : l’infrastructure.

**Jamais** de rémunération pour :

- développeurs,
- “bénévoles déguisés”,
- “équipe interne” associative,
- frais de structure hors technique.

### 3.2 Ce que financent les dons

Les dons ne financent que :

- hébergement (Supabase, Netlify, infrastructure équivalente),
- stockage (bases, blobs, sauvegardes, CDN),
- IA (embeddings, génération, modèles, appels API),
- OCR avancé (PDF scannés, municipalités peu équipées),
- quotas d’API géographiques (IGN, Géoportail, etc.),
- monitoring, logs, sécurité, certificats, DNS,
- coûts techniques strictement nécessaires.

> Chaque euro donné est converti en capacité technique brute, pas en rente humaine.

### 3.3 Avantages de ce modèle

- incorruptibilité structurelle,
- coût marginal très faible,
- image cohérente avec la logique de “commun”,
- compatibilité forte avec la qualification d’**intérêt général**,
- impossibilité pour les acteurs commerciaux d’imiter ce modèle sans se saborder.

---

## 4. Niches prometteuses – Analyse par type de communauté

### 4.1 Communes (36 000) – Cas fondateur

**Douleur majeure** :

- Illisibilité des délibérations,
- budgets incompréhensibles,
- opacité de l’action municipale réelle,
- absence de mémoire structurée du mandat.

**Ophélia pertinent pour** :

- lire et résumer les délibérations,
- reconstituer la chronologie du mandat,
- cartographier les projets et décisions (PLU, travaux, incidents),
- fournir un bilan objectivé du mandat en fin de cycle,
- permettre un dialogue citoyen avec l’IA.

**Stratégie** :

- Pilote Corte (municipales 2026),
- fédération Corte → interco → Corse → communes comparables,
- démonstrateur national.

---

### 4.2 Copropriétés (740 000)

**Douleur** :

- AG hystériques, conflits chroniques,
- opacité des comptes,
- manque d’accès aux PV,
- syndic perçu comme boîte noire.

**Ophélia pertinent pour** :

- ingestion et accès aux PV d’AG,
- historisation des décisions (travaux, appels de fonds),
- IA pour répondre : “Que s’est-il voté sur la façade ?”,
- comparaisons temporelles (promis vs fait),
- traçabilité des dépenses.

**Stratégie** :

1. Cibler syndics bénévoles et petites copropriétés,
2. Partenariats avec structures type ARC/UNARC,
3. Outillage minimal, réplicable, simple.

Potentiel : ⭐⭐⭐ (volume colossale, douleur réelle, concurrence gratuite inexistante).

---

### 4.3 Associations loi 1901 (1,5 million)

**Douleur** :

- gouvernance floue,
- adhérents déconnectés des décisions,
- budgets peu lisibles,
- AG formelles, peu investies.

**Sous-segments prioritaires** :

- associations sportives,
- culturelles,
- sociales,
- ONG locales.

**Ophélia pertinent pour** :

- comptes et bilans expliqués en langage clair,
- archivage des délibérations d’AG,
- suivi des résolutions,
- transparence des subventions publiques,
- consultation des membres.

**Stratégie** :

- cibler associations de taille moyenne (100–1000 membres),
- articulation avec HelloAsso (collecte + transparence),
- modules locaux ultra-légers.

Potentiel : ⭐⭐⭐ (énorme, mais très fragmenté).

---

### 4.4 Universités & Grandes Écoles – Cas pilote : Université de Corse

**Douleur** :

- gouvernance complexe (CA, CFVU, CS),
- étudiants désengagés,
- décisions incomprises,
- budgets opaques.

**Cas pilote** : Università di Corsica Pasquale Paoli (Corte)

- ~5 000 étudiants, 500 personnels,
- communauté compacte, identitaire,
- environnement idéal pour un démonstrateur.

**Ophélia pertinent pour** :

| Public                 | Besoin                    | Fonctionnalité Ophélia           |
| ---------------------- | ------------------------- | -------------------------------- |
| Étudiants              | Comprendre les décisions  | Chat IA sur les délibérations    |
| Élus étudiants         | Rendre compte             | Publication simplifiée des votes |
| BDE / Assos étudiantes | Transparence des budgets  | Comptes lisibles                 |
| Syndicats étudiants    | Suivi des décisions       | Alertes, résumés                 |
| Enseignants / BIATSS   | Vision structurée du CA   | Tableau de bord des actes        |
| Présidence             | Communication stratégique | Score de transparence interne    |

**Stratégie d’entrée** :

1. Contacter la présidence,
2. coopérer avec les élus étudiants,
3. intégrer la vie associative,
4. démarrer sur les délibérations du CA,
5. étendre ensuite.

Potentiel : ⭐⭐⭐ (vitrine nationale, impact symbolique fort).

---

### 4.5 SCOP / SCIC (3 500)

Alignement naturel :

- 1 personne = 1 voix,
- transparence structurelle théoriquement centrale,
- manque d’outillage numérique adéquat.

**Ophélia pertinent pour** :

- historiser les décisions collectives,
- rendre accessibles les orientations stratégiques,
- faire exister réellement la démocratie interne.

Potentiel : limité en volume, élevé en valeur symbolique.

---

### 4.6 Communautés en ligne / DAO

Terrain d’expérimentation :

- gouvernance de serveurs Discord,
- projets open source,
- DAOs,
- communautés de créateurs.

**Ophélia pertinent pour** :

- historiser les décisions de modération,
- expliciter les choix de roadmap,
- fournir une “mémoire politique” de la communauté.

Potentiel : expérimental, mais cohérent avec la vision long terme.

---

## 5. Analyse concurrentielle

### 5.1 CivicTech participative

| Solution         | Modèle                  | Prix      | Points forts                            | Limites par rapport à Ophélia                         |
| ---------------- | ----------------------- | --------- | --------------------------------------- | ----------------------------------------------------- |
| Decidim          | Open Source (Barcelone) | Gratuit   | Référence mondiale, budget participatif | Pas d’IA intégrée, stack lourde, peu orienté actes    |
| CONSUL Democracy | Open Source (Madrid)    | Gratuit   | 250+ villes, outils participatifs       | Principalement consultation, pas observatoire d’actes |
| Cap Collectif    | SaaS propriétaire       | 5–15K€/an | 400 clients, suite complète             | Payant, source fermée, dépendance fournisseur         |
| Make.org         | Plateforme propriétaire | Sur devis | Consultations massives                  | Pas local, pas orienté suivi fin et actes municipaux  |

### 5.2 Data / Open Data

| Solution     | Modèle          | Prix estimé | Points forts                        | Limites pour les communes                         |
| ------------ | --------------- | ----------- | ----------------------------------- | ------------------------------------------------- |
| Huwise / ODS | SaaS Enterprise | 15–100K€/an | data marketplace, clients nationaux | Hors de portée des petites communes               |
| data.gouv.fr | Plateforme État | Gratuit     | référentiel national                | Peu adapté à la granularité municipale, technique |

### 5.3 Position relative d’Ophélia

- **Gratuit** pour les collectivités,
- **open source**,
- **IA intégrée**,
- **SIG intégré**,
- **modules locaux**,
- pensés pour des entités **sans DSI**, sans budget numérique.

Les concurrents ne peuvent pas imiter ce modèle sans renoncer à leur structure salariale ou à leur
modèle d’affaires.

---

## 6. Proposition de valeur et différenciateurs

### 6.1 Proposition de valeur

```text
"Ophélia transforme l’opacité locale en compréhension collective.

Une IA qui lit, relie et explique les décisions qui nous concernent.

Gratuit. Open Source. Bénévole. Pour toutes les communautés."
```

### 6.2 Différenciateurs clés (par rapport aux solutions classiques)

| Critère                  | Cap Collectif  | Decidim      | Ophélia                       |
| ------------------------ | -------------- | ------------ | ----------------------------- |
| Prix pour la commune     | 5–15K€/an      | Intégration  | **0 €**                       |
| IA intégrée              | ❌             | ❌           | **✅ Oui**                    |
| Cadastre / SIG           | ❌             | ❌           | **✅ Oui (Géoportail, etc.)** |
| Focus “actes municipaux” | Partiel        | Non          | **✅ Central**                |
| Stack technique          | PHP            | Ruby         | **React + Supabase**          |
| Cible prioritaire        | Grandes villes | Métropoles   | **Communes < 50 000 hab.**    |
| Dépendance fournisseur   | Forte          | Intégrateurs | **Faible (open source)**      |

---

## 7. Segments de marché opérationnels

### 7.1 Cible primaire : petites et moyennes communes (< 50 000 hab.)

Profil :

- budget numérique quasi nul,
- peu ou pas de DSI,
- un(e) secrétaire de mairie surchargé(e),
- élus de bonne volonté mais sans moyens techniques.

Douleurs :

- “On veut être transparents, mais on n’a ni outils ni temps”,
- “On se fait reprocher l’opacité sans pouvoir y remédier”,
- “Les solutions du marché sont hors de portée”.

Bénéfices Ophélia :

- gratuit, donc aucune ligne budgétaire à voter,
- mise en place progressive,
- IA qui répond aux citoyens 24/7 en s’appuyant sur les actes de la commune,
- amélioration de l’image publique sans charlatanisme.

---

### 7.2 Cible secondaire : candidats aux municipales 2026

Profil :

- listes citoyennes, listes de renouvellement,
- volonté affichée de transparence,
- besoin de différenciation claire.

Douleurs :

- difficulté à prouver la sincérité de l’engagement,
- ressources limitées,
- retard par rapport aux sortants sur l’accès à l’information.

Bénéfices Ophélia :

- possibilité de **s’engager** sur une charte de transparence crédible,
- outil prêt pour documenter le mandat dès le premier jour,
- capacité à mettre en scène un discours : “Nous accepterons d’être surveillés par une IA
  citoyenne.”

---

### 7.3 Cible tertiaire : associations locales, collectifs de contrôle, EPCI

Profil :

- collectifs de citoyens vigilants,
- associations locales de défense de l’intérêt général,
- intercommunalités souhaitant harmoniser la transparence sur plusieurs communes.

Ophélia devient :

- un outil de structuration de leur veille,
- une plateforme partagée de mémoire,
- une base technique pour leurs propres actions.

---

## 8. Stratégie d’acquisition

### 8.1 Principe

> Ophélia ne se “vend” pas. Ophélia se diffuse par conviction civique et démonstration de valeur.

### 8.2 Canaux prioritaires

| Canal                     | Rôle                                 | Investissement |
| ------------------------- | ------------------------------------ | -------------- |
| GitHub / communauté dev   | Recruter des contributeurs bénévoles | Temps          |
| Facebook / réseaux locaux | Mobiliser citoyens et relais         | Temps          |
| LinkedIn élus / DGS       | Visibilité institutionnelle          | Temps          |
| Partenariats associatifs  | Légitimité démocratique              | Relationnel    |
| Presse locale             | Créer l’événement (Corte, Corse)     | RP ciblées     |

### 8.3 Canaux secondaires

- salons (AMF, ESS) si l’opportunité se présente,
- podcasts / médias civiques,
- conférences universitaires.

### 8.4 Canaux à éviter

- Google Ads,
- influenceurs payants,
- télémarketing agressif.

---

## 9. Identité de marque et tonalité

### 9.1 Palette de couleurs (indicative)

```css
:root {
  --ophelia-primary: #6366f1; /* Indigo – sérieux technique */
  --ophelia-secondary: #10b981; /* Vert – confiance, stabilité */
  --ophelia-accent: #f59e0b; /* Ambre – lisibilité, attention */
  --ophelia-dark: #111827; /* Gris très sombre – gravité */
  --ophelia-light: #f9fafb; /* Gris très clair – clarté */
}
```

### 9.2 Tonalité

- sobre, claire, structurée,
- non militante, mais intransigeante sur la transparence,
- pas de langage start-up,
- pas de promesses creuses.

### 9.3 Personnalité d’Ophélia (IA)

```text
Ophélia est :

– neutre : ne prend pas parti, expose les faits,
– précise : cite ses sources et ses limites,
– patiente : reformule si besoin,
– locale : comprend le contexte de la commune,
– transparente : explicite ce qu’elle sait et ce qu’elle ignore.
```

---

## 10. Partenariats stratégiques

### 10.1 Partenaires civiques

| Partenaire potentiel | Intérêt                    | Voie d’approche               |
| -------------------- | -------------------------- | ----------------------------- |
| Anticor              | Légitimité anti-corruption | webinaire, dossier de fond    |
| AMF                  | Accès aux maires           | stand, article, démonstration |
| CNIL                 | Cadrage RGPD               | échange technique, note       |
| Etalab / data.gouv   | Interopérabilité open data | discussions techniques        |

### 10.2 Partenaires techniques

| Partenaire potentiel | Apport principal            |
| -------------------- | --------------------------- |
| Supabase             | Hébergement / BDD           |
| Fournisseurs IA      | Modèles / API à coût réduit |
| IGN / Géoportail     | Données cartographiques     |

### 10.3 Partenaires “modules locaux”

- écoles d’ingénieurs,
- fablabs,
- associations de développeurs,
- groupes open source locaux.

---

## 11. Plan de lancement – Municipales 2026 (Corte comme pilote)

### Décembre 2025

- stabiliser MVP Ophélia pour Corte :
  - ingestion actes municipaux,
  - premiers résumés,
  - embryon de bilan 2020–2025,
  - interface simple pour questionner.

- rédiger et publier la campagne HelloAsso,

- mettre en ligne Ophelia.com (landing minimale).

### Janvier 2026

- communication publique :
  - annonce sur les réseaux,
  - premiers articles ou posts pédagogiques,
  - démonstration ciblée pour quelques acteurs locaux.

- enrichir le corpus d’actes,

- affiner les réponses IA sur Corte,

- recruter des bénévoles dev / data.

### Février 2026

- produire des “dossiers thématiques” sur Corte :
  - urbanisme,
  - finances,
  - vie associative,
  - sécurité / voirie, etc.

- commencer à analyser les programmes des listes si disponibles,

- activer fortement la campagne HelloAsso.

### Mars 2026

- municipales :
  - usage public d’Ophélia sur Corte,
  - réponses aux questions des citoyens,
  - démonstration vivante de ce qu’une IA citoyenne peut apporter.

- après le scrutin :
  - capitaliser le retour d’expérience,
  - début de réplication vers d’autres communes.

---

## 12. Documents à produire

- One-pager Ophélia (PDF synthétique),
- présentation 8–10 slides pour élus / associations,
- FAQ développeurs bénévoles,
- FAQ citoyens,
- modèle de page HelloAsso,
- page d’accueil Ophelia.com,
- charte du commun Ophélia (pour GitHub).

---

## Conclusion stratégique

Ophélia n’est pas une start-up. Ophélia n’est pas un “service” vendu aux collectivités.

Ophélia est :

- un **commun numérique**,
- un **moteur IA**,
- un **système de modules locaux**,
- un **outil de lisibilité politique**,
- un **patrimoine logiciel ouvert** qui doit survivre à ses initiateurs.

La municipalité de Corte, en 2026, sera le premier terrain de démonstration complet. Si l’expérience
réussit, le modèle sera reproductible dans n’importe quelle commune de France, par n’importe quel
groupe de citoyens organisés, avec un minimum de ressources techniques.

Le reste est une question de volonté collective.

---

_Document créé le 6 décembre 2025_ _Association C.O.R.S.I.C.A._ _Contact :
jean_hugues_robert@yahoo.com_
