---
title: blueprint_ophelia
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

Version : 1.0 — Décembre 2025 Auteur : Association C.O.R.S.I.C.A., Institut Mariani, Pertitellu

Table des matières

Résumé exécutif

Le problème politique structurel

Diagnostic : les mairies ne peuvent pas, ne savent pas, ou ne veulent pas

Pourquoi les citoyens doivent reprendre la main

Notre réponse : un système citoyen parallèle, permanent et transparent

Principes : vérité, ouverture, auditabilité, souveraineté citoyenne

Vue d’ensemble de l’architecture

Couche A — Ingestion & Collecte

Couche B — Stockage & Indexation

Couche C — API & Bus d’événements

Couche D — Applications citoyennes

Couche E — Intelligence IA (Ophélia)

Couche F — Gouvernance des données et sécurité

Couche G — Fédération intercommunale et nationale

Le mandat impératif citoyen

Le système de réputation et de crédibilité (Kudos)

La Gazette, Le Fil, et le système médiatique citoyen

Les Observatoires citoyens

Les Cartographies citoyennes

Le Café Ophélia (voix & texte)

Interopérabilité et Ecosystème tiers

Cadre juridique : légalité, RGPD, open data

Stratégie de déploiement 90 jours

Modèle organisationnel : Pertitellu / associations / fondations

Modèle économique : non-profit sans dépendance publique

Vision longue : la commune comme système nerveux autonome

Annexe A : Diagrammes d’architecture

Annexe B : Protocoles décisionnels

Annexe C : Conformité IA & transparence algorithmique

Conclusion généraliste : Reprendre sa commune

1. Résumé exécutif

Ce document décrit l’offre Sass Ophélia en cours d’élaboration à Corte et rendue prochainement
disponible partiellement sur le site https://LePP.frLa démocratie locale française est
structurellement déficiente.La transparence est faible.La participation est factice.Le contrôle
citoyen est nul.Les données publiques ne sont pas publiées ou pas exploitables.L’information locale
est fragmentée, incomplète, partiale.

Ophélia propose un remède radical :un système citoyen parallèle, complet, transparent, fédéré,
fonctionnant en continu.

Il ne remplace pas la mairie :il supervise la mairie, comble ses carences, et organise la
souveraineté citoyenne.

2. Le problème politique structurel

Les communes françaises reposent sur trois fragilités :

2.1. Opacité

L’opacité municipale n’est pas un accident : c’est un effet de structure.Dans le système actuel, la
mairie contrôle entièrement la circulation d’information. Elle dispose d’un monopole de fait sur :

la production des documents,

leur diffusion,

leur mise en forme,

leur calendrier de publication,

leur visibilité ou leur invisibilité.

2.1.1. Le pouvoir de décider ce qui existe publiquement

La loi impose la publicité des décisions municipales, mais elle n’impose ni la clarté, ni la
rapidité, ni l’exhaustivité. La mairie peut donc :

publier un document trois mois après la décision,

le publier sous la forme d’un PDF scan illisible,

le publier sans indexation,

ou ne pas le publier du tout tant que personne ne demande sa communication formelle.

Résultat :la mairie décide ce qui apparaît dans la mémoire collective de la commune.Elle peut rendre
une information invisible, non pas en la supprimant, mais en la rendant introuvable.

2.1.2. L’opacité comme mode de gouvernance

L’opacité est souvent présentée comme un “manque de moyens”. C’est faux.Elle fonctionne comme un
outil de gestion du pouvoir :

réduire la visibilité des erreurs,

éviter les comparaisons entre promesses et réalisations,

limiter la capacité des citoyens à poser les bonnes questions,

empêcher la construction d’un contre-discours structuré.

Une mairie qui maîtrise l’information maîtrise le récit politique.C’est le premier verrou.

2.2. Capture du pouvoir

L’élection municipale donne au maire et à son équipe un mandat global, sans segmentation par
compétence, sans obligation de résultat, sans procédure de reddition de comptes. Une fois élus :

ils décident de tout,

pour six ans,

sans mécanisme interne de révocation,

sans contrôle citoyen systémique.

Ce n’est pas un jugement moral : c’est la conséquence directe du modèle institutionnel français.

