---
title: mcp/cop
author: unknown
date: "2025-12-24"
last_modified_at: "2026-09-24"
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 1cdac1c
  origin_date: "2025-12-24"
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---

# mcp/cop

COP router and Supabase adapters for the MCP (COP core).

## ACP host runtimes

`hostRuntimeClient.js` provides the experimental host-side adapter for installed coding agents. The
generic path is `acpStdioRuntime()`: it starts an ACP-compatible runtime over stdio, creates a fresh
session with only explicitly supplied MCP servers, and returns its bounded output through the
existing COP handler contract. ACP is an `ExecutionSurface`, never an identity or authority source:
the surrounding delegating agent remains responsible for mandate checks, budget
reservation/settlement, traces, and imputation.

`codexAcpRuntime()` preserves Codex's native inspection tools in its isolated working directory. Its
default `read-only` permission policy can admit only one-shot, local inspection commands; file
edits, network/elevation requests, persistent grants and unknown permission requests are refused and
recorded in the invocation's `permission_trace`. That policy is not an enforceable tool-call count.
ACP hard budgets admit only dimensions this adapter can bound before `session/prompt`: one governed
prompt (`max_steps`) and a prompt abort timeout installed before the session (`max_elapsed_ms`) that
is no greater than the reservation. `max_tool_calls`, `max_subagents`, and `max_external_effects`
are unenforceable on this profile, including a reserved zero. Tool-call ids, kinds, statuses,
permission decisions, the measured elapsed time, and usage updates stay observations. Provider cost
is `not_estimated` when the ACP usage update has no cost. An omitted hard dimension is not zero
usage. The current Agent JHN grant still names all five dimensions, so this preflight refuses that
grant. The mandate and the grant stay as they are. Additional MCP servers remain explicitly admitted
per runtime: they must be public/read-only and separately policy-reviewed, so the Cogentia MCP is
never injected as an ambient re-entry path.

Runtime descriptors are host-local configuration. They may contain the executable path and the
environment required by a vendor adapter, but `list()` and `resolve()` deliberately exclude both.
The direct `codex_exec_jsonl` path remains an explicit emergency fallback for a host without an ACP
adapter; it is not the generic integration model.

An installed runtime can declare `context_inheritance` as `none`, `ambient-host`, or `cop-artifact`.
`ambient-host` is deliberate: a locally authenticated client such as Codex may bring useful account-
or session-associated context, and a future LogicalAgent may be a useful delta from John rather than
a blank instance. This remains an optimisation, not its durable identity or memory. Any
consequential work must remain reconstructible from portable COP events, artifacts, and
continuations when the account, provider, host, or inherited context is absent.

## Selecting Codex or OpenCode

`codexAcpRuntime()`/`codexAcpCapabilityOffer()` and
`openCodeMagistralRuntime()`/`openCodeMagistralCapabilityOffer()` are distinct replaceable handler
bindings for the same `coding.assist.read` capability. Register both pairs in the host runtime
client and capability catalog. `HandlerAssistDecision.capability_requirement` is load-bearing in
`jhnDelegatingAgent`: a bound handler is considered only when its declared `capability` exactly
equals that requirement. `coding.assist` and `coding.assist.read` are distinct strings; there is no
prefix or inheritance match. A mismatch is refused as `capability_requirement_mismatch` before
Mandate evaluation, budget reservation, or governed invocation. A continuation requirement may then:

- pin `runtime_id` (or `offer_id`) for an explicit operator/governance choice;
- request `execution_surface: "acp"` for Codex ACP or `execution_surface: "cli"` for OpenCode; or
- omit both and let offer `attraction` express the deployment's default preference.

The resolver validates that the selected offer and runtime agree on host, handler, execution
surface, and capability before invoking it. OpenCode's reproducible, secret-free provider template
is `packages/magistral/config/opencode-magistral.example.json`. It uses the `magistral-once` agent
with one model step and no tools; the host runtime adds a hard elapsed-time termination boundary.
Retries and handler changes must be represented by a new governed continuation.

