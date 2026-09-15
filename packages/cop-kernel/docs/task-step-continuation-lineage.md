---
title: Task / Step / Continuation Lineage in COP
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

# Task / Step / Continuation Lineage in COP

**Date:** 2026-05-31 **Context:** Work toward first stable COP implementation before integration
into apps/platform and briques. **Related:** l8 (historical), Inox (future runtime), COP
Architecture.md, cop-kernel implementation, bac-à-sable validation, supabase schema.

## Historical Precedent: l8

l8 (https://github.com/JeanHuguesRobert/l8, ~2016 era) provided a JS-native model for asynchronous
control flow that feels very close to COP's ambitions:

- **Task**: An activity that a normal JS function cannot do because JS functions cannot block. A
  Task is composed of **Steps**.
- Functions are broken into steps executed by the l8 scheduler.
- Steps are closures. Execution moves step to step. If a step cannot proceed immediately, the task
  "blocks" (cooperatively) waiting for something (promise, callback, signal, etc.) before resuming.
- Tasks are also Promises.
- Rich control: .step, .task, .fork, .repeat, .spawn, .generate, .pause/.resume, synchronization
  primitives (semaphores, mutexes, queues, signals, timeouts, generators).
- Message-passing / actor flavor in later parts.
- Goal: Make async JS feel more like readable blocking/threaded code while staying in the JS event
  loop model.

l8 Tasks/Steps were a pragmatic solution to "callback hell" and complex async flows in real
applications (notably Kudocracy, liquid democracy).

### Comparison to other l8 mechanisms (Promise/Parole, Water, Fluid) – local l8/ copy + wiki (2026)

l8 (local at `l8/` in workspace: lib/whisper.js for core Parole, lib/water.js for Water+Fluid impl + tests/parole.js, test/promise.js, README, doc/api.txt) has several orthogonal but composable primitives that COP draws from and generalizes. These were explored via the local depot as the user noted ("there is a local copy of l_").

**l8 Promise (via Parole integration, test/promise.js adapter for promises-aplus, api.txt):**
- Standard thenable: .then(ok, ko), .resolve(val), .reject(reason), .signal alias for resolve.
- Tasks are promises (fulfilled on success/reject on fail).
- Paroles and Boxons can be cast to/ from ECMA promises.
- Used for task completion monitoring, async outcome, chaining.

**l8 Parole (lib/whisper.js + lib/parole.js wrapper, test/parole.js, wiki AboutParoles):**
- "Paroles are promises with steps, in callback disguise." / "Paroles are Function objects that make it easier to use Promise/A style in callback world."
- A callable object: `p = Parole(); someAsync(..., p);` (node-style cb signature f(err, ...rslt) when called as cb).
- When invoked as cb, fulfills attached .then promises or .on listeners: p(err) rejects, p(null, rslt) resolves.
- Rich: .on(listener) for cb style, .then for promise, .will() for multi-step chaining (avoids callback hell, like steps), .pipe() for composition/pipes, .subscribe for pub/sub, .resolve/.reject, .when(multiple) for join, .upgrade, support for generators/pipes.
- When used as "cb" for async, the parole "remembers" and can later be used as promise or have listeners attached even after fill.
- Also supports "steps" via chaining and "pipes" for data transform chains.
- Bridges node cb <-> Promise/A perfectly; tasks use similar.

**l8 Water (lib/water.js, wiki AboutWater, README examples):**
- Reactive programming "like cells in a spreadsheet".
- Water "sources": `w = Water([init]); w(value)` to "pour"/push update.
- Transformers: `a = Water(init, fn)` where fn is transform; called when deps change, in topo order (auto-dep detection in "prologue" sync phase via `source(Water)` or passed sources).
- Supports async: fn can return promise/parole/boxon; propagation waits.
- Lazy "demand": Water.demand(sources) for on-demand (not auto propagate; use .demand(cb) or Water.again()).
- Fillers: Water.filler(w) turns node-style cb into a pourer for the water (cb outcome "pours" into w).
- Connections: source( dest ) or Water.connect; disconnect.
- Effects: Water.effect(fn) post-propagation, Water.back for pre.
- Errors in-band as special {water, error}, wrap/unwrap.
- Handles diamonds (last change wins?), cycles (propagation can loop, "turing complete").
- "Machine" for processing changes.
- Interop with boxons/paroles/promises for async transforms.
- "pour" changes propagate reactively to dependents.

**l8 Fluid (in water.js, wiki AboutFluids, README):**
- "Fluids are streams. They are made of water sources." Fluent/stream API on top of Water.
- `f = Water.fluid().from(source).map(fn).filter(p).reduce... .tap... .to(sink);`
- Array-like but reactive to pushes: .map, .filter (where/select), .reduce, .forEach/each, .tap/subscribe, .find etc.
- Wiring: .from(source) (array ok, with hold/release to control timing), .to(sink), .push(v), .hold()/.release() (global nested counter for queueing pushes during build or prop).
- Control structures: .if(p). ... .else_if(). ... .end_if() (or .junction), .while(p)... .end_while (or .repeat), .route({even: is_even, ...}) for multi-way, .branch, .junction/.repeat for merge/loop.
- Lifecycle: .close() (special "close" error), .failure(mapper)/.catch for errors (in-band {water,error}), .final for close only.
- Stateful: .stateful([arr]) to remember history (for index relative ops), .stateless().
- Async friendly: ops can return promise/parole for later result.
- Subclassing: Water.fluid.subclass() + .method() for domain fluids (e.g. numbers with .average()).
- .define(fn) for "fluid fn" that takes input fluid, sets up, returns callable that pushes and gets output (sync or cb).
- .raw for not skipping errors, .flatmap, etc.
- "fluent" composition for stream processing with control flow.

**Mapping / Comparison to COP (Cogitors, Continuations, stack framing, control plane, runner, Tasks/Steps, buses):**

- **Parole <-> COP Continuations + stack-call + "as input" result delivery + Cogitor onPacket**:
  - Parole's "call me as cb (err,rslt) to fulfill my promises/listeners" is *exactly* mirrored by COP's "attach optional_continuation to a stack 'call' or resume; when the target Cogitor produces result, the runner delivers it by sending a 'continuation-input' packet (with value) to the waiting Cogitor's stdin, which onPacket sees as the 'cb firing'".
  - The continuation descriptor (resumeTo + state + id) plays the role of the "parole object" (the return address + context).
  - Chaining .will() / steps in Parole ~ emitting a continuation that wires the next Cogitor (or step), with the runner as the "scheduler" that applies it.
  - .pipe() composition ~ runner dynamically wiring Cogitors based on emitted conts (no static graph).
  - Parole as "cb in promise disguise" when passed to async ~ stack frame's optional cont when "calling" a (remote) Cogitor via the protocol.
  - COP lifts it out of process: the "parole" travels as JSON envelope packet (routable by cogentia, with capability/spawn meta), the "fulfill" is mediated by runner over stdio. Supports cross-lang (any tool emitting the frame), distributed, with policy.
  - Cogitor's readline receiving continuation-input is the "listener/cb" being invoked (cooperative, can check shouldStop etc).
  - l8 Parole for "multiple steps promises" / breaking callback hell ~ COP's task/step + runner's continuation chaining + stack for "call with cont".
  - Bonus: COP's explicit control plane stop (graceful shouldStop on Cogitor) directly echoes l8 Task .stop / .cancel / gentle stop (user mentioned "should stop command sent to a task").

- **Water <-> COP events/buses + Cogitors as "transformers" + demand-like pending conts + runner wiring**:
  - Water "pour value to source -> auto propagate/transform to dependents in topo, async via returned promise/parole" ~ COP "emit packet (data or stack) to Cogitor stdin -> Cogitor 'transforms' in onPacket and emits output packet(s); async 'result' via attached cont delivered later by runner (like waiting for async transform)".
  - Water sources/transforms with dep auto-detect ~ Cogitors "depend" via the continuations they emit or receive; runner "connects" them.
  - Demand (lazy on-demand) ~ pendingContinuations in runner + continuation as "demand for result" ; Water.again() ~ re-using cont or delivering multiple.
  - Filler(cb -> pour) ~ the runner's sendPacketToStream or the way stack/ cont is fed as "input" to Cogitor.
  - Effects post-prop ~ cop.packet.* events or onClose in Cogitor.
  - Water's support for cycles/loops in prop ~ COP's dynamic graphs and "process" streaming mode (can loop via conts).
  - But COP is not pure data-reactive: it's control-flow first (continuations direct "what next"), with packets carrying meta (envelope for routing/policy, unlike Water's value focus). Water is great for derived/computed values; COP uses similar for orchestration of *work* (tasks, cognitive turns in Ophelia, etc.).
  - COP's buses/SubBuses provide "propagation" substrate (publish to interested, per-topic), JobScheduler for timed "demand".
  - The "as input continuation" is a powerful back-channel (result flow) that Water achieves via connections/demand but COP makes first-class portable "closure" for IOC (as user noted).