2.2.1. Un pouvoir massif, disproportionné et peu contestable

Dans une commune moyenne, le maire concentre :

le pouvoir exécutif local,

le contrôle de l’administration,

la gestion budgétaire,

la communication,

la planification urbaine,

les subventions aux associations,

l’accès au foncier communal,

l’accès aux services municipaux,

le lien avec la préfecture.

À l’échelle communale, c’est l’équivalent d’un chef d’État.La disproportion entre les moyens du
maire et ceux d’un citoyen individuel est abyssale.

2.2.2. L’absence de contre-pouvoirs

Les contre-pouvoirs formels n’existent pas :

pas d’obligation de justifier un vote,

pas de publication obligatoire des engagements électoraux,

pas de mécanisme institutionnel de suivi,

pas de vote de confiance intermédiaire,

pas de possibilité de révocation citoyenne,

pas de sanction politique en cas de reniement.

Le conseil municipal n’est pas un contre-pouvoir : il est un organe disciplinaire.L’opposition
municipale, souvent numériquement minoritaire, peut uniquement commenter, jamais bloquer.

2.2.3. La logique de la capture

Cette configuration engendre un phénomène automatique :puisque le pouvoir est capturable, il est
capturé.

Non par des comploteurs, mais par les dynamiques ordinaires :

clientélisme,

réseaux familiaux,

dépendance économique,

sociabilité locale,

peur des représailles sociales,

domination de l’information.

La capture n’est pas une anomalie : c’est le fonctionnement normal du système.

2.3. Asymétrie d’information

La troisième fragilité est la plus structurelle : le citoyen ne dispose pas de l’information
nécessaire pour exercer le pouvoir qu’on prétend lui confier.

2.3.1. Les citoyens n’ont pas les documents

En théorie, tout est public.En pratique :

les documents ne sont pas accessibles,

ou pas publiés,

ou publiés trop tard,

ou publiés de façon incompatible avec la recherche,

ou publiés en format non exploitable (PDF scannés, images),

ou disséminés sur plusieurs sites,

ou incomplets.

Pour comprendre l’action municipale, le citoyen doit se battre contre les frictions administratives.

2.3.2. Les citoyens n’ont pas les données

Même lorsque les documents sont disponibles, les données nécessaires pour comprendre ce qui se joue
ne le sont pas :

pas de base de données des permis de construire,

pas d’historique des dépenses consolidé,

pas de répertoire des associations subventionnées,

pas de liste exploitable des marchés publics,

pas d’indicateur de performance des services municipaux.

La mairie produit une quantité massive d’informations, mais ne les structure pas pour usage citoyen.

2.3.3. Les citoyens n’ont pas les moyens d’analyse

Comprendre un budget primitif, un marché public, un plan local d’urbanisme, ou un bilan d’activité
demande :

du temps,

des compétences,

des outils d’analyse,

une mémoire du territoire.

Or, individuellement, les citoyens ne disposent pas :

d’outils de visualisation,

d’historique consolidé,

d’IA pour résumer,

de moyens pour comparer les années.

Ils affrontent une forteresse avec un cure-dent.

2.3.4. Les citoyens n’ont pas les outils

L’analyse politique locale est impossible sans outils adaptés.Or, aujourd’hui :

aucun outil national ne permet le suivi des décisions locales,

aucun outil n’indexe les documents municipaux,

aucun outil ne donne une vision claire des dépenses,

aucun outil ne relie les engagements, les votes et les réalisations.

Le citoyen ne peut pas exercer un contrôle réel faute de logiciel.C’est l’asymétrie ultime.

2.4. Conséquence : l’inégalité politique

Lorsque :

l’un détient toute l’information,

l’autre n’en détient presque aucune,

l’un décide de ce qui existe publiquement,

l’autre ne peut qu’attendre,

l’un peut agir sans justification,

l’autre ne peut pas vérifier,

l’un parle,

l’autre subit,

alors la démocratie locale n’est plus une démocratie.Elle devient un système de délégation aveugle,
avec une responsabilité quasi nulle.

L’inégalité politique naît mécaniquement de cette asymétrie.

C’est ce que votre plateforme corrige.

