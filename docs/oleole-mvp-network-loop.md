---
title: Olé Olé — MVP network loop addendum
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: normative MVP addendum
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: documentation
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Olé Olé — MVP network loop addendum

Status: normative MVP addendum  
Date: 2026-08-13  
Parent specification: [`docs/oleole-mvp-spec.md`](./oleole-mvp-spec.md)  
Implementation issue: [#46](https://github.com/JeanHuguesRobert/inseme/issues/46)

## Purpose

Olé Olé depends on a network effect. Low-friction invitation, continuity of use and installability are therefore part of the service capability, not a separate marketing subsystem.

This addendum extends the MVP specification without introducing a parallel Olé Olé identity architecture.

## Identity invariant

Olé Olé MUST reuse/reconcile with the common Inseme/Cogentia identity model and remain compatible with the identity layering exercised by Digipolis.

Keep these layers distinct:

```text
anonymous visitor
→ pseudonymous session/device continuity
→ optional verified credential (email initially)
→ account
→ Cogentia Subject
→ optional Personal Digital Twin
→ optional Cogentia Digital Twin Instance
→ optional Digipee / Digipolis public identity
```

The following are not equivalent:

```text
session/device continuity
≠ verified credential
≠ account
≠ Subject
≠ Personal Digital Twin
≠ Cogentia Digital Twin Instance
≠ Digipee
```

Requirements:

- browsing the public service MUST remain possible without account creation;
- first useful interaction/contribution SHOULD remain low-friction;
- cookie/local session identifiers are pseudonymous continuity, not proof of human identity;
- email is initially a verified credential/contact/recovery mechanism, not the semantic identity itself;
- Olé Olé MUST NOT introduce a durable application-specific canonical person identity where the shared account/`Subject` model can own the relation;
- when a credential is later verified, existing ephemeral/session state SHOULD migrate/link into the shared account/`Subject` model rather than start a second identity;
- email collected solely for authentication/recovery MUST NOT imply marketing/newsletter consent;
- a visitor MUST NOT be required to become a Personal Twin, Digital Twin Instance or Digipee merely to use Olé Olé.

## Invitation

Provide a visible but non-intrusive `Inviter` action.

Priority:

1. platform-native Web Share API where supported;
2. copy-link fallback;
3. QR code for local/in-person sharing.

Requirements:

- no address-book upload/read is required;
- invitation recipients can reach a useful Olé Olé state without registration;
- shared URLs MAY preserve useful public context such as place/time when privacy-safe;
- optional invitation/referral tokens MUST be opaque and MUST NOT encode email, person identity or precise location;
- V0 MUST NOT use referral rewards, leaderboards or dark-pattern gamification to force viral growth.

The intended network effect is functional: more contributors make the Presence field more useful, which makes contribution and return more useful in turn.

## Anonymous continuity and optional recovery

A first-party pseudonymous session SHOULD preserve useful state on the same browser/device.

After a meaningful interaction/contribution, John or the UI MAY offer an optional recovery path such as:

> Retrouver Olé Olé sur un autre appareil

Preferred MVP mechanism: verified email by magic link or OTP, using existing Supabase/auth conventions where practical.

Requirements:

- explain the recovery purpose before collecting email;
- verify the email before treating it as a credential;
- link/migrate existing session state rather than discard it;
- do not require email before the first useful experience;
- provide a way to clear/reset local/session continuity consistent with the documented retention policy.

## Installability

`apps/oleole` is already configured as a PWA. Installability is therefore a product/UX concern before it is a native-app concern.

Requirements:

- expose an `Installer Olé Olé` affordance after meaningful use rather than immediately on first load;
- use the browser install prompt where supported;
- provide platform-appropriate add-to-home-screen guidance where direct prompting is unavailable, notably iOS;
- installed launch SHOULD recover the same service/session state where technically possible;
- a thin native wrapper remains deferred until a platform capability genuinely requires it, especially reliable background location.

## First-party measurement

The network loop MAY be measured using first-party product events such as:

```text
invite_started
invite_link_opened
first_useful_action
first_presence_contribution
return_visit
pwa_install_prompted
pwa_installed
credential_verified
```

Requirements:

- no behavioral advertising/tracking SDK;
- data minimization;
- bounded retention documented;
- no requirement to know which address-book contact received an invitation;
- no hidden commercial profiling.

## Additional MVP acceptance scenarios

15. A visitor can use Olé Olé anonymously and return on the same browser with useful pseudonymous session continuity.
16. A user can invite another person using native share, copy-link or QR without granting Olé Olé access to their address book.
17. An invitation recipient can open the shared URL and reach a useful Olé Olé state without first creating an account.
18. After receiving value, a user can optionally provide and verify an email to recover their state later or on another device.
19. Verifying that email links/migrates the existing state into the shared account/`Subject` model rather than creating an incompatible Olé Olé identity silo.
20. A user can install/add the Olé Olé PWA to the home screen and reopen the same service with continuity where technically supported.
21. No marketing consent is inferred from an email supplied solely for authentication/recovery.
22. Invitation/conversion metrics can be collected first-party without storing address-book identity or adding behavioral tracking SDKs.

## Target vertical slice

```text
anonymous arrival
→ useful interaction
→ persistent first-party session
→ Invite [native share | copy | QR]
→ optional verified email recovery
→ optional PWA installation
→ return
```

For the near-term implementation target, prefer shipping anonymous continuity + invitation + PWA installation over creating identity debt. If verified cross-device recovery cannot be reconciled cleanly with the shared identity model, record the blocker explicitly and defer that sub-slice.

## Relation to Digipolis

Digipolis concerns Digital Twin Instance / Digipee identity, provenance and cryptographic act verification. Olé Olé must remain compatible with that architecture but operates at an earlier entry layer for ordinary human users.

Canonical progression:

```text
visitor/session
→ verified credential/account/Subject
→ optional Personal Twin
→ optional Digital Twin Instance
→ optional Digipee
```

Do not collapse these layers merely for implementation convenience.
