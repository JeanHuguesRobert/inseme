---
title: "Issue 121 — Portable Handler Resume"
date: "2026-10-09"
document_role: operational
document_kind: continuation
visibility: public
lifecycle_state: working
---

# Portable handler resume — Inseme #121

**Packet:** https://github.com/JeanHuguesRobert/inseme/issues/121

**Canonical guidance:** https://github.com/JeanHuguesRobert/cogentia/blob/main/docs/portable-agent-guidance-and-classification.md

**Instructions:** https://github.com/JeanHuguesRobert/inseme/blob/main/AGENTS.md and https://github.com/JeanHuguesRobert/cogentia/blob/main/instructions/AGENTS.shared.md

## First minute

1. Refresh live issue #121 and the default-branch head, read applicable instructions. Avoid trusting the snapshot in this page as current.
2. Declare your actual execution surface, Corpus read access, repository mutation scope, state durability, claim fencing, and evidence level. Unknown is not verified.
3. Check whether the requested change already exists; do not rebuild F1/F2/F4 or invent normative COP changes.
4. Choose one bounded next operation with an observable result. If tool blocked, leave a durable continuation instead of claiming success.

## Verified evidence and its boundaries

- F4.1: GitHub file stale SHA rejected: https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6076916487
- F4.2: separate authority and target resources permitted stale target write, then corrected: https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6076991617
- F4.3: same GitHub file version boundary rejected stale snapshot: https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6077048896
- F4.4: current SHA did **not** enforce semantic holder/epoch: https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6077259774
- F4.5: local reference gateway tests **5/5 passed**, receipt https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6077504144 ; source `scripts/local-governed-effect-gateway.js`, `scripts/local-governed-effect-gateway.test.js`. **In-memory only**; not a secured network gateway or provider-side authority fence.

## Portability contract (read and report, do not silently extend authorization)

```yaml
schema: cogentia.handler-resume-brief/v0-experimental
packet: https://github.com/JeanHuguesRobert/inseme/issues/121
objective: verify the smallest real governed effect boundary
role: handler
required_outputs:
  - capability_truth
  - changed_artifact_or_explicit_no_effect
  - test_or_provider_receipt
  - residual_risk
  - smallest_next_action
concurrency: optimistic_refresh_and_reconcile
restrictions:
  - no_claim_of_distributed_atomicity_without_provider_receipt
  - no_direct_business_effect
  - no_mandate_widening
  - no_normative_COP_rewrite
```

## Handler-adapter selection

| Execution family | Delivery | Explicitly unavailable guarantee |
|---|---|---|
| Chat/conversational | Issue URL and short instruction brief; use connected GitHub tools if present | Conversation history is not an authoritative shared Store |
| Coding CLI (Codex/Claude/Grok etc.) | Repo `AGENTS.md`, path-scoped `SKILL.md`, issue URL | Model name alone proves no access or provider fencing |
| GitHub typed Compute | `cop.compute-request/v1` and issue result receipt | Standard current node-test profile is read-only, not a GitHub effect gateway |
| Agent JHN / service handler | Bounded Mandate + actual capability registry + Packet | Harness existence is not proof of deployed live mandate fencing |
| Human principal | Decision brief with evidence and a specific unresolved hard boundary | Human review does not magically create cross-provider atomicity |

## Next small implementation choice

Before writing a production gateway, identify one actual mutation endpoint and test whether:
(a) all relevant writers must pass through it; (b) authority/epoch is checked and enforced at the provider commit boundary; and (c) idempotent replay produces a durable receipt. If bypass remains possible, classify as **advisory preflight** and keep effects synthetic or low-Exposure. Prefer an existing gateway/adapter over introducing a second control plane.

## Short final report

State: baseline commit; actual handler and access; action attempted/committed; tests and receipt URLs; costs observed/estimated/unknown; conflicts and correction; remaining guarantee gap. Preserve incidental observations without creating extra work.
