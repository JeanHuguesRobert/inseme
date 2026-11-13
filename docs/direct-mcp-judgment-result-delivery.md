---
title: "Direct MCP Judgment Result Delivery — COP continuation integration profile"
date: "2026-11-13"
status: "working-paper — implementation contract"
document_role: "research"
document_kind: "integration-profile"
visibility: "public"
lifecycle_state: "active"
license: "CC BY-SA 4.0"
---

# Direct MCP Judgment Result Delivery — implementation profile

**Canonical ownership:** Inseme #113 owns recognition and acceptance; #85 owns ExecutionBinding/ExecutionReceipt; #121 owns parallel claims; #165 owns generic consumption; #161–164 own accounting; Cogentia #330 owns conversational-browser integration; Cogentia #291 owns navigation.

## 1. FBF finding: don't mint a second result protocol

The existing #113 semantics already specify:
`observed ≠ correlated ≠ attributed ≠ schema-valid ≠ accepted ≠ returned ≠ resolved ≠ assimilated`.

The direct MCP delivery path must be another **normalized COP event/trace ingress**, not a privileged `continuation.resolve` shortcut. The `cogentia.continuation.v2` schema currently says `Resolution is not proof of delivery`. A direct `continuation_resolve(id, decision)` call alone does not demonstrate a durable, independently correlated receipt. Do not widen that tool's semantics silently.

Only the *transport* differs from the existing GitHub-comment ingestion/reconciliation proof. The same generic recognizer should consume resulting COP events.

## 2. Proposed compatibility interface (not yet implemented)

An authorized MCP tool for a conversational processor may expose a discoverable descriptive name such as `continuation.result.submit`. The name is provisional, not a new normative COP entity or a promise of live exposure. In the implementation, prefer existing result-ingress and Event primitives.

Minimal submission JSON:

```json
{
  "protocol": "cop.continuation-result-submit/v0",
  "continuation_id": "ctn_example",
  "attempt_id": "attempt_example",
  "execution_binding_ref": "binding_example",
  "continuation_version": "version-observed-on-claim",
  "idempotency_key": "attempt_example:result:0",
  "result_digest": "sha256:<canonical-payload-hash>",
  "step_result": {
    "status": "success",
    "result": {"answer": "The selected classification"}
  },
  "evidence_refs": [],
  "usage_observation": {
    "source": "agent_self_report",
    "estimated": true,
    "unit": "unknown",
    "quantity": null
  }
}
```

The authenticated MCP transport identity is server-observed metadata, **not** a field accepted on trust from the model. An optional correlation challenge is not a mandate. An execution binding is not authority. Do not send untrusted effect commands in the result.

**Return on durable write, not merely receipt of HTTP bytes:**

```json
{
  "accepted_for_processing": true,
  "receipt_ref": "opaque-durable-event-reference",
  "duplicate": false,
  "candidate_status": "observed",
  "continuation_status": "not-yet-resolved"
}
```

If server persistence cannot be confirmed, return an uncertain/transient error; caller retries **same submission with same idempotency key and digest**. Repeated identical submissions return the same logical receipt. Reuse of the same key with a different digest is a conflict. Store the key scoped to the relevant continuation/attempt/actor, not as a global unbounded claim.

## 3. Distinct phases and responsibilities

