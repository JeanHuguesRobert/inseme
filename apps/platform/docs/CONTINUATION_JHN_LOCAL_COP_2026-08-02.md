---
title: Continuation — JHN local COP runtime
date: '2026-08-02'
status: paused
commit: f041466fdb8640adec78aedeba036cb06bcb7e4a
scope: apps/platform local JHN personal instance
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
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


# Continuation — JHN local COP runtime

## Objective reached

The first local JHN/John runtime is operational:

- portable COP schema validates unchanged in Node SQLite and is suitable for a later
  PostgreSQL/Supabase deployment;
- SQLite is the durable local source for COP events and current mandates;
- Ed25519 capabilities and current mandate checks protect COP writes;
- the protected runtime binds only to loopback;
- the local terminal REPL and browser console work;
- an OpenAI Responses adapter is used statelessly (`store: false`);
- a conversation survives runtime stop/restart by reconstructing context from COP events in SQLite.
  A two-turn live test recalled `cèdre` after restart.

`f041466` is pushed to `origin/main` and contains the runtime, tests, portable schema, local
bootstrap and verifier.

## Durable versus local-secret state

Versioned in Git:

- source and tests under `apps/platform/mcp/cop/` and `apps/platform/mcp/test/`;
- local lifecycle scripts under `apps/platform/scripts/`;
- portable and Supabase hardening migrations;
- this continuation packet.

Never commit or print:

- `apps/platform/instances/jhn-cop-local/` (Git-ignored): SQLite state, private Ed25519 JWK and
  public-key configuration;
- `inseme/.env`, including `OPENAI_API_KEY`;
- Supabase Vault values.

The Vault `instance_config` for JHN and Pertitellu, and the local `.env` mirror, were updated with a
working OpenAI key during this increment. Do not infer or display its value; re-verify it only with
a minimal live request.

## Resume commands

From `C:\tweesic\inseme`:

```powershell
pnpm --filter platform verify:jhn:local-cop
pnpm --filter platform test:cop:portable
pnpm --filter platform repl:jhn:local
pnpm --filter platform console:jhn:local
```

The browser console is `http://127.0.0.1:8788`. It must be launched from the operator's normal
terminal session; a Codex-sandboxed background process may lack outbound access to OpenAI even when
the operator session does not.

## Architecture decisions

- SQLite/COP is the durable, portable source of truth.
- Authorization is decided in portable ESM from signed capability + current mandate. Tailscale,
  Supabase Auth, RLS, stored procedures and triggers are not normative dependencies.
- Supabase RLS migration is defence in depth only.
- OpenAI is a replaceable reasoner provider. Current mode reconstructs local context and calls
  Responses statelessly.
- A provider `previous_response_id`/Responses chain may later be used as a short-lived optimisation
  cache. It must never replace SQLite history; expiry, hibernation, provider failure and migration
  must fall back to stateless local reconstruction.
- Massive objects remain references, not mandatory contents of the SQLite package.

## Migration and hibernation

For migration to Fracta or another Node host, stop the runtime and transfer the local state
directory through the normal secret channel. It contains SQLite, public configuration and private
JWK; it is deliberately not a Git artifact. On the destination, run `verify:jhn:local-cop` before
starting the runtime.

This is a minimal hibernation implementation: conversation continuity is proven through SQLite
events. Full task/worker suspension, large-object hydration and backup rotation remain future work.

## Next increments

1. Add automated end-to-end coverage for the browser console and conversation restart path.
2. Implement an explicitly governed local administrative path for mandate issuance,
   suspension/revocation, renewal and Ed25519 key rotation.
3. Produce a verified backup/export and import procedure for the local state directory.
4. Deploy the runtime as a Fracta service, retaining loopback/private boundary discipline and
   host-managed secrets.
5. Add a controlled remote interface or channel adapter; the browser and remote callers must never
   receive the signing key.

## Worktree boundary at pause

The workspace may show untracked `gen-*.js` wrappers under the Cyrnea, Inseme and Platform Netlify
applications plus generated Ophélia prompt/tool aggregates. They are outputs of the COP Host brique
compiler, not part of the JHN runtime commit. Do not stage or remove them without a separate
generation/reproducibility decision.
