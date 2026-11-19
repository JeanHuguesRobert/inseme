---
title: "COP — Work assignment, commissioning and lazy legacy reconciliation"
date: "2026-11-19"
last_modified_at: "2026-11-19"
version: "0.1"
status: "operational pilot — core projection and one task-step activation path"
document_role: "operational"
document_kind: "implementation-note"
visibility: "public"
lifecycle_state: "working"
license: "CC BY-SA 4.0"
language: "en"
update_policy: "UP-DEFAULT-REVIEWED"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/docs/work-assignment.md"
provenance:
  origin_type: "conversation"
  origin_repository: "JeanHuguesRobert/cogentia"
  origin_ref: "https://github.com/JeanHuguesRobert/cogentia/issues/341"
  origin_date: "2026-11-19"
  derived_from:
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/agent_work_turn_metacognition.md"
    - "https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_zero_draft.md"
review:
  status: "unreviewed"
  reviewed_by: []
---

# Work assignment in the COP EventStore

A *work item* (existing Cognitive Packet / Continuation) has a **single
responsible logical agent**, independent of its current handler, session,
PacketClaim, physical host, or external GitHub assignee. It also records the
**commissioning logical agent** for whom the work is performed. At the root
only, a **Principal** directly commissions a Root Agent; there is no fictional
super-agent above a living or institutional Principal.

The implementation is a **derived projection of events already in COP**:
`cop.packet-work-assignment/v1`. No new backlog, scheduler, SQL table,
permission broker or parallel mandate is created.

## API and events

- `assignPacketWork(store, {packet_ref, assignment_id,
  responsible_agent_ref, commissioned_by_agent_ref,
  commissioned_by_principal_ref, expected_revision, source_ref})` —
  initial assignment or versioned transfer in **one** canonical transaction.
  Exactly one of the two commissioner references must be present, and an
  agent may not commission its **own** work as a distinct delegate.
- `projectPacketWorkAssignment` — pure reconstruction of current assignment,
  history, revision and receipt.
- `ensurePacketWorkAssignment` — lazy, idempotent migration upon activation,
  from explicit typed historical fields and/or the responsibility of a single
  already-assigned parent packet.
- `listPendingWorkAssignmentJudgments` — current unresolved historical work
  from the **same** COP journal (not another queue).
- `preparePacketWorkAssignmentJudgment` /
  `runPacketWorkAssignmentJudgment` — read/propose through an **injected,
  existing** JudgmentHandler (LLM or human). Candidate is non-authoritative.
  The admitting handler still needs the real COP Mandate and a recorded
  disposition before calling `assignPacketWork`.

New `declarePacketTaskSteps` callers can supply `work_assignment`; the
plan and the first assignment are committed atomically. Existing callers
continue to work without any new required fields.

`advancePacketTaskStep` now reconciles the assignment **inside the same COP
transaction** as step advancement. If sufficient explicit evidence is known,
it records `assigned` automatically. Otherwise it writes exactly one
`judgment_requested` event, returns
`work_assignment_status: "needs_judgment"`, **and lets the previously
supported work continue**. The old execution path remains backward compatible.

## Rules for old work

1. Do not convert `workerHandlerName`, Github Issue `assignee`,
   process identity, `PacketClaim`, topic creator or Principal into a
   responsible **logical agent**. They are not equivalent.
2. Typed `assignedLogicalAgentRef` plus explicit
   `commissionedByLogicalAgentRef` / `commissionedByPrincipalRef` from a
   cited source may be sufficient.
3. If the child has **exactly one** linked parent with a proven assignment,
   its parent's *responsible* logical agent supplies a candidate commissioner.
   It **does not** supply the child's responsible agent or mandate.
4. Conflicting or incomplete evidence remains `needs_judgment`; one
   deterministic request is emitted, not one per resumed Turn.
5. A Judgment model must return explicit agent references, an explanation,
   source references and a confidence label — **or** `undetermined`. An LLM
   output is recorded as `judgment_proposed`, not as an assignment or
   authority grant. The caller must enforce evidence disclosure and
   the actual admission/mandate contract before committing a decision.
6. The assignment ledger is not the authority ledger. COP Mandate and
   budget checks remain independent for every real action.

## Pilot limitations / next integration

This patch implements the **core EventStore profile** and integrates it
into the packet-backed Task/Step activation path. Existing Github Issues,
`cop_tasks` SQL rows, and legacy `cogentia.continuation.v2` files are
**not bulk-migrated**, and consumers that do not use this activation path are
**not automatically upgraded**. The Judgment callback is provider-neutral,
not an autonomous connection to an LLM: the existing COP/JudgmentHandler
routing needs to consume these requests and report admitted results. That
integration belongs to [Cogentia #341](https://github.com/JeanHuguesRobert/cogentia/issues/341)
and [Inseme #194](https://github.com/JeanHuguesRobert/inseme/issues/194).

Reality tests in `test/packet-work-assignment.node-test.mjs` cover:
deterministic restoration; unique-parent inference; ambiguous legacy work;
a model-proposed candidate without automatic ownership; root Principal
boundary; idempotence; single-owner CAS between two SQLite connections;
replayable step activation; and atomic new-plan assignment.
