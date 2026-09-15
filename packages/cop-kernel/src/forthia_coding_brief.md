---
title: Forthia — Coding Brief for a COP/Inox Fractanet Router
author: Jean Hugues Noël Robert, baron Mariani / drafted by ChatGPT
affiliation: Institut Mariani / C.O.R.S.I.C.A.
date: '2026-06-12'
status: draft-for-coding-handler
version: 0.1.0
language: en
corpus_role: source
implementation_target:
  repository: JeanHuguesRobert/inseme
  primary_package: packages/cop-kernel
  possible_http_integration: apps/platform/mcp/cop
  future_runtime: Inox / Inox Core
related_documents:
  - FractaVolta/research/fractanet.md
  - FractaVolta/research/generalized_packet_networks.md
  - inseme/packages/cop-core/Architecture.md
  - inseme/research/COP_STATE_OF_PLAY.md
  - Inox/research/inox-spec.md
human_validation_required:
  - Confirm final repository path.
  - Confirm whether Forthia should start inside packages/cop-kernel or as a new packages/forthia package.
  - Confirm whether the first implementation should use pure JavaScript strategy functions before Inox integration.
tags:
  - Forthia
  - Fractanet
  - COP
  - Inox
  - generalized control plane
  - generalized packet networks
  - exergy
  - router
  - HTTP JSON
  - gateway
  - cognitive router
  - capability routing
  - envelope payload
license: CC BY-SA 4.0
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


# Forthia — Coding Brief for a COP/Inox Fractanet Router

## 0. Purpose of this document

This document is a coding brief for an implementation handler.

The goal is to implement a first minimal version of **Forthia**, the small name, in homage to **Forth**, of a **cognitive router** for augmented HTTP/JSON APIs.

Forthia is not a general web framework. It is a first concrete implementation step toward **Fractanet**: a programmable, distributed, anti-capture network of capability verbs, generalized packets, COP traces, Inox-like composition, generalized control planes, non-bit substrates, and exergy-oriented routing.

The implementation must start small, testable, and compatible with the existing COP codebase.

## 1. Short definition

**Forthia is a COP-traceable cognitive router that receives an HTTP/JSON request for a verb, evaluates admissible routes under Fractanet criteria, selects or explains a route, and emits COP-compatible events describing the decision.**

A first version may be implemented in JavaScript inside the current COP package, but the design must remain compatible with a future Inox / Inox Core execution substrate.

## 2. Strategic intent

Forthia is meant to turn this pattern:

```text
client → fixed HTTP endpoint → direct response
```

into this pattern:

```text
client → verb call → Forthia router → admissible route selection → target API/gateway/cache/continuation → response + COP trace
```

The client does not merely call a URL. It calls a **verb**.

The router determines the concrete target according to:

- explicit capabilities;
- namespace;
- client type;
- route availability;
- substrate type;
- control-plane policy;
- exergy score;
- latency/cost/risk/freshness trade-offs;
- COP traceability requirements;
- future Inox execution constraints.

## 3. Repository and placement

### Recommended initial location

Use the existing monorepo:

```text
JeanHuguesRobert/inseme
```

The current corpus indicates that COP is already implemented there through:

```text
packages/cop-core
packages/cop-kernel
packages/cop-host
apps/platform/mcp/cop
```

The first implementation should preferably be placed in:

```text
packages/cop-kernel/src/forthia/
```

Rationale: `cop-kernel` already exposes runtime helpers, registries, continuation helpers, bus, scheduler, job scheduler and timing helpers. Forthia should reuse these as much as possible.

### Alternative later refactor

If the module becomes large enough, split it later into:

```text
packages/forthia/
```

But do **not** start with a separate package unless the handler finds a strong technical reason. The first goal is integration, not architectural ceremony.

## 4. Non-goals for the MVP

Do not implement full Fractanet.

Do not implement real Inox execution yet.

Do not implement a full programmable gateway.

Do not implement distributed routing, RAIX, energy markets, water routing, or physical substrate control.

Do not implement learned energy-based models yet.

Do not implement arbitrary user-supplied JavaScript execution.

The MVP must implement a **small, deterministic routing core** with clear data structures, tests, and COP-compatible trace hooks.

## 5. MVP scope

The MVP must provide:

1. A `VerbCall` input model.
2. A `RouteCandidate` model.
3. A `RouteDecision` output model.
4. A deterministic route evaluator.
5. Hard constraint filtering.
6. Exergy-inspired scoring among admissible routes.
7. COP event emission hooks or event objects.
8. A small HTTP/JSON adapter, if feasible.
9. Unit tests.
10. A README for future handlers.

