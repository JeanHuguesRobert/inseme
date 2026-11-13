# Pertitellu / LePP — preview publication contract

Owner: [Inseme #59](https://github.com/JeanHuguesRobert/inseme/issues/59). DNS and
edge dependency: [Operium #37](https://github.com/JeanHuguesRobert/operium/issues/37)
and [#77](https://github.com/JeanHuguesRobert/operium/issues/77).

The canonical **intended** web host is `lepp.baronsmariani.org`, in the
Cloudflare-authoritative `baronsmariani.org` zone. Former `lepp.fr` is abandoned:
do **not** renew it, point it here, or restore it in host/instance aliases.
This does not establish a new `@lepp.baronsmariani.org` mail service.
A previously verified shared contact route `contact@baronsmariani.org` is used
by the local instance configuration.

## Available substrate (not yet a public release)

- `pnpm --filter platform run build:pertitellu:preview` compiles the civic profile
  and writes `apps/platform/dist-fracta-preview`. The build is an artifact,
  not a claim that consultation, Wiki, elections, chat, authentication or COP
  writes function end-to-end.
- `pertitellu.caddy` is **versioned preparation**, not an installed vhost.
  It serves *only* the inert, self-contained `en-preparation.html` publicly;
  no JS bundle, no client calls to Supabase, and no direct civic actions.
  The full SPA stays available for private acceptance testing.
  It expects a separately managed immutable release symlink
  `/srv/www/pertitellu/current`.
- `GET /health` is strictly a **static-preview health** response. API endpoints
  return 503 rather than impersonate a functioning backend. Public routes
  return `en-preparation.html`, compiled assets return 404. The public page
  is `noindex` and the full SPA is *not* exposed by this vhost.
- The Deno `pertitellu-server.ts` adapter is source-only here; it is not an
  installed service. Its `preview_url` is null until explicitly configured.
- Existing database state must be reviewed before promotion: `lepp.fr` remains
  an alias in the JHN-hosted instance registry at the 2026-11-13 read-only check,
  while the replacement alias was absent. Correct with the governed instance
  capability and a verified effect receipt; never blindly rerun a generic seed
  against the current production database.

## Release gates

1. Check `git status`, branch freshness and task-owned diff on the serving host.
2. Build and test with the intended Node 24 runtime (current Fracta2 Node 22
   succeeded with engine warnings). Inspect generated `index.html` canonical,
   asset references and check for non-public material.
3. Place an identifiable, content-hashed release into the managed
   `/srv/www/pertitellu/releases/` directory. Keep `current` as a versioned
   symlink only after the artifact passes the local smoke test.
4. Validate `pertitellu.caddy` and the *actual* imported config; do not assume
   the vhost is live merely because a file exists in Git. Smoke-test using the
   desired Host locally, verify health, assets, 404 and API=503.
5. Confirm that the actual Oracle ingress serves Fracta2 HTTPS, and that the
   Cloudflare CNAME/A payload points to **that** working endpoint. Operium #77
   verified on 2026-11-10 that the reserved public IPv4 `82.70.234.207` was
   reassigned to Fracta2; public HTTPS probes on 2026-11-13 confirmed the
   Fracta2 Caddy response at `fracta.fractavolta.com`. The Oracle instance
   metadata still reports `publicIp: null` for its NIC, so use OCI's
   authoritative PublicIp association and public HTTPS reality tests; do not
   infer reachability from that metadata field alone. This does **not** prove
   the new LePP hostname is configured, has a certificate, or resolves.
6. Independently authorize, perform and re-read DNS and edge effects. Verify
   public NS, A/CNAME, trusted TLS, exact site identity, basic navigation and
   non-regression of neighboring vhosts. No email send or MX change.
7. Keep public preview labelled as such; remove `noindex` only after the
   application's backend, roles, data and COP paths meet the parity contract
   in Inseme #59. Rollback uses the prior `current` release and Caddy config.

**Do not call `lepp.baronsmariani.org` live until external HTTPS and page-content
checks actually pass.**
