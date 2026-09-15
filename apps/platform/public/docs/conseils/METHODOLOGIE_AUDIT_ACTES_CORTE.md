---
title: Méthodologie d’audit citoyen des actes municipaux de Corte
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

# Méthodologie d’audit citoyen des actes municipaux de Corte

## Statut du document

**Version :** 0.1  
**Date :** 2026-05-30  
**Périmètre :** documents officiels de la commune de Corte stockés dans `apps/platform/public/docs/conseils/` et, lorsque disponibles, PDF canoniques associés dans `apps/platform/public/docs/officiel/`.  
**Usage :** base méthodologique pour Ophélia, l’audit citoyen des conseils municipaux et les futures publications publiques.

Ce document n’est pas une analyse juridique définitive. Il fixe une méthode de travail prudente pour exploiter des documents officiels dont l’extraction OCR est encore imparfaite.

---

## 1. Objet

L’objectif est de rendre les actes municipaux de Corte plus :

- lisibles ;
- recherchables ;
- comparables ;
- vérifiables ;
- discutables publiquement ;
- traçables dans le temps.

Le corpus actuel contient notamment :

- des convocations et ordres du jour ;
- des listes de délibérations ;
- des délibérations extraites par OCR ;
- des procès-verbaux ;
- un rapport automatisé sur la publicité des actes.

L’enjeu n’est pas d’accuser, mais de documenter. La méthode doit rester neutre, factuelle, vérifiable et proportionnée à la qualité des sources.

---

## 2. Principe général

La méthode repose sur une distinction stricte entre :

```text
PDF officiel           = source documentaire primaire
Markdown OCR           = extraction textuelle imparfaite
Extraction structurée  = interprétation machine/humaine contrôlée
Audit citoyen          = synthèse publique prudente
```

Le Markdown OCR est utile pour chercher, indexer et comparer. Il ne doit pas être traité comme une transcription juridiquement parfaite.

Toute affirmation publique sensible doit pouvoir être rattachée :

1. au fichier Markdown utilisé ;
2. au PDF officiel correspondant, si disponible ;
3. au lien d’origine mairie, si disponible ;
4. à un niveau de confiance explicite.

---

## 3. Niveaux de preuve

### Niveau 0 — Trace brute

Élément présent dans un fichier, mais non encore interprété.

Exemples :

- nom de fichier ;
- lien de téléchargement ;
- date `Last-Modified` ;
- hash de fichier ;
- texte OCR brut.

Usage : indexation, archivage, traçabilité.

### Niveau 1 — Élément OCR lisible

Élément clairement lisible dans le Markdown OCR, mais non vérifié contre le PDF.

Exemples :

- date de séance ;
- titre apparent d’un point ;
- domaine général ;
- montant isolé ;
- nom d’une délibération.

Usage : recherche et pré-analyse. Publication possible avec prudence si l’enjeu est faible.

### Niveau 2 — Élément structuré cohérent

Élément extrait du Markdown et cohérent avec d’autres indices du même document.

Exemples :

- date de convocation cohérente avec l’ODJ ;
- numéro de délibération cohérent avec la séance ;
- montant répété dans plusieurs lignes ;
- vote compatible avec présents + procurations.

Usage : base de connaissance Ophélia, comparaison ODJ ↔ actes, tableaux de synthèse.

### Niveau 3 — Élément vérifié

Élément contrôlé contre le PDF officiel ou contre une source municipale directe.

Usage : publication publique forte, argumentation citoyenne, courrier institutionnel.

### Niveau 4 — Élément opposable à instruire

Élément ayant fait l’objet d’une vérification documentaire robuste et, si nécessaire, d’un contrôle juridique ou institutionnel.

Usage : signalement, recours, demande officielle, communication publique très structurée.

---

## 4. Typologie des documents

| Type | Fonction | Qualité OCR attendue | Usage prioritaire |
|---|---|---:|---|
| Convocation / ODJ | Annonce des points soumis au conseil | généralement bonne | liste des sujets annoncés |
| Liste des délibérations | Liste des actes votés | moyenne à bonne | contrôle de publication et inventaire |
| Délibération | Acte décisionnel détaillé | variable | décision, domaine, montant, vote |
| Procès-verbal | Trace de séance et arrêt du PV | variable | débats, présences, validation |
| Rapport consolidé | Synthèse automatisée | bonne | audit temporel et tableau de bord |