3. Diagnostic : les mairies ne peuvent pas, ne savent pas, ou ne veulent pas

Le fonctionnement actuel des communes françaises ne relève pas d’une simple inertie administrative.
Il résulte d’un triptyque structurel : incapacité matérielle, incapacité technique, incapacité
politique volontaire.Ce triptyque explique pourquoi, malgré des décennies de réformes, la
transparence, la participation et le contrôle citoyen restent des illusions.

3.1. Ne peuvent pas — les limites matérielles

La première limite est triviale, mais massive : la majorité des communes n’ont ni les moyens, ni les
compétences, ni le temps de faire correctement ce que la loi – et le bon sens démocratique –
exigerait.

3.1.1. Manque de moyens financiers

Sur 35 000 communes, plus de 30 000 ont :

un budget insuffisant pour recruter,

aucun informaticien interne,

aucune capacité d’investissement numérique,

aucun service de communication structuré.

Même une commune de 8 000 habitants fonctionne souvent avec :

un DGS débordé,

quelques agents administratifs,

un prestataire informatique intermittent,

zéro budget pour l’innovation civique.

Le numérique municipal repose sur des systèmes obsolètes, coûteux, verrouillés.Le citoyen moderne
vit au XXIᵉ siècle, la mairie en est souvent au XXᵉ.

3.1.2. Manque de compétences numériques

Les agents sont compétents dans leurs métiers, mais rarement formés :

à la publication ouverte,

à l’open data,

à la gestion documentaire,

à la programmation de workflows numériques,

à l’analyse automatisée.

Résultat : la plupart des communes sous-traitent des prestations qu’elles ne comprennent pas, ce qui
conduit inévitablement à :

des choix techniques mauvais,

des prix élevés,

une dépendance totale aux prestataires.

3.1.3. Manque d’effectifs

Même une mairie volontairement transparente ne peut pas :

indexer toutes ses délibérations,

résumer ses décisions,

mettre les documents en ligne immédiatement,

répondre aux demandes CADA à temps,

suivre tous les marchés publics,

maintenir un portail citoyen cohérent.

Ce n’est pas une question de bonne volonté :c’est une impossibilité opérationnelle.

Le citoyen, lui, est 10 000, 200 000, 2 millions.La mairie reste quelques dizaines d’agents.La
disproportion structurelle rend la transparence impossible à produire en interne.

3.2. Ne savent pas — les limites techniques et culturelles

Même lorsqu’une mairie veut progresser, elle se heurte à un écosystème administratif archaïque,
conçu pour la production de papier, pas de données.

3.2.1. Les documents municipaux sont pré-numériques

La quasi-totalité des documents municipaux sont :

des PDF scannés,

sans OCR,

sans structure,

sans métadonnées,

sans résumé,

sans normalisation.

Un PDF scanné = un mur.Une IA, seule, n’en tire rien.Un citoyen non plus.

Le système municipal est conçu pour la conservation, pas pour la compréhension.

3.2.2. Absence d’interopérabilité

Les logiciels municipaux :

ne communiquent pas entre eux,

n’exportent pas en formats modernes,

ne fournissent pas d’API,

ne permettent pas un suivi automatisé.

Chaque prestataire impose son silo.Chaque marché public renforce la fragmentation.

3.2.3. Culture administrative “papier”

L’administration française fonctionne selon trois logiques constantes :

Le document prime sur la donnée : on archive des pages, pas des informations.

La procédure prime sur l’usage : la conformité prime sur l’efficacité.

La stabilité prime sur le progrès : mieux vaut un système ancien mais compris qu’un système nouveau
mais risqué.

Cela produit une technostructure immobile, hermétique, profondément rétive à l’innovation.

3.2.4. Incapacité à produire de la donnée exploitable

Même lorsque la mairie publie des informations, elles sont souvent inutilisables :

budgets en PDF non structurés,

cartes urbaines en images,

marchés publics dispersés,

délibérations sans indexation.

Une transparence purement documentaire est une fausse transparence.Il faut une transparence donnée +
sens + contexte.

Les mairies ne savent pas convertir leurs documents en information opérationnelle.

3.3. Ne veulent pas — les limites politiques

