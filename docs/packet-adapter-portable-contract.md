---
title: "Issue 121 — Portable Packet ↔ adapter contract (progressive profile)"
date: "2026-10-09"
document_role: research
document_kind: interface-contract
visibility: public
lifecycle_state: working
---

# Portable Packet ↔ adapter contract — progressive profile

## Purpose and precedence

A **Packet** owns intent, authority requirements, effect identity, recovery expectations and receipts. An **adapter** declares and implements the guarantees of an execution provider. Neither an LLM conversation nor an adapter's self-reported capabilities establishes authority. This is a **working experimental interoperability contract**, not a COP-core normative amendment.

Reuse [packet coordination](../packages/cop-core/src/packet-coordination.js), [local reference gateway](../scripts/local-governed-effect-gateway.js), [effect preflight](../scripts/packet-effect-fence.js), and the [F4.1–F4.4 provider tests](../research/reality-tests/). Do not create a second mandate ontology.

## Packet request (minimal candidate `cop.packet-adapter-request/v0`)

```json
{
  "schema": "cop.packet-adapter-request/v0",
  "packet_ref": "packet:example",
  "operation_id": "effect:unique",
  "mode": "MUTATE",
  "claim": {"claim_id": "claim:1", "handler_ref": "agent:A", "epoch": 2, "expected_generation": 3},
  "authority": {"mandate_ref": "mandate:example", "mandate_revision": 7},
  "target": {"provider": "github", "resource": "repo:path", "expected_version": "blob-sha"},
  "effect": {"kind": "replace-text", "payload_ref": "artifact:example"},
  "idempotency_key": "effect:unique",
  "exposure": {"classification": "bounded-synthetic", "recovery_ref": "artifact:rollback-plan"}
}
```

This is a *shape example*, not an authorization to mutate GitHub. Actual adapter requests MUST be justified by real mandate, provider scope and budgets. Do not treat a merely present `authority` object as evidence that the mandate remains valid.

## Adapter capability declaration

```text
observe(target) -> {observed_version, provider_receipt}
prepare(request, snapshot) -> {accepted | rejected | deferred, reasons}
commit(request, verified_context) -> {committed | rejected | uncertain, provider_receipt}
reconcile(operation_id) -> {committed | absent | uncertain, evidence}
```

Adapters MUST **truthfully declare**, per operation, their observed guarantees: `target_cas`, `atomic_authority_and_target`, `durable_idempotency`, `provider_enforced_epoch`, `reconcile_receipt` (each `verified | unsupported | unknown`). An adapter must refuse to advertise `verified` from a mere caller-side preflight. Avoid inferring provider guarantees from schema fields.

## Agent classes and adapters

| Handler class | Packet interface | Required adapter |
|---|---|---|
| Human principal | decision, mandate, dispute resolution, trace | user-facing manual relay with explicit acknowledgement |
| Conversational agent (ChatGPT or similar) | propose/inspect/observe; action only via authorized tool | tool-specific GitHub/Supabase adapter |
| Code agent on GitHub Actions | bounded test/build/commit, receipt | GitHub Actions runner + scoped token |
| Persistent local or hosted service (Fractanet scheduler) | durable claim, commit, reconciliation | persistent Store and provider gateways |
| Untrusted/external specialist model | evidence or candidate artifact only | no-effect submit/review adapter |

Classifications describe **capability and trust boundary**, not brand rankings. A provider may fall in several classes depending on the invocation and token scope.

## GitHub adapter: what is already observed

Real experiments in #121 demonstrate:
- GitHub Contents API **rejects stale blob SHA** on the same file (HTTP 409).
- When authority and target are different files, fresh target SHA permits an old handler to write after authority changed elsewhere.
- One-file CAS prevents a *stale snapshot* from overwriting a newer combined blob, but **does not reject a semantically unauthorized writer with current SHA**.
- Correcting an unintended synthetic write by successor commit is possible; it does not erase the intermediate effect.

Therefore initial GitHub adapter declaration:
```json
{
  "target_cas": "verified",
  "atomic_authority_and_target": "unsupported",
  "durable_idempotency": "unknown",
  "provider_enforced_epoch": "unsupported",
  "reconcile_receipt": "verified"
}
```
`atomic_authority_and_target` refers to **semantic validation** at commit, even if authority and payload occupy one file; GitHub Contents does not interpret the authority fields.

## Progressive routing rule

1. **OBSERVE / SNAPSHOT**: concurrent, no lock; record source version.
2. **Low-Exposure GitHub mutation**: require explicit current mandate check through a controlled adapter, SHA CAS, inspectable diff, idempotency/recovery plan and receipt. Report as `preflight_checked`, **not** `atomic_authority_enforced`.
3. **Consequential mutation requiring revocation-safe fencing**: do not claim authorization safety through GitHub CAS alone; route to an adapter with verified provider-enforced authority+effect boundary, or request human decision/reduce scope.
4. **Conflict**: reconcile against fresh state; don't blindly overwrite. Record original effect, correction and residual consequences.
5. **Uncertain provider response**: query durable receipt before retry; avoid claiming exactly-once.

## Next discriminating test

Conformance test a *portable* router against an adapter's declared capabilities: refuse `atomic_authority_enforced` when GitHub advertises only CAS; allow a bounded optimistic route with honest receipt; reject a simulated stale mandate even when target SHA is current. Then, if the available GitHub connector permits, exercise a harmless Contents update and verify its HTTP 409 collision behavior independently. Do not expose or copy credentials; a scripted local test is not a substitute for a provider-side write.