- **Fluid <-> COP Cogitors (as stream processors) + stack "process" verb + runner dynamic composition + control/branch via conts + complete/close packets**:
  - Fluid "stream of pushes, apply fluent .map/.filter/.reduce/.tap reactively, with .if/.while/.route branching, .junction merge, .from/.to wiring, hold/release timing, .failure/.final for errors/close, stateful history" ~ COP "Cogitor as long-running 'fluid': receives stream of input lines/packets (data or stack 'process'), does logic (can implement map/filter etc in onPacket), emits outputs; 'process' verb in stack framing starts streaming mode (vs 'call' one-shot); runner does the 'composition' by wiring via emitted conts (dynamic .from(cont) instead of static fluent chain); branching via different resumeTo/caps in conts or capability routing; errors/complete via packets or control stop (analog to .close/.failure); shouldStop for graceful 'end of stream'".
  - .tap / subscribe ~ onPacket / bus subs in COP.
  - Fluent in-process chaining ~ dynamic cont emission + runner (more powerful: can spawn new Cogitors on fly, attach result closures, cross process/lang, with envelope policy).
  - Fluid's control (if/while/junction) ~ COP's stack + cont + task/step + control plane (stop as "break", complete as end).
  - Stateful ~ Cogitor can hold state (or use task/step metadata).
  - Async in fluid ops ~ continuations for async "steps" inside Cogitor or across.
  - COP "Cogitor" generalizes the Fluid "processor" to a first-class distributed "thinker" that can participate in cognitive routing (requiredCapability on packets), use continuations for both forward and reverse (result callback), and be controlled (stop/kill).
  - l8 Fluid is elegant in-JS stream DSL; COP makes the equivalent (stream Cogitors + wiring) the *fabric* for larger systems, with audit (events), resilience (RAIX, federation), mixed participants (AI/tool/human as Cogitors).
  - The user's proposed "stack" framing is a direct "call site" syntax that feels very fluid/parole-ish: data stack + optional "return parole/cont" + verb (call/process like sync vs stream op).

