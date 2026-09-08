---
title: "COP/Accounting — Resource, Budget, Mandate, and Ledger Semantics"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
language: "en"
date: "2026-07-20"
last_modified_at: "2026-07-20"
published_at: "2026-07-20"
version: "1.0"
status: "stable — human validated"
document_role: "source"
document_kind: "protocol-profile"
visibility: "public"
lifecycle_state: "active"
update_policy: "UP-DECISION-REVIEW"
human_validation_required: false
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/COP_ACCOUNTING.md"
revision_note:
  "v1.0 is the first human-validated public source. It consolidates the v0.4 arbitration on account
  URLs, proportional real-time traces, privacy and consent, cellular community boundaries,
  democratic safeguards, express mandates, experimental profiles, consolidation, and exploratory
  confederated Kudos work."
ai_assisted_by:
  - name: "OpenAI Codex"
    role: "AI-assisted co-drafting, corpus retrieval, structuring, and consistency review"
    principal: "Jean Hugues Noël Robert"
    responsibility: "Human author retains validation and publication authority"
provenance:
  origin_type: "conversation"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "conversation checkpoint R52"
  origin_date: "2026-07-20"
  derived_from:
    - "packages/cop-core/Invariants.md"
    - "packages/cop-core/COP_STORE_AND_PERSISTENCE.md"
    - "packages/cop-core/COP_IDENTITY.md"
    - "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/kudos.md"
    - "https://github.com/acorsica/Kudos/blob/main/README.md"
    - "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md"
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md"
review:
  status: "human-validated"
  reviewed_by:
    - "Jean Hugues Noël Robert"
  reviewed_at: "2026-07-20"
tags:
  - cop
  - accounting
  - resources
  - budgets
  - mandates
  - audit
  - fractanet
  - kudos
---

# COP/Accounting — Resource, Budget, Mandate, and Ledger Semantics

## 1. Decision and status

COP/Accounting specifies how a COP system records resources, budgets, reservations, commitments,
settlements, and delegated acts without losing accountability.

This profile is:

- **mandatory from day one for Fractanet**, including cognitive-packet routing;
- normative for any COP application that allocates, consumes, transfers, reserves, creates, or
  destroys consequential resources;
- optional for COP applications that perform no such act;
- a human-validated public source whose unresolved extensions are explicitly identified as future
  work rather than silently treated as settled protocol.

The accounting trace MUST exist before reputation, market signals, or routing weights are computed.
Good intentions, transient agent memory, and application logs are not accounting records.

### 1.1 Documentary dependency rule

This profile uses ordinary accounting vocabulary without redefining every generally known term. Any
Corpus-specific concept, however, MUST be linked to the document that defines it. A concept for
which no such document exists MUST be marked as unstabilized and MUST NOT silently acquire normative
force through this profile alone.

The dependency status used below is:

- **canonical** — the link is the intended source definition;
- **working source** — the document defines the current concept but still requires stabilization;
- **missing source** — the concept is used provisionally and requires its own source document.

### 1.2 Corpus concept anchors

