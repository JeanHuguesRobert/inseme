---
title: Auxilia — brique d'hospitalité numérique (data & power)
project: inseme
component: auxilia
upstream: FractaVolta
version: 0.6-draft
status: spécification de travail
license: CC BY-SA 4.0 (texte) — AGPL-3.0 (code, à confirmer)
maintainer: jhr@baronsmariani.org
last_modified_at: '2026-05-19'
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
date: '2026-09-15'
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Auxilia

> **FractaVolta Auxilia** — brique d'_hospitalité numérique_ pour téléphones portables. Auxilia
> permet à une personne disposant d'une ressource critique (connexion, batterie, point de recharge)
> d'en partager temporairement une fraction avec une personne proche qui en manque. Première mise en
> œuvre : la Corse, comme service offert aux visiteurs et mobilisable par les habitants. Intégrée
> comme composant opérationnel du projet `inseme`.

---

## 0. À propos de ce document

Cette spécification décrit le périmètre, les principes, la sécurité, la vie privée, l’architecture
et la feuille de route d’Auxilia. Elle est destinée à être commitée dans le dépôt `inseme` dès
qu’elle aura été stabilisée. Elle ne décrit pas une implémentation existante : elle décrit l’objet à
construire, et les choix structurants que cet objet impose.

Le document est volontairement plus normatif que descriptif : il fixe des règles avant de fixer du
code.

---

## 1. Objet

Auxilia est un service d'**hospitalité numérique** : il permet à une personne qui dispose d'une
ressource critique (connexion mobile, batterie, powerbank, câble, point de recharge) d'en partager
temporairement une fraction avec une personne proche qui en manque.

Le bénéficiaire-type est un visiteur — touriste, étudiant en mobilité, voyageur d'affaires — qui
arrive en territoire inconnu, son téléphone à plat ou sans connexion. Le donneur-type est un
habitant en confiance sur son territoire, dont la ressource est mobilisable. Auxilia inscrit cette
rencontre dans la tradition d'hospitalité méditerranéenne, et la traite comme un service offert
avant d'être un dispositif de secours.

Mais Auxilia est tout aussi utile aux habitants entre eux : un étudiant à court de batterie avant un
examen, une personne âgée dont le forfait est consommé, un livreur dont le téléphone s'éteint. Le
mécanisme est le même ; seul le contexte change.

L'objectif initial reste volontairement modeste :

- dépanner un téléphone qui manque de batterie ;
- dépanner un téléphone qui manque de connexion ;
- organiser la rencontre entre donneur et bénéficiaire ;
- tracer l'acte sans surveiller la vie privée ;
- rendre visible une capacité collective d'accueil.

Auxilia n'est pas un VPN anonyme, ni une place de marché, ni une infrastructure commerciale. C'est
un commun technique minimal : une manière de rendre visibles, mobilisables et traçables des
micro-capacités d'hospitalité.

À l'échelle conceptuelle, Auxilia est l'instanciation humaine du principe _store-and-forward_ qui
fonde les Energy Packet Networks : un piéton qui traverse une place avec une powerbank chargée est
un paquet d'énergie en transit ; un téléphone qui partage temporairement son hotspot est un nœud
relais de données. Là où FractaVolta industrialise ce principe sur des conteneurs et des
micro-grilles, Auxilia le rend accessible à l'échelle de la rue — et l'aligne sur une pratique
culturelle pré-existante.

---

## 2. Principes fondateurs

### 2.1 Devise

> **Transparence des actes. Pudeur des personnes. Confidentialité des contenus.**

Cette devise n’est pas un slogan : elle est la règle d’arbitrage. Tout choix technique, juridique ou
ergonomique doit pouvoir être justifié comme la mise en œuvre concrète d’une de ces trois exigences.

### 2.2 Asymétrie volontaire

Le donneur d’une ressource critique accepte une exposition plus forte que le bénéficiaire.

Cette asymétrie est délibérée. Celui qui dispose encore d’une capacité (batterie, connexion,
matériel) est en position de force ; celui qui en manque est en situation de vulnérabilité.
L’équilibre se rétablit en exigeant du premier qu’il se présente visuellement au moment du don
(prénom et photo de profil), tout en laissant au second la possibilité de demander de l’aide sous un
pseudonyme.

Au niveau technique, les deux parties sont identifiées de la même manière (numéro de téléphone
vérifié ou adresse email vérifiée, voir §7). L’asymétrie ne porte donc pas sur la _vérification_
mais sur l’_exposition publique_ : le donneur est visible, le bénéficiaire peut rester pseudonyme.

Règle :

> **Pas de don critique sans donneur visible. Pas de bénéficiaire forcé de se justifier.**

### 2.3 Possibilisme

Auxilia ne garantit rien. Elle rend des choses possibles. La présence d’une offre n’est pas un droit
pour le demandeur ; l’existence d’une demande n’est pas une obligation pour le donneur. Le système
rend visible ce qui est mobilisable, et rien de plus.

Cette posture est cohérente avec le cadre intellectuel d’`inseme` : agir sans exiger, proposer sans
contraindre, mesurer ce qui est fait sans en faire une dette.

### 2.4 Subsidiarité fractale

Auxilia s’organise par niveaux : un point, une place, un quartier, une commune, une micro-région,
une région. Chaque niveau gère ses propres détails et expose au niveau supérieur des agrégats
statistiques anonymisés. Aucun niveau supérieur ne détient les données nominatives des niveaux
inférieurs.

Cette règle protège la vie privée par construction : la donnée nominative ne quitte pas le hub où
elle est née.

### 2.5 Réversibilité

Toute session, toute offre, toute demande, tout compte peut être interrompu, retiré, supprimé.
Auxilia n’accumule pas. Auxilia ne piège pas. Les actes restent tracés (sous forme agrégée) après
suppression du compte ; les liens vers la personne disparaissent.

---

## 3. Périmètre

### 3.1 Ce qu’Auxilia fait

Auxilia permet de :

- publier une offre de dépannage data ;
- publier une offre de dépannage power ;
- chercher une aide proche ;
- utiliser un hub local pour apparier offre et demande ;
- proposer un lieu de rencontre public ;
- afficher l’identité vérifiée du donneur au moment du don ;
- créer une session de dépannage courte ;
- clôturer la session ;
- signaler un incident ;
- publier des statistiques agrégées du commun.

### 3.2 Ce qu’Auxilia ne fait pas

Auxilia ne cherche pas, dans son MVP, à :

- fournir un anonymat fort ;
- router tout le trafic via un réseau mesh complet ;
- transformer les téléphones personnels en nœuds de sortie Internet généraux ;
- vendre de la data ou de l’électricité ;
- créer une monnaie convertible ;
- collecter des avis, des notes ou des évaluations des donneurs ou des bénéficiaires ;
- fidéliser, récompenser ou pénaliser les participants au-delà du strict nécessaire (suspension pour
  incident grave) ;
- suivre les déplacements des membres ;
- inspecter le contenu des communications ;
- se substituer aux services d’urgence (15, 17, 18, 112).

Le système n’organise pas l’irresponsabilité. Il organise l’hospitalité.

---

## 4. Ressources concernées

### 4.1 Data

Le donneur data dispose encore d’une connexion mobile ou Wi-Fi utilisable. Il peut proposer une
session courte de partage de connexion.

**Phase 0 (cas minimal et sûr) :**

- hotspot Wi-Fi manuel activé par le donneur ;
- SSID conventionnel possible (par exemple `AUXILIA-SECOURS-XXXX` où `XXXX` est un suffixe de
  session) ;