Usage:

- Mount the router at `/cop` in `mcp/server.js`.
- Use `mcp/cop/supabaseBus.js` to publish/subscribe events to/from `cop_event`.
- Use `mcp/cop/supabaseStore.js` to persist topics, tasks, steps, and artifacts.

Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`.

## Portable runtime writes

`portableRuntimeGateway.js` is the new write path for the JHN COP runtime. It serialises portable
rows before persistence and evaluates principal + mandate permissions in ESM, before any SQLite or
Supabase adapter is called.

`createPortableCopRuntimeHandlers({ gateway, resolveContext })` exposes its append/upsert handlers
only when the host supplies `resolveContext(request)`. That resolver must verify a cryptographic
capability or another instance-owned identity proof, then return `{ principal, mandate }`. It must
not treat an unverified HTTP header or source network location as a principal.

Bus abstraction:

- The repository includes a bus abstraction at `mcp/cop/bus.js` that chooses a bus implementation at
  runtime based on the `COP_BUS` environment variable.
- Supported values:
  - `supabase` (default) — uses `mcp/cop/supabaseBus.js`.
  - `ws` — uses `mcp/cop/wsBus.js` (websocket-based bus).

Example (shell):

```bash
# Use the websocket bus instead of the default supabase bus
COP_BUS=ws npm run start
```

Or set `COP_BUS` in your Netlify environment variables if deploying Edge functions.

Note: This is a minimal starting point; implement robust task claiming/lock semantics in the store
for Deno Edge function workers.

See `mcp/cop/IDEMPOTENCY.md` for details on idempotency, write-ahead, and restartability practices.

Netlify Deno Edge functions pattern:

1. Use the `cop_claim_task` RPC to atomically claim a task and push the lease for your worker.
2. The Edge function processes a single step and reports status using `PATCH` to `cop_step` and
   `cop_task`.
3. On success, publish `artifact_created` or `assistant_update` events to `cop_event` to notify
   clients.
4. On failure, clear lease/worker_id so other workers can take it.

This design favors short-running stateless functions paired with DB-level task leasing for
robustness and auto-retry (Erlang-style supervision can be simulated by a worker supervisor that
re-queues or monitors task counts).

## Portable runtime authorization

The portable runtime gateway authorizes each write in application code. A host can use
`createSignedCapabilityContextResolver()` with short-lived Ed25519 capabilities: the capability
proves the caller identity and references a `cop_mandates` row, while `resolveMandate()` reads the
instance's current mandate state. Suspension, reassignment, revocation, or a mandate version change
therefore invalidates a previously signed capability immediately.

The signing private key is host-only configuration and must never be committed or sent to a browser.
Public keys are selected by `kid` to permit rotation. The capability is audience-bound; neither a
Tailscale address nor an unverified HTTP header is an identity assertion. Supabase Auth and RLS may
be adapters and defence in depth, but are not the authority decision or a runtime dependency.

For a local Node instance, `createSqliteCopRuntimeStore(database)` supplies both the write executor
and `resolveMandate`. It accepts a `DatabaseSync` compatible database that has received the portable
migration. Malformed or missing mandate rows fail closed. Mandate mutation is intentionally not
exposed through the runtime write gateway: it requires a distinct, explicitly governed
administrative path.

`pnpm --filter platform bootstrap:jhn:local-cop` performs that first local bootstrap into
`apps/platform/instances/jhn-cop-local/` (Git-ignored). It creates the private Ed25519 key,
public-key configuration, migrated SQLite database, the transport ACL row, and one auditable
bootstrap event. It also records a separate normative mandate and a separate bounded
execution-budget grant. It refuses to overwrite state and never prints the private key or a bearer
capability.

Those are different authorities:

```text
mandate:jhn:runtime:1
  SQL transport ACL
  issuer instance:jhn
  grantee principal:jhn:runtime
  permissions for the signed capability gateway

