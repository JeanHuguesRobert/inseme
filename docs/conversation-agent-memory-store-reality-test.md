---
title: "Conversation-Agent Memory as a Candidate COP Store"
date: "2026-10-08"
document_role: operational
document_kind: research-protocol
visibility: public
lifecycle_state: working
---

# A third storage surface: memory available to a conversational agent

## Discovery / hypothesis

Beyond a durable external COP Store or a file in ChatGPT Library, conversational agents can sometimes recover context from previous exchanges by means of conversation history, persistent personalization memory, summaries and retrieval. This can serve as an *agent-accessible continuity surface*. It has not yet demonstrated the semantics required of an authoritative durable store.

**Distinguish four surfaces**:
1. Current conversation window: volatile context; context eviction/truncation possible.
2. Cross-conversation agent memory / retrieval: user-specific, synthesized or selected, asynchronous and potentially lossy; not a guaranteed exact byte-preserving database.
3. Conversation history / files: inspectable source records, dependent on availability and access; separate from extracted memory.
4. Explicit Library files: concrete user-controlled artifact repository, retrievable as files when accessible; not equivalent to implicit memory.

No assumption that an agent can force arbitrary structured items into personalization memory, enumerate every memory item, make atomic compare-and-swap updates, provide retention guarantees, or schedule background execution. An assistant's claim that it 'remembers' does not establish durability.

## Role in store-and-forward

Possible role: *discovery, hint, index, continuity pointer, recovery aid* for a deferred effect. The authoritative full effect payload, provenance, content digest, authority/budget references, validity, supersession and receipts should remain stored in a verifiable durable artifact/store where correctness matters. Memory should ideally hold only a minimal pointer and retrieval instructions; no credentials or unnecessarily sensitive contents.

Never execute a remembered intention by itself. The handler MUST:
1. resolve the canonical envelope by stable reference;
2. verify digest, source, identity/mandate, budget, valid-time, idempotency, Packet claim and target current state;
3. re-evaluate satisfaction by another agent, revocation and supersession;
4. recheck atomically at provider effect boundary where supported;
5. record a new receipt and prevent stale replays.

A memory entry that survives while its referred effect becomes obsolete is a **stale index** rather than an executable instruction.

## Reality Test protocol (not yet executed)

- E1: create a synthetic non-sensitive, unambiguous unique packet pointer and canonical JSON artifact with checksum in a verifiable store.
- E2: in another conversation, without pasting its content, ask the agent to retrieve the pointer and explain the canonical source; record recall fidelity and latency, including failures/false positives.
- E3: change only the canonical artifact state to `satisfied_elsewhere` or `superseded`; confirm the agent does not execute the old remembered intent.
- E4: repeat with multiple independent agents to test competing continuations, without real third-party mutations.
- E5: explicitly test deletion/forgetting and access limitations; determine what happens if history or Library is unavailable.
- E6: only if successful, test an authorized, idempotent benign action with a provider receipt.

Metrics: exact-reference retrieval, fidelity, freshness, false-positive recovery, observed persistence horizon, user-control/deletion, portability across agents, confidentiality, duplicate-effect safety, failure diagnosis. Record `not_estimated` for unobservable properties.

## Provisional decision

Conversation-agent memory is a *candidate non-authoritative Store/Index capability*, not yet an authoritative durable effect queue. Its value may be high as a low-friction human-agent continuity interface. This is not a claim that the underlying product offers transactional persistence, automatic recall, exact retention, or reliable background processing.

Issues:
- https://github.com/JeanHuguesRobert/inseme/issues/120
- https://github.com/JeanHuguesRobert/inseme/issues/121
- https://github.com/JeanHuguesRobert/inseme/issues/89