- mot de passe transmis hors-bande (QR code en présence physique) ;
- durée par défaut courte (15 minutes, prolongeable une fois) ;
- volume déclaré ou estimé ;
- acte tracé.

**Phases ultérieures :**

- proxy local applicatif ;
- URL PAC distribuée par QR code ;
- quotas techniques imposés par le donneur ;
- tunnel chiffré entre les deux téléphones ;
- nœuds avancés réservés aux opérateurs de hub et appareils dédiés.

### 4.2 Power

Le donneur power dispose d’une ressource énergétique mobilisable :

- powerbank ;
- câble USB-C (de préférence certifié et data-blocked, voir §8) ;
- charge inversée téléphone-à-téléphone (encadrée, voir ci-dessous) ;
- point de recharge fixe ;
- micro-nœud solaire ;
- routeur ou hub équipé d’une batterie.

**Règles recommandées :**

- pas de don si la batterie du donneur est sous un seuil (par défaut : 30 %) ;
- durée courte par défaut (15 minutes) ;
- arrêt volontaire possible à tout moment, par l’une ou l’autre des parties, sans justification ;
- pas de recharge rapide non maîtrisée (limiter à USB-PD modéré) ;
- powerbank préférée au transfert direct entre téléphones ;
- câble fourni par le donneur ou par le hub, jamais par un tiers inconnu ;
- incident signalable immédiatement.

### 4.3 Modalités physiques

Auxilia distingue trois modalités de transfert physique :

| Modalité              | Description                                                          | Risque relatif                            |
| --------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Point fixe            | Borne, prise murale, station hub                                     | Faible                                    |
| Powerbank tampon      | La powerbank du donneur passe au bénéficiaire le temps d’une session | Faible à modéré (perte de l’objet)        |
| Câble direct          | Donneur et bénéficiaire connectés par câble USB                      | Modéré (compatibilité, attaque par câble) |
| Téléphone à téléphone | Charge inversée                                                      | Modéré à élevé (selon matériel)           |

Le MVP doit privilégier les deux premières modalités. La charge inversée téléphone-à-téléphone reste
possible mais nécessite une confirmation explicite des deux parties.

---

## 5. Hubs locaux

### 5.1 Définition

Un hub local est une zone, un point ou une institution de coordination : place, café, mairie,
campus, marché, fontaine, refuge, stand, quartier, commune.

Un hub a un nom, un niveau, un parent (sauf au plus haut), une zone approximative, un statut (actif,
inactif, dégradé), et éventuellement un référent humain.

Un hub n’est pas une boutique. C’est un point de rendez-vous.

### 5.2 Structure fractale

Les hubs sont organisés par emboîtement :

```text
Méditerranée
└── Corse
    └── Centre Corse
        └── Corte
            └── Place Paoli
                ├── Donneur data (offre A)
                ├── Donneur power (offre B)
                ├── Powerbank n°7 (asset)
                └── Point fixe Auxilia (asset)
```

Chaque niveau gère ses détails et expose vers le haut des statistiques agrégées. La donnée
nominative ne remonte jamais au-dessus du hub où elle est née.

### 5.3 Niveaux d’agrégation

- **Point** : un endroit précis (un banc, une borne, un café).
- **Zone** : un ensemble cohérent (place, campus, marché).
- **Quartier / village** : agrégat de zones.
- **Commune** : niveau administratif minimal.
- **Micro-région** : pertinence géographique (Centre Corse, Cap Corse).
- **Région** : Corse, ou autre région adoptante.
- **Réseau** : ensemble des régions ayant adopté Auxilia.

Les niveaux administratifs ne sont pas obligatoires : un hub peut sauter des niveaux si la
géographie l’exige (un village isolé peut être directement rattaché à la région).

---

## 6. Cycle de vie d’un dépannage

### 6.1 Étapes

```text
1. Le donneur publie une offre (statut: open).
2. Un demandeur publie une demande, ou consulte les offres.
3. Le hub propose un match.
4. Le demandeur sollicite le match (statut: pending).
5. Le donneur accepte (statut: matched).
   → l’identité du donneur devient visible pour le bénéficiaire.
6. Les deux se rendent au lieu public convenu.
7. Confirmation physique (QR croisé, code court).
8. Session active (statut: active).
9. Clôture par l’une ou l’autre partie (statut: closed).
10. Compte rendu agrégé visible dans les stats du hub.
```

### 6.2 États de session

```text
draft → open → pending → matched → confirmed → active → closed
                                                        ↘ incident
                                                        ↘ aborted
```

- **draft** : l’offre est en cours de création.
- **open** : visible dans le hub.
- **pending** : un demandeur a sollicité un match, en attente d’acceptation.
- **matched** : acceptation mutuelle, identité du donneur révélée.
- **confirmed** : présence physique vérifiée (QR scan croisé).
- **active** : transfert en cours.
- **closed** : transfert terminé normalement.
- **aborted** : interruption volontaire avant ou pendant.
- **incident** : signalement à examiner.

### 6.3 Révélation progressive d’identité

L’identité du donneur se révèle par paliers, alignés sur les états de session. L’identité ici est
entendue comme _exposition publique_ (prénom et photo de profil), non comme vérification
administrative.

| État            | Ce que voit le demandeur                  | Ce que voit le donneur                                             |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| open            | Pseudonyme du donneur, zone approximative | —                                                                  |
| pending         | Idem                                      | Pseudonyme du demandeur, zone                                      |
| matched         | **Prénom et photo de profil du donneur**  | Pseudonyme du demandeur (sauf si demandeur a choisi de se révéler) |
| confirmed       | Idem + présence vérifiée par QR croisé    | Idem                                                               |
| active / closed | Idem                                      | Idem                                                               |

Le demandeur peut volontairement révéler son prénom et sa photo au passage `matched`. Il n’y est
jamais contraint.

Le numéro de téléphone et l’adresse email ne sont **jamais** révélés à l’autre partie, dans aucun
état de session. La communication entre les deux parties passe exclusivement par l’application
(messagerie courte et liée à la session).

---

## 7. Identification et niveaux

### 7.1 Niveaux de participation

```text
Niveau 0 — compte créé, OTP vérifié, sans profil public
Niveau 1 — profil public (prénom + photo) — peut être donneur
Niveau 2 — donneur de power (engagement plus fort, voir §7.3)
Niveau 3 — opérateur de hub
Niveau 4 — mainteneur technique
```

Le passage de N0 à N1 est gratuit, instantané et réversible : il suffit de renseigner un prénom et
une photo.

Le passage à N3 (opérateur de hub) suppose une identification physique par l’équipe d’`inseme` et un
accord formel sur la charte des hubs (à rédiger séparément).

### 7.2 Méthode d’identification

> **Priorité Phase 0 : viralité maximale.** L’inscription doit prendre moins de 30 secondes. Aucune
> vérification administrative n’est requise pour utiliser Auxilia comme bénéficiaire ou comme
> donneur ordinaire.

**Mécanisme par défaut :**

1. L’utilisateur saisit son numéro de téléphone (format international, indicatif inclus).
2. Il reçoit un code OTP par SMS.
3. Il saisit le code dans l’application.
4. Le compte est créé en niveau 0.
5. Pour devenir donneur, il complète prénom + photo et passe en niveau 1.

**Alternative :**

L’écran d’inscription propose un lien discret « _Plutôt par e-mail_ » qui bascule sur un OTP envoyé
par e-mail. Utile pour :

- les utilisateurs qui ne veulent pas exposer leur numéro de téléphone ;
- les touristes étrangers dont le SMS coûte cher en roaming ;
- les zones où la couverture data est meilleure que la couverture SMS.

**Règles :**

