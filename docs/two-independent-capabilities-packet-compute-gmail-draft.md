---
title: "Two independent capabilities: Packet Compute and Markdown to Gmail Draft"
date: "2026-10-08"
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
---

# Capability contracts: independent by construction

## Capability A — `cognitive_packet.compute`

Owner: `inseme`. Its input is a resumable packet reference, requested computation and retrievable immutable source references. It returns a correlated compute result, provider ExecutionReceipt, evidence/artifact references and a handler-resumable return state. The provider may be GitHub Actions today or another compute provider later.

A successful compute invocation is **not** equivalent to progress or completion of the Cognitive Packet; a handler interprets results and records the resulting continuation. Capability is not mandate; budget is not capability.

Existing implementation: `scripts/github-compute-request.js`, `scripts/github-compute-execute-program.js`; provider-neutral byte verification `scripts/packet-artifact-handoff.js`. A packet identity may parent multiple computation IDs. Reuse rather than duplicate existing COP/Magistral semantics.

## Capability B — `markdown.to_gmail_draft`

Owner of document derivation and planner: `ubikia`; external Gmail side-effect adapter: an authorized Gmail-capable runtime/connector.

Input: Markdown bytes or retrievable Markdown artifact, Gmail account context, recipient and subject, explicit `create|update|upsert` operation. **No Packet or Compute reference is required.** Pure planning is implemented in `ubikia/src/gmail/markdown-draft.js`: unique subject+recipient matching, duplicate refusal, `must_not_send`, and Markdown SHA-256. It does not invoke Gmail and cannot claim persisted-byte equality.

After planning, the external adapter uses the authorized Gmail connector to mutate an existing draft or create one only where explicitly permitted; then it performs provider readback, reports `updated|unchanged|blocked` plus evidence and never sends. Exact MIME fidelity remains a separate test. Gmail account/draft identifiers must not be promoted to public canonical packet attributes.

## Optional composition

`Cognitive Packet` → invoke Capability A → check artifact bytes/hash → invoke Capability B → record adapter outcome in Packet Return.

A user may also invoke Capability B directly with an ordinary Markdown. Or Capability A may produce numerical data, code, charts or any other artifact without Gmail.

## Empirical boundaries

- Compute/Ubikia document production and independent Gmail update of the existing draft have been observed.
- The generic handoff module has been written, but completion of its latest submitted remote test must be checked before declaring success.
- The `markdown.to_gmail_draft` pure planner has been written and a GitHub Actions test requested; the Gmail side-effect adapter remains connector-mediated, not an unattended Ubikia service.
- No email is sent by either capability without a distinct governed send operation.

Related: https://github.com/JeanHuguesRobert/inseme/issues/120