| Concept used here                                       | Defining or closest source                                                                                                                                                                                                                                                         | Status in this profile                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| COP durable primitives and Views                        | [COP Store — Minimal Persistence Model](COP_STORE_AND_PERSISTENCE.md)                                                                                                                                                                                                              | working source                                                                      |
| COP invariants                                          | [COP Protocol Invariants](Invariants.md)                                                                                                                                                                                                                                           | canonical within COP                                                                |
| Identity, subject, actor, principal, and mandate fields | [COP/Identity](COP_IDENTITY.md)                                                                                                                                                                                                                                                    | working source                                                                      |
| Act, mandate, responsibility, and imputability          | [Traçabilité des actes](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/traceabilite_des_actes.md) and [Act, mandate and responsibility](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/act_mandate_responsibility.md)                      | working sources                                                                     |
| Fractanet                                               | [Fractanet — Generalized Control Planes for Heterogeneous Packet Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)                                                                                                                        | working source                                                                      |
| Cognitive packet                                        | [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)                                                                                                                                                                          | working source                                                                      |
| Cognitive-packet routing                                | [Cognitive Packet Switching](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packet_switching.md)                                                                                                                                                        | working source                                                                      |
| Packet Attractor                                        | [Packet Attractor — Fractanet Distributed Demand and Capability Routing](../../research/packet_attractor_fractanet.md)                                                                                                                                                             | working source                                                                      |
| Kudos                                                   | [Kudos source paper](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/kudos.md), [Kudos repository status](https://github.com/acorsica/Kudos/blob/main/STATUT.md), and [Kudos repository introduction](https://github.com/acorsica/Kudos/blob/main/README.md) | working sources; see §8 for unresolved differences                                  |
| Community rules and equality of users                   | [Constitution minimale des communs](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/constitution_minimale_des_communs.md)                                                                                                                                    | working source                                                                      |
| Kudocracy                                               | [Kudocracy](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/kudocracy.md) and [COP/Kudocracy](COP_KUDOCRACY.md)                                                                                                                                              | working sources                                                                     |
| Stigmergy                                               | [Stigmergie sans limite haute](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/stigmergie_sans_limite_haute.md)                                                                                                                                              | working source                                                                      |
| Traceability of consequential acts                      | [Traçabilité des actes](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/traceabilite_des_actes.md)                                                                                                                                                           | working source                                                                      |
| Informational gravity (`gravité informationnelle`)      | [Informational Gravity — Contextual Attraction for Cognitive-Packet Routing](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/informational_gravity.md)                                                                                                             | local working-source draft; human validation and publication pending                |
| Confederated circulation of Kudos                       | No defining document found that captures the bilateral agreements and upward-subsidiarity model                                                                                                                                                                                    | **missing source; §8 records requirements but does not define the political model** |

## 2. Scope

COP/Accounting is a multidimensional resource-accounting profile for COP-supervised systems such as
[Fractanet](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md). It
covers monetary and non-monetary resources, including:

- legal tender and bank balances;
- complementary units such as Kudos;
- energy, compute, storage, bandwidth, materials, and time;
- [cognitive-packet](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)
  budgets;
- reservations, quotas, rights of use, and other capacities.

This profile does not claim that every resource has a monetary value. Quantity, unit, valuation,
legal ownership, operational control, custody, and beneficial interest are distinct facts and MUST
NOT be silently conflated.

This profile is not, by itself, a substitute for statutory, tax, banking, or regulated financial
accounting. Adapters MAY produce such ledgers when their jurisdictional rules are explicitly stated.

## 3. Relationship to COP Core

COP/Accounting adds semantics and conformance rules, not a parallel persistence system.

- An accounting fact is recorded as an immutable COP `Event`.
- Supporting evidence is recorded or referenced as a COP `Artifact`.
- Accounts, ledgers, balances, available budgets, statements, reconciliations, and routing metrics
  are `View`s derived from Events and Artifacts.
- A correction is a new reversal or compensating Event. History is never overwritten.

Consequently, accounting MUST preserve all COP invariants: ordering, idempotency, durability,
stateless agents, event-mediated coordination, deterministic replay, schema versioning, and
transparency.

## 4. Normative vocabulary

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** express normative
requirements.

### 4.1 Core concepts

| Concept       | Meaning                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Subject       | Identified natural person, legal person, informal collective, agent, node, packet, community, or other accountable entity. |
| Resource type | Kind of resource being accounted for, independently of its unit.                                                           |
| Unit          | Exact measurement unit used by a posting.                                                                                  |
| Account       | Stable analytical address associating a subject, a resource type, a capacity, and a scope.                                 |
| Transaction   | One atomic, causally coherent set of postings.                                                                             |
| Posting       | Signed quantity applied to one account in one transaction.                                                                 |
| Budget        | Bounded authorization to use specified resources for a specified purpose.                                                  |
| Reservation   | Temporary exclusion of an amount from the budget available to competing acts.                                              |
| Commitment    | Resource obligation that has been accepted but may not yet be settled.                                                     |
| Settlement    | Event establishing that the expected transfer or consumption occurred.                                                     |
| Mandate       | Bounded authority through which an actor acts for a principal.                                                             |
| Evidence      | Artifact or external reference supporting an assertion or reconciliation.                                                  |
| Valuation     | Time- and source-bounded interpretation of one resource in another unit.                                                   |

### 4.2 Measurement uncertainty and subscription-backed capabilities

A CapabilityInvocation MAY consume a resource that cannot be reliably priced in fiat. Flat-rate or
quota-backed subscriptions, including a provider plan whose remaining allowance or marginal price is
not exposed, are common examples.

Such an invocation MUST NOT fabricate a dollar amount merely to fill an accounting field. Record one
of the following native assessments instead:

```text
measured      — an exact quantity is evidenced in its native unit
estimated     — a numerical estimate is available with interval, confidence,
                method and evidence; it remains distinct from a measurement
not_estimated  — the resource type is known but no reliable numerical quantity
                 can be supported; preserve the reason and available evidence
```

Human attention is a legitimate separate resource dimension when it is measured or consciously
budgeted (for example `human.attention` in `minute`). It MUST NOT be implicitly converted to
currency, tokens, provider quota or reputation.

Any valuation between dimensions is a distinct, source- and time-bounded event. It preserves the
original measurement and may be absent. Analytical projections MUST distinguish `not_estimated` from
zero consumption and from missing data. They MUST also distinguish an `estimated` quantity from a
measured one, and preserve the estimate's interval and confidence basis.

### 4.3 Execution budgets as bounded native resources

An agent loop MUST carry bounded native execution dimensions even when a monetary valuation is
absent. At minimum a profile may bound steps, tool calls, sub-agents, elapsed time and external
effects. A consequential invocation MUST reserve every enforceable dimension before handler
execution, then settle its observed use or release unused capacity. An unestimable provider price
does not permit an unbounded loop.

Reservations apply only to enforceable limits. An estimate is a forecast, not a capacity claim: it
MUST retain its confidence and MAY trigger a smaller bounded slice or review, but MUST NOT by itself
lock all available capacity. Reservation, settlement and release use an expected budget version; a
version conflict returns the current snapshot for a caller to re-read and recalculate.

Where a COP event store is available, these operations MUST be represented by append-only
`ExecutionBudgetReservation`, `ExecutionBudgetSettlement`, and `ExecutionBudgetRelease` events under
one budget topic. The topic sequence is the budget version and is the atomic precondition of each
write. The ledger is then a replayable projection, not a second mutable accounting store.

### 4.4 Local working trace and Corpus consolidation

An instance MAY retain a detailed local working trace (for example in SQLite) for recovery, incident
investigation and bounded handoff. That trace is not, by default, the long-term Corpus of the
Digital Twin. A Corpus publication SHOULD instead be a consolidated receipt: the meaningful outcome,
relevant artifacts, consequential effects, resource assessments, and a verifiable reference to a
bounded local trace window. It MUST record the local retention deadline and integrity references,
but MUST NOT export raw prompts, deltas or every loop step merely because they exist locally.

Consolidation is an explicit, traceable COP act. It never rewrites the local journal; it may be
repeated at a different detail level under its own mandate, exposure and retention policy. A
retained local trace MAY be inspected later by an authorised process when the consolidated receipt
identifies an incident or other justified need. The Corpus-facing event type is
`LocalTraceConsolidated`; its payload carries the consolidated receipt, not the raw local event
payloads.

An `Account` is a projection address, not necessarily a bank account and not a new durable COP
primitive.

## 5. Accounting invariants

### 5.1 Complete attribution

Consistently with the Corpus doctrine of
[traceable consequential acts](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/traceabilite_des_actes.md),
every consequential posting MUST identify:

- the transaction and posting;
- the account and accountable subject;
- the resource type, unit, and exact signed quantity;
- the actor that emitted the act;
- the principal on whose behalf the act was performed;
- the applicable mandate and budget when delegation or bounded spending is involved;
- its causal event, purpose, time, schema version, and privacy classification.

An actor and a principal MAY be the same subject. When they differ, the distinction MUST be
explicit.

### 5.2 Balanced transactions

Within every conserved `(resourceType, unit, accountingDomain)` dimension, the signed postings of a
settled transaction MUST sum to exactly zero.

Creation, destruction, demurrage, loss, or transformation MUST use an explicit source, sink, or
transformation account and MUST cite the rule and authority that permit it. Nothing is created or
destroyed merely to make a balance reconcile.

### 5.3 No implicit conversion

Postings expressed in different units MUST NOT be balanced against each other. A conversion or
valuation requires an explicit event stating at least its source, rate or method, effective time,
precision, and scope.

A valuation is a derived interpretation. It MUST NOT rewrite the original quantities.

### 5.4 Exact quantities

Authoritative quantities MUST use decimal integers with an explicit scale, or another exact
canonical representation. Binary floating-point numbers MUST NOT be used for authoritative postings.

### 5.5 Budget and reservation safety

A budget MUST define its owner or principal, permitted resource dimensions, purpose, scope, validity
period, limits, and applicable mandate.

At every accepted transition:

```text
available = granted + received - settled - committed - reserved - expired_or_revoked
```

The exact projection MAY refine these terms, but MUST NOT permit the same capacity to be spent
twice. A reservation MUST precede an asynchronous consequential act whenever concurrent execution
could overspend the budget.

### 5.6 Bounded delegation

An act performed by a human, software agent,
[cognitive packet](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md),
or node on behalf of another subject MUST reference a valid mandate, in the sense developed by
[Act, mandate and responsibility](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/act_mandate_responsibility.md).
The verifier MUST reject an act outside the mandate's resource, amount, purpose, recipient class,
time, or delegation bounds.

No mandate may infer unbounded authority from silence.

### 5.7 Lifecycle and finality

Implementations MUST distinguish at least:

```text
proposed -> reserved -> committed -> settled
```

They MUST also support rejection, expiry, release, reversal, and dispute without mutating prior
events. A state transition MUST identify the state it expects; conflicting concurrent transitions
MUST fail deterministically.

### 5.8 Evidence and reconciliation

External observations—bank transactions, meters, sensors, invoices, delivery receipts—MUST retain
their source identity and observation time. Matching an external observation to an internal
transaction MUST produce a reconciliation Event; it MUST NOT erase either trace.

Reconciliation confidence and human validation status MUST remain inspectable.

### 5.9 Rights are not one field

Legal ownership, beneficial interest, custody, operational control, authority to spend, and
liability MUST be representable separately. In particular, resources held by a treasurer for a
community MUST remain distinguishable from the treasurer's private resources.

### 5.10 Public proof and private content

Each event MUST declare a disclosure class and support purpose-limited projections. Auditability
does not imply publishing every underlying fact.

For example, a public Kudos trace MAY establish that an identified giver voluntarily rewarded an
identified provider in relation to a genuine exchange, while the purchased goods, bank details,
private price, and unrelated transactions remain private.

Public, restricted, confidential, and regulator/auditor projections MUST derive from the same
authoritative trace, with redaction decisions themselves governed and auditable.

### 5.11 Idempotency and replay

Every command and transaction MUST carry a stable idempotency key. Receiving the same request more
than once MUST have the same accounting effect as receiving it once.

Given the same ordered Events, Artifacts, schemas, and deterministic projectors, balances, budget
availability, statements, and accounting-derived routing inputs MUST replay identically.

### 5.12 Reputation and routing are derived signals

Reputation, market signals, and provisionally named information-gravity weights are contextual
`View`s. They are not assets, balances, or authoritative facts about a subject.

The expression **informational gravity** (`gravité informationnelle`) is defined by
[Informational Gravity — Contextual Attraction for Cognitive-Packet Routing](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/informational_gravity.md),
whose local working-source draft still requires human validation and publication. Until that source
is stabilized, implementations MUST treat it as an experimental Fractanet concept rather than a
stable COP invariant. Its relationship to the
[Packet Attractor](../../research/packet_attractor_fractanet.md) remains explicit: an attractor is a
capacity declaration; informational gravity is a contextual relation between one packet and one
candidate capacity.

The COP routing layer:

- MUST derive such signals only from eligible, traceable events;
- MUST state the context, time window, algorithm version, and evidence set used;
- MUST distinguish proposed, committed, settled, reversed, and disputed acts;
- MUST NOT count a reversed, invalid, duplicated, self-dealing, or unauthorized act as ordinary
  positive evidence;
- MUST NOT collapse contextual reputation into an unexplained global moral score;
- SHOULD limit feedback loops in which past attraction mechanically creates permanent dominance;
- MUST preserve alternative routing factors and the ability to audit or contest the result.

The accounting trace therefore supplies evidence to routing. It never delegates the routing decision
to a balance alone.

## 6. Minimal event families

An implementation MAY choose different names, but MUST preserve equivalent semantics.

| Event family                         | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `accounting.budget.granted`          | Establish a bounded resource authorization.                   |
| `accounting.budget.amended`          | Add, reduce, extend, revoke, or replace authority explicitly. |
| `accounting.resource.reserved`       | Exclude capacity before concurrent/asynchronous execution.    |
| `accounting.resource.released`       | Release an unused or rejected reservation.                    |
| `accounting.transaction.committed`   | Record accepted reciprocal obligations.                       |
| `accounting.transaction.settled`     | Record balanced final postings.                               |
| `accounting.transaction.reversed`    | Neutralize a prior transaction without deleting it.           |
| `accounting.observation.recorded`    | Preserve an external resource observation.                    |
| `accounting.reconciliation.asserted` | Link internal and external traces.                            |
| `accounting.dispute.opened`          | Contest a posting, mandate, observation, or settlement.       |
| `accounting.dispute.resolved`        | Record the governed outcome and any compensating acts.        |

## 7. Minimum settled-transaction payload

The following is illustrative; a versioned JSON Schema is required before implementation.

```json
{
  "transactionId": "txn_...",
  "idempotencyKey": "packet:pk_123:node:n_456:service:s_789",
  "principalId": "person:alice",
  "actorId": "packet:pk_123",
  "mandateId": "mandate:m_123",
  "budgetId": "budget:b_123",
  "purpose": "relay cognitive packet pk_123",
  "effectiveAt": "2026-07-20T12:00:00Z",
  "disclosureClass": "restricted",
  "postings": [
    {
      "postingId": "post_1",
      "accountId": "packet:pk_123:kudos-available",
      "subjectId": "packet:pk_123",
      "resourceType": "kudos",
      "unit": "KUDOS",
      "quantity": { "coefficient": "-250", "scale": 2 }
    },
    {
      "postingId": "post_2",
      "accountId": "node:n_456:kudos-received",
      "subjectId": "node:n_456",
      "resourceType": "kudos",
      "unit": "KUDOS",
      "quantity": { "coefficient": "250", "scale": 2 }
    }
  ],
  "evidenceArtifactIds": ["artifact:service-proof-s_789"]
}
```

This example specifies accounting mechanics only. It does not presume that Kudos are convertible,
fixed to the euro, legally regulated as a payment instrument, or implemented in any particular
community regime.

## 8. Kudos accounting profile

### 8.1 Doctrinal anchors

Kudos is not introduced here as an arbitrary example. It is a Corpus concept with its own sources:

- the
  [Kudos source paper](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/kudos.md)
  defines a Maussian complementary currency superposed on a real euro-denominated transaction;
- the [Kudos repository status](https://github.com/acorsica/Kudos/blob/main/STATUT.md) identifies
  the dedicated repository as doctrinal, editorial, and pre-operational;
- the [Kudos repository introduction](https://github.com/acorsica/Kudos/blob/main/README.md) states
  that the gift/counter-gift layer is public, voluntary, nominative, transparent, and traceable;
- the [Kudos concept note](https://github.com/acorsica/Kudos/blob/main/concept.md) develops
  recognition, social memory, circulation, community autonomy, and non-accumulation;
- the [Kudos glossary](https://github.com/acorsica/Kudos/blob/main/annexes/glossaire.md) defines the
  dedicated vocabulary, including complementary currency, recognition, demurrage, community,
  circulation, and velocity.

The source paper presently describes euro backing and at least partial convertibility as part of the
proposed design. Later design clarification has established that convertibility and fixed euro
parity may need to remain inactive until a lawful implementation path is available. Because that
clarification is not yet consolidated in a dedicated Kudos source document, this profile MUST NOT
pretend that the documentary discrepancy is resolved. The three modes below are an accounting
mechanism for making the active legal and operational regime explicit; they do not amend the Kudos
doctrine by themselves.

### 8.2 Trace semantics

A Kudos gift represented through COP/Accounting MUST retain the defining properties stated by the
Kudos sources:

- it is voluntary, nominative, and publicly attributable;
- it is a trace of recognition or counter-gift, not a hidden purchase record;
- its connection to a genuine euro-denominated exchange can be auditable without publishing what was
  purchased, private banking data, or unrelated transactions;
- its giver, recipient, community, governing policy, quantity, time, and delegation chain are
  explicit;
- when an agent, node, or cognitive packet gives Kudos for a principal, the public trace MUST
  distinguish the principal from the technical actor;
- circulation, demurrage, common-pool contribution, redistribution, backing, redemption, and
  cross-community exchange MUST be recorded as distinct event types rather than inferred from one
  opaque balance change.

This explicit trace allows Kudos to contribute to stigmergic guidance in the sense explored by
[Stigmergie sans limite haute](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/stigmergie_sans_limite_haute.md).
Its use by routing remains governed by §5.12 and does not turn Kudos into an unquestionable or
global reputation score.

### 8.3 Activation modes

The ledger MUST make the active community regime explicit. At minimum, it MUST distinguish:

1. `recognition_only` — public, nominative, voluntary recognition; no euro redemption and no fixed
   euro parity;
2. `reserved_nonconvertible` — a governed reserve exists, but holders have no automatic redemption
   claim;
3. `regulated_convertible` — conversion or redemption is enabled under an identified lawful
   operator, agreement, and compliance regime.

Changing mode MUST be a governed, prospective, versioned event. It MUST NOT retroactively change the
rights attached to prior Kudos.

Consistently with the democratic community framework of the
[Constitution minimale des communs](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/constitution_minimale_des_communs.md),
community-specific demurrage, common-pool distribution, weekly redistribution, eligibility, and
cross-community compensation MUST be explicit policies referenced by the relevant transactions. They
are not universal COP invariants.

The confederal model—bilateral agreements, upward subsidiarity, and cross-community clearing—does
not yet have a defining source identified by this audit. Implementations MUST therefore keep these
features disabled or explicitly experimental until that source exists and the accounting-domain
boundaries are specified.

If a regime asserts a backing rule such as “one Kudos created implies one euro reserved,” the
projector MUST expose reserve coverage separately from Kudos circulation, and conformance tests MUST
prove that unauthorized issuance cannot create apparent coverage.

## 9. Day-one Fractanet requirements

This section specializes the
[Fractanet source architecture](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md),
the
[Cognitive Packet](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)
format, and
[Cognitive Packet Switching](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packet_switching.md).

Before a cognitive packet can consume a consequential resource or influence accounting-derived
routing, the reference implementation MUST provide:

1. versioned schemas for budgets, mandates, reservations, postings, settlements, and reversals;
2. exact arithmetic and balance validation;
3. idempotent append and deterministic accounting projectors;
4. atomic reservation or an equivalent concurrency-safe mechanism;
5. mandate, expiry, and limit validation before commitment;
6. public and restricted projections with explicit redaction policy;
7. reconciliation hooks for external providers without treating external data as infallible;
8. conformance vectors covering success, rejection, retries, disputes, and replay;
9. routing inputs that cite the accounting events and algorithm version from which they derive.

A prototype that routes packets without these controls MAY be an isolated simulation, but MUST NOT
be described as a production-conformant Fractanet.

## 10. Minimum conformance tests

A conforming implementation MUST demonstrate that:

- a balanced transaction is accepted and replayed identically;
- an unbalanced transaction is rejected atomically;
- different units cannot balance without an explicit conversion;
- duplicate delivery changes no balance;
- concurrent reservations cannot overspend one budget;
- an expired, revoked, or out-of-scope mandate is rejected;
- reversal preserves the original trace and neutralizes its accounting effect;
- creation and destruction require authorized source or sink accounts;
- private purchase content does not appear in the public Kudos projection;
- a disputed or reversed reward is treated according to an explicit routing policy;
- external reconciliation preserves both the external observation and internal transaction;
- full replay reconstructs the same balances, reservations, and routing evidence references.

Regime-specific tests MUST be added for reserve coverage, demurrage, redistribution, exchange, or
convertibility whenever those features are activated.

## 11. Human arbitration and remaining openings

### 11.1 Canonical account address

The initial canonical account address is a URL. For example, `https://jhn.baronsmariani.org/` is
intended to be Jean Hugues Noël Robert's address.

The address is an identity and discovery root, not merely the location of an HTML page. The exact
resources exposed there require a separate design study. Expected possibilities include:

- a human- and search-engine-readable identity description;
- machine-readable metadata and capability discovery;
- links to public accounts, mandates, policies, keys, and service descriptions;
- an optional conversational or `chat/completions`-compatible intelligence endpoint;
- explicit content negotiation, versioning, and privacy boundaries.

No optional service is implied merely because the URL exists. Failure or absence of an intelligent
endpoint MUST NOT invalidate the stable address.

### 11.2 Lifecycle, hard real time, and proportional trace

The lifecycle MUST support extremely short acts because hard real time is not out of scope. A valid
lifecycle may be no longer than the execution of an interrupt request (IRQ).

This does not require a durable Event for every interrupt. In accordance with
[Constitution minimale des communs](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/constitution_minimale_des_communs.md)
and
[Traçabilité des actes](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/traceabilite_des_actes.md),
trace depth is proportional to consequence. For an interrupt stream, meaningful durable traces may
be limited to transitions such as:

```text
normal -> overload: excessive interrupts, node cannot keep up
overload -> normal: service recovered
```

Intermediate telemetry MAY be sampled or retained for audit and optimization. It does not become a
full consequential-act ledger unless policy, observed harm, or law requires it. The transition,
threshold, responsible policy, and any lost or deferred work MUST remain auditable.

### 11.3 Privacy, minimum disclosure, and informed consent

Disclosure follows this order:

1. disclose what applicable law requires;
2. otherwise disclose only what is necessary for the stated purpose;
3. inform the data owner of foreseeable consequences;
4. provide understandable explanations and resources so consent can be as informed as reasonably
   possible;
5. record the applicable legal basis, consent, refusal, withdrawal, or exceptional mandate.

Consent MUST NOT be inferred merely from technical access, silence, or inability to understand an
opaque notice. Public accounting proofs SHOULD minimize the private content they expose.

### 11.4 Communities as bounded cells

A community is modeled as a cell with a frontier: what is inside, what is outside, and how the two
interact must be distinguishable. The frontier may depend on personal intentions, community rules,
mandates, and external circumstances.

This applies to territorial and thematic communities and also to a personal **Society of Mind**: the
community formed by a person and their assistants or cognitive prostheses. Membership, residency,
visiting status, delegation, data flow, resource custody, and external settlement MUST not be
inferred from one another.

The frontier is governed and permeable, not an assertion of isolation. Cross-frontier acts require
explicit interfaces, policies, traces, and—where resources move—accounting-domain semantics.

### 11.5 Anti-manipulation and democratic safeguards

At minimum, anti-manipulation rules MUST be either:

- directly decided by citizens; or
- applied under maximal transparency for mandate holders, maximum lawful privacy for other users,
  traceable consequential acts, and correction without rewriting history.

Routing weights, thresholds, decay, exclusions, exploration rules, concentration safeguards, and
audit procedures are democratically decided, changeable, and auditable. A technical operator MUST
NOT silently substitute its own political judgment.

The system cannot guarantee that citizens will save themselves from every collective error. It can
guarantee that they have inspectable information, accountable mandates, reversible rules where
possible, and effective means to deliberate and correct.

### 11.6 Normal, degraded, and crisis regimes

Transitions between normal, degraded, and crisis modes MUST be bounded by **express mandates**
prepared, deliberated, and voted in advance through democratic procedures, as defined by
[Mandats express et démocratie capable de crise](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/democratie_crise_mandats_express.md).

Each transition policy MUST identify triggering evidence, authorized actors, temporary powers,
resource limits, prohibited acts, trace requirements, review, revocation, expiry, and automatic
return conditions. Crisis does not authorize an unbounded blank cheque.

### 11.7 Protocol profile versus experimental deployment

In this document, a **protocol profile** means a reusable set of optional COP semantics and
conformance rules. It does not mean a personal ideological profile and does not impose one local
regime on everyone.

The deployments chosen by Jean Hugues Noël Robert, C.O.R.S.I.C.A., or an initial community are
experiments and, hopefully, reproducible examples. Other entities remain free to duplicate, improve,
reject, or adapt them to local needs, subject to the interoperability claims they choose to make. A
system MUST NOT claim conformity to a named profile while violating that profile's stated
invariants, but nobody is required to adopt the profile.

This distinction is anti-totalitarian: interoperability is offered; political uniformity is not.

### 11.8 Validation and authorship trace

Jean Hugues Noël Robert performed the human validation and retains authority over later revisions.
OpenAI Codex contributed corpus retrieval, drafting, structuring, consistency checks, and objections
under his mandate. This contribution is disclosed in the frontmatter without transferring human
responsibility to software.

### 11.9 Consolidation required

The decisions developed in conversation must be consolidated into the sovereign documents that
define Kudos, informational gravity, communities, identity, and COP profiles. COP/Accounting should
reference those sources rather than become their substitute.

### 11.10 Confederated Kudos circulation remains exploratory

A dedicated document is needed for the confederation around Kudos circulation. It MUST initially
remain an exploratory working source, not a canonical doctrine: bilateral agreements, upward
subsidiarity, compensation, and community autonomy expose unresolved questions that require
experience and further human deliberation.

At minimum, that exploration should examine:

- how two communities establish, authenticate, amend, suspend, and terminate an agreement;
- whether Kudos cross the frontier, are wrapped, converted, cleared, or merely recognized;
- how double spending and replay are prevented across intermittently connected communities;
- who owns and controls reserves, bridge liquidity, and settlement accounts;
- how insolvency, reserve shortfall, disputed settlement, reversal, and community exit are handled;
- which community's rules apply to demurrage, redistribution, disclosure, taxation, and disputes;
- how identity assurance and Sybil resistance work without forcing universal identity disclosure;
- how exchange or compensation rates are decided without creating a hidden central bank;
- how bilateral agreements compose into longer paths without silently granting transitive trust;
- how partitions, degraded mode, crisis mode, and later reconciliation affect finality;
- how bridge operators are prevented from becoming capture points;
- how users obtain intelligible warnings about legal, financial, privacy, and irreversibility risks.

These are openings, not presumed answers. The first confederation document should map choices,
failure modes, and experiments before proposing stable rules.