- Un compte est rattaché à un identifiant unique : un numéro **ou** un email. Le second identifiant
  peut être ajouté plus tard comme moyen de récupération.
- Le numéro et l’email ne sont jamais exposés à un autre utilisateur, sous aucun état de session
  (voir §6.3).
- En cas de changement de numéro ou d’email, l’utilisateur effectue une mise à jour via OTP sur le
  nouveau canal et confirme sur l’ancien si possible.
- Pas de mot de passe en Phase 0. La possession du canal vérifié _est_ l’authentification.

**Considérations opérationnelles :**

- Le coût des SMS OTP est à anticiper. Sur la base de 200 utilisateurs en Phase 0 avec une moyenne
  de 3 SMS par compte la première année, l’ordre de grandeur reste sous 30 €/an. En Phase 1, l’usage
  massif rendra le choix du fournisseur SMS structurant (voir §18).
- Le SMS OTP a des vulnérabilités connues (SIM swap, interception SS7). En Phase 0, le risque est
  jugé acceptable au regard de la sensibilité limitée des comptes. En Phase 2, des mécanismes
  complémentaires (codes de récupération, second canal) pourront être introduits.

### 7.3 Donneurs de power

Le don de power engage plus que le don de data (objet physique, risque matériel pour les deux
parties, valeur monétaire d’une powerbank, possibilité de perte). Pour devenir donneur de power,
l’utilisateur :

- doit être au moins en niveau 1 (prénom + photo) ;
- doit déclarer avoir lu et accepté les recommandations de sécurité matérielle (§4.2) ;
- accepte que ses sessions power soient incluses dans les statistiques publiques du hub avec un
  niveau de visibilité légèrement supérieur (le hub voit le compte de sessions par donneur, sans
  exposer publiquement).

Aucune vérification administrative n’est imposée. La friction reste minimale.

### 7.4 Asymétrie donneur / bénéficiaire

Voir §2.2. Elle se traduit techniquement par :

- le donneur est en niveau 1 minimum, donc avec prénom et photo visibles ;
- le bénéficiaire peut rester en niveau 0 (pseudonyme seul) ;
- au passage `matched`, le prénom et la photo du donneur sont révélés au bénéficiaire ;
- le bénéficiaire n’est jamais contraint de révéler son prénom ou sa photo.

---

## 8. Sécurité et modèle de menace

### 8.1 Menaces identifiées

| Menace                                  | Vecteur                                                             | Sévérité          |
| --------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| SSID malveillant homonyme               | Un attaquant ouvre un Wi-Fi `AUXILIA-SECOURS-XXXX`                  | Élevée            |
| Câble USB malveillant                   | Câble fourni par un tiers injecte des commandes                     | Élevée            |
| Phishing de hub                         | Faux hub se déclarant sur la plateforme                             | Modérée           |
| Pistage par offres répétées             | Un acteur cartographie les présences en croisant les offres         | Modérée           |
| Ingénierie sociale                      | Faux récit d’urgence pour soutirer un don                           | Modérée           |
| Vol de powerbank                        | Le bénéficiaire ne rend pas l’objet                                 | Faible (matériel) |
| Dommage matériel                        | Surtension, court-circuit                                           | Faible à modérée  |
| Demande étatique sur les logs           | Subpoena, réquisition                                               | Modérée           |
| Doxxing du donneur                      | Le donneur identifié devient cible                                  | Modérée           |
| Détournement à des fins de surveillance | Un acteur étatique ou commercial utilise Auxilia pour cartographier | Modérée           |

### 8.2 Mitigations techniques

- **SSID + token de session** : le SSID seul ne suffit jamais ; il faut un token de session valide,
  échangé hors-bande par QR.
- **Empreinte du hub** : chaque hub présente une empreinte cryptographique vérifiable. Un hub non
  vérifié est marqué comme tel dans l’UI.
- **Recommandation câble** : le hub fournit ou recommande un câble _data-blocker_ (USB charge-only).
  À défaut, le bénéficiaire est averti.
- **Offres éphémères** : les offres expirent par défaut en 30 minutes. Pas d’offres permanentes en
  Phase 0.
- **Tokens à usage unique** : chaque QR code de session est consommé une fois.
- **Rate limiting** : nombre maximal d’offres par compte et par jour, nombre maximal de matchs par
  jour.
- **Pas de géolocalisation continue** : seule la zone du hub est enregistrée, jamais la position GPS
  du téléphone.

### 8.3 Mitigations sociales

- **Lieu public obligatoire** : le système refuse les rendez-vous en lieu privé non labellisé.
- **Référent de hub** : chaque hub désigne un référent humain joignable.
- **Charte des participants** (voir §15) à accepter à l’inscription.
- **Bouton d’incident** présent à tous les écrans de session active.
- **Possibilité de refus sans justification** : un donneur ou un bénéficiaire peut annuler à tout
  moment, le système n’en tire aucune conclusion morale.

### 8.4 Anti-capture

Auxilia doit être conçue de manière à ne pas pouvoir être instrumentalisée comme outil de
surveillance :

- **Minimisation** : ce qui n’est pas stocké ne peut pas être réquisitionné.
- **Hébergement segmenté** : les bases nominatives d’un hub restent juridiquement liées au hub, pas
  à une plateforme centrale.
- **Logs limités dans le temps** : 90 jours par défaut, sauf incident en cours d’instruction.
- **Politique de transparence** : un rapport annuel publie le nombre de demandes étatiques reçues et
  la suite donnée.
- **Pas d’intégration analytics tiers** : aucune balise Google, Meta, etc.
- **Code ouvert** : auditeur tiers possible.

---

## 9. Vie privée et conformité RGPD

### 9.1 Principes

- **Finalité claire** : mise en relation pour dépannage data/power, et publication de statistiques
  agrégées.
- **Minimisation** : pas de donnée inutile.
- **Durée courte** : les offres expirent vite ; les logs vivent 90 jours sauf incident.
- **Transparence** : chacun sait ce qui est enregistré.
- **Contrôle** : chacun peut refuser une session, supprimer son compte, exporter ses données.
- **Séparation** : actes publics, contenus privés.
- **Agrégation** : statistiques publiques sans exposition des personnes.

### 9.2 Bases légales

- **Consentement explicite** pour la création du compte, la vérification du numéro de téléphone ou
  de l’adresse e-mail, et la publication d’offres.
- **Exécution d’une mission d’intérêt général** (commun local de secours) pour la conservation des
  logs agrégés.
- **Intérêt légitime du donneur** pour la conservation courte des traces de session, à des fins de
  preuve en cas d’incident.

Le numéro de téléphone et l’adresse e-mail sont des données personnelles directement identifiantes.
Ils sont stockés chiffrés au repos. Ils ne sont accessibles que par :

- le système d’authentification (pour l’envoi des OTP) ;
- l’utilisateur lui-même (via son espace personnel) ;
- les opérateurs de hub uniquement dans le cas d’un incident grave en cours d’instruction, et après
  journalisation explicite de l’accès dans `audit_logs`.

Ils ne sont jamais exposés à un autre utilisateur sous aucun état de session.

### 9.3 Responsable de traitement

> **[À valider]** Le responsable de traitement doit être désigné. Trois options :
>
> 1. L’association C.O.R.S.I.C.A. pour l’ensemble du réseau.
> 2. Une association _ad hoc_ dédiée à Auxilia.
> 3. Chaque hub est responsable de ses propres données ; la plateforme centrale n’est que
>    sous-traitant.
>
> La piste 3 est juridiquement la plus protectrice mais opérationnellement la plus lourde. La piste
> 1 est probablement la bonne pour Phase 0.