**Synthesis / Evolution**:
- l8 Parole + Water + Fluid + Promises + Tasks provide a rich, composable toolkit *inside one JS runtime* for control flow (parole steps), reactive data (water), streams with control (fluid), unified async (promises/boxons).
- COP "lifts" the same ideas to a *distributed cognitive packet fabric*:
  - Parole-like "cb with promise" becomes portable, routable Continuation packet (with resumeTo as the "then", state, and the runner as the "fulfiller" that "calls back" via continuation-input when result ready).
  - Water/Fluid "reactive streams + transforms + branching" becomes Cogitors (stream or one-shot "processors that cogitate") + runner as dynamic composer/wirer (using conts for the "pipes" and result backflow) + buses for propagation + stack framing as the "pour/call with cont" syntax + control plane for lifecycle (stop ~ fluid close or task stop).
  - Tasks/Steps remain (now with events/projections + linked conts).
  - Adds: envelope-only cognitive routing (capability/policy layer beyond l8 actors), full event sourcing (everything replayable, unlike l8 in-mem), cross-lang/portable via stdio protocol (Cogitor as universal "actor" or "fluid processor"), dynamic no-pre-graph (conts self-assemble the "fluid" graph at runtime), mixed agents (human/AI/tools), RAIX resilience.
- The "Cogitor" name (user idea) perfectly captures the "cogitates using these l8-inspired primitives + packets" vs plain processor.
- Recent features (continuations as input/closures, stack with optional cont + verb, control stop/kill with shouldStop, runner delivery) are *direct lifts and generalizations* of l8 Parole (cb/promise hybrid + steps/pipes), Water (reactive + demand + filler), Fluid (streams + control + fluent), and Task stop.
- In l8 these are for nice JS async; in COP they are the *mechanism* for the "cognitive OS" layer (orchestrating real work across heterogeneous participants with observability and policy).
- Future Inox (stack VM + actors + strict planes) will make native versions of Water/Fluid/Parole/Cont even tighter with COP's model.

This lineage (l8's practical JS control primitives → COP's distributed packetized cognitive version → Inox efficient realization) is explicit in the code/docs.

(Added based on local l8/ exploration + wiki + prior COP work on continuations-as-input, stack framing, control plane, Cogitor naming, runner.)

## Current COP Model (from Architecture.md)

COP generalizes and distributes this idea across agents, time, and systems:

- **Event** is the only source of truth (immutable log).
- **Topic**: Long-lived scope of activity (a deliberation, a case, a project, a regulatory file...).
- **Task**: Unit of work within a Topic. Has status, attempts, leasing (for distributed workers),
  meta.
- **Step**: Finer-grained subunit inside a Task. Has name, input, output, status. Linked to
  Artifacts.
- **Artifact**: Immutable durable output (documents, decisions, models...). Continuations are a
  reserved subtype.
- **Continuation** (Artifact type "cop/continuation"):

## Broader Architectural Influences

The Task/Step/Continuation model in COP is not an isolated invention. It sits at the intersection of
several deep influences in the author's thinking, which consistently emphasize **resilience through
discretization, distribution, redundancy, and actor-like autonomy without a capturable center**.

