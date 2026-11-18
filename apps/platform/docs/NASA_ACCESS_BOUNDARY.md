---
title: La Nasa access boundary
status: deployed Principal read-only Fracta2 observer; action bridge not configured
visibility: public
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
date: '2026-09-15'
update_policy: UP-DEFAULT-REVIEWED
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


# La Nasa access boundary

La Nasa has two deliberately different surfaces:

| Surface           | URL                                                                 | Audience                | Capability                                                 |
| ----------------- | ------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Public projection | `https://cogentia.fractavolta.com/ops/dashboard` | everyone                | existing public Fractanet operational summary |
| John workspace    | `https://jhn.baronsmariani.org/nasa`                                | Principal (and limited delegated access) | private, read-only Fracta2 observations; action bridge absent |

The public surface contains no browser token, node identity, endpoint, private registry data, or
action control. It must remain safe to share as a demonstration URL.

## John authentication boundary

`/nasa` sends the current John Supabase access token only to its same-origin endpoint:

```text
GET /api/nasa/control (read)
POST /api/nasa/control (not deployed)
```

The Netlify Edge Function `nasa-control` validates the token with the JHN Supabase project using
`auth.getUser(token)`. It recognizes the Principal only when the user’s immutable Supabase subject
(`auth.users.id`) matches the server-only JHN Vault (`instance_config`) value:

```text
nasa_principal_subject=<uuid-for-jeanhuguesrobert-gmail>
```

Delegates are separately listed, only after a mandate exists:

```text
nasa_operator_subjects=<uuid-for-a-mandated-agent-account>
```

Netlify holds only the JHN Supabase bootstrap (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)
needed for the Edge runtime to read that Vault. The service-role key never reaches the browser; the
presented browser access token is still independently validated.

Do not use email addresses or editable `user_metadata` for the runtime authorization decision. The
Principal’s authoritative email binding remains private configuration, not public site content. Each
agent must have a separate Supabase account and subject UUID; never share the Principal password or
a browser session with an agent.

The endpoint is fail-closed:

- absent or invalid session → `401`;
- missing Principal subject → `503`;
- authenticated but not allowed → `403`;
- operator action before an action bridge is configured → `501`.

The `501` response is intentional. It proves that authentication and authorization are in place
without accidentally granting write access to Fracta.

## Fracta2 read-only observer (2026-11-17)

The production JHN FractaFunction Deno runtime receives a non-secret
`NASA_OBSERVER_URL=http://127.0.0.1:8794` from its Operium bootstrap.
The value is resolved by the existing instance-aware `getConfig(..., "jhn")`
and is accepted **only** when it matches this exact loopback origin. The Deno
network permissions allow the local ONA port and otherwise retain the existing
host allowlist.

After Supabase `auth.getUser` and UUID Principal validation, a GET reads only
ONA `/node/status` and `/cgi-bin/fleet` over server-side loopback. The server
returns a bounded, allowlisted projection (local health/probes/jobs/COP outbox
and observed fleet status), not ONA raw JSON, auth headers, node endpoints,
action definitions, credentials or remote administration rights. Delegates do
not receive the Fracta2 observer projection. Unavailable/stale component
responses remain explicit; unknown peer health is not interpreted as down.

The public link now targets the functioning `/ops/dashboard`, not the
`/ops/console/` deployment missing after the November 10 migration.
No ONA action endpoint is proxied; GET-only is enforced by the FractaFunction
Deno guard. The browser uses only its same-origin, bearer-protected API.

## Principal Cogentia cockpit snapshot (2026-11-18)

The same Supabase-verified Principal GET now reads the *existing* Cogentia
daemon on Fracta2 via the strictly pinned `NASA_COGENTIA_URL` instance
configuration (`http://127.0.0.1:8790` injected by Operium's Deno bootstrap).
Its `/api/views/snapshot?limit=8&no_store_probe=1` is the canonical read-only
cockpit projection. The returned JSON is filtered to workload estimates,
continuation counts, a bounded title/status/reference sample, and open issue
counts. No raw continuation payloads, context, resume recipes, credentials or
daemon command/action APIs reach the browser. The External Views Store is
deliberately not probed by this query.

This view is not an independent task registry, an authorization grant, or a
live mandate ledger. The separate mandate/continuation decision endpoints
remain protected by COP; their HTTP 403 responses must **not** be bypassed.
John's current consent flow is linked as a separate authenticated workflow.
A Cogentia daemon failure is represented as `cockpit.status=unavailable`,
without hiding an otherwise healthy ONA observer.

## Locality, neighboring capacities and path evidence (2026-11-18)

The Principal-only GET now reads four fixed loopback ONA endpoints:
`/node/status`, `/cgi-bin/fleet`, `/node/peers?fresh=0` and
`/soma/object`. The last two provide a **bounded, source-matched** projection
of local CPU/memory observations and locally known peer attractors,
capability declarations, last-seen timestamps, TTL and independently observed
direct mesh reachability when available. Peer endpoints, raw private
metadata and irrelevant SOMA attributes never reach the browser.

The ONA SQLite local peer registry (not the five hard-coded legacy fleet
entries) represents this node's observed *neighbor knowledge*. Freshness is
checked at read-time in ONA and in the protected JHN projection. Historical
peers remain inspectable after expiry but are not thereby routable.
An ONA `operium.node.v1` attractor is not a Cognitive Packet executor.
No throughput, queue estimate, multi-hop path, authority or packet-relative
attractiveness is manufactured from CPU load or TTL alone.

Stigmergic path evidence is a subsequent, separately testable layer. It
must derive from source-local COP event/effect receipts and their assimilation,
indexed by packet class, capability, destination and path/hops, with
provenance, decay, rejection and negative experience. This increment creates
**no new routing log or authority, no dispatch action and no simulated score**.
See the 2026-11-18 research addendum in
`cogentia/research/informational_gravity.md` and
`barons-Mariani/research/the_network_is_the_learning_computer.md`.

## Deployment checklist

Before publishing the John increment:

1. Create or confirm the Principal’s designated email/password account on `jhn.baronsmariani.org`.
2. In Supabase Authentication, identify that account’s UUID; create separate accounts only for
   mandated agents.
3. In the JHN Vault, set `nasa_principal_subject` to the Principal UUID. Add
   `nasa_operator_subjects` only for approved delegates.
4. Ensure the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` refer to the JHN
   project. Do not add principal or delegate subjects to Netlify.
5. Deploy, then test the four outcomes above from a browser and HTTP client.
6. Only then implement a narrow, audited action bridge. It must receive the validated John identity
   server-side and use a host-only Fracta credential; it must never accept a Fracta token supplied
   by a browser.

## Current limit

No public or authenticated write operation has been deployed by this increment.
The public dashboard remains a projection; the Principal's John workspace now also
shows a bounded private Fracta2 observer. Authenticated write/action transport remains
out of scope.