### 9.4 Statut télécoms

> **[À surveiller]** Le partage temporaire de connexion entre individus, sans rémunération, dans un
> cadre associatif, ne devrait pas relever du régime des opérateurs de communications électroniques
> (ARCEP). Toutefois, dès que les volumes deviennent significatifs ou que la pratique se
> professionnalise, une consultation préalable de l’ARCEP est recommandée. Un avis juridique formel
> sera commandé avant le passage à la Phase 1.

---

## 10. Traçabilité

Auxilia trace les actes de dépannage, non les contenus.

**À tracer :**

- session (identifiant, horodatage, durée, type) ;
- donneur (par référence à un compte) ;
- bénéficiaire (par référence à un compte ou un identifiant de session anonyme) ;
- hub local ;
- volume data déclaré et, si possible, mesuré ;
- énergie estimée ou mesurée (Wh) ;
- incident éventuel ;
- clôture de session.

**À ne pas tracer :**

- contenu des communications ;
- historique de navigation ;
- messages personnels ;
- localisation GPS permanente ;
- déplacements détaillés ;
- raisons intimes du besoin.

Formule :

> **On trace le secours, pas la vie privée.**

---

## 11. Workflows

### 11.1 Donner de la data

```text
1. Le donneur ouvre Auxilia.
2. Il choisit « Je peux donner du réseau ».
3. Il fixe durée, volume, seuil de batterie, lieu public, niveau de visibilité.
4. L’offre apparaît dans le hub local (statut: open).
5. Un bénéficiaire sollicite l’offre (statut: pending).
6. Le donneur accepte (statut: matched).
7. L’identité du donneur devient visible pour le bénéficiaire.
8. Rencontre au lieu public, scan QR croisé (statut: confirmed).
9. La session démarre via hotspot (statut: active).
10. Clôture (statut: closed). L’acte est enregistré.
```

### 11.2 Donner de l’énergie

```text
1. Le donneur ou le hub déclare une ressource power disponible.
2. Le bénéficiaire demande une recharge courte.
3. Le hub propose un donneur, une powerbank ou un point fixe.
4. Le bénéficiaire voit qui donne ou quel point est responsable.
5. La rencontre se fait dans un lieu public.
6. La recharge commence.
7. La session est clôturée.
8. Incident ou succès est enregistré.
```

### 11.3 Demander data + power

```text
1. Le bénéficiaire signale un besoin combiné.
2. Le hub cherche une offre « both » ou deux offres complémentaires.
3. Le système privilégie un lieu public stable.
4. La session peut être scindée : recharge d’abord, data ensuite.
5. Les actes sont enregistrés séparément ou dans une session combinée.
```

### 11.4 Cas typique du visiteur (touriste, étudiant en mobilité)

Persona pivot du service. La séquence est conçue pour fonctionner même si le visiteur ne parle ni
français ni corse.

```text
1. Le visiteur arrive sur une place équipée (Place Paoli, par exemple).
   Son téléphone est à 5 % de batterie.
2. Il voit un panneau physique « AUXILIA — free help with battery and data ».
   Le panneau affiche un QR code statique et 3 ou 4 drapeaux.
3. Il scanne le QR avec l'app appareil photo native.
4. L'app web s'ouvre dans la langue de son navigateur (italien, anglais...).
5. Si pas de data, le panneau indique un SSID ouvert
   (`AUXILIA-PUBLIC`) qui donne accès à l'app uniquement.
6. Inscription par OTP SMS (numéro avec indicatif +39, +44, +49...)
   ou par e-mail si SMS roaming trop coûteux.
7. Le visiteur déclare un besoin (power, data ou both).
8. Le hub propose une offre du moment, ou un point fixe Auxilia.
9. Rencontre sur place, prénom et photo du donneur visibles.
10. Session courte (15 minutes par défaut).
11. À la clôture, le visiteur peut laisser un mot de remerciement
    anonyme qui apparaît dans les statistiques publiques du hub.
```

Le visiteur n'a aucune obligation de revenir. Aucun lien commercial n'est créé. Le seul retour
attendu — facultatif — est statistique (un dépannage de plus dans le compteur du hub) et symbolique
(le mot de remerciement).

C'est ce qui distingue Auxilia d'une plateforme de location ou d'une application d'avis : le service
est un don, conforme à une tradition d'accueil, et il s'arrête là.

### 11.5 Cas du bénéficiaire sans data du tout

C’est un cas critique. Le bénéficiaire ne peut pas atteindre Auxilia via Internet.

**Solutions Phase 0 :**

- panneaux physiques dans chaque hub avec QR code statique pointant vers les offres en cours via
  SSID Wi-Fi public ou Bluetooth ;
- chaque hub physique a une borne ou affiche un état du moment (« 2 offres data actives ici ») ;
- les SSID `AUXILIA-SECOURS-XXXX` sont scannables sans connexion ; le téléphone du bénéficiaire les
  voit et peut s’y connecter avec le mot de passe affiché en clair sur le panneau, pour rejoindre
  l’application.

**Solutions Phase 1 :**

- découverte BLE (Bluetooth Low Energy) : les offres power et data à proximité sont visibles
  localement.
- NFC pour l’appariement physique rapide en présence.

### 11.6 Signaler un incident

```text
1. Un participant signale un problème.
2. Il choisit une catégorie : data, power, rencontre, matériel, comportement, autre.
3. L’incident est lié à une session.
4. Un référent de hub examine.
5. Une offre ou un compte peut être suspendu si nécessaire.
6. Pour les incidents graves, le référent oriente vers les services compétents.
```

---

## 12. Statistiques publiques

Auxilia publie quotidiennement, par hub et par agrégat supérieur :

```text
Aujourd’hui à Corte :
- 14 dépannages data
- 8 dépannages power
- 2 dépannages combinés
- 0 incident grave

Ce mois :
- 312 dépannages, dont 6 incidents signalés (5 résolus localement)
```

Ces statistiques rendent le commun visible sans exposer les personnes. Elles servent aussi à mesurer
l’usage réel et à éviter le théâtre : un hub sans usage doit être visible comme tel.

---

## 13. Architecture technique

### 13.1 Principes

- **Auxilia est `brique-auxilia`**, treizième brique du monorepo `inseme/packages/`, à côté des
  douze briques déjà existantes (`brique-actes`, `brique-blog`, `brique-communes`, `brique-cyrnea`,
  `brique-democracy`, `brique-fil`, `brique-group`, `brique-kudocracy`, `brique-map`,
  `brique-ophelia`, `brique-tasks`, `brique-wiki`).
- **Conforme au contrat `BRIQUE_SPEC.md`** de `packages/cop-host/`. Le manifeste `brique.config.js`
  à la racine du package est le point d'entrée unique de l'intégration.
- **Consommée par les apps host** existantes (`apps/cyrnea`, `apps/inseme`, `apps/platform`) via le
  registre auto-généré `brique-registry.gen.js`.
- **Pas de tables propres** : Auxilia s'inscrit dans les tables `cop_*` partagées (`cop_event`,
  `cop_topic`, `cop_task` et apparentées) en utilisant le champ `metadata jsonb` pour ses données
  spécifiques. Voir §14.
- **Activation par feature flag** : la brique est activable / désactivable par instance via
  `instance_config.feature_auxilia`.

### 13.2 Pile technique (héritée du monorepo)

- **Frontend** : React + JSX, icônes Phosphor.
- **Backend** : Netlify Functions (Node.js) pour les handlers classiques, Edge Functions (Deno) pour
  les routes temps réel ou à faible latence.