## 6. Core concepts

### 6.1 Verb

A verb is a stable operational capability.

Example:

```text
customer.summary
inference.dispatch
packet.route
cognitive.context.resume
energy.packet.reserve
```

The MVP can start with synthetic examples only. It does not need to call real external APIs.

### 6.2 VerbCall

A `VerbCall` is the input to Forthia.

Example:

```json
{
  "verb": "customer.summary",
  "input": {
    "customer_id": "cus_123"
  },
  "context": {
    "client_type": "mobile",
    "tenant": "demo",
    "region": "EU",
    "capabilities": ["read:customers", "read:orders"],
    "trace": true
  },
  "constraints": {
    "max_latency_ms": 500,
    "max_cost": 1.0,
    "min_freshness": 0.8,
    "data_residency": "EU"
  }
}
```

### 6.3 RouteCandidate

A route candidate is a possible implementation of a verb.

Example:

```json
{
  "id": "customer-summary-mobile-v1",
  "verb": "customer.summary",
  "target": {
    "kind": "http-json",
    "method": "GET",
    "url": "https://api.example.local/customer-summary/mobile"
  },
  "namespace": "client/mobile",
  "version": "1.0.0",
  "substrate": "data",
  "required_capabilities": ["read:customers", "read:orders"],
  "hard_constraints": {
    "data_residency": "EU"
  },
  "metrics": {
    "estimated_latency_ms": 120,
    "estimated_cost": 0.2,
    "estimated_energy": 0.1,
    "freshness": 0.9,
    "risk": 0.1,
    "noise": 0.2,
    "sovereignty_penalty": 0.0
  }
}
```

### 6.4 RouteDecision

A route decision is the output.

Example:

```json
{
  "status": "selected",
  "verb": "customer.summary",
  "selected_route_id": "customer-summary-mobile-v1",
  "rejected": [
    {
      "route_id": "customer-summary-us-v1",
      "reason": "data_residency_mismatch"
    }
  ],
  "score": {
    "exergy_score": 0.82,
    "details": {
      "latency_component": 0.12,
      "cost_component": 0.20,
      "freshness_component": 0.90,
      "risk_component": 0.10
    }
  },
  "trace": {
    "correlation_id": "...",
    "events": []
  }
}
```

## 7. Envelope / payload separation

Forthia must enforce a clean separation between:

```text
envelope = routing/control metadata
payload  = content or capability being transported, transformed or activated
```

The MVP may not transport real payloads. It must still model the distinction.

### Envelope fields

```json
{
  "verb": "customer.summary",
  "namespace": "client/mobile",
  "origin": "demo-client",
  "destination": "forthia",
  "ttl_ms": 1000,
  "priority": "normal",
  "capabilities": ["read:customers"],
  "policy": {},
  "trace": true
}
```

### Payload field

```json
{
  "input": {
    "customer_id": "cus_123"
  }
}
```

The route evaluator should primarily inspect the envelope and constraints. It should not need to inspect sensitive payload fields unless a route explicitly declares that it needs payload-derived features.

## 8. Control plane / data plane

Forthia is a control-plane component.

It decides, explains and traces routing. It does not itself become the data plane.

For the MVP:

```text
control plane = verb, envelope, capabilities, route candidates, policy, trace, exergy score
data plane    = target HTTP API, cache, continuation, stream, future non-bit substrate
```

Later Fractanet data planes may include:

- data;
- energy / exergy;
- water;
- goods;
- inference;
- cognitive packets;
- continuations;
- mandates;
- responsibilities.

The MVP must remain compatible with this generalized interpretation by using a `substrate` field on route candidates.

## 9. Exergy-oriented routing

Forthia must not implement a naive “lowest energy wins” rule.

The criterion is **exergy**: useful capacity produced relative to the cost, risk, latency, noise and loss imposed by the route.

A simple MVP formula is acceptable:

```text
exergy_score = useful_signal / total_burden
```

Where:

```text
useful_signal = freshness + reliability + sovereignty_bonus + capability_fit

total_burden = latency_weight + cost_weight + energy_weight + risk_weight + noise_weight + complexity_weight
```

The implementation must keep the formula configurable and transparent.

### Suggested default scoring function

Use normalized values between `0` and `1` where possible.

```js
score =
  + 0.25 * freshness
  + 0.25 * reliability
  + 0.20 * capabilityFit
  + 0.15 * sovereigntyFit
  + 0.15 * substrateFit
  - 0.20 * latencyPenalty
  - 0.15 * costPenalty
  - 0.15 * energyPenalty
  - 0.15 * riskPenalty
  - 0.10 * noisePenalty
  - 0.10 * complexityPenalty;
```

