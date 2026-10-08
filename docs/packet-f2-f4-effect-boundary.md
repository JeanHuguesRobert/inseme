---
title: "F2 snapshot and F4 effect-fence reference seam"
date: "2026-10-08"
document_role: operational
document_kind: implementation-guide
visibility: public
lifecycle_state: working
---

# #121 F2 and F4: distinguish results from effects

The provider-independent helpers are in `scripts/packet-effect-fence.js`.

**F2:** `observePacketSnapshot` records the packet generation observed when a computation starts. It does not acquire a mutation claim; concurrent calculation and observation remain admissible. A later result may be historically valid without being the latest candidate.

**F4:** `checkPacketEffectFence` rejects an expired/superseded claim, a mismatched expected generation, and a previously recorded idempotency key. A passing result is `EFFECT_PREFLIGHT_VALID`, **not** a mutation authorization or evidence that the external effect occurred.

A durable production mutation MUST check and commit claim epoch, generation, target resource expected revision, idempotency and mandate at one authoritative effect boundary. Read/check in JavaScript then a later independent Gmail API call is susceptible to TOCTOU and cannot be labeled an atomic fence.

## Gmail as a separate effect boundary

Markdown→Gmail draft transformation remains a standalone Ubikia capability. When a packet happens to request it, the coordinator may attach causal references to the adapter result. The Gmail connector must separately identify the unique draft, avoid unintended creation/sending, and guard against overwriting a newer draft. A GitHub Packet claim alone cannot prevent an unrelated Gmail client from editing that draft. Where Gmail lacks an atomic conditional-write API, do **not** falsely claim strict cross-client serializability; rely on a bounded serialized adapter owner plus explicit readback/conflict detection, and surface residual races.

## Validation

Test fixture: `scripts/packet-effect-fence.test.js`; scenarios are snapshot generation, current claim, takeover and stale claim, mismatched generation, and idempotency replay. This is a synthetic reference test, not a distributed storage or Gmail delivery proof.

- https://github.com/JeanHuguesRobert/inseme/issues/121
- https://github.com/JeanHuguesRobert/inseme/issues/120