- **Base de données** : Supabase (Postgres + Auth + Realtime + Storage). Tables `cop_*`.
- **Auth** : la brique réutilise l'auth de l'écosystème `cop-host` (Supabase Auth). Le choix OTP SMS
  / OTP e-mail (§7.2) doit être confirmé comme déjà supporté par l'auth existante, ou faire l'objet
  d'une contribution en retour à `cop-host`.
- **Internationalisation** : à confirmer — Auxilia déclare ses chaînes en FR/EN/IT/CO en s'appuyant
  sur le mécanisme i18n du monorepo (vraisemblablement géré au niveau `cop-host` ou par une brique
  dédiée).
- **PWA / installable** : à confirmer selon ce que les apps host exposent déjà.

### 13.3 Routes (déclarées dans `brique.config.js`)

```text
/auxilia                        Accueil de la brique, état du hub courant
/auxilia/need                   Publier une demande
/auxilia/give                   Publier une offre
/auxilia/hub/:hubId             Page d'un hub (offres et demandes en cours)
/auxilia/session/:sessionId     Vue de session active
/auxilia/incident/:sessionId    Signalement d'incident
/auxilia/charte                 Charte des participants
/auxilia/stats                  Statistiques publiques
```

Les routes protégées (création d'offre, accès à une session) sont marquées `protected: true`.

### 13.4 Functions et Edge Functions

**Netlify Functions (Node.js, traitements transactionnels)**

```text
create-offer            POST   /api/auxilia-create-offer
create-request          POST   /api/auxilia-create-request
match-request           POST   /api/auxilia-match-request
accept-match            POST   /api/auxilia-accept-match
confirm-presence        POST   /api/auxilia-confirm-presence    (scan QR croisé)
start-session           POST   /api/auxilia-start-session
end-session             POST   /api/auxilia-end-session
report-incident         POST   /api/auxilia-report-incident
cleanup-expired-offers  CRON   tous les jours à 03:00
generate-daily-stats    CRON   tous les jours à 23:55
```

**Edge Functions (Deno, faible latence et streaming)**

```text
hub-state               GET    /auxilia/hub/:id/state          (état temps réel d'un hub)
session-events          SSE    /auxilia/session/:id/events     (flux d'événements de session)
qr-resolver             GET    /auxilia/qr/:token              (résolution rapide de QR)
```

### 13.5 Schéma de configuration (`configSchema`)

```text
auxilia_default_hub_id          uuid, hub par défaut de l'instance
auxilia_session_max_minutes     int, défaut 15
auxilia_offer_ttl_minutes       int, défaut 30
auxilia_min_battery_percent     int, défaut 30 (seuil de protection donneur)
auxilia_languages_enabled       array of locale codes, défaut ["fr","en","it"]
auxilia_sms_provider            string, à arbitrer
auxilia_panneau_url             string, URL des panneaux physiques imprimables
```

### 13.6 Mapping COP — entités et metadata jsonb

> **[À valider]** Ce mapping est une proposition. Il doit être confronté à la sémantique précise des
> entités COP (`cop_event`, `cop_topic`, `cop_task`) dans `cop-host`, qui m'est partiellement
> connue. Lecture d'une brique fonctionnellement proche (`brique-tasks` ou `brique-map`) recommandée
> pour confirmer.

Hypothèse de travail, à valider :

| Concept Auxilia                | Entité COP candidate | Justification                                                            |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------ |
| Offre (donneur publie)         | `cop_topic`          | Sujet de l'attention collective dans le hub, durable le temps de son TTL |
| Demande (bénéficiaire signale) | `cop_topic`          | Idem, avec polarité inverse                                              |
| Match (appariement)            | `cop_event`          | Acte ponctuel qui transforme deux topics en une session                  |
| Session (transfert)            | `cop_task`           | Action en cours, avec début, fin, état, possibilité d'échec              |
| Incident                       | `cop_event`          | Acte ponctuel signalé, audité par un référent                            |
| SOS data/power (alerte courte) | `cop_event`          | Évènement à fort signal, court terme                                     |

**Schéma `metadata jsonb` pour les topics Auxilia (offres et demandes) :**

```json
{
  "auxilia": {
    "kind": "offer" | "request",
    "resource": "data" | "power" | "both",
    "polarity": "give" | "need",
    "max_duration_minutes": 15,
    "max_volume_mb": 500,
    "estimated_wh": 5,
    "min_battery_after_percent": 30,
    "available_until": "2026-06-15T18:30:00Z",
    "meeting_point": "Place Paoli, banc nord",
    "hub_id": "uuid-of-hub",
    "visibility": "public" | "hub_only" | "invite",
    "languages_spoken": ["fr", "co"]
  }
}
```

**Schéma `metadata jsonb` pour les tasks Auxilia (sessions) :**

```json
{
  "auxilia": {
    "kind": "session",
    "match_event_id": "uuid",
    "donor_topic_id": "uuid",
    "receiver_topic_id": "uuid",
    "resource": "data" | "power" | "both",
    "started_at": "2026-06-15T18:35:00Z",
    "ended_at": null,
    "planned_duration_minutes": 15,
    "measured_volume_mb": null,
    "measured_wh": null,
    "qr_token_hash": "sha256:...",
    "presence_confirmed_at": null,
    "incident_flag": false,
    "status": "matched" | "confirmed" | "active" | "closed" | "aborted" | "incident"
  }
}
```

L'avantage de ce mapping est qu'Auxilia hérite gratuitement, pour ses entités, des fonctionnalités
déjà offertes par les autres briques sur les `cop_*` : `brique-actes` pour la traçabilité,
`brique-map` pour la cartographie des offres, `brique-fil` pour la diffusion temps réel,
`brique-democracy` ou `brique-kudocracy` si un jour on veut gouverner les hubs par vote.

### 13.7 Squelette de `brique.config.js`

À titre d'exemple opérationnel, le manifeste pourrait ressembler à :

```js
/**
 * @type {import('@inseme/cop-host').BriqueConfig}
 */
export default {
  id: "auxilia",
  name: "Auxilia — hospitalité data & power",
  feature: "auxilia",

  routes: [
    { path: "/auxilia", component: "./src/pages/AuxiliaHome.jsx", protected: false },
    { path: "/auxilia/need", component: "./src/pages/Need.jsx", protected: false },
    { path: "/auxilia/give", component: "./src/pages/Give.jsx", protected: true },
    { path: "/auxilia/hub/:hubId", component: "./src/pages/Hub.jsx", protected: false },
    { path: "/auxilia/session/:sessionId", component: "./src/pages/Session.jsx", protected: true },
    {
      path: "/auxilia/incident/:sessionId",
      component: "./src/pages/Incident.jsx",
      protected: true,
    },
    { path: "/auxilia/charte", component: "./src/pages/Charte.jsx", protected: false },
    { path: "/auxilia/stats", component: "./src/pages/Stats.jsx", protected: false },
  ],

  menuItems: [
    {
      id: "auxilia-home",
      label: "Auxilia",
      path: "/auxilia",
      icon: "HandHeart",
      position: "header",
    },
  ],

  functions: {
    "create-offer": { handler: "./src/functions/create-offer.js" },
    "create-request": { handler: "./src/functions/create-request.js" },
    "match-request": { handler: "./src/functions/match-request.js" },
    "accept-match": { handler: "./src/functions/accept-match.js" },
    "confirm-presence": { handler: "./src/functions/confirm-presence.js" },
    "start-session": { handler: "./src/functions/start-session.js" },
    "end-session": { handler: "./src/functions/end-session.js" },
    "report-incident": { handler: "./src/functions/report-incident.js" },
    "cleanup-expired": { handler: "./src/functions/cleanup-expired.js", schedule: "0 3 * * *" },
    "daily-stats": { handler: "./src/functions/daily-stats.js", schedule: "55 23 * * *" },
  },

  edgeFunctions: {
    "hub-state": { path: "/auxilia/hub/:id/state", handler: "./src/edge/hub-state.js" },
    "session-events": {
      path: "/auxilia/session/:id/events",
      handler: "./src/edge/session-events.js",
    },
    "qr-resolver": { path: "/auxilia/qr/:token", handler: "./src/edge/qr-resolver.js" },
  },

  configSchema: {
    auxilia_default_hub_id: {
      type: "string",
      description: "UUID du hub par défaut de l'instance (typiquement la commune).",
    },
    auxilia_session_max_minutes: {
      type: "integer",
      default: 15,
      description: "Durée maximale par défaut d'une session de transfert.",
    },
    auxilia_offer_ttl_minutes: {
      type: "integer",
      default: 30,
      description: "Durée de vie par défaut d'une offre publiée.",
    },
    auxilia_min_battery_percent: {
      type: "integer",
      default: 30,
      description: "Seuil de batterie minimal après don, protection du donneur.",
    },
    auxilia_languages_enabled: {
      type: "array",
      default: ["fr", "en", "it"],
      description: "Langues activées pour cette instance.",
    },
  },
};
```

L'icône `HandHeart` (Phosphor) est suggérée. Alternatives possibles : `Handshake`, `Lightning`,
`Heart`, `Plug`. Choix à arrêter selon la charte iconographique du monorepo.

---

## 14. Modèle de données — mapping sur les tables `cop_*`

Auxilia n'introduit aucune table propre dans Supabase. Toutes les entités vivent dans les tables
`cop_*` partagées du monorepo, en utilisant le champ `metadata jsonb` pour les données spécifiques à
la brique.

Cette section décrit ce mapping. Le schéma précis des `metadata.auxilia` est documenté en §13.6 ;
cette section en donne la vue d'ensemble et les conventions transverses.

### 14.1 Profils — `cop_profile` (table partagée du monorepo)

Auxilia ne possède pas ses utilisateurs. Elle utilise les profils existants du monorepo `inseme`.
Les besoins propres à Auxilia (langue préférée, niveau de participation pour la brique, dernière
offre, etc.) sont stockés dans `cop_profile.metadata.auxilia`.

```json
{
  "auxilia": {
    "participation_level": 0,
    "has_completed_charter": true,
    "charter_version": "1.0",
    "preferred_languages": ["fr", "it"],
    "donor_power_consent": true,
    "last_offer_at": "2026-06-15T18:30:00Z",
    "incident_count": 0
  }
}
```

L'identité utilisateur (numéro de téléphone, email, prénom, photo, OTP) est entièrement gérée par le
socle d'auth `cop-host`, à condition que celui-ci supporte OTP SMS et OTP e-mail (voir §18, question
13).

