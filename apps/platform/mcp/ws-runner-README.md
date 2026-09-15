---
title: MCP WebSocket Runner (ws-runner)
author: unknown
date: '2025-12-24'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 1cdac1c
  origin_date: '2025-12-24'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# MCP WebSocket Runner (ws-runner)

This simple runner demonstrates a reliable WebSocket-based agent runner approach:

- Subscribes to Supabase COP events and forwards them to agents via `onEvent` (write-ahead,
  idempotent).
- Runs a pool of workers that claim tasks atomically using `cop_claim_task` and execute `onTask`
  handlers.
- Exposes `/health` and `/metrics` HTTP endpoints for health checks and basic Prometheus metrics.
- Implements graceful shutdown: unsubscribes, stops workers, and attempts to let in-flight claims
  finish.

Deployment hints:

- In Kubernetes, deploy with:
  - Readiness and liveness probes against `/health`.
  - Pod restart policy `Always` and `failureThreshold` for backoff.
  - Horizontal Pod Autoscaler if relevant.
- In serverless/FaaS, prefer the DB-backed edge worker model for short-lived, stateless task
  processing.

Options & Env variables:

- `WS_RUNNER_PORT` - health server port (defaults to 8123)
- `WS_RUNNER_CONCURRENCY` - number of task workers to run

Limitations / Notes:

- This is a minimal runner and is meant as an example; production runner should include more
  observability and metrics and careful backoff / rate-limiting for LLM providers.
- If you use supabase channel wildcard subscription, configure accordingly; otherwise enumerate
  topic IDs and subscribe individually.
