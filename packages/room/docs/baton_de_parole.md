---
title: Bâton de parole et terrains féconds
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

# Bâton de parole et terrains féconds

**Statut :** note de conception  
**Projet :** Inseme / Ophélia  
**Objet :** protocole de parole pour assemblées synchrones

---

## 1. Principe

Le **bâton de parole** est le protocole temporel de l’assemblée.

La **méthode des terrains féconds** est le protocole cognitif du désaccord.

Celui qui tient le bâton parle. Les autres écoutent. Ophélia tient le cadre, non le pouvoir.

Formule :

> Parole ordonnée, désaccord fécond, décision humaine.

---

## 2. Pourquoi un bâton de parole dans Inseme ?

Une assemblée synchrone est fragile. La parole se superpose, les plus rapides dominent, les participants distants peuvent disparaître, les tensions montent vite, les oppositions binaires se figent.

Le bâton de parole sert à :

- réduire les interruptions ;
- garantir l’isegoria ;
- rendre visible la file d’attente ;
- limiter les monopoles ;
- protéger les participants discrets ;
- rendre explicite le passage de parole ;
- permettre à Ophélia de proposer des reconfigurations sans interrompre arbitrairement.

Le bâton ne rend pas le débat lent. Il le rend lisible.

---

## 3. États du bâton

```ts
type TalkingStickState = {
  holderId: string | null;
  holderName?: string;
  grantedAt?: string;
  maxDurationSec?: number;
  remainingSec?: number;
  status: "free" | "held" | "yielding" | "expired";
  queue: string[];
  mode: "open" | "soft" | "strict";
};
```

### `free`

Personne ne tient le bâton. La parole peut être demandée.

### `held`

Une personne tient le bâton. Elle parle ; les autres écoutent.

### `yielding`

Le détenteur rend ou transmet le bâton.

### `expired`

Le temps de parole est écoulé. Ophélia ou l’organisateur propose une transmission.

---

## 4. Modes de fonctionnement

| Mode | Usage | Règle |
|---|---|---|
| `open` | discussion informelle | Ophélia observe, intervient peu |
| `soft` | débat structuré | file d’attente recommandée, rappels doux |
| `strict` | tension, décision, temps limité | seul le détenteur du bâton parle |

Le passage en mode strict doit être proposé ou validé par un humain.

Formule d’Ophélia :

> « La tension monte. Je propose de passer temporairement en bâton strict pendant dix minutes. Le groupe valide-t-il ce cadre ? »

---

## 5. Événements

```ts
type TalkingStickEvent =
  | { type: "TOKEN_REQUESTED"; participantId: string }
  | { type: "TOKEN_GRANTED"; participantId: string; by: "moderator" | "ophelia" | "auto" }
  | { type: "TOKEN_YIELDED"; participantId: string }
  | { type: "TOKEN_TRANSFERRED"; from: string; to: string }
  | { type: "TOKEN_EXPIRED"; participantId: string }
  | { type: "TOKEN_RECALLED"; participantId: string; reason: string };
```

Ces événements peuvent être diffusés en temps réel et archivés comme messages de type `talking_stick_event`.

---

## 6. Relation avec `speechQueue`

`speechQueue` répond à la question :

> Qui veut parler ?

`talkingStick` répond à la question :

> Qui parle maintenant ?

Les deux états sont complémentaires.

```text
speechQueue  -> file d’attente
TalkingStick -> parole actuelle
```

---

## 7. Rôle d’Ophélia

Ophélia :

- annonce le détenteur du bâton ;
- surveille l’équité de parole ;
- propose des transmissions ;
- invite les participants discrets ;
- résume les points clés ;
- détecte les oppositions binaires stériles ;
- propose une reconfiguration par terrains féconds ;
- ne décide jamais pour le groupe.

Elle peut dire :

> « Le bâton est actuellement à Marie. Paul est ensuite dans la file pour une objection. »

Ou :

> « Je propose de suspendre le duel un instant : quelle vérité chaque position cherche-t-elle à protéger ? »

---

## 8. Interaction avec les terrains féconds

Le bâton règle la forme temporelle du débat.

Les terrains féconds règlent la forme cognitive du débat.

| Problème | Réponse |
|---|---|
| Interruptions | Bâton de parole |
| Monopole | Timer + équité de parole |
| Confusion | Synthèse courte |
| Polarisation | Reconfiguration du terrain |
| Tension | Pause + mode strict temporaire |
| Décision | Proposition validée humainement |
| Mémoire | Synthèse + archives |

---

## 9. État temps réel recommandé

```json
{
  "talking_stick": {
    "holderId": "user_123",
    "holderName": "Marie",
    "status": "held",
    "mode": "soft",
    "remainingSec": 94,
    "queue": ["user_456", "user_789"]
  }
}
```

Broadcast possible :

```ts
sendBroadcast("talking_stick_update", {
  holderId,
  holderName,
  status,
  mode,
  remainingSec,
  queue
});
```

---

## 10. Archive recommandée

Événement bâton :

```json
{
  "type": "talking_stick_event",
  "metadata": {
    "event": "TOKEN_GRANTED",
    "holderId": "user_123",
    "mode": "soft"
  }
}
```

Événement terrain fécond :

```json
{
  "type": "fertile_ground_event",
  "metadata": {
    "opposition": "autonomie / République",
    "partial_truths": [
      "autonomie de capacité territoriale",
      "cadre commun républicain"
    ],
    "proposal": "cadre commun républicain, autonomie de capacité territoriale",
    "status": "proposed"
  }
}
```

---

## 11. Synthèse vers l’asynchrone

L’assemblée synchrone ne doit pas tout résoudre. Elle doit produire des artefacts pour l’asynchrone :

- synthèse ;
- propositions ;
- objections ouvertes ;
- terrains féconds proposés ;
- décisions prises ;
- continuations.

Formule :

> Le synchrone rend la parole vivante ; l’asynchrone rend la pensée vérifiable.

---

## 12. Décision de conception

Le bâton de parole doit rester un outil de facilitation, non un outil de domination.

Ophélia peut proposer, rappeler, synthétiser et alerter. Le groupe humain reste souverain.
