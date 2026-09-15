---
title: 'GitHub webhook ingress for Digital Twin (Inseme #29)'
date: '2026-08-07'
document_role: operational
document_kind: method
visibility: public
related_issues:
  - https://github.com/JeanHuguesRobert/inseme/issues/29
  - https://github.com/JeanHuguesRobert/inseme/issues/28
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# GitHub webhook ingress (Digital Twin)

**GitHub delivery ≠ COP event ≠ FractaLog / activity feed.**

| Layer             | What it is                                                           |
| ----------------- | -------------------------------------------------------------------- |
| **Delivery**      | Provider-native evidence (`github_webhook_deliveries`)               |
| **COP event**     | Normalized durable fact (`cop.event/v1` via `cop_event_append`)      |
| **Activity feed** | Rebuildable private projection for the mandant (`buildActivityFeed`) |
| **FractaLog**     | Federated reconstructible view (later) — not this feed               |

GitHub signatures prove **App delivery path**, not legal Principal / mandate (#30).

## Endpoint

```text
POST /api/webhooks/github
```

Netlify edge: `apps/platform/netlify/edge-functions/github-webhook.js`

## Secrets (never in Git)

| Name                                         | Where                                                   |
| -------------------------------------------- | ------------------------------------------------------- |
| `github_webhook_secret`                      | JHN `instance_config` Vault                             |
| `github_repo_allowlist`                      | JHN `instance_config` Vault                             |
| `cop_artifact_bucket`                        | JHN `instance_config` Vault, optional (`cop-artifacts`) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | edge                                                    |

## Instance profile (example)

```yaml
# instances/jhn-github-ingress.example.yaml
instance_id: jhn-personal
anchor_repository: JeanHuguesRobert/JeanHuguesRobert
observed_repositories:
  - name: JeanHuguesRobert/JeanHuguesRobert
    role: anchor
  - name: JeanHuguesRobert/inseme
    role: work
  - name: JeanHuguesRobert/cogentia
    role: work
github_events: # see GITHUB_EVENT_SUBSCRIPTIONS in github-ingress.js
  - push
  - issues
  - pull_request
  - workflow_run
  # …
```

## GitHub App setup (operator)

1. Create GitHub App (or use existing) with **Subscribe to events** matching the subscription list.
2. Set webhook URL to the deployed edge URL ending in `/api/webhooks/github`.
3. Store the same webhook secret in the JHN Vault as `github_webhook_secret`. The Edge Function
   fails closed if this Vault entry is missing or cannot be read.
4. Install on **allowlisted** repositories only.
5. Provision private Storage bucket `cop-artifacts` on the instance Supabase if large payloads are
   expected.

## First activation: JHN (operator checklist)

Use this sequence when the reviewed code is ready to deploy. Steps 1–3 may be completed beforehand;
do not activate the GitHub App before step 4. Never put the secret in Git, a `.env` committed to
Git, an issue, or a chat transcript.

1. For JHN, use the secret already generated in the Vault. For a new instance, generate one
   high-entropy secret and store it there first.
2. In the JHN Supabase project, confirm the `instance_config` row `github_webhook_secret` is
   non-empty and has `is_secret=true` and `is_public=false`. Do not create a browser configuration
   entry for it.
3. In the JHN Vault, create `github_repo_allowlist` as a JSON array (preferred) or comma-separated
   string. Start with one repository, for example `JeanHuguesRobert/inseme`; add further
   repositories only after the smoke test. Keep the existing host bootstrap Supabase credentials; do
   not add an allowlist variable to Netlify.
4. Deploy this reviewed JHN profile. The generated profile must contain `github-webhook` at
   `/api/webhooks/github`.
5. In GitHub **Settings → Developer settings → GitHub Apps**, create a private App (or edit the
   intended existing App). Enable webhooks and use:

   ```text
   https://jhn.baronsmariani.org/api/webhooks/github
   ```

   Paste the exact same secret into **Webhook secret**.

6. Begin with the minimum subscriptions needed for the first observation loop: `Push`, `Issues`,
   `Pull request`, and `Workflow run`. GitHub only offers events whose corresponding repository
   permissions have been granted; grant read-only permissions unless a later capability needs more.
7. Restrict installation to the intended account and allowlisted repository. Activate the App and
   inspect its initial `ping` delivery.
8. Confirm a `202` delivery in GitHub and a durable row/event in the JHN instance. For a failed
   delivery, fix the cause first, then redeliver it from the GitHub App delivery view.

GitHub requires a configured webhook URL, a high-entropy secret and matching event permissions for a
GitHub App. It retains recent deliveries for manual redelivery; failed deliveries are not
automatically retried by GitHub.

## Deferred activation record — JHN launch first

**Decision (2026-08-11):** defer GitHub App creation, installation and live webhook activation until
after the first public Agent John launch, targeted for 2026-08-15. This avoids expanding the
operational perimeter during launch stabilization.

Already prepared:

- `github_webhook_secret` is generated in the JHN Vault and marked secret;
- `github_repo_allowlist` is present in the JHN Vault with the initial `JeanHuguesRobert/inseme`
  scope;
- the JHN Netlify profile contains the Vault-backed, fail-closed ingress;
- no GitHub App, installation, or live delivery has been created.

Resume checklist:

1. Commit, deploy and smoke-test the reviewed JHN webhook code.
2. In the GitHub App UI, copy the existing Vault secret into the App's webhook secret field without
   exposing it in Git, chat or a repository `.env`.
3. Register the URL, choose minimal read permissions and subscribe initially to Push, Issues, Pull
   request and Workflow run.
4. Install the App only on the allowlisted repository.
5. Verify `ping` then a signed `202` delivery, its durable delivery record and its restricted COP
   event.
6. Only then consider adding a JHN GitHub-App credential tool under Inseme #43; installation tokens
   must remain ephemeral, not stored as Vault values.

## Code surfaces

| Module                                    | Role                                  |
| ----------------------------------------- | ------------------------------------- |
| `packages/cop-core/src/github-ingress.js` | HMAC, allowlist, full event map       |
| `github-activity-feed.js`                 | Private activity projection           |
| `github-delivery-replay.js`               | Remap after mapper changes            |
| `github-reconcile.js`                     | Gap detection vs injected GitHub list |
| Edge `github-webhook.js`                  | 202 + durable #28 path                |

## Local simulation

```bash
node scripts/simulate-github-webhook-e2e.js
node scripts/test-github-webhook-ingress.js
node scripts/test-github-activity-feed.js
```

## Activity feed

```js
import { buildActivityFeed } from "@inseme/cop-core/…";
const feed = buildActivityFeed(store, { viewer_clearance: "restricted", limit: 50 });
```

Items carry `activity_kind`: observation | work_proposal | human_decision | publication | security |
governance | system.
