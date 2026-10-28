---
title: Checkpoint — Mandated Agents, Harness and capability resolution
author: Jean Hugues Noël Robert, baron Mariani
date: '2026-08-24'
last_modified_at: '2026-08-24'
version: '0.1'
document_role: source
document_kind: research-checkpoint
visibility: public
lifecycle_state: stable
language: en
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: conversation
  origin_repository: JeanHuguesRobert/inseme
  origin_date: '2026-08-24'
  derived_from:
    - packages/cop-core/COP_MANDATED_AGENT_SECURITY.md
    - packages/cop-core/MANDATED_AGENT_SECURITY_AUDIT_2026-08-24.md
    - packages/magistral/CAPABILITY_RESOLUTION.md
    - https://github.com/JeanHuguesRobert/inseme/issues/55
  origin_ref: unknown
review:
  status: conversation-approved
  reviewed_by:
    - Jean Hugues Noël Robert
changelog:
  - v0.1 (2026-08-24) — conversation checkpoint before returning control to implementation and empirical feedback.
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
legacy_document_role: checkpoint
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
status: working-paper
---


# Checkpoint — Mandated Agents, Harness and capability resolution

## 1. Purpose

This checkpoint closes the current exploration without pretending to close the subject. It records the conclusions that are sufficiently stable to guide implementation and future observation of the fast-moving agent ecosystem.

The next useful information should primarily come from implementation, tests and real use rather than additional speculative architecture.

## 2. Canonical agent formulation

The preferred concept is **Mandated Agent / Agent Mandaté**, rather than an agent that autonomizes itself.

Core distinction:

```text
operational autonomy != autonomous authority
```

A Mandated Agent may choose means within its authority. It may not create, enlarge or perpetuate the source of that authority by itself.

Compact rule:

> **The agent may choose its means; it may not assign itself its mandate.**

The objective is not to make agents sovereign. It is to increase the Principal's effective capacity while preserving the Principal's sovereignty.

## 3. General delegation doctrine

Delegation does not alienate the source of authority.

The reusable chain is:

```text
Principal
  -> Mandate
  -> Mandated Agent
  -> bounded capabilities
  -> operational autonomy
  -> effects
  -> trace + provenance + accounting
  -> accountability
  -> correction / revocation / recovery
```

The same grammar is intended to remain meaningful across software agents, human delegates and representative institutions.

## 4. Implementation consequence

A Mandate must become a technical precondition of consequential effect, not merely a reference recorded after the fact.

The current implementation audit identified the principal gap as authority enforcement immediately before effect, including mandate version pinning and TOCTOU protection.

GitHub issue #55 is the current implementation handoff:

> Implement Mandated Agent authority enforcement before consequential effects.

The expected sequence is P0a authority evaluation, P0b governed invocation boundary, then P0c John/Magistral integration and the complete revocation-before-effect test.

## 5. Governance conformance

After #55, the implementation should maintain a dedicated governance conformance suite, separate in intent from ordinary functional tests.

It should continuously test at least:

- no self-elevation of scope or authority;
- no consequential execution after effective revocation;
- capability availability is never authority;
- budget authority remains derived and bounded;
- subdelegation only attenuates authority;
- imported or portable state does not import local privilege;
- historical effects and evidence remain reconstructible after revocation.

Passing tests once is not sufficient; these properties should resist regression.

## 6. Review principle

The coding agent and the reviewer should be distinct roles where practical.

The reviewer should not merely verify that declared tests pass. It should actively search for alternate paths to consequential effects that bypass the governed invocation boundary.

Primary adversarial question:

> **Does any path to consequential effect remain that does not require current proof of authority?**

## 7. Harness and fast-moving vendors

DeepSeek Harness, Buzz, Codex, Claude Code and future systems are not an integration backlog.

They are primarily **experimental evidence** from which reusable patterns may be learned.

The strategic rule is:

> **Integrate from use; generalize from experience.**

ACP was useful because Codex was already useful in practice; ACP generalized an existing need. The desired direction is not protocol-first integration.

Discouraged pattern:

```text
new framework
-> speculative adapter
-> maintenance burden
-> search for a use
```

Preferred pattern:

```text
real use
-> smallest sufficient integration
-> observed friction / second case
-> reusable abstraction
-> stabilization when justified
```

## 8. Pré-généralisation et Rule of Two (clarification 2026-10-28)

**Dès le premier cas**, séparer au besoin deux couches :