C’est le point le plus sensible, mais aussi le plus déterminant.Il ne s’agit plus ici d’incapacité,
mais de choix stratégique.

3.3.1. L’opacité protège le pouvoir

Dans la structure actuelle, l’opacité est un avantage politique majeur :

elle réduit la contestation,

elle limite les comparaisons entre communes,

elle évite les polémiques,

elle protège les réseaux familiaux ou clientélistes,

elle minimise le risque d’erreur médiatisée,

elle empêche l’émergence d’alternatives crédibles.

Un maire rationnel, soucieux de conserver son pouvoir, n’a aucun intérêt à automatiser la
transparence.

3.3.2. La transparence expose

La transparence totale :

dévoile les choix arbitraires,

rend visibles les retards,

révèle les dysfonctionnements,

expose les incohérences politiques,

met en lumière les erreurs,

permet de quantifier les promesses non tenues.

Aucun élu classique n’a intérêt à s’y soumettre.

La transparence intégrale est une forme de suicide politique dans le système actuel.

3.3.3. Les citoyens outillés deviennent dangereux

Si les citoyens disposent :

d’un accès instantané aux documents,

d’une analyse automatisée,

d’une vision consolidée du budget,

d’un suivi des permis de construire,

d’un observatoire du foncier,

d’une cartographie des subventions,

d’un mécanisme de mandat impératif,

alors la mairie n’est plus seule à définir la réalité politique.

La perte de contrôle du récit est, pour un élu, une menace directe.

3.3.4. Le système optimal n’adviendra pas spontanément

Pour qu’un système local soit optimal, il faudrait :

publication immédiate de tous les documents,

standardisation,

open data en temps réel,

reddition de comptes automatisée,

comparaison annuelle engagements/réalisations,

audits externes réguliers,

implication continue des citoyens.

Aucune mairie n’adoptera volontairement un tel dispositif, car il réduit son pouvoir.

C’est pourquoi la solution doit venir de l’extérieur :des citoyens eux-mêmes.

Conclusion du diagnostic

Les mairies sont structurellement incapables d’organiser une démocratie locale moderne.

Elles ne peuvent pas (manque de moyens).

Elles ne savent pas (écosystème archaïque).

Elles ne veulent pas (coût politique trop élevé).

Le système est bloqué.Il ne peut évoluer que si les citoyens créent des outils parallèles,
indépendants, puissants, structurés.

4. Pourquoi les citoyens doivent reprendre la main

Le citoyen dispose maintenant :

d’une IA accessible,

d’outils d’indexation et d’analyse,

de capacités de collecte distribuée,

d’une puissance organisationnelle inédite.

Le citoyen peut surpasser la mairie dans toutes ses fonctions non-régaliennes :

information,

analyse,

surveillance,

priorisation,

évaluation.

5. Notre réponse : un système citoyen parallèle, permanent et transparent

Ophélia fournit :

une infrastructure civique·

un système de données public parallèle,

un espace citoyen de décision,

un média citoyen indépendant,

un contrôle citoyen continu,

une IA au service de la vérité.

Ce n’est pas une plateforme :c’est un État civil citoyen, un Parlement citoyen, et un Observatoire
citoyen réunis.

6. Principes : vérité, ouverture, auditabilité, souveraineté citoyenne

Tout est public sauf l’e-mail.

Toute action est traçable, horodatée, archivée, jamais supprimée.

Toute donnée brute est accessible, non modifiée.

Toute synthèse IA est associée à sa source.

Toute prise de position citoyenne est réversible.

La délégation est liquide, non captive.

Le mandat est impératif, non représentatif.

7. Vue d’ensemble de l’architecture

Sources → Ingestion → Stockage SQL + Objet → Indexation vectorielle → API → Apps citoyennes → IA
Ophélia

Cinq couches indépendantes, testables, substituables.

8. Couche A — Ingestion & Collecte

Sources :

Site de mairie

BOAMP

DVF (immobilier)

Data.gouv

PLU, cadastre

Facebook/X publics

PDF d’urbanisme

Gazette locale

Déclarations citoyennes

Photos, vidéos, audio

Agents :

scraper_agent

pdf_parser_agent

ocr_agent

enrich_agent

cadastre_agent