### 14.2 Hubs — `cop_hub` ou `cop_community` (à confirmer)

> **[À valider]** Le rattachement géographique d'Auxilia s'aligne sur la convention déjà utilisée
> par `brique-communes`, `brique-cyrnea` et `brique-map`. La table candidate est probablement
> `cop_community` ou un équivalent. L'inspection de l'une de ces trois briques permettra de
> trancher.

Les hubs Auxilia (§5) sont attendus comme des entités déjà gérées par une autre brique. Auxilia s'y
rattache via foreign key, et complète si nécessaire par `metadata.auxilia` pour ses besoins propres
(référent Auxilia, statistiques, panneaux physiques associés).

### 14.3 Offres et demandes — `cop_topic`

Une offre est un _topic_ publié par un donneur. Une demande est un _topic_ publié par un
bénéficiaire. Le statut (open, matched, closed) suit le cycle de vie du topic ; le détail est dans
`metadata.auxilia` (voir §13.6).

Avantage : `brique-map` peut afficher automatiquement les topics avec un `metadata.auxilia.kind` et
un `meeting_point` géolocalisable.

### 14.4 Match — `cop_event`

L'acte d'appariement (offre × demande → session) est consigné comme un événement, daté, lié aux deux
topics et au profil qui a accepté.

### 14.5 Session — `cop_task`

La session de transfert est une tâche : elle a un début, une fin, un état, un résultat possible
(succès, abandon, incident). Le détail des mesures (volume data, Wh énergie) est dans
`metadata.auxilia` (voir §13.6).

### 14.6 Incident — `cop_event`

L'incident est consigné comme un événement de sévérité, lié à une session (`cop_task`) et à un
référent (`cop_profile`).

### 14.7 Power assets — option à arbitrer

> **[À valider]** Les ressources matérielles identifiées (powerbanks à QR, points fixes, micro-nœuds
> solaires) peuvent être :
>
> 1. modélisées comme des `cop_topic` avec `metadata.auxilia.kind = "asset"` ;
> 2. ou modélisées via une brique distincte (ou une extension de `brique-tasks`) si la sémantique «
>    actif suivi dans le temps » est trop spécifique.
>
> La piste 1 est privilégiée tant qu'on n'a pas besoin d'un suivi sophistiqué.

### 14.8 Audit — `brique-actes`

La traçabilité des actes Auxilia (création de compte, vérification d'identité, accès référent à un
numéro de téléphone, suppression) est confiée à `brique-actes` si celle-ci offre déjà ce service au
monorepo. À défaut, les événements sont consignés en `cop_event` avec un
`metadata.auxilia.audit = true`.

### 14.9 Convention transverse pour `metadata.auxilia`

- La clé racine est toujours `auxilia` à l'intérieur du `metadata jsonb`, jamais à la racine de
  l'entité.
- Les champs date sont en ISO 8601 UTC.
- Les durées sont en minutes (entier).
- Les volumes data en mégaoctets (entier ou numeric).
- Les énergies en wattheures (numeric).
- Les langues en codes ISO 639-1 minuscules (`fr`, `en`, `it`, `co`).
- Les statuts sont énumérés et documentés en §13.6.

---

## 15. Charte des participants

Tout participant accepte les principes suivants à l’inscription :

1. Je ne propose une aide que si je peux l’assurer sans me mettre en danger.
2. Je ne sollicite une aide que si j’en ai réellement besoin.
3. Je me présente au lieu et à l’heure convenus, ou j’annule à l’avance.
4. Je respecte la personne en face de moi, quelles que soient ses raisons.
5. Je ne demande pas et je ne donne pas d’informations personnelles au-delà de ce qui est
   nécessaire.
6. Je n’utilise pas Auxilia pour observer, suivre ou démarcher.
7. Je signale les incidents que je constate.
8. Je quitte Auxilia quand je veux, sans avoir à me justifier.

Cette charte est versionnée. Un participant inscrit sous une version antérieure est invité à
accepter la nouvelle version à la première occasion ; il peut refuser sans perdre son compte, mais
certaines fonctionnalités peuvent lui devenir inaccessibles.

---

## 16. Feuille de route

### 16.1 Phase 0 — Pilote Corte (3 à 6 mois)

- 1 à 3 hubs physiques à Corte (Place Paoli, Université, un café partenaire).
- 50 à 200 utilisateurs inscrits, niveaux 0 à 2.
- Inscription en moins de 30 secondes par OTP SMS ou OTP e-mail. Pas de vérification administrative.
- Interface en français, anglais et italien dès le lancement.
- Workflows data et power simples (hotspot manuel, powerbanks et points fixes).
- Pas de BLE, pas de NFC, pas de proxy avancé.
- Statistiques publiques quotidiennes.
- Charte v1 stabilisée, traduite dans les trois langues.
- Référent de hub désigné par l’équipe `inseme`, pas par vote en Phase 0.
- **Calendrier visé** : lancement de préférence en début de saison touristique (mai-juin) pour
  bénéficier d'une affluence naturelle de visiteurs ; trois mois de pilote ; bilan à l'automne et
  préparation de la Phase 1.
