# JHN Supabase password recovery (inseme#184)

## Application contract

- Browser route: `https://jhn.baronsmariani.org/auth/reset-password` (React Router SPA fallback required).
- The existing `@inseme/cop-host` Supabase client with `detectSessionInUrl` handles implicit or PKCE exchange. The page only calls `auth.updateUser({password})` when a recovery callback was received on the dedicated route and a client session exists. It does not create a COP mandate or new password service.
- The callback query/fragment is erased with `history.replaceState` after session initialization; do not log full callback URLs, token fragments, request headers or form contents. No test uses genuine credentials.
- `authEvent`/token exchange ordering and stale pre-existing sessions require **browser integration tests** before production acceptance: a callback marker by itself does not prove that the current session was created by that recovery link. The route must not be declared secure/production-ready until this is demonstrated or hardened with an explicit exchange proof.

## Canonical Supabase configuration (operator-owned)

1. Add `https://jhn.baronsmariani.org/auth/reset-password` to Auth URL redirect allowlist for project `ndiysuhzmztatpxbkezn` (no secret). Preserve approved existing OAuth URLs.
2. Ensure recovery request passes `redirectTo: "https://jhn.baronsmariani.org/auth/reset-password"` or that the recovery mail template explicitly targets that exact URL. The Supabase Dashboard request may default to Site URL rather than a requested redirect.
3. Configure the production HTTP server to serve the SPA entry point for the route, without treating unmatched `/api/*` as SPA.
4. Run an actual fresh recovery email through the canonical HTTPS origin, verify expired/invalid link behavior and successful sign-in with the new password (old password rejected). Never paste its link or tokens into tickets.
5. Coordinate the release with `operium#77`; neither this code change nor local build authorizes DNS/Caddy cutover.

## Local evidence 2026-11-10

`node --test apps/platform/scripts/test-jhn-password-recovery.test.js` passed (2 tests). `pnpm exec vite build` succeeded on fracta2 (Node 22 in use despite project engine >=24). Browser-based recovery, Supabase Auth URL settings and live mail not yet validated.
