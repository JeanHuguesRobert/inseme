---
title: "FractaLog Act catalogue"
date: "2026-09-07"
status: experimental
document_role: implementation-profile
document_kind: protocol-profile
visibility: public
related_issue: "https://github.com/JeanHuguesRobert/inseme/issues/59"
---

# FractaLog Act catalogue

This is the initial, versioned catalogue for recording acts through COP and FractaLog. It makes the
scope explicit before individual subsystems are instrumented. It is a profile over COP; it does not
replace the generic COP model or make the JHN instance part of `cop-core`.

## 1. Rule of scope

Every **semantic Act** performed by a Twin, a hosted Twin, a LogicalAgent, or a handler on their
behalf SHALL be traceable. A semantic Act is a request, decision, external effect, or durable state
transition that can matter to a Principal, another party, replay, responsibility, or later
reconstruction.

This does **not** mean storing every low-level UI or transport signal as a separate Act. Repeated
mouse moves, focus events, retries, and polling samples may be retained as a bounded raw artifact or
an aggregate observation when useful. They are not automatically independent Acts. The resulting
trace must still make a consequential Act intelligible and reconstructible.

The normal governed chain remains:

```text
CapabilityInvocation -> Act -> Trace -> Imputation
```

`Trace` is expressed with the COP trace primitives where applicable: `TraceRef`, `TraceDescriptor`,
native `TraceObservation`, and (separately) Assertions and EvidenceRelations. A provider
acknowledgement is evidence of a delivery or accepted request; it is not by itself proof of an
external effect.

## 2. Canonical FractaLog document

Each FractaLog entry has one canonical, versioned document. In PostgreSQL it is stored as
`document jsonb`; in a local SQLite outbox it is stored as canonical JSON text. Relational columns
are selected projections used for routing, integrity checks, access control, and query. They never
replace the document as the most complete retained account.

```json
{
  "schema": "fractalog.act-record/v1",
  "record_id": "flr:...",
  "act_kind": "navigation.draft.insert",
  "act_phase": "attempt|committed|failed|refused|observed",
  "governed_chain": {
    "principal_ref": "twin:jhn",
    "owner_instance_id": "...",
    "on_behalf_of_instance_id": null,
    "logical_agent_ref": "agent:jhn",
    "handler_instance_ref": "handler:...",
    "mandate_ref": "mandate:...",
    "capability": "navigation.draft.insert"
  },
  "trace": {
    "trace_ref": {},
    "descriptor": {},
    "observation": {}
  },
  "effect": {},
  "authority": {},
  "integrity": { "document_hash": "sha256:..." },
  "time": {},
  "links": []
}
```

Fields not yet projected remain in `document`; later migrations may add or rebuild projections
without losing them. `metadata` is reserved for genuinely auxiliary operational data, not as a
substitute for the canonical document.

Internal references use JSON Pointer strings (for example `#/trace/trace_ref`) and external
references use stable, declarative identifiers such as `urn:` or a resolved `TraceRef`. References
never imply permission to fetch, execute, or disclose their target.

## 3. Required identities and phases

Every record SHALL identify, where known:

- the storage owner (`owner_instance_id`): the instance that consolidates it;
- the represented target (`on_behalf_of_instance_id`): null for the owner itself, otherwise the
  hosted instance for whose account the Act occurred;
- Principal, LogicalAgent, HandlerInstance, mandate, capability, node/origin, correlation, and
  idempotency key;
- the temporal distinction between attempted, committed, refused/failed, and externally observed
  effect.

An implementation may emit several entries for one logical Act. The stable `act_id`, correlation,
causation, and trace references tie them together. Corrections and later observations append
entries; they never rewrite an older claim of fact.

## 4. Initial batches

The catalogue is deliberately expanded in batches. A batch is complete only when its listed acts
have a descriptor, an admissibility point, a trace shape, and a small conformance test or reality
test. It is not complete merely because its names appear in this document.

| Batch | Family                  | Initial Act kinds                                                                                                                                                                                                           | Boundary / expected trace                                                                                                                               |
| ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | FractaLog substrate     | `fractalog.record.append`, `fractalog.outbox.enqueue`, `fractalog.outbox.forward`, `fractalog.receipt.record`, `fractalog.projection.rebuild`                                                                               | Local durable append, central acceptance/rejection receipt, idempotent forwarding and verifiable projection.                                            |
| 1     | Navigation assistance   | `navigation.page.observe`, `navigation.clipboard.capture`, `navigation.clipboard.write`, `navigation.draft.insert`, `navigation.tab.create`, `navigation.tab.activate`, `navigation.tab.close`, `navigation.script.execute` | Browser/clipboard effects and page observations; scripts and raw DOM evidence are bounded artifacts, never implicit publication authority.              |
| 2     | External communication  | `publication.draft.create`, `publication.draft.revise`, `publication.compose.insert`, `publication.publish.request`, `publication.publish.observed`, `publication.edit.request`, `publication.delete.request`               | Explicit channel, target locator, visibility, content/artifact hash, mandate and provider/UI receipt; publication observation is distinct from request. |
| 3     | Civic collaboration     | `wiki.page.create`, `wiki.page.revise`, `proposal.create`, `proposal.revise`, `vote.cast`, `delegation.grant`, `delegation.revoke`, `moderation.decide`                                                                     | Instance-scoped authority, actor/Principal distinction, immutable source revision and resulting civic state projection.                                 |
| 4     | Instance and operations | `instance.configure`, `credential.use`, `deployment.request`, `deployment.observe`, `schema.migrate`, `domain.configure`, `data.export`                                                                                     | Higher-exposure effects; record authority, approval/review evidence where required, provider receipt and post-effect observation.                       |
| 5     | Hosting and federation  | `hosted-agent.invoke`, `interinstance.message.send`, `interinstance.message.receive`, `hosted-instance.configure`                                                                                                           | Owner vs on-behalf identity, routing, capability boundary, delivery and acceptance evidence.                                                            |

Additional kinds enter a batch before implementation whenever a new semantic effect is discovered.
The catalogue may be reclassified later; raw traces and stable identifiers must remain available for
that reconstruction.

## 5. First reality test

The first vertical test is intentionally non-engaging: import the already observed Facebook
appearance plus a bounded Navigation Assistant observation through Batch 0. It verifies the local
outbox, central ingress, projected identities, idempotency, and receipt path without publishing
anything new.

External publication instrumentation follows only in Batch 2. It must preserve the distinction
between a local draft, an insertion into a compose field, a publish request, and a verified public
appearance.

## 6. Evolution and recovery

`fractalog.act-record/v1` is an experimental versioned profile. A schema change adds a new version
or a compatible optional field; it does not silently alter the meaning of retained documents.
Reprojection is recoverable from documents and immutable artifacts. Outbox retries are at-least-once
and require an idempotency key plus a durable central receipt.

This is a living catalogue: absence from the current table means `not_catalogued_yet`, not
`not_an_act` or `impossible_to_trace`.
