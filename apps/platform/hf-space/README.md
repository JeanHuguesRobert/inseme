---
title: Ophélia – CivicTech RAG Chatbot (Hugging Face Space)
author: unknown
date: '2025-12-24'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 1cdac1c
  origin_date: '2025-12-24'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
status: working-paper
---


# Ophélia – CivicTech RAG Chatbot (Hugging Face Space)

Bienvenue sur le Space Hugging Face d’Ophélia, l’assistante citoyenne open source du "petit parti"
de Corte, le Pertitellu, dédiée à la vie municipale à Corte en général et aux élections municipales
en particulier. En toute transparence et à la gloire de la Corse !

---

## Qu’est-ce qu’Ophélia ?

Ophélia est un chatbot conversationnel basé sur le RAG (Retrieval-Augmented Generation), conçu pour
:

- Répondre aux questions sur la vie municipale, la démocratie locale, la transparence, et la Corse
- Valoriser la connaissance locale (wiki, documents publics, Q&A)
- Offrir un accès simple, ouvert et sécurisé à l’information citoyenne
- Être réutilisable et interopérable (API REST, npm, widget, MCP, Space…)
- Prochainement facilement déployable pour d'autres commune, entière open source

Ce Space est une vitrine interactive : posez vos questions, testez la pertinence, et découvrez la
puissance du RAG appliqué au service de l'intérêt général.

---

## Fonctionnement

- L’interface Gradio (Python) relaie vos questions à l’API REST centrale d’Ophélia (hébergée sur
  LePP.fr)
- Aucune logique métier n’est embarquée dans le Space : tout le traitement est fait côté serveur
- Les réponses sont générées à partir de sources locales (wiki, docs, Q&A) et de modèles LLM

---

## Exemples de questions

- « Quelle est la capitale de la Corse ? »
- « Comment assister au prochain conseil municipal ? »
- « Quels sont les critères de transparence d’une mairie ? »

---

## Pour aller plus loin

- [Documentation API REST](../docs/API-OPHELIA.md)
- [Plan technique complet](../docs/plan-ophelia.md)
- [Widget web embeddable](https://LePP.fr/public/widget/demo-widget-ophelia.html)
- [Dépôt GitHub](https://github.com/JeanHuguesRobert/survey)

---

## Contribuer / Remixer

- Ce Space est open source (MIT)
- Vous pouvez le forker, l’adapter à votre commune, ou contribuer à l’amélioration d’Ophélia
- Pour toute question, suggestion ou bug, ouvrez une issue sur GitHub ou contactez l’équipe LePP.fr

---

## Limitations & sécurité

- Ce Space est une démo publique : ne pas soumettre de données personnelles
- Les réponses sont générées automatiquement et peuvent comporter des erreurs
- L’API centrale applique une clé de démo et des quotas de sécurité

---

## Publier Ophélia sur Hugging Face Space : pas à pas

1. **Créer un compte Hugging Face**
   - Rendez-vous sur https://huggingface.co/ et inscrivez-vous (gratuit).

2. **Installer le CLI Hugging Face**
   - Dans un terminal :
     ```
     pip install huggingface_hub
     ```

3. **Se connecter au CLI**
   - Exécutez :
     ```
     huggingface-cli login
     ```
   - Suivez le lien pour obtenir un token sur le site.

4. **Préparer le dossier Space**
   - Placez le contenu de `hf-space/` (au minimum `app.py` et `README.md`) dans un dossier dédié.

5. **Créer un nouveau Space**
   - Allez sur https://huggingface.co/spaces
   - Cliquez sur “Create new Space”
   - Choisissez “Gradio” comme SDK
   - Donnez un nom (ex : `pertitellu/ophelia-space`)
   - Initialisez le Space (vous pouvez le cloner en local)

6. **Pousser le code**
   - Dans le dossier du Space cloné :
     ```
     git add .
     git commit -m "Initial commit Ophélia"
     git push
     ```

7. **Le Space se build automatiquement**
   - L’interface Gradio sera visible publiquement.
   - Vous pouvez ajouter des assets, modifier le README, etc.

8. **Partager l’URL**
   - (ex : https://huggingface.co/spaces/pertitellu/ophelia-space)

**Astuces** :

- Pour mettre à jour, modifiez localement puis `git push`.
- Pour les secrets/API keys, utilisez l’onglet “Settings > Secrets” du Space.
- Pour un Space privé, choisissez l’option lors de la création.

---

Merci d’utiliser Ophélia pour une démocratie plus transparente et accessible !