### Actor-Oriented Programming and Erlang

- **Core idea**: Computation as independent actors that communicate exclusively via asynchronous
  message passing. No shared mutable state. Actors can be supervised; failure in one does not
  cascade if the supervisor can restart or reroute work.
- **Erlang realization**: Lightweight processes, "let it crash" philosophy, supervision trees, hot
  code loading, distribution transparency.
- **Mapping to COP**:
  - COP **Agents** (human or machine) are actors.
  - **COPBus** is the mailbox + transport (message passing).
  - **Tasks and Steps** are units of work assigned to actors.
  - **Continuations** are the portable, resumable "process state" that can be moved between
    actors/nodes.
  - **Scheduler / JobScheduler + obsolescence / retry** act as the supervision layer: they decide
    when to resume, retry with backoff, or declare a line of work obsolete (equivalent to
    terminating a misbehaving process and letting higher-level logic decide the next action).
  - The requirement that agents be stateless between invocations and idempotent w.r.t. Events
    directly echoes Erlang actor purity and at-least-once messaging.

This influence explains why COP treats failure and resumption as first-class, observable phenomena
rather than exceptions to be hidden.

### ARPANET, Packet Switching, and Mesh Networks

- **ARPANET insight** (Paul Baran et al.): Survivable communication does not require dedicated
  end-to-end circuits. Break information into discrete, addressed, routable packets that can take
  multiple paths and be reassembled. The network continues functioning even when individual links or
  nodes fail.
- **Mesh networks**: Decentralized, self-organizing connectivity with no privileged central routers.
  Routing happens locally; redundancy is structural.
- **Mapping to COP**:
  - **Events** are the packets (immutable, addressed, causally ordered via topicSeq /
    parentEventIds).
  - **Topics** are like flows or sessions.
  - **Tasks / Steps / Continuations** are the "payload work units" that can be routed,
    stored-and-forwarded, and resumed on whichever actor/node in the mesh is currently available and
    capable.
  - The Scheduler acts as a decentralized router + supervisor that chooses resumption paths based on
    events, time, and policy (including RAIX redundancy considerations).
  - Degraded-mode and partition tolerance (DTN influence) are explicit design conditions, not
    afterthoughts — see the "avian SD card" extreme case in the Inference Packet Networks paper.
  - No single point of control or failure for a Topic's ongoing work.

This is why COP insists that all state (Tasks, Steps, Continuations, Artifacts) must be
reconstructible from the Event log alone.

### RAID Generalized to RAIX

- **Classic RAID**: Redundancy across multiple inexpensive, independent disks so that failure of any
  one does not lose data. The array as a whole is more reliable than its parts.
- **RAIX generalization** (prominent in FractaVolta and related writings): Apply the same principle
  not just to storage but to any critical resource in the stack — compute nodes, energy sources
  (exergy packets), model versions, execution environments, human/AI agent capacity, network paths,
  legal jurisdictions, etc.
- **"X" can be anything whose failure would otherwise create a single point of capture or
  fragility.**
- **Mapping to COP**:
  - A **Task** or **Continuation** can be redundantly scheduled or resumed across multiple
    independent "X" elements in the RAIX array.
  - If one node/energy source/agent fails or is constrained, the Continuation (with its state +
    resumption conditions) can be picked up by another independent element without loss of progress
    or audit trail.
  - The **JobScheduler**'s exponential backoff + explicit obsolescence support, combined with the
    low-level Scheduler's time- and event-based resumption, provide the mechanisms for this
    redundancy at the cognitive layer.
  - This directly supports the goals in _Inference Packet Networks_ (IPN): bounded continuity of
    useful inference when hyperscale/central systems are unavailable, overloaded, legally blocked,
    or energetically constrained.
  - The entire point of strong causality, provenance, and replayability in COP is to make RAIX-style
    redundancy effective for _reasoning and decision processes_, not just data or energy.

The combination produces the characteristic COP posture:

- Discretize work into Events, Tasks, Steps, Continuations (packets).
- Route and resume them across a mesh of redundant, independent actors/nodes/energy sources (RAIX +
  ARPANET/mesh).
- Treat actors as autonomous and fallible (Actor model + Erlang supervision), with observable
  failure and explicit resumption/obsolescence paths.
- Make everything auditable and reconstructible from the log.

This is the same architectural answer the corpus gives at every scale: from language (Inox
control/data separation + actors), through network (patent + EPN/IPN), territory, individual
(Cogentia), governance (DHITL), to the cognitive orchestration layer (COP itself).

## Implications for Implementation and Validation

When working on Task/Step/Continuation in the kernel and bac-à-sable:

- Prioritize mechanisms that enable **routing + resumption across independent redundant elements**
  (not just single-node efficiency).