mandate:jhn:agent:1
  append-only MandateDeclaration
  principal:jhn → agent:jhn
  scope limited to coding.assist
  not inferred from the transport row

budget:jhn:agent:local:1
  append-only ExecutionBudgetGrant bound to mandate:jhn:agent:1
  small local handler-turn ceiling
  not part of the mandate scope
```

`chat:jhn:local`, `repl:jhn:local`, and `console:jhn:local` open that SQLite file in-process through
`createJhnLocalOperationalAgent`. The transport ACL does not mediate those calls: the process is
inside the trusted host boundary and can read the state file directly. Normative Mandate and budget
checks still mediate consequential handler Acts. This is a local trust-boundary choice, not a claim
that security is unchanged, and it does not apply to deployed or public runtimes. The conversational
factory does not grant or repair its own mandate.

A directory created by the older bootstrap has the transport row and no normative declaration.
Repair it explicitly, without rotating keys or deleting history:

```text
node apps/platform/scripts/repair-jhn-local-agent-authority.js --state-dir <directory>
```

The repair is idempotent. It refuses if an existing Principal → Agent JHN declaration or budget
grant disagrees with this local canonical shape, or if the transport row itself is missing or
reassigned. It reports what it changed and does not print key material.

The state directory is deliberately portable: `cop-runtime.sqlite`, the public key configuration,
and the private JWK can be moved together to a Node host such as the Fracta VPS. The runtime does
not rely on Windows ACLs, Tailscale, or any OS-specific key store. The destination host remains
responsible for keeping the private JWK out of source control and transferring it through its normal
secret channel. After a stopped-runtime copy, run
`pnpm --filter platform verify:jhn:local-cop -- --state-dir <directory>`; it checks the transport
row, the normative Agent JHN mandate, the separate budget grant, and that the private/public key
pair matches, without disclosing either key or a bearer capability. A pre-#97 directory fails this
check until the repair command above has been run.

`pnpm --filter platform start:jhn:local-cop` starts the next boundary on `127.0.0.1:8787`:
`GET /health` and the six protected COP write routes. It never binds a public interface and loads
only the public capability keys. A separate local issuer must hold the private JWK and provide
short-lived bearer capabilities to callers.

`createJhnLocalCapabilityIssuer()` is that host-only issuer. It confirms the private/public key
match and the current SQLite mandate before issuing a 1–300-second capability; the subject must
equal the mandate grantee. For an agent command,
`pnpm --filter platform run:jhn:local-cop -- -- <command>` passes the capability only as
`COP_CAPABILITY` and the loopback URL as `COP_RUNTIME_URL`. Neither is printed or written to disk.

`chat:jhn:local` is the local conversational loop. It calls an OpenAI Responses adapter with
`store: false`, then records the user and assistant messages through the in-process SQLite
operational agent described above. A direct invocation is
`pnpm --filter platform chat:jhn:local -- --message "Bonjour John"`. The signed loopback gateway
remains available for other callers through `run:jhn:local-cop`.

### Future optimisation: provider conversation cache

The current profile is deliberately stateless: each turn reconstructs its useful context from the
durable COP/SQLite conversation. This is the portable baseline and must remain a working fallback.

Some providers, including the OpenAI Responses API, can retain a short-lived working state and
accept only a new turn plus a provider response reference. That state is an optional cache, never
the source of truth. A future router may select a `responses-stateful` profile, store its provider
reference alongside the local conversation, and fall back to the stateless profile after expiry,
provider failure, migration, or hibernation. Keep conversation routing and the reasoner adapter
separate so that this optimisation does not change the COP event model or require a specific
provider.

For local interactive use, `pnpm --filter platform repl:jhn:local` starts a terminal REPL for the
`john` conversation (or pass another conversation id as its first argument). It uses the same
in-process operational agent and persists every turn to SQLite. It does not issue a transport
capability for those conversational turns.
