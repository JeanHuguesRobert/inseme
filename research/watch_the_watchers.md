---
title: Watch the Watchers — access-trace kernel
author: Jean Hugues Robert
date: '2026-10-07'
document_role: specification
document_kind: technical-specification
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: issue-120
  origin_date: '2026-10-07'
  derived_from:
    - https://github.com/JeanHuguesRobert/inseme/issues/120
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
language: fr
status: working-paper
---

# Watch the Watchers — access-trace kernel

This document specifies the bounded first implementation slice from Issue #120. It is not a production deployment.

## Purpose

Record requests made through an individualized artifact-access path while preserving conservative evidentiary semantics:

- `LANDING` means the individualized landing path was requested.
- `OPEN_PDF` means the explicit action toward the PDF endpoint was requested.
- `REDIRECT` means the redirect endpoint was requested.
- none of these events proves that a named human read the artifact.
- absence of an event does not prove absence of consultation through another route.

## Privacy invariants

The public token is opaque and contains no readable recipient identity. The private token-to-recipient mapping is a separate concern and MUST NOT be committed to a public repository.

The event schema is intentionally minimal:

```yaml
schema: artifact-access-event/v1
token_ref: <opaque stable identifier>
event: LANDING | OPEN_PDF | REDIRECT
timestamp: <server timestamp>
artifact_ref: <logical artifact/version ref>
```

Raw IP address, User-Agent and referrer are not part of the canonical event.

No tracking pixel, browser fingerprinting, advertising identifier, analytics identifier, cookie or local-storage requirement is introduced by this kernel.

## State machine

### REVIEW

An individualized URL may resolve to the current review representation. No definitive SHA-256 is present and no frozen coordinates are advertised.

### FROZEN

A frozen configuration must contain:

- repository;
- release tag;
- release asset filename;
- SHA-256 computed from the exact frozen bytes;
- canonical asset URL.

Every individualized path must resolve to the same immutable asset. The canonical asset URL is also exposed as a non-instrumented escape path.

Historical REVIEW events remain attached to the REVIEW artifact reference and cannot be silently relabeled as FROZEN-artifact events.

## Recipient-facing disclosure

The landing page explicitly states that the link is individualized, that minimal technical logging may occur, that this does not prove human reading, and—after freeze—that a canonical non-instrumented route exists.

## Prefetch and bots

A passive request to the landing route is recorded, at most, as `LANDING`. The explicit PDF action is modeled separately as `OPEN_PDF`. This distinction is useful but is not treated as proof of human identity or reading.

## Storage and retention

This kernel does not select a production datastore. A deployment must keep the token mapping and raw access events non-public, use append-oriented integrity where appropriate, and define a retention period tied to the evidentiary/litigation purpose rather than indefinite retention.

## Current implementation

- `scripts/watch-the-watchers.js`: pure kernel for tokens, state validation, event creation, target resolution and disclosure-page rendering.
- `scripts/watch-the-watchers.test.js`: tests for privacy, REVIEW/FROZEN separation, conservative event semantics and canonical escape path.

Production routing, datastore selection, secrets, domain/DNS and public deployment remain outside this bounded slice and require the appropriate deployment mandate.