1. **Admission:** COP checks current Principal/actor, delegated read/result-return capability, privacy disclosure, reservation/quota, and active claim. This is not implied by a valid MCP session.
2. **Dispatch:** scheduler chooses a reachable provider/channel explicitly permitted for automation; creates/reuses durable ExecutionBinding and bounded claim lease, emits a packet projection with expected_result and return instructions.
3. **Model processing:** conversational JudgmentHandler reasons. Browser extension, if used, transmits the job only; it is not the result parser.
4. **Submission:** agent invokes the authorized MCP tool to submit its candidate result and receives a durable acknowledgement.
5. **Recognition:** normalized COP Event -> correlate continuation/attempt/binding/version -> check result schema/provenance/mandate/effects -> propose acceptance/rejection Events.
6. **Commit:** canonical state transition under optimistic locking/CAS; accepted candidate may return to original continuation slot; resolving/assimilating is a separate lifecycle decision.
7. **Accounting:** record provider/channel, observed or estimated unit, reservation and settlement/release under existing COP Accounting. Never infer exact tokens from web-visible text.
8. **Redispatch:** an accepted final state or an explicit new runnable continuation signals the existing generic consumer (#165/#166); no local conversational loop is required.

## 4. Exceptional states

| Situation | Required behavior |
| --- | --- |
| Ack lost after durable submission | Exact idempotent replay yields same receipt, no double accounting |
| Two workers claim same continuation | #121 claim/CAS winner only; loser may report progress but cannot commit stale resolution |
| Late response after changed continuation version | Persist observation as evidence, reject or re-evaluate candidate; never overwrite newer work |
| Active browser but no MCP delivery | Browser heartbeat indicates connectivity only; do not infer useful progress |
| MCP unavailable | Retry boundedly; if necessary route through separately authorized observable channel (e.g. existing GitHub #113), not blind DOM extraction |
| Provider quota, retry-after, lockout | Stop submissions on this channel, settle consumed resources, cool down, reroute if mandate permits |
| Agent blocked by judgment or authorisation gate | Structured `needs_acceptance` or new continuation, no fake success |
| Invalid or contradictory result | Store rejection trace; preserve original continuation and associated evidence |
| Job exceeded deadline/budget | Release/settle valid reservations; cancel lease and quarantine late outcomes |
| Provider channel disallows automated access | No automated dispatch on that channel, regardless of available account/quota |

Distinguish `session_alive`, `claim_lease_alive`, `progress_observed`, `result_persisted`, `result_accepted`. A lease renewal must be bounded by its mandate, maximum runtime and budget; repeated heartbeats cannot extend the maximum indefinitely.

## 5. Fair Usage and evidence schema

The companion [provider analysis](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/integration/conversational_agents_fair_usage_cop_2026-11-13.md) governs the channel permission test.

At minimum, record: `provider`, `channel`, `plan_class`, `channel_permission_basis`, `policy_source_version`, `request_count`, observed quota/error/reset information, actual usage if provider supplies it, estimate method otherwise, `budget_reservation_ref`, `accounting_event_ref`, `receipt_ref`, `time_range`, `evidence_quality`. Keep secret credentials and private content out of public source/traces. Balanced journal entries do not alone authenticate provider-side consumption.

Policy gate: `channel_permitted && mandate_valid && budget_reserved && claim_valid`. The *fairness* budget is a further constraint, not an override for provider restrictions.

## 6. Minimal executable acceptance tests to implement in existing owners

- Same candidate twice -> one durable logical receipt and one accepted transition.
- Same idempotency key, changed digest -> explicit conflict.
- Submission stored but acknowledgment lost -> retry yields original receipt.
- Wrong continuation ID, wrong binding, stale version, absent mandate -> rejected or quarantined with evidence, not resolved.
- Multiple processors race -> CAS claim arbitration; late result archived without unauthorized overwrite.
- Agent returns `needs_acceptance` -> remains nonterminal until legitimate approval.
- Browser reports alive but no progress/result -> timeout/reassignment after lease and budget policy.
- Quota/circuit-breaker and provider policy denial -> no new dispatch.
- Three harmless continuations -> sequential and parallel progress on at least two simulated handlers; accounting debit/credit balanced and replay consistent.
- A *live* test on an externally authorized provider channel separately proves MCP visibility, durable ack and second dispatch. Unit simulations are not live evidence.

## 7. Source check and next implementation boundary

Source inspected: `packages/cop-kernel/src/continuation.js` contains continuation descriptors, retry behavior, message attachment and resumption. `packages/cop-core/src/github-delivery-replay.js` is GitHub-specific ingress replay, **not** a generic MCP delivery tool. Inseme #113 already forbids notification -> direct mutation.

Implement first the smallest provider-neutral **normalized result ingestion** adapter against the existing COP event store and recognizer, with unit tests; only add an MCP callable tool after its mandate and accounting hooks are known. Avoid a second database, scheduler, inbox, ontology, or browser-side response scraper.

**Current status (2026-11-13): specification drafted; no implementation/live Reality Test is claimed here.**