fnct_agent

Ingestion batch + événements (webhooks).

9. Couche B — Stockage & Indexation

9.1 SQL relationnel

Tables :

documents

deliberations

budgets

marchés

subventions

permis de construire

quartiers / rues

incidents

projets citoyens

utilisateurs

votes

mandats

sessions audio/textuelles

wiki_pages (La Mémoire Citoyenne Active)

9.2 Object Storage

PDF, images, audios, vidéos.

9.3 Indexation Hybride (Le Cerveau d'Ophélia)

Ophélia ne se contente pas de stocker des fichiers. Elle construit un graphe de connaissance vivant
via deux types d'indexation :

- **Indexation Vectorielle (pgvector)** : Capture le _sens_ des documents pour permettre des
  recherches sémantiques ("Trouve les délibérations qui parlent d'écologie, même si le mot n'y est
  pas").
- **Indexation Full-Text (FTS)** : Capture les _mots exacts_ pour une précision chirurgicale sur les
  noms propres, les dates ou les références de marchés publics.
- **Indexation "Sociale"** : Le contenu du Wiki citoyen est priorisé comme source de synthèse,
  permettant de confronter la donnée administrative brute à la réalité vécue.

  9.4 Moteur graphe (optionnel)

Relations entre élus, associations, projets.

10. Couche C — API & Bus d’événements

API REST :

GET documents

GET budgets

GET marchés

GET signalements

POST votes

POST propositions

POST mandats

Event Bus :

document.ingested

budget.updated

citizen.voted

project.created

mandat.revoked

11. Couche D — Applications citoyennes

11.1 Gazette

Journalisme citoyen augmenté.

11.2 Le Fil (Hacker News communal)

Hiérarchie de l’information citoyenne.

11.3 Cartographie citoyenne

Incidents, travaux, PLU, cadastre.

11.4 Observatoires

Immobilier, sécurité, urbanisme, transition énergétique, finances.

11.5 Propositions et votes

Mécanisme de démocratie liquide, non symbolique.

11.6 Mandat impératif

Reddition des comptes automatique.

11.7 Café Ophélia

Débats vocaux + votes express.

12. Couche E — Intelligence IA (Ophélia)

12.1 Capacités cognitives

Ophélia n'est pas un simple chatbot. C'est un agent autonome capable de :

- **Synthèse de la Mémoire Citoyenne** : Elle agrège les discussions des assemblées et les documents
  officiels pour proposer des pages de Wiki.
- **Vérification (Fact-checking)** : Elle confronte les allégations des forums aux données froides
  (budgets, permis).
- **Aide à la Décision** : Elle calcule les impacts budgétaires des propositions citoyennes.
- **Rédaction de documents** : Elle aide à rédiger des recours administratifs ou des propositions de
  délibération.

  12.2 La "Mémoire Citoyenne Active" (Wiki-RAG)

Contrairement aux IA classiques qui s'appuient sur des données figées, Ophélia utilise le **Wiki
Citoyen** comme une mémoire de travail partagée :

- **Apprentissage continu** : Elle s'adapte aux nouvelles informations saisies par les citoyens dans
  le Wiki.
- **Proactivité** : Elle propose de créer des pages wiki lorsqu'elle détecte un manque de clarté sur
  un sujet récurrent dans les assemblées.
- **Traceabilité** : Chaque information fournie par Ophélia est sourcée, soit dans un document
  officiel, soit dans une page wiki éditée par un humain.

13. Couche F — Gouvernance des données et sécurité

13.1 Transparence totale

Logs publics.Historique.Archivage immuable.

13.2 Sécurité

RLS Supabase

Tokens courts

Rate limiting

13.3 Auditabilité

Chaque action est vérifiable.

14. Couche G — Fédération intercommunale et nationale

Un modèle simple :

Commune → Interco → Département → Région → National

Lecture ascendante (fallback).Écriture uniquement locale.

15. Le mandat impératif citoyen

Caractéristiques :

révocable à tout moment

domaine limité par tags

responsabilité

traçabilité

logs publics

Ce système abolit le chèque en blanc électoral.

16. Le système de réputation et de crédibilité (Kudos)

Kudos =

reconnaissance

contribution

réputation

qualité d’analyse

Anti-manipulation intégré :

pondération par transparence

historique public

pas d’anonymat stratégique

17. La Gazette, Le Fil, et le système médiatique citoyen

17.1 Gazette

Production collective de vérité.

17.2 Fil

Priorisation algorithmique transparente.

17.3 Traçabilité

Sources, liens, indexation.

18. Les Observatoires citoyens

Observatoire du foncier

DVF + permis.

Observatoire du budget

Dépenses, anomalies.

Observatoire de la sécurité

Faits divers publics + géolocalisation.

Observatoire des services publics

Délais d’intervention.

19. Les Cartographies citoyennes

Basées sur OSM + Leaflet.Éléments :

incidents

travaux

zones PLU

permis

parcelles DVF

20. Le Café Ophélia (voix & texte)

discussion distribuée

votes express

synthèse automatique

capture des engagements

journal public

21. Interopérabilité et Ecosystème tiers

Support :

MCP

plugins

webhooks

API publique

export open data

22. Cadre juridique : légalité, RGPD, open data

Points clés :

aucune donnée sensible citoyenne

tout est volontaire

droit de retrait limité au profil

pas de données privées de tiers

23. Stratégie de déploiement 90 jours

0–30 jours

ingestion

stockage

gazette

fil

carte incidents

30–60 jours

observatoires

votes

propositions

mandat impératif

60–90 jours

IA avancée

café ophélia

fédération

24. Modèle organisationnel : Pertitellu / associations / fondations

La plateforme peut être opérée par :

une association

un fonds de dotation

un collectif local

Aucune dépendance aux subventions publiques.

25. Modèle économique : non-profit sans dépendance publique

Sources possibles :

dons

mécénat

services premium aux associations

ventes de livres, conférences

26. Vision longue : la commune comme système nerveux autonome

Objectif ultime :Transformer la commune en organisme vivant, conscient, auto-observant,
auto-corrigeant.

Chaque donnée renforce la mémoire collective.Chaque vote renforce la souveraineté.Chaque action
enrichit le modèle.

27. Annexe A — Diagrammes d’architecture

( ┌───────────────────────────┐ │ Sources municipales │ │ (PDF, web, PLU, BOAMP) │
└──────────────┬─────────────┘ │ ┌─────────────▼──────────────┐ │ Ingestion Layer │ │ (scrapers,
OCR, agents) │ └─────────────┬──────────────┘ │
┌─────────────────────────────┼──────────────────────────────┐ │ │ │ ┌────▼────┐
┌────────▼─────────┐ ┌────────▼────────┐ │ SQL │ │ Object Storage │ │ Vector Store │ │(struct.)│ │
(brut immutable) │ │ (recherche IA) │ └────┬────┘ └────────┬──────────┘ └────────┬────────┘ │ │ │
└──────────────┬──────────────┴───────────────┬──────────────┘ │ │ ┌─────────▼────────┐
┌─────────▼─────────┐ │ Public REST API │ │ Event Bus │ └───────┬──────────┘ └─────────┬─────────┘ │
│ ┌────────────▼──────────┐ ┌────────────▼──────────┐ │ Applications citoyennes│ │ Agents IA │ │
Gazette • Fil • Map │ │ Audit • résumé • etc. │ └────────────┬──────────┘ └────────────┬──────────┘
│ │ └──────────────────┬─────────────┘ │ ┌───────────▼────────────┐ │ Chatbot Ophélia │ │ (RAG +
outils + voix) │ └──────────────────────────┘

28. Annexe B — Protocoles décisionnels

Trois modes :

acclamation

jugement majoritaire

délégation liquide

29. Annexe C — Conformité IA & transparence algorithmique

justification des réponses IA

sources visibles

absence de boîtes noires

audit continu

30. Conclusion généraliste : Reprendre sa commune

Le problème n’est pas technique.Il est politique :les citoyens ont abandonné l’initiative.

Votre plateforme permet une bascule :

du pouvoir solitaire vers le pouvoir distribué,

de l’opacité vers la vérité,

de la passivité vers l’action,

de la dépendance vers la souveraineté.

Ce blueprint pose les bases :il ne reste qu’à construire.