---

## 5. Extraction des ordres du jour

Les convocations et ODJ sont le meilleur point d’entrée, car ils sont généralement plus courts et mieux structurés.

Pour chaque ODJ, extraire :

```yaml
session_date: "YYYY-MM-DD"
convocation_date: "YYYY-MM-DD"
meeting_time: "HH:MM"
location: "..."
items:
  - order: 1
    section: "Finances Communales"
    suborder: "A"
    title: "Adoption du Compte Financier Unique 2024"
    domain: "finances"
    raw: "ligne source OCR"
    confidence: "medium|high"
```

Règles :

- conserver l’ordre d’apparition ;
- distinguer section principale et sous-points ;
- conserver le libellé brut ;
- produire un titre normalisé court ;
- ne pas corriger silencieusement un intitulé douteux ;
- marquer les lignes fusionnées par OCR.

---

## 6. Extraction des délibérations

Les délibérations sont plus difficiles à exploiter en raison :

- des tableaux financiers mal lus ;
- des signatures et tampons OCRisés ;
- des répétitions d’accusés de réception ;
- des ruptures de pages ;
- des montants parfois altérés ;
- des votes parfois incohérents.

Pour chaque bloc de délibération, extraire :

```yaml
act_id: "25-07/044"
session_date: "2025-07-01"
convocation_date: "2025-06-23"
domain: "finances"
title: "Délibération Modificative n°1 — Budget Général"
action: "adoption"
amounts:
  - raw: "812 000,00 €"
    normalized_eur: 812000
    meaning: "dépenses réelles supplémentaires en investissement"
    confidence: "medium"
vote:
  raw: "A l’unanimité des membres présents et représentés"
  normalized:
    for: null
    against: 0
    abstention: 0
  confidence: "medium"
warnings:
  - "vote_count_not_normalized"
source:
  markdown_path: "apps/platform/public/docs/conseils/..."
  pdf_path: "apps/platform/public/docs/officiel/..."
```

Règles :

- privilégier les marqueurs juridiques : `OBJET`, `LE CONSEIL`, `Après en avoir délibéré`, `ADOPTE`, `DECIDE`, `APPROUVE`, `AUTORISE` ;
- ne pas extraire automatiquement une ligne de vote numérique si elle contredit les présents + procurations ;
- traiter les montants comme `medium confidence` tant qu’ils ne sont pas vérifiés dans le PDF ;
- conserver le brut OCR pour permettre le retour à la source ;
- ne pas transformer une déduction en fait.

---

## 7. Comparaison ODJ ↔ actes

Chaque point de l’ODJ doit être rapproché, si possible, d’un acte voté.

Statuts proposés :

| Statut | Sens |
|---|---|
| `CORRESPONDANCE` | même sujet de fond, ordre et périmètre compatibles |
| `ORDRE_MODIFIE` | même sujet, mais ordre différent |
| `LIBELLE_DIVERGENT` | formulation différente, fond probablement identique |
| `PERIMETRE_MODIFIE` | l’acte élargit, réduit ou transforme sensiblement le point annoncé |
| `NON_RETROUVE` | aucun acte correspondant identifié |
| `ACTE_NON_ANNONCE` | acte identifié sans point clair à l’ODJ |
| `A_VERIFIER` | OCR ou source insuffisante pour conclure |

La comparaison doit rester neutre. Un écart documentaire n’est pas automatiquement une irrégularité. Il peut résulter :

- d’un libellé résumé ;
- d’un regroupement de points ;
- d’un éclatement en plusieurs actes ;
- d’un défaut OCR ;
- d’une annexe non extraite ;
- d’une réelle modification de périmètre.

---

## 8. Publicité des actes

Le rapport consolidé utilise la date `Last-Modified` des PDF pour estimer la publication web.

Cette méthode est utile, mais limitée.

Elle peut indiquer :

- une publication web tardive ;
- une republication ;
- un remplacement de fichier ;
- une mise en ligne postérieure à la séance.

Elle ne prouve pas à elle seule :