This is not the final doctrine. It is a testable placeholder.

The decision response must expose the scoring components.

## 10. Hard constraints first

Forthia must apply hard constraints before scoring.

Examples of hard rejection:

- missing required capability;
- data residency mismatch;
- namespace not allowed;
- route version not compatible;
- client type not authorized;
- substrate not allowed;
- route disabled;
- TTL exceeded;
- policy forbids target.

Principle:

```text
Capabilities bound the search space; exergy ranks admissible routes.
```

## 11. Backtracking-ready design

The MVP does not need full Prolog-like backtracking.

However, it must return enough information to support future backtracking:

- ordered candidate list;
- rejected candidates with reasons;
- fallback candidates;
- decision trace;
- route attempt status;
- retryable vs non-retryable failure classification.

Suggested design:

```js
const plan = buildRoutingPlan(verbCall, candidates, policy);
const first = plan.admissible[0];
```

Later:

```js
for (const route of plan.admissible) {
  const result = await tryRoute(route);
  if (result.ok) return result;
  emitBacktrackEvent(route, result.failure);
}
```

## 12. COP integration

Forthia must emit or prepare COP-compatible events.

The existing COP corpus defines COP as the Cognitive Orchestration Protocol, with events, artifacts, topics, tasks, steps and continuations as core concepts.

For the MVP, do not overfit the final event schema if uncertain. Provide plain event objects compatible with later mapping.

### Suggested event types

```text
forthia.verb.called
forthia.candidates.enumerated
forthia.candidate.rejected
forthia.route.scored
forthia.route.selected
forthia.route.failed
forthia.route.backtracked
forthia.route.completed
forthia.decision.explained
```

### Minimal COP event shape

```json
{
  "type": "forthia.route.selected",
  "topicId": "optional-topic-id",
  "taskId": "optional-task-id",
  "correlationId": "...",
  "parentEventIds": [],
  "payload": {
    "verb": "customer.summary",
    "selected_route_id": "customer-summary-mobile-v1",
    "score": {}
  },
  "timestamp": "2026-06-12T00:00:00.000Z"
}
```

If the existing `emitCopEvent` helper can be reused cleanly, use it. If not, return the events as part of the decision object and leave integration as the next step.

## 13. HTTP/JSON adapter

If feasible, add a minimal Express router under:

```text
apps/platform/mcp/cop/forthiaRouter.js
```

or expose it through the existing COP router.

Minimal endpoint:

```http
POST /cop/forthia/route
Content-Type: application/json
```

Request:

```json
{
  "verbCall": {},
  "candidates": [],
  "policy": {}
}
```

Response:

```json
{
  "decision": {},
  "events": []
}
```

Do not call external URLs in the first MVP. Only select the route.

A second endpoint may be added later:

```http
POST /cop/forthia/execute
```

But execution should be out of scope for v0.1 unless already trivial.

## 14. Proposed file structure

Preferred MVP file structure:

```text
packages/cop-kernel/src/forthia/
  index.js
  types.js
  normalize.js
  constraints.js
  scoring.js
  router.js
  events.js
  explain.js
  README.md

packages/cop-kernel/test/forthia.test.js
```

Optional HTTP integration:

```text
apps/platform/mcp/cop/forthiaRouter.js
apps/platform/mcp/cop/router.js   # import/use forthiaRouter if appropriate
```

## 15. Module responsibilities

### `types.js`

Define JSDoc typedefs or TypeScript-like comments for:

- `VerbCall`
- `Envelope`
- `RouteCandidate`
- `RouteDecision`
- `RouteRejection`
- `RouteScore`
- `ForthiaPolicy`
- `ForthiaEvent`

The package is currently pure JS ES modules, so keep it JS unless the repository already supports TS here.

### `normalize.js`

Normalize inputs:

- ensure arrays exist;
- set default context;
- set default constraints;
- normalize metrics to numbers;
- generate correlation ID if absent.

### `constraints.js`

Implement:

```js
checkHardConstraints(verbCall, candidate, policy)
filterAdmissibleRoutes(verbCall, candidates, policy)
```

Return explicit rejection reasons.

### `scoring.js`

Implement:

```js
scoreRoute(verbCall, candidate, policy)
rankRoutes(admissibleRoutes)
```

Expose score components.

### `router.js`

Implement:

```js
routeVerb(verbCall, candidates, policy)
```