- Make failure, delay, partition, and obsolescence first-class and observable (Erlang "let it
  crash" + ARPANET degraded paths).
- Ensure the model composes cleanly with the packetized layers below it (EPN for energy, IPN for
  inference workloads).
- Design the surface so that future Inox-based edge nodes can act as first-class actors in the RAIX
  mesh without a central coordinator.

### Recent Enhancement (May 2026)

**Bus evolution toward Fractanet**

- `bus.js` now supports:
  - `bus.sub(namespace)` and the convenient `bus.forTopic(topicId)` → hierarchical per-Topic
    sub-buses (core request).
  - Federation primitives (`federate(peer)`, `declareInterest(pattern)`, `receiveFromFederation`).
  - `createFractanetBus(name)` factory.
- `COPScheduler` now has `getBusForTopic(topicId)` and automatically prefers per-topic sub-buses for
  registration and resumption events.
- Generalized SubBus subscription scheme (scoped listeners + clean type delivery on sub-buses).
- Task/Step helpers now route events through topic sub-buses when context is available.
- `COPJobScheduler` generalized to use per-topic sub-buses (via scheduler or direct `forTopic`).
- `SubBus` subscribe scheme significantly improved for proper scoping and clean event delivery.
- Added `propagateInterest()` for basic subscription propagation across federated buses.
- bac-à-sable pipeline now offers `busForCurrentTopic()` (auto-scoped when `context.currentTopicId`
  is set) + `propagateInterest`.
- The `research-review` scenario demonstrates the full generalized per-topic sub-bus + subscribe
  pattern.
- New dedicated `federation-demo` scenario added (and iteratively improved) to demonstrate real
  cross-bus continuation registration and event-triggered resumption using separate schedulers +
  federated topic sub-buses.
- Pipeline enriched with `createFederatedBusPair()`, `federateBuses()`, `propagateInterest()`, and
  improved `busForCurrentTopic()` helpers.

Combined with the Task/Step/Continuation generic helpers (`createTaskWithInitialContinuation`, event
emission on the bus, etc.), we now have the foundation for decentralized, observable, RAIX-resilient
orchestration at the kernel level — instead of duplicating it in every application.

These changes were exercised and validated in the bac-à-sable.

See also the updated comments in `continuation.js`, `jobScheduler.js`, and `index.js`.

See also the sibling documents in this directory and the canonical Fractanet paper in the
FractaVolta repository:

`https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md`

- Suspends reasoning/work.
- Payload includes: resumeTo (agent), resumeIntent, state, taskId/stepId references, conditions
  (waitForEvents, resumeAfter, resumeBefore), retry policy, causality (correlationId,
  parentEventIds).
- Original Continuation is never mutated; resumption produces new Events/Artifacts/Continuations.
- **Scheduler**: Reacts to Events and time (ticks, resumeAfter) to decide when to resume
  Continuations. Publishes resumption messages. Supports retries and obsolescence.
- All of Tasks/Steps/Artifacts/Continuations are **projections** reconstructible by replaying the
  Event log + Store.

### Granularity of Artifact Persistence, "Transactions", and Stable States

A recurring practical tension (raised explicitly during work on long mutations such as "add a column to a table"):

- The *event* log wants (and gets) fine-grained, immutable, causal steps for every discrete action. This is the source of truth and enables perfect replay, resumption, audit, and RAIX.
- A "logical unit of work" (e.g. evolving a table schema + data + dependent views/indexes/code/tests) can involve dozens or hundreds of micro-changes.
- Persisting a full `cop_artifacts` row (with potentially large `content` or `content_ref`) for every intermediate version is wasteful in storage, query cost, and cognitive load. What usually matters for consumers and for "the corpus" is the *stable before* state and the *stable after* state.
- If the whole evolution fails part-way, we want a clean "abort + rollback to last known stable" without having to manually undo a long trail of intermediate artifacts.

COP already has several pieces that map to a solution:

- **Tasks as the natural transactional boundary**. A `cop_task` (with its child `cop_steps`, leasing, status, `retry_count`, and linkage via `root_correlation_id`) is the scope of "one logical evolution". All micro-artifacts/events during the task can be tagged with `task_id` / `task_step_id`. Only on successful `markTaskCompleted` (or equivalent) do we promote a *stable* artifact.
- **Artifacts are already linked to tasks/steps** (`task_id`, `task_step_id` columns added in migrations). `emitCopArtifact` now (as of the 2026-06 enhancements) also accepts `stabilityLevel`, `derivesFromArtifactId`, `isCompacted`, and `contentRef`.
- **Checkpoints + continuation state**. `cop_step.checkpoint` and the `state` inside continuations can carry the "current working table representation" cheaply during the long task without creating heavyweight artifacts every step.
- **Events as the fine-grained truth**. Most micro-changes ("column_added_draft", "data_migration_chunk_3", "index_rebuilt") should primarily be *events* (cheap, append-only, subscribable). Artifacts are the *materialized, named, queryable* stable projections.
- **Compensation + obsolescence** (already in the model via JobScheduler retry/obsolescence and control-plane stop/kill on Cogitors). On task failure you schedule compensating continuations instead of (or in addition to) mutating history.
- **Low-level atomicity**. The storage layer's `transaction(cb)` (implemented across sqlite/postgres/mysql/etc. drivers) can be used to atomically do "mark task failed + insert compensation marker artifact + update any canonical pointers".

**Recommended patterns for "table evolution" and similar large mutations:**

1. **Stable vs. working artifacts (the core mechanism)**  
   Use `stabilityLevel: 'transient' | 'provisional' | 'stable' | 'superseded'`.  
   During the Task: emit events + optional lightweight provisional artifacts (or just put big state in `content_ref` + task metadata).  
   On success: call helpers such as `recordArtifactEvolution({ taskId, before: lastStable, after: newTableState, operation: 'add_column' })` or `stabilizeTaskArtifacts(taskId, { stableArtifacts: [...] })`. This creates one (or a small number of) `stable` artifact(s) with `derivesFromArtifactId` linking the before/after and `task_id` for traceability.  
   Intermediate artifacts can be left as transient or explicitly superseded.

2. **Content externalization for bulk data**  
   For anything larger than small JSON (real table schemas + sample data, documents, model weights...), put the bulk in fileStorage (or external CAS like S3/IPFS/content-hash store) and store only `{ type: 'table', schema_version: '..', data_ref: 's3://.../hash', hash: '..' }` (or a `content_ref` column) inside the artifact. This makes even "stable" snapshots cheap in the main table.

3. **Task = Saga / distributed transaction**  
   The parent Task orchestrates phases (via child Steps or sub-continuations / forked Cogitors). Each phase can have its own lease + continuation.  
   On any failure inside the task: the task status goes to failed (via `markTaskFailed`), compensation continuations are emitted (e.g. "revert the partial column add using the pre-state captured at task start"), and no new stable artifact for "after" is promoted. The previous stable artifact remains the authoritative version of the table.  
   This is exactly the saga pattern humans use (draft PRs, "we'll revert if the migration breaks prod", meeting notes as events, final "approved version" as the stable artifact).

4. **Partial consistency as a feature (especially for AI agents)**  
   While a long Task is running, the "corpus" (artifacts visible under a Topic) can legitimately be in a partially-consistent state.  
   - Agents subscribe to `cop.task.*` + `cop.artifact.stability_changed` (or just the events) and can choose:
     - "I need the last *stable* table" (filter on stability or task status).
     - "I can work with last stable + these pending deltas from open task X" (AI agents are often *better* than classical deterministic code at this fuzzy reconciliation).
   - Emit "working change proposed" events early so dependent agents can prepare or block if they must.
   - This matches how humans operate daily (eventual consistency via communication + drafts + "we'll clean it up in the next release") and is explicitly supported by the RAIX + mesh + agent-autonomy principles in the architecture.

5. **Compaction / lineage hygiene (future or background)**  
   After a task stabilizes, a compactor (or the `isCompacted` flag + `metadata.compacted_from`) can replace a long chain of transient deltas with a single summary delta artifact, or just drop the transient ones (they are still reconstructible from the event log).  
   `recordArtifactEvolution` already gives you the before/after links for git-like history queries ("what was the table at the end of task T?").

**Helpers added (in artifacts.js)** to make the above ergonomic:
- `emitCopArtifact(..., { stabilityLevel, derivesFromArtifactId, contentRef, isCompacted, ... })`
- `stabilizeTaskArtifacts(taskId, { stableArtifacts, supersededArtifactIds, ... })`
- `abortTaskEvolution(taskId, { reason, compensationArtifacts, ... })`
- `recordArtifactEvolution({ taskId, before, after, operation })` — the "table before vs after" one-liner.

These are intentionally thin (they still go through the normal insert + event emission path) so they remain storage-agnostic and replayable. For stronger atomicity you wrap the call site with `storage.transaction(...)` when the concrete storage supports it.

This design deliberately re-uses the existing "Event = truth, Artifacts/Tasks/Steps = projections", Task-as-scope, continuation-as-resumable-state, compensation/obsolescence, and leasing machinery instead of inventing a separate "transaction" concept that would fight the distributed + cognitive nature of the system.

See also the "side" retry+caching model (in the sibling `side/` repo) as a complementary technique at a higher level: an entire "evolve table" Task can itself be wrapped in a Side action so that expensive reads are cached across retries of the whole evolution, while the actual side-effecting promotion of the stable artifact is done only in the final `write()` / success path.

The result is practical, auditable, distributed-friendly "transactions" that feel a lot like how humans (and increasingly AI-augmented teams) actually manage complex changes to shared artifacts.

Key invariants preserved:
- Nothing is ever mutated in place in the log.
- You can always answer "what was the state of this table right before task T started?" and "what is the current stable state after all known completed tasks?"
- AI agents can be given the full event stream + last stable + list of in-flight tasks and do useful work (or decide to wait for stabilization).

This is one of the places where the COP model shines compared to classical strict ACID transactions: it makes the *partial and evolving* state first-class and usable. 

(Added 2026-06 during discussion of artifact persistence granularity for real-world mutable entities.)

Key invariants (from spec):

- At-least-once delivery + idempotency.
- Per-Topic ordering (topicSeq).
- Strong causality and auditability.
- Human and machine agents treated uniformly (DHITL).
- Obsolescence explicitly supported (especially useful for AI agents deciding a line of inquiry is
  no longer relevant).

## Future Substrate: Inox

Inox (https://github.com/virteal/Inox) is designed as the efficient, portable runtime for exactly
this kind of agentic, distributed, traceable computation:

- Concatenative stack VM (Forth lineage + Smalltalk messaging + Erlang actors).
- **Strict control plane / data plane separation** — data lives on stacks longer; state machines
  expressed natively. This maps beautifully to COP's "don't mutate the Continuation, emit new
  Events/Artifacts" rule.
- Named values on stacks (tag-based access instead of positional).
- Actors with multiple stacks/addresses (natural mailboxes for different concerns: data, control,
  resumption conditions).
- Reactive sets for dataflow.
- Will descend from JS/TS → WASM → C/C++ → bare metal (ESP32 etc.).
- Goal: uncapturable computational nodes that can host COP agents with the same semantics and
  traceability from cloud down to tiny edge devices.

Inox's control structures (loops, conditionals via verbs on stacks, actors) and actor model are
natural vehicles for implementing COP Schedulers, Task/Step executors, and Continuation resumption
with low overhead and excellent observability.

## Practical Usage Implications (for apps/platform and briques)

From schema, bac-à-sable scenarios, and stated priorities:

- Long-running civic, legal, research, and regulatory processes (months/years, multiple human + AI
  participants, many natural suspension points).
- Distributed work with leasing (platform as the engine scheduling work across
  instances/briques/agents).
- Rich resumption conditions mixing events, time, external signals, and agent decisions (including
  obsolescence).
- Strong requirement for replay/audit (every decision, every artifact, every resumption must be
  explainable and reconstructible).
- Briques participate by emitting Events, producing Artifacts (including Continuations), and
  handling Steps (via tools, Prolog, LLM agents, human UI flows).

## Current Gaps / Work Items in cop-kernel

- JobScheduler is a good start for higher-level scheduling with backoff + obsolescence but lacks
  persistence (the `store` param is declared but unused).
- Task/Step lifecycle is mostly implicit in the schema and continuation descriptors (taskId/stepId
  fields exist); we need clearer helpers for creating/updating Tasks and Steps as first-class
  projections driven by Events.
- Better integration between low-level Continuation resumption and higher-level Job/Task concepts.
- Observability: rich traces that include Task/Step/Continuation transitions (the bac-à-sable is
  already generating these; we can feed them back into the kernel).
- Alignment tests against the spec (especially §5.5 resumption semantics and the requirement that
  everything is replayable from Events).

## Recommended Next Steps

1. Flesh out explicit `createTask`, `createStep`, `updateTaskStatus` etc. helpers in the kernel,
   driven by Events.
2. Wire COPJobScheduler to use a real Store (start with inMemory, then one of the existing
   sqlite/supabase backends).
3. Enhance the bac-à-sable scenarios (especially machine-a-explorer-gabarit-abstrait and regulation
   workflow) to explicitly create and manage Tasks/Steps/Continuations using the kernel primitives.
4. Add conformance-style tests that replay event logs and verify Task/Step/Continuation projections.
5. Document the mapping in this file and cross-link from Architecture.md, l8 wiki/history, and Inox
   spec.
6. When stable, provide a clean integration surface for apps/platform (e.g., a "PlatformCOP" host
   that wires the kernel to the multi-instance Supabase setup and brique registry).

This lineage (l8 practicality → COP distributed auditability → Inox efficient execution) is one of
the strongest threads in the corpus. Getting Task/Step/Continuation right is central to making the
whole thing work without a capturable center.

**Note on the historical repositories**: See Inox#17 ("Destiny of the l8 and side repositories in the corpus") for the current discussion and recommended handling (preserve as historical Rossignols + interop layers during Inox maturation; strong lineage pointers in their READMEs; no major new investment; concepts evolved into l9.nox + COP).

### l8 face for Cogitors + complementarity with the "side" repository

User request (reconciliation of COP + l8 + side for "Cogitor as special l8 Step"):

A Cogitor (the readline-based participant created by `createReadlineCogitor`) can be presented as a special kind of l8 Step. This gives the COP API an "l8 face": l8 code (or l8-orchestrated flows) can treat remote/heterogeneous Cogitors (including JVM agents speaking the packet protocol over stdio or other transports) as ordinary cooperative blocking steps, gaining all of l8's structured control flow (fork/join, parent/child tasks, semaphores, pause/resume, local bindings, etc.) while the actual execution crosses the packet boundary.

**Why it still makes sense post-async/await**:
- async/await is excellent for intra-process JS.
- l8's value (and the value of exposing it here) is the *explicit, controllable, inspectable* cooperative steps + rich task surface for complex orchestration across *external* participants.
- The existing machinery (stack framing with optional continuation + "call"/"process" verb, `pendingContinuations` + `deliverResult` + `continuation-input` packet injection in the runner, `createCogitorL8Waitable` + `callCogitorAsPromise` helpers, `shouldStop` mirroring l8 gentle stop, cogitorCooperation fork/join already annotated as l8-inspired) makes the bridge natural.

**Concrete helpers** (added to `continuation.js`):
- `createCogitorL8Waitable(targetCapability, stack, opts)` → `{ promise, continuation, resolve, reject, buildStackCallPacket() }`.
  - The promise is suitable for `l8.wait(promise)` inside an l8 step body (blocks the l8 task cooperatively until result).
  - Caller sends the call (using the continuation or the stack packet), and on result delivery (the runner's deliver path or direct `onPacket` seeing `packetKind: 'continuation-input'`) calls `.resolve(value)`.
  - This makes a JVM (or any stdio Cogitor) look like a local l8 Step from the caller's perspective.
- `callCogitorAsPromise(targetCapability, stack, opts)` → the promise directly (for convenience).

**Complementarity with the "side" repository** (`C:\tweesic\side` — "Synchronous javascript thanks to caching & pure functions", retry-on-block + slots for results + delayed writes for side effects, aimed at making async (including Lambda) look synchronous):

- side is the "outer" reconciliation: wrap a whole "cognitive turn" or exploration sub-tree in a Side action.
- Inside the side function, use `side.slot(() => callCogitorAsPromise('cap', input))` for each Cogitor call. Slots cache the result across retries of the side action (exactly like side does for any async).
- Only on final success do the real side effects via `side.write(() => promoteStableArtifact(...))` or `side.restore` for reversibility.
- This makes the high-level unit retryable and "pure until commit", while the inner structure can still use l8 tasks/steps (with Cogitors as steps via the waitable bridge) for fine-grained control flow.

Together:
- l8 inside: explicit steps, fork/join trees of Cogitors, l8's full control primitives.
- side outside: the turn as a retryable unit with cached sub-results and safe side-effect commit.
- COP underneath: the distributed packet fabric, continuations as closures/callbacks, runner as dynamic scheduler, artifacts with stability/cache_key/retention for the "capitalized" results.
- Matches the user's note that side was "a kind of 'final' work to 'reconcile' asynchronicity of execution with a synchronous API", now lifted to the world of heterogeneous Cogitors and l8-structured orchestration.

See also the "Machine à explorer" gabarit (which uses continuations for suspended paths, artifacts as stabilisateurs, judgment for pruning) and the recent work on cache_key + `lookupReusableArtifact` + retention policies on artifacts (capitalization + GC of the maps without confusing them for the territory).

This is the practical bridge for "when a JVM needs results from some external agents, with all the benefits offered by l8" while keeping the side-style outer safety net.

(Added during return to COP + l8 + side thread, post the carte/territoire and exploration discussions.)

**Integrative framing (June 2026):** The higher-level pattern is described in the Cogentia research
corpus as "Cognitive Packet Switching" (see `cogentia/research/cognitive_packet_switching.md` and
`cogentia_continuation_packet_routing.md`). In this view, COP (with its Events, Continuations as
resumable payloads, and especially the Bus + sub-buses + federation primitives) supplies the
operational "packet switching" / routing layer for Fractanet. The per-topic SubBus, `federate()`,
`propagateInterest()`, topic-scoped scheduling, and generic Task+Continuation helpers are the
concrete realization of routable, resumable cognitive packets in a decentralized mesh (with RAIX
via redundant paths). The bac-à-sable scenarios (federation-demo, raix-obsolescence-resilience,
job-scheduler-stress-test) serve as executable validation of that routing model.

_Generated / updated during COP stabilization and packet-switching alignment work, 2026-05-31 / 2026-06._