1. **Contrat abstrait minimal** : la capacité requise, ses invariants, les identités et données canoniques, et la frontière qui rend un remplacement possible.
2. **Réalisation concrète** : la première implémentation, éventuellement unique, choisie pour sa simplicité et soumise à ce contrat.

Il ne s'agit pas de bâtir d'avance un framework général, une hiérarchie de plugins ou plusieurs implémentations fictives. Il s'agit de **ne pas rendre irréversible une dépendance contingente**. L'abstraction initiale est une *couture* légère, explicite, modifiable ; elle peut se réduire à un type, une fonction, un protocole standard, un format de données ou une configuration.

**La Rule of Two change de portée :** attendre deux cas réels indépendants (ou davantage de preuves) pour *généraliser et stabiliser une abstraction réutilisable dans le cœur* ; ne pas attendre le second cas pour *identifier et préserver la frontière abstrait/concret* lorsque le remplacement est plausible ou coûteux.

Séquence préférée :

```text
premier cas réel
  -> contrat minimal / frontière de substitution
  -> une implémentation concrète, la plus simple suffisante
  -> test du réel : invariants, réversibilité, coût de sortie
  -> second cas réel / friction observée
  -> généralisation et stabilisation, si justifiées
```

**Critère pragmatique :** le coût de la couture précoce doit rester inférieur au coût probable de l'enfermement futur ; ne créer une couche explicite que si elle protège une liberté réelle de choix. Privilégier les standards déjà disponibles plutôt qu'une abstraction maison.

**Exemple OAuth/MCP (Cogentia #294) :** `(issuer, subject) -> principal Cogentia -> mandats` est la frontière canonique dès le premier fournisseur ; l'émission des jetons reste confiée à une réalisation OAuth/OIDC standard (ZITADEL, Auth0, Keycloak ou autre). Le second fournisseur ne sera nécessaire que pour éprouver la substituabilité et enrichir éventuellement l'adaptateur, pas pour justifier la séparation initiale entre identité externe et mandat.

Cette règle conserve l'intention anti-surarchitecture de la Rule of Two tout en corrigeant son interprétation trop tardive et le risque d'une architecture façonnée par un fournisseur.

## 9. Capability-resolution layering

The current stable direction is:

```text
CapabilityRequirement
        -> CapabilityProvider
        -> ExecutionBinding
        -> TransportAdapter
```

COP governs authority, causality and accounting.

Magistral resolves useful capabilities and bindings.

ACP, native APIs, CLIs, MCP, A2A, HTTP and future protocols are execution surfaces below that boundary. A common protocol is a projection of capability, not necessarily its complete semantics.

Use the most generic surface that preserves the capability actually needed. Use a richer provider-native surface only when demonstrated useful semantics would otherwise be lost.

## 10. Ownership and authority

The architecture should distinguish:

```text
authority owner
execution/lifecycle owner
resource owner
runtime owner
artifact owner
```

These roles may coincide but are not equivalent.

In particular, lifecycle ownership, provider account ownership and technical reachability do not create Principal authority.

## 11. Portability and anti-capture

The target is capability portability, not merely data export.

Core distinction:

```text
portable continuity state != portable privilege
```

A fork, resume, import or provider migration may carry useful work state and causal continuity. It must not silently carry broader credentials, filesystem rights, tools, budget or authority.

Local privilege must be re-derived from the governing Mandate and rebound where necessary.

The future empirical test should be a real continuation started with one useful coding capability and resumed through another while preserving Principal, Mandate, budget, trace and causal lineage without implicit privilege transfer.

## 12. Engineering rules retained

Three compact rules summarize the current checkpoint:

```text
AUTHORITY
The agent never assigns itself its mandate.

INTEGRATION
Integrate from use; generalize from experience.

ABSTRACTION
Pré-généralisation dès le premier cas : séparer contrat minimal et réalisation ; Rule of Two : stabiliser après convergence de besoins réels indépendants.
```

A fourth rule follows from the portability work:

```text
CONTINUITY
State may travel; authority must remain justified.
```

## 13. Closure condition

No additional Harness-specific adapter or speculative provider integration is justified by this checkpoint.

The next priority is empirical:

1. implement and review issue #55;
2. establish governance conformance tests;
3. observe the resulting implementation friction;
4. perform a real cross-capability continuation/substitution experiment;
5. feed only demonstrated lessons back into the Reactive Corpus.

This is an application of **Le Réel répond**: the architecture has reached the point where implementation should now answer questions that further discussion alone cannot settle.