- **Panneaux physiques multilingues** dans chaque hub : QR code statique + SSID public + brève
  notice en 3 langues.

### 16.2 Phase 1 — Multi-hub Corse (6 à 12 mois)

- Extension à plusieurs villes de Corse (Ajaccio, Bastia, Calvi, Porto-Vecchio, etc.).
- Application Android compagnon.
- Découverte BLE / NFC.
- SSID semi-permanents pour points fixes.
- Powerbanks identifiées par QR.
- Ajout du corse comme langue d’interface optionnelle (jamais imposée).
- Premier rapport annuel de transparence.
- Arbitrage du fournisseur SMS et de l’éventuel canal alternatif (WhatsApp, RCS).

### 16.3 Phase 2 — Méditerranée (12 à 24 mois)

- Premiers hubs hors Corse, en cohérence avec la stratégie méditerranéenne d’`inseme` et de
  MareNostrum.
- Internationalisation étendue : ajout de l’arabe, de l’espagnol, du catalan et du grec selon
  adoption.
- Adaptation juridique par pays.
- Documentation académique séparée (à publier dans `FractaVolta/research/auxilia`).

### 16.4 Phase 3 — Intégration EPN avancée

- Connexion aux nœuds FractaVolta véritables (conteneurs, micro-grilles).
- Comptabilité énergétique en CXU (unité d’exergie compute) lorsque pertinent.
- Routeurs Auxilia dédiés, indépendants des téléphones personnels.
- Tunnels chiffrés bout-à-bout pour le partage data.
- Interopérabilité avec d’autres réseaux d’entraide locaux.

---

## 17. Positionnement

### 17.1 Dans `inseme`

`inseme` (« ensemble » en corse) est un monorepo qui héberge un framework de briques (_packages_)
composables et plusieurs applications hôtes qui les consomment.

Le framework central est `@inseme/cop-host` (`packages/cop-host/`), qui définit le contrat
d'intégration des briques via le manifeste `brique.config.js` et génère le registre auto-importé
`brique-registry.gen.js` côté apps host.

Au moment de la rédaction de cette spec, le monorepo contient :

- **Douze briques métier** dans `packages/` : `brique-actes`, `brique-blog`, `brique-communes`,
  `brique-cyrnea`, `brique-democracy`, `brique-fil`, `brique-group`, `brique-kudocracy`,
  `brique-map`, `brique-ophelia`, `brique-tasks`, `brique-wiki`.
- **Trois apps hôtes** dans `apps/` : `apps/cyrnea`, `apps/inseme`, `apps/platform`. Chacune compose
  un sous-ensemble de briques selon son contexte (territorial, générique, plateforme).

Auxilia sera la treizième brique : `brique-auxilia`. Elle sera consommable par les trois apps hôtes
— `cyrnea` pour le déploiement corse, `inseme` pour un déploiement générique, `platform` selon
l'usage prévu pour cette dernière.

L'inscription d'Auxilia dans `inseme` n'est pas anecdotique : elle hérite d'un socle technique et
social déjà éprouvé. Surtout, elle hérite gratuitement, par le seul fait d'utiliser les tables
`cop_*`, d'une intégration potentielle avec les autres briques : `brique-actes` pour la traçabilité,
`brique-map` pour la cartographie des offres, `brique-fil` pour la diffusion temps réel,
`brique-communes` pour le rattachement géographique, `brique-democracy` ou `brique-kudocracy` si un
jour on veut gouverner les hubs par vote des participants.

Auxilia est par ailleurs conçue comme un service d'hospitalité conforme à la réputation d'accueil de
la Corse. Le mécanisme est universel — il marche partout — mais sa première mise en œuvre tire parti
d'une pratique culturelle pré-existante : recevoir un voyageur en territoire inconnu, lui faire
passer un cap, sans rien attendre en retour. Auxilia n'invente pas l'hospitalité ; elle lui donne un
outil numérique qui en rend les actes visibles et mesurables, sans en altérer la gratuité.

C'est ce qui distingue Auxilia d'une plateforme de service : pas de compte client, pas d'avis, pas
de notation, pas de fidélisation. Le donneur n'accumule rien ; le bénéficiaire ne doit rien.

### 17.2 Dans FractaVolta

FractaVolta apporte l’arrière-plan conceptuel : énergie distribuée, autonomie de capacité, _packet
switching_ des ressources critiques. Auxilia est l’instanciation humaine de ce principe : un piéton
avec une powerbank est un paquet d’énergie en transit ; un téléphone qui partage son hotspot est un
nœud relais à durée de vie limitée.

Cette filiation conceptuelle n’est pas un ornement. Elle a des conséquences pratiques :

- les unités énergétiques mesurées en Wh peuvent être agrégées dans la comptabilité FractaVolta
  lorsque les nœuds le permettent ;
- les hubs Auxilia peuvent à terme accueillir de véritables nœuds FractaVolta (micro-conteneurs,
  nœuds solaires) ;
- la philosophie _store-and-forward_ est commune.

### 17.3 Vis-à-vis d’autres solutions

Auxilia se distingue volontairement de :

- **VPN et réseaux anonymes** (Tor, Tailscale) : Auxilia ne cherche pas l’anonymat fort, elle
  cherche la rencontre identifiable.
- **Plateformes d’entraide commerciales** : Auxilia n’est pas un marché, ne facture rien, ne note
  personne.
- **Mesh networks** (Briar, Bridgefy, Meshtastic) : Auxilia n’est pas un mesh ; elle est un annuaire
  d’offres ponctuelles avec rendez-vous physique.
- **Power-sharing commercial** (Chargemap, type bornes EV) : Auxilia s’adresse aux téléphones, pas
  aux véhicules ; et elle est associative.

---

## 18. Questions ouvertes

Ces points sont identifiés comme non résolus et doivent être tranchés avant le passage à un dépôt
stabilisé.

1. **Responsable de traitement RGPD** : C.O.R.S.I.C.A., association _ad hoc_, ou modèle distribué
   par hub ? Voir §9.3.
2. **Licence du code** : AGPL-3.0 par défaut (cohérent avec la posture anti-capture), ou alignée sur
   la licence des autres briques du monorepo ? Le texte de spec reste CC BY-SA 4.0.
3. **Statut télécoms** : avis juridique formel ARCEP avant Phase 1.
4. **Mesure réelle des Wh transférés** : Phase 0 : déclaration seule. Phase 1 : mesure optionnelle
   via compteur USB-C.
5. **Modalités de gouvernance** des hubs : qui désigne un référent, comment, pour combien de temps ?
   Phase 0 : désignation par l'équipe `inseme`. Phases ultérieures : `brique-democracy` ou
   `brique-kudocracy` pourraient être mobilisées.

**Questions liées à l'intégration dans `cop-host`** (à trancher avec l'autre agent qui connaît le
monorepo)

6. **Mapping COP** : la proposition §13.6 (offre/demande → `cop_topic`, match → `cop_event`, session
   → `cop_task`, incident → `cop_event`) doit être confrontée à la sémantique précise des entités
   COP dans `packages/cop-host/`. Lecture d'une brique fonctionnellement proche (`brique-tasks`,
   `brique-map`) recommandée.