Return:

```js
{
  decision,
  events,
  plan
}
```

### `events.js`

Build COP-compatible Forthia events.

Do not require storage.

### `explain.js`

Generate a human-readable explanation of the decision:

```text
Selected route X because it satisfied capabilities, matched EU residency, had high freshness, and lower burden than alternatives. Route Y was rejected because it lacked data residency compatibility.
```

This is important for signal/noise optimization.

## 16. Tests required

Create tests for:

1. Selects the best admissible route.
2. Rejects missing capability.
3. Rejects data residency mismatch.
4. Prefers high exergy over low latency if useful signal is higher.
5. Produces rejection reasons.
6. Produces COP-compatible events.
7. Produces a human-readable explanation.
8. Returns `no_admissible_route` when all candidates are rejected.
9. Preserves envelope/payload separation.
10. Keeps deterministic output for identical input.

Use Node’s built-in test runner consistent with `cop-kernel`.

## 17. Example test fixture

```js
const verbCall = {
  verb: "customer.summary",
  input: { customer_id: "cus_123" },
  context: {
    client_type: "mobile",
    tenant: "demo",
    region: "EU",
    capabilities: ["read:customers", "read:orders"],
    trace: true,
  },
  constraints: {
    data_residency: "EU",
    max_latency_ms: 500,
  },
};

const candidates = [
  {
    id: "eu-mobile-cache-v1",
    verb: "customer.summary",
    namespace: "client/mobile",
    version: "1.0.0",
    substrate: "data",
    required_capabilities: ["read:customers"],
    hard_constraints: { data_residency: "EU" },
    metrics: {
      freshness: 0.85,
      reliability: 0.95,
      estimated_latency_ms: 80,
      estimated_cost: 0.1,
      estimated_energy: 0.1,
      risk: 0.05,
      noise: 0.1,
      complexity: 0.2,
    },
  },
  {
    id: "us-direct-v1",
    verb: "customer.summary",
    namespace: "public",
    version: "1.0.0",
    substrate: "data",
    required_capabilities: ["read:customers"],
    hard_constraints: { data_residency: "US" },
    metrics: {
      freshness: 1.0,
      reliability: 0.95,
      estimated_latency_ms: 50,
      estimated_cost: 0.1,
      estimated_energy: 0.1,
      risk: 0.05,
      noise: 0.1,
      complexity: 0.1,
    },
  },
];
```

Expected: `eu-mobile-cache-v1` selected; `us-direct-v1` rejected for residency mismatch.

## 18. Design constraints

The coding handler must preserve these constraints:

- pure ES modules;
- no heavy dependency unless strictly necessary;
- deterministic by default;
- no external HTTP calls in v0.1;
- no arbitrary script execution;
- no secrets in traces;
- no payload leakage in explanations;
- no hidden scoring magic;
- explicit reasons for every rejection;
- every decision explainable.

## 19. Future extensions

After the MVP:

1. Add a route registry.
2. Add namespace-aware dispatch.
3. Add cache candidates.
4. Add streaming decision events.
5. Add continuation-aware route attempts.
6. Add real COP event persistence.
7. Add Inox Core execution profile.
8. Add backtracking execution.
9. Add learned or energy-based route ranking.
10. Add RAIX route redundancy and failover.
11. Add non-bit substrates as real targets.
12. Add policy DSL.
13. Add a Fractanet node manifest.

## 20. Success criteria for v0.1

The implementation is acceptable when:

- `pnpm --filter @inseme/cop-kernel test` passes;
- `routeVerb()` works with deterministic fixtures;
- rejected routes have clear reasons;
- selected route has score details;
- decision emits Forthia events;
- no external calls are made;
- README documents the module;
- the code remains small and easy to refactor toward Inox.

## 21. Suggested coding-handler task list

Give the coding handler these tasks in order:

```text
1. Inspect packages/cop-kernel/src and test structure.
2. Add packages/cop-kernel/src/forthia modules.
3. Export Forthia from packages/cop-kernel/src/index.js.
4. Add unit tests in packages/cop-kernel/test/forthia.test.js.
5. Run package tests.
6. Add README for Forthia.
7. Optionally add HTTP router under apps/platform/mcp/cop/forthiaRouter.js.
8. Report exact files changed, tests run, and remaining gaps.
```

## 22. Minimal public summary

**Forthia is the first small COP-compatible cognitive router for Fractanet. It routes verb calls over augmented HTTP/JSON APIs by applying hard capabilities first, then exergy-oriented scoring among admissible routes, while producing COP-style traces and explanations.**