- l’absence d’affichage légal papier ;
- l’absence d’envoi aux élus ;
- l’absence d’information du public par un autre canal ;
- une irrégularité juridique complète.

Toute publication publique doit donc utiliser une formule prudente :

> Selon les traces web disponibles et la date `Last-Modified` des fichiers, la publication numérique apparaît tardive ou postérieure. Cette mesure ne préjuge pas d’autres formes de publicité légale qui resteraient à vérifier.

---

## 9. Règles de prudence éditoriale

### Dire

- « Les traces disponibles suggèrent... »
- « Le fichier web porte une date de modification... »
- « L’OCR indique... »
- « Le point semble correspondre à... »
- « À vérifier contre le PDF officiel... »
- « Niveau de confiance : faible / moyen / élevé. »

### Ne pas dire sans vérification forte

- « La mairie a illégalement... »
- « Le conseil a dissimulé... »
- « Les élus n’ont pas été informés... »
- « Le vote est nécessairement de X voix... »
- « Le montant exact est... » si la ligne vient d’un tableau OCR bruité.

---

## 10. Usage par Ophélia

Ophélia doit agir comme assistante civique neutre.

Elle peut :

- retrouver un document ;
- expliquer un ordre du jour ;
- rapprocher un ODJ d’une délibération ;
- signaler un écart documentaire ;
- résumer une délibération ;
- lister les montants extraits ;
- produire une note de transparence ;
- indiquer les niveaux de confiance.

Elle ne doit pas :

- inventer une source manquante ;
- transformer une hypothèse en accusation ;
- donner un conseil juridique personnalisé ;
- conclure à une illégalité sans qualification prudente ;
- masquer les limites OCR ;
- produire une certitude à partir d’un tableau illisible.

---

## 11. Schéma minimal recommandé

```yaml
document:
  id: "mairie-corte_deliberations_2025-07-01_downloads-1919"
  type: "deliberation"
  session_date: "2025-07-01"
  source_paths:
    markdown: "apps/platform/public/docs/conseils/..."
    pdf: "apps/platform/public/docs/officiel/..."
  source_url: "https://www.mairie-corte.fr/..."
  ocr_quality: "low|medium|high"
  extraction_status: "raw|structured|verified"

items:
  - id: "25-07/044"
    title: "Délibération Modificative n°1 — Budget Général"
    domain: "finances"
    action: "adoption"
    odj_match:
      status: "CORRESPONDANCE"
      odj_item: "1-A"
      confidence: "medium"
    decision:
      raw: "ADOPTE la proposition..."
      normalized: "adopted"
    vote:
      raw: "A l’unanimité..."
      normalized: null
      confidence: "medium"
    warnings:
      - "OCR tables require PDF verification"
```

---

## 12. Priorités d’amélioration

1. **Réassocier systématiquement Markdown OCR et PDF canonique.**
2. **Ajouter un champ `ocr_quality` par fichier.**
3. **Détecter automatiquement les incohérences de vote.**
4. **Extraire les ODJ en premier : ce sont les documents les plus fiables.**
5. **Comparer ODJ ↔ actes par séance.**
6. **Produire une table publique des écarts avec niveaux de confiance.**
7. **Améliorer l’OCR des PDF problématiques.**
8. **Mettre en place une revue humaine légère pour les cas sensibles.**
9. **Conserver les formulations prudentes dans toute publication externe.**
10. **Préparer une version structurée JSON/CSV par séance.**

---

## 13. Formule de référence

> Les documents municipaux officiels sont la source primaire.  
> L’OCR est un outil d’accès.  
> L’extraction structurée est une hypothèse contrôlée.  
> L’audit citoyen est une synthèse prudente, traçable et révisable.

---

## 14. Continuation

Prochaines étapes recommandées :

1. créer un inventaire JSON des fichiers `mairie-corte_*` ;
2. attribuer un niveau de qualité OCR à chaque fichier ;
3. générer une extraction structurée des ODJ ;
4. générer une extraction structurée des délibérations ;
5. produire une première table ODJ ↔ actes pour les séances du 18 mars 2025 et du 1er juillet 2025 ;
6. publier une note publique courte expliquant la démarche sans accusation ;
7. améliorer progressivement l’OCR et revalider les extractions.