7. **OTP SMS / e-mail dans l'auth existante** : l'auth Supabase de `cop-host` supporte-t-elle déjà
   OTP SMS + OTP e-mail ? Si non, faut-il contribuer cette amélioration à `cop-host` plutôt que la
   coder dans `brique-auxilia` ?
8. **Table des hubs** : `brique-communes`, `brique-cyrnea` et `brique-map` utilisent une certaine
   table pour les entités géolocalisées. Laquelle exactement Auxilia doit-elle utiliser pour ses
   hubs ? `cop_community`, `cop_hub`, ou une création nouvelle ?
9. **i18n** : quel mécanisme i18n existe-t-il dans `cop-host` ? Auxilia déclare-t-elle ses chaînes
   en clés dans `brique.config.js`, dans un dossier `locales/`, ou dans une convention différente ?
10. **Fournisseur SMS / OTP** : à arbitrer une fois clarifié le point 7.
11. **Power assets** : modélisation comme `cop_topic` avec `metadata.auxilia.kind = "asset"`, ou
    nouvelle brique dédiée ? Voir §14.7.
12. **Choix de l'icône Phosphor** pour le menu (suggestion : `HandHeart`, `Handshake`, `Plug`,
    `Lightning`). À aligner sur la charte iconographique des autres briques.

---

## 19. Glossaire

- **Auxilia** : nom de la brique. Latin, « secours, troupes auxiliaires ». Évoque aussi l’_aiutu_
  corse.
- **Donneur** : personne qui propose une ressource.
- **Bénéficiaire** : personne qui en a besoin.
- **Hub** : zone ou point de coordination locale.
- **Offre** : déclaration publique de capacité.
- **Demande** : déclaration publique de besoin.
- **Match** : appariement entre offre et demande.
- **Session** : transfert effectif (data ou power).
- **Référent de hub** : personne physique en charge d’un hub.
- **CXU** : _Compute eXergy Unit_, unité d’exergie compute, utilisée par MareNostrum et FractaVolta.
- **EPN** : _Energy Packet Network_, cadre conceptuel hérité de Gelenbe (2012) et étendu par
  FractaVolta.
- **Store-and-forward** : principe selon lequel une ressource est stockée localement puis transmise
  à un nœud voisin, sans circuit continu.

---

## 20. Devise

> **Transparence des actes. Pudeur des personnes. Confidentialité des contenus.**

---

## 21. Annexe — Travaux open source connexes

Les projets ci-dessous ont été identifiés comme potentiellement réutilisables, en tout ou partie.
Cette liste est indicative et appelle confirmation au moment de l'implémentation. Aucun engagement
de réutilisation n'est pris ici ; il s'agit de signaler la matière disponible.

### 21.1 Plateformes de partage local — inspirations et forks

**Inspirations propriétaires (non forkables, mais UX et trust model bien documentés) :**

- **OLIO** (UK, fondée 2015, 2,9 M utilisateurs en 2024) — partage de surplus alimentaires et
  d'objets entre voisins. Modèle de confiance multi-couches _sans KYC_ : vérification SMS, photo
  d'ID optionnelle non stockée (matching visuel par modérateurs), notation post-pickup, badges après
  10+ transactions. 40-50 % des annonces sont demandées en moins d'une heure. Le modèle low-friction
  OLIO valide directement le choix Auxilia d'OTP SMS comme identification suffisante.
- **Peerby** (Pays-Bas, fondée 2011) — prêt d'objets entre voisins. Approche communautaire,
  géolocalisée. Propriétaire également.

**Plateformes open source forkables :**

- **Freecycle** — frontend open source, le plus ancien réseau de don d'objets entre voisins (2003).
  Code disponible, à étudier comme base pour la liste/carte d'offres.
- **Shareish** _(GPL ou similaire, à vérifier)_ — plateforme map-based de mutual aid présentée à ACM
  C&T 2022. Donneurs, prêts gratuits, demandes de biens, événements. Modèle conceptuel le plus
  proche d'Auxilia, source ouvert et déploiement moderne.
- **`rubyforgood/mutual-aid`** _(MIT)_ — Ruby on Rails, déployé dans plusieurs villes américaines.
  Pas réutilisable en ESM JS, mais modèle de données mature.
- **`factn/resilience-app`** _(MIT)_ — JavaScript, plus axé crise et désastre. Coordination de
  volontaires, dons et missions.

Le fork direct d'un de ces projets dans Auxilia est peu probable : aucun ne couvre le couple data +
power, et tous mélangeraient des conventions étrangères au monorepo `inseme`. Mais leurs modèles UX,
leurs schémas de données et leurs courbes d'adoption constituent un matériau de référence solide
pour la conception.

### 21.2 Hotspot Wi-Fi et captive portals

- **OpenWISP** _(GPL)_ — solution mature de gestion de hotspots WiFi en réseau public. Hors scope
  Phase 0 (trop lourd pour un pilote à un hub), pertinent dès Phase 1 quand des routeurs dédiés
  équiperont les hubs. Embarque Coova-Chilli et FreeRADIUS.
- **Coova-Chilli** _(GPL)_ — captive portal léger pour routeurs OpenWrt. Brique de bas niveau, à
  embarquer dans le matériel des hubs Phase 1.

### 21.3 Découverte hors ligne et mesh

- **Meshtastic** _(GPL)_ — réseaux LoRa décentralisés avec passerelle Bluetooth vers smartphones.
  Pertinent pour le cas du téléphone bénéficiaire totalement déconnecté en Phase 1 / Phase 2. La
  pile matérielle est abordable (microcontrôleurs ESP32 + module LoRa).

### 21.4 Écosystème Mistral AI

Mistral AI publie sous Apache 2.0 plusieurs modèles directement intéressants pour Auxilia. Le
rapprochement est cohérent avec les principes du projet : modèles européens, exécutables localement,
légers.

- **Voxtral TTS** _(Apache 2.0)_ — modèle text-to-speech embarquable supportant 9 langues (FR, EN,
  IT, ES, DE, NL, PT, AR, HI). Usage Auxilia : vocaliser les instructions de session pour un
  visiteur dont le téléphone s'éteint, ou qui ne lit pas la langue d'affichage. Tourne sur
  smartphone sans cloud.
- **Ministraux (Mistral 3B, Mistral 8B)** _(Apache 2.0)_ — modèles légers conçus pour être embarqués
  dans des systèmes isolés d'internet. Un hub Auxilia pourrait héberger un assistant linguistique
  local pour orienter les visiteurs, traduire des panneaux à la volée, ou répondre à des questions
  simples sans dépendance cloud.
- **`@mistralai/mistralai`** _(npm, Apache 2.0)_ — SDK JavaScript / TypeScript officiel. Branchement
  trivial en ESM pour les tâches de génération ou traduction (rédaction multilingue de la charte,
  localisation des messages OTP, FAQ).

L'intégration Mistral n'est pas un prérequis Phase 0 : elle est mentionnée ici comme piste cohérente
pour Phase 1 et au-delà, dans l'optique d'un service d'hospitalité multilingue à faible empreinte
cloud.

### 21.5 Cadres conceptuels académiques

- **Energy Packet Networks** (Erol Gelenbe, Imperial College, 2012 et travaux ultérieurs) — cadre
  théorique fondateur du _store-and-forward_ énergétique, dont Auxilia est une instanciation
  humaine. Référence centrale du corpus FractaVolta.
- **Generalized Tocqueville Law** (J.-H. Robert, 2025–2026) — cadre sur la centralisation comme
  effet structurellement intolérable. Pertinent pour la posture anti-capture d'Auxilia (§8.4).

---

_Document maintenu par jhr@baronsmariani.org. Contributions bienvenues par PR sur le dépôt
`inseme`._
