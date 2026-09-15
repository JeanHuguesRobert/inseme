---
title: Rapport d'audit éthique - Consultation citoyenne {{MOVEMENT_NAME}}
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

# Rapport d'audit éthique - Consultation citoyenne {{MOVEMENT_NAME}}

_Généré automatiquement le 24/10/2025_

## Synthèse

La consultation citoyenne {{MOVEMENT_NAME}} respecte globalement les standards éthiques des enquêtes
d'opinion publique, avec quelques points d'attention.

## Finalités de la consultation

Cette consultation poursuit trois objectifs qu'il convient d'expliciter par souci de transparence :

1. **Objectif politique**
   - Alimenter le programme électoral de la liste {{MOVEMENT_NAME}} pour les élections municipales
   - Identifier les sujets prioritaires pour les habitants
   - Évaluer l'adhésion aux propositions de démocratie participative

2. **Objectif démocratique**
   - Expérimenter des outils de consultation citoyenne
   - Mesurer l'intérêt des habitants pour les référendums locaux
   - Collecter des suggestions d'amélioration de la vie démocratique locale

3. **Objectif d'étude**
   - Établir un diagnostic partagé de la situation de {{CITY_NAME}}
   - Comprendre les attentes des différents quartiers
   - Documenter le niveau de satisfaction avec la gouvernance actuelle

La consultation n'a pas vocation à :

- Se substituer à un sondage représentatif
- Constituer une base de données électorale
- Remplacer les dispositifs officiels de concertation

## Points forts

1. **Transparence**
   - Mention explicite du caractère politique (initiative électorale)
   - Page méthodologie accessible
   - Code source public
   - Résultats consultables en temps réel

2. **Protection des données**
   - Collecte minimale d'informations personnelles
   - Section profil clairement identifiée comme optionnelle
   - Email collecté uniquement sur consentement explicite
   - Pas de géolocalisation ni de tracking

3. **Neutralité des questions**
   - Formulation équilibrée des options
   - Inclusion systématique d'options neutres sur toutes les questions sensibles
   - Option "Je préfère ne pas répondre" disponible pour les sujets controversés
   - Échelles symétriques (1-5) avec possibilité de s'abstenir
   - Commentaires libres optionnels

## Points d'attention

1. **Représentativité**
   - Absence de quotas ou de redressement statistique
   - Biais potentiel lié à la diffusion numérique
   - Risque de sur-représentation des militants

2. **Influence**
   - Questions sur la "démocratie locale" et le "déclin" pourraient orienter le débat
   - Ordre fixe des questions peut influencer les réponses

3. **Validation**
   - Pas de mesure anti-spam
   - Risque de réponses multiples
   - Absence de vérification de résidence à {{CITY_NAME}}

## Recommandations

1. **Court terme**
   - Ajouter une rotation aléatoire de l'ordre des questions
   - Implémenter un captcha basique
   - Ajouter un cookie de session pour limiter les réponses multiples

2. **Moyen terme**
   - Développer une version papier pour les personnes non connectées
   - Prévoir une analyse par quartier pour vérifier la représentativité
   - Mettre en place un comité de suivi indépendant

3. **Communication**
   - Clarifier la méthode de traitement des commentaires libres
   - Expliciter l'utilisation future des résultats
   - Préciser la durée de conservation des données

## Hébergement et Déploiement

- **Infrastructure** : Application hébergée sur Netlify
- **Disponibilité** : Service accessible 24/7 avec monitoring automatique
- **Sécurité** :
  - Certificat SSL/TLS automatiquement géré
  - Protection DDoS incluse
  - Pas de base de données exposée
- **Mise à jour** :
  - Déploiement continu depuis GitHub
  - Prévisualisation des modifications avant mise en production
  - Historique des versions conservé
- **Durabilité** :
  - Export régulier des données sur GitHub
  - Conservation des anciennes versions
  - Documentation publique du processus

## Conclusion

Le dispositif est conforme aux standards éthiques minimaux pour une consultation citoyenne locale.
Les points d'attention identifiés ne remettent pas en cause la validité de la démarche mais
appellent à une interprétation prudente des résultats.

## À propos de ce rapport

Ce rapport d'audit éthique a été généré automatiquement lors du déploiement de l'application. Il
fait partie intégrante de notre démarche de transparence.

**Auteur :** Initiative {{MOVEMENT_NAME}}  
**Date de génération :** 24/10/2025  
**Version de l'application :** 1.0.4  
**Standards appliqués :** ESOMAR/WAPOR pour les sondages d'opinion publique  
**Source :** Le code source de ce rapport est disponible sur
[GitHub](https://github.com/jeanhuguesrobert/survey/blob/main/docs/audit-ethique.md)

---

_Document public - Reproduction et partage encouragés avec mention de la source_
