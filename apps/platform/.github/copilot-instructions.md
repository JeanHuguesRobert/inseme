---
title: copilot-instructions
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
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

## GitHub Copilot / AI Agent Instructions

This repository is a collaborative open-source civic platform that uses React + Vite, Netlify
functions and Edge Functions (Deno), and Supabase (Postgres) for persistence.

If you are an AI agent assigned to implement features or fixes in this repo, follow these guidelines
to ensure consistency, safety, and maintainability.

1. When asked about the model in use, figure it out.

2. General Principles

- Preserve public API shape where possible; if making breaking changes, document them and ask about
  migration scripts.
- When changing database schema, add SQL migrations in `supabase/migrations` and update any seeds or
  test fixtures.
- Avoid interactive commands in hooks or CI (e.g., avoid `npx` without `--no-install` and use local
  node bin paths when possible).
- Be explicit about feature flags and environment variables — add to `.env.example` and reference
  docs.

3. Code Organization & Patterns

- Frontend lives in `src/`:
  - `src/pages/` — application pages
  - `src/components/` — reusable React components
  - `src/lib/` — utility modules, Supabase client, hooks
  - `src/services/` — API clients for edge functions and serverless endpoints
- Backend & Edge functions:
  - `netlify/functions/` — Node-based Netlify functions
  - `netlify/edge-functions/` — Deno-based edge functions (used for streaming, RAG, and LLM
    integrations)
  - `mcp/` — server-like code for Model Context Protocol (embed & ophelia agents; also provides an
    express-like router for `cop_` APIs)
- Database & Supabase:
  - `supabase/` — migrations and local schema

4. Naming & Migration Conventions

- Provide backward compatibility after user confirmation. Use english for code, french for end
  users.

5. Workflows & Local Development

- Running the app locally:
  - Ask user to run netlify dev in another window.
- Running tests and lint checks:
  - Linting rules: `stylelint.config.js`, Tailwind usage. Use `npm run lint`.
  - Pre-commit hooks: Husky is used in `.husky/pre-commit` — avoid modifications that reintroduce
    interactive `npx` installs. Prefer `npm run -s lint-staged` or local bin.

6. PR & Commit Guidelines

- Don't use PR. It's a solo developper project at this stage.

7. Testing & Monitoring

- Add tests for new business logic after user confirmation only; ensure that `unit` and
  `integration` tests are present where feasible.
- Add a short E2E test demonstrating the flow (e.g., create a `cop_topic`, send `cop_event`
  utterances, subscribe via `mcp/ws-runner` or simulated WS bus).
- Add simple metrics and health-check endpoints for new long-running services.

8. Security & Secrets

- Use `.env` for credentials in local dev; store production secrets in Netlify environment vars.
- When creating `host_secret` or other secrets, store them hashed or ephemeral in the DB; do not log
  the secret in plaintext in server logs.
- Avoid embedding private keys or tokens in public PRs.

9. Realtime & WebSocket bus (High-Level)

- Use WebSocket, avoid using Supabase realtime features, unless there is a very advantage, then ask
  the developper.

10. Communication and Labels

- Provide fullpath when usefull, not just file names.

11. Where to Ask for Help

- For front-end and design questions: `src/components/layout/SiteFooter.jsx` and `src/pages/*` are
  good starting points.
- For data model or schema questions: `supabase/schema.sql`, `supabase/migrations/*`,
  `mcp/cop/db.js`, and `netlify/edge-functions/cafe-api.js`.
- For background jobs and websockets: `mcp/ws-runner.js` and `mcp/cop/supabaseBus.js`.

12. When You Complete a change

- Update `CHANGELOG.md` and `README.md` if the PR substantially alters usage.
- Add details to `docs/` (migration plan, necessary commands) when releasing DB or API changes.

Thanks for contributing! Keep change well-documented.
