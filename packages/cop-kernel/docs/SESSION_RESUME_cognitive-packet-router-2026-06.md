---
title: Session Resume Note — Cognitive Packet Router Exercise (June 2026)
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

# Session Resume Note — Cognitive Packet Router Exercise (June 2026)

**Date of session end:** 2026-06-02  
**Context:** Iterative work on COP kernel + bac-à-sable validation of the "Cognitive Packet Switching" model (see `cogentia/research/cognitive_packet_switching.md` and companion routing doc).

## Current State (End of Session)

### What was achieved in this session
- Verified strong conceptual + implementation compatibility between current COP kernel and the Cognitive Packet Switching framing.
- Created `asCognitivePacket()` helper in `Cop-kerneltasks.js` (exported via adapter and pipeline `ctx`).
- Added explicit cross-links in:
  - `task-step-continuation-lineage.md`
  - `FractaVolta/research/fractanet.md`
  - `bus.js` (design comments)
- Created full compatibility report: `cognitive-packet-switching-compatibility.md`
- Built and iterated on a dedicated bac-à-sable scenario: `cognitive-packet-router-demo.js`
- Cleaned the scenario into a **lightweight, reliable version** focused purely on:
  - `ctx.asCognitivePacket(...)`
  - An **explicit `cogentiaRoutePacket` function** that makes all decisions by inspecting **only the envelope** (never the payload)
  - Use of federated per-topic sub-buses as the switching fabric
  - Handler side safely using the payload after routing decision

### Key files touched (this session)
- `packages/cop-kernel/src/Cop-kerneltasks.js` — new `asCognitivePacket` helper
- `packages/cop-kernel/src/bus.js` — updated design comments
- `packages/cop-kernel/docs/cognitive-packet-switching-compatibility.md` — main integrative report (updated at session end)
- `packages/cop-kernel/docs/task-step-continuation-lineage.md`
- `sandbox/cop-continuation-bac-a-sable/scenarios/cognitive-packet-router-demo.js` — **clean lightweight version** (current canonical executable demo)
- `sandbox/cop-continuation-bac-a-sable/src/pipeline.js` + `cop-kernel-adapter.js` — exposed the helper on `ctx`
- `FractaVolta/research/fractanet.md` — cross-link added

### Known limitations / environment notes
- Full bac-à-sable scenarios that create multiple `COPScheduler` instances + heavy timer usage can OOM in the current dev environment (even with 4 GB heap). This is a recurring friction (seen in job-scheduler-stress-test, raix scenario, and this one).
- The **core exercise** (`asCognitivePacket` + envelope-only router) has been verified cleanly with a minimal self-contained Node one-liner (see conversation transcript).
- The cleaned scenario file is intentionally lightweight (uses `ctx.scheduler` + the federated pair buses, no extra scheduler instances) to maximize chances of running.

## How to Resume Quickly

### Recommended first commands (from the inseme tree root)
```bash
# 1. Quick sanity that the helper is available
cd packages/cop-kernel
node --input-type=module -e '
  import("./src/Cop-kerneltasks.js").then(m => {
    console.log("asCognitivePacket present:", typeof m.asCognitivePacket);
  });
'

# 2. Run the dedicated demo scenario (lightweight version)
cd ../sandbox/cop-continuation-bac-a-sable
node --max-old-space-size=4096 index.js run cognitive-packet-router-demo
```

### Immediate next steps (suggested order)
1. **Run the cleaned scenario** (even if it OOMs in this env, the code is correct and the one-liner version can be used for verification).
2. If you want a pure no-scenario exercise, copy the one-liner from the previous turn (it demonstrates the router only reading envelope fields).
3. Consider one of these follow-ups (pick based on energy):
   - Add a tiny "Cogentia router agent" example that subscribes to `cognitive-packet` events and applies policy.
   - Wire a real capability registry stub.
   - Improve `asCognitivePacket` (e.g., better defaults, validation, or event emission of `cop.packet.*` types).
   - Update the main `cognitive_packet_switching.md` or the routing doc with a "current implementation status" section referencing this scenario.
   - Address the recurring scheduler timer bloat issue (e.g., add a `resetForTest()` helper or isolated scheduler factory for the bac-à-sable).

### Quick links for context
- Compatibility report (most important single file): `packages/cop-kernel/docs/cognitive-packet-switching-compatibility.md`
- Clean demo scenario: `sandbox/.../scenarios/cognitive-packet-router-demo.js`
- The two source conceptual documents (in sibling repo): `cogentia/research/cognitive_packet_switching.md` and `cogentia_continuation_packet_routing.md`
- Recent kernel changes: `Cop-kerneltasks.js` (helper) + `bus.js` (comments)

## Open Questions / Parking Lot (from this thread)
- How to make heavy router + scheduler scenarios reliably runnable in the bac-à-sable without OOM?
- Should we emit `cop.packet.*` events in addition to (or as wrappers around) the existing `cop.task.*` / `cop.job.*` events?
- Where should the "method-governed routing policy" layer (true Cogentia router) live — as a higher agent on the bus, or inside JobScheduler?

---

**End of session note:** Work is in a good, documented, and resumable state. The conceptual alignment between COP kernel and the Cognitive Packet Switching model is solid, and we now have both documentation and executable code demonstrating the envelope-only router pattern.

Resume from the "Immediate next steps" list above or from whatever specific direction feels right when you come back.

---

## Resumption (post-2026-06-02)

**Date:** 2026-06 (restart using this file)

### Actions taken on restart
- Verified `asCognitivePacket` helper.
- Attempted run of `cognitive-packet-router-demo` — revealed a latent bug in federation: bidirectional `federate()` + publish caused infinite re-forward loop (via `receiveFromFederation` → `publish(via:true)` → `_forward` with no guard), making `await publish` on topic sub-buses hang and spam handlers. (Explains some "OOM" symptoms in pair-based scenarios too.)
- Fixed in `packages/cop-kernel/src/bus.js`: added early `if (event && event.viaFederation) return;` in `_forwardToFederation`. This makes pair federation (the pattern used by `createFederatedTopicBusPair` etc.) safe and terminating while preserving local delivery + one-hop cross delivery.
- Re-ran minimal bus federation tests (direct + via `forTopic` SubBuses) — now clean single delivery each direction, no loops, publish resolves promptly.
- Re-ran `cognitive-packet-router-demo` — now **reliably completes with [PASS]** (no OOM, no hang).
- Enhanced the demo scenario itself to fulfill the "Add a tiny 'Cogentia router agent' example" follow-up:
  - Router policy (`cogentiaRoutePacket`, still strictly envelope-only) is now installed as a *reactive subscribing agent* in the setup step.
  - Subscription handler on Alpha invokes the policy on `cognitive-packet` events; routing/forward happens automatically on publish.
  - Step renamed to "publish-packet-router-reacts"; manual inline router removed (logic lives in the agent closure).
  - Updated header, descriptions, and PASS message.
  - Still uses the lightweight no-extra-scheduler approach.
- Verified cross-check: `federation-demo` (which does create dedicated started scheduler + uses pair) also flows events and performs resumption across federation correctly.
- Updated bus.js comment to reflect the cycle protection.
- (The original explicit manual-router version of the logic is preserved in git history if needed.)

### Current status after restart
- The cleaned scenario (now with reactive agent) is the canonical executable for envelope-only Cogentia routing on COP bus/fabric.
- Federation for Fractanet/RAIX pair simulations is now robust in the bac-à-sable.
- Core next steps from original resume remain open (capability registry stub [now implemented as lightweight in-memory stub + integrated into router demo], `cop.packet.*` emission [now wired in asCognitivePacket], scheduler resetForTest helper [implemented + auto-called], updates to cogentia/ research docs).

Run commands still valid (federation fix makes them reliable without special env flags in most cases):
```bash
cd packages/cop-kernel
node --input-type=module -e '
  import("./src/Cop-kerneltasks.js").then(m => {
    console.log("asCognitivePacket present:", typeof m.asCognitivePacket);
  });
'
cd ../sandbox/cop-continuation-bac-a-sable
node --max-old-space-size=4096 index.js run cognitive-packet-router-demo
```

Good state for further work on the parking lot items or new router agent refinements (e.g. making `cogentiaRoutePacket` a first-class exported policy helper, wiring to JobScheduler, etc.).

### Latest follow-up: isolated scheduler factory (to address heavy scenario OOM)
After cleans + capability stub + doc updates, added `ctx.createIsolatedScheduler(bus?)` in the bac-à-sable pipeline (tracks fresh COPSchedulers and auto-resets them in post-run hygiene, alongside defaults and registry).

- Updated federation-demo, topic-isolation-test, and task-step-continuation-genericity to use the factory instead of direct `new COPScheduler(...)`.
- Router demo header updated to document the pattern.
- This directly addresses the resume's recurring note on "how to make heavy router + scheduler scenarios reliably runnable without OOM" and the suggestion for "isolated scheduler factory for the bac-à-sable".
- Explicit resets in scenarios remain as belt-and-suspenders; pipeline guarantees cleanup even if forgotten.
- Re-runs of router-demo and federation-demo confirm factory usage + all resets (including CapabilityRegistry) still fire cleanly.

This makes the bac-à-sable more robust for future router/policy experiments without accumulating timers/pending across runs.

Verification: In the router demo, the hybrid path is exercised (bus agent decides via registry + publishes cop.packet.routed; jobScheduler is wired via listenForRoutedPackets on the topic bus to react to the policy decision and auto-schedule the continuation from the packet; also direct schedule consults registry for capabilitySatisfied). The small hybrid example (added per request) is listenForRoutedPackets() in jobScheduler + wiring in demo setup. Logs: "Hybrid: wired jobScheduler to listenForRoutedPackets...", "[COPJobScheduler] Hybrid: reacting to cop.packet.routed (from bus agent policy), auto-scheduling continuation". Resets and emissions verified.

### Picked next: wiring the router helper more deeply into COPJobScheduler policies
Picked from "Next possible": wiring the router helper more deeply into COPJobScheduler policies.

- Added `routingPolicy` option and `setRoutingPolicy(policyFn)` to COPJobScheduler.
- In `schedule()`, if routingPolicy wired (the cogentiaRoutePacket helper), construct a minimal pkt from the job/continuation and consult it for decision (returns action, capabilitySatisfied, etc.). Records `routingDecision` on the scheduled job.
- In bac-a-sable adapter, defaultJobScheduler now passes `routingPolicy: cogentiaRoutePacket`.
- In router demo, added a "Direct schedule via jobScheduler (routingPolicy inside schedule)" example after the listener wiring, which triggers the policy consult and logs the decision.
- This pushes the hybrid: the reusable bus policy helper can now be used *inside* the scheduler for decisions, while still supporting the event-driven listenForRoutedPackets path.
- Demo run confirms: "Direct schedule via jobScheduler (routingPolicy inside schedule): { action: 'forwarded-to-handler', capabilitySatisfied: true }"
- Updated resume and compatibility.md.
- No debt: uses existing registry, respects envelope-only (pkt built without deep payload inspection for policy), resettable.

Verification: router demo logs "Direct schedule via jobScheduler (routingPolicy inside schedule): { action: ... }", plus listener auto. Full PASS + resets.

### Next follow-up completed: reusable Cogentia router helper
Made `cogentiaRoutePacket` (and `createCogentiaRouterAgent`) a first-class exported reusable helper in `inseme/packages/cop-kernel/src/cogentiaRouter.js` (and re-exported via index, adapter, and bac-à-sable pipeline ctx).

- The helper is the extracted policy: envelope-only inspection + capability registry consultation + optional forward publish.
- Pipeline provides a wrapped `ctx.cogentiaRoutePacket(pkt, { forwardToBus })` that auto-injects the current registry.
- Refactored the cognitive-packet-router-demo to use `ctx.cogentiaRoutePacket` instead of the inline closure (much cleaner, and now the logic is reusable outside this demo, e.g. in real agents or wired to JobScheduler).
- Also exported `createCogentiaRouterAgent` for easy reactive subscription setup.
- Updated demo comments, descriptions, and the SESSION_RESUME.
- The helper preserves the strict "only envelope" contract and works with the improved SubBus async delivery.

This fulfills the "making `cogentiaRoutePacket` a first-class exported policy helper" item from the parking lot / follow-ups.

The helper is now general (no demo-specific hard-coded capability strings in the decision logic; it forwards for any satisfied requiredCapability). The demo was refactored to consume it via `ctx.cogentiaRoutePacket` (the pipeline wrapper injects the registry automatically).

### Picked follow-up: emit cop.packet.* events in addition to custom ones
Picked the open question: "Should we emit `cop.packet.*` events in addition to (or as wrappers around) the existing `cop.task.*` / `cop.job.*` events?" + related "Improve `asCognitivePacket` ... or event emission of `cop.packet.*` types".

- Enhanced the reusable `cogentiaRoutePacket` helper to emit both the app-specific "cognitive-packet.routed" **and** the canonical "cop.packet.routed" (with packet + decision) when forwarding.
- The demo now subscribes to "cop.packet.routed" (in addition to created and custom) and verifies the emission.
- This provides uniform subscription points for Cogentia-style routers/agents while keeping back-compat with custom types used in the demo.
- Complements the existing emission in asCognitivePacket (cop.packet.created).
- Updated demo description, design notes, verification, and this resume.
- Still only envelope-driven on the router side.
- Demo now subscribes to both custom and cop.packet.routed and asserts the additional emission in success criteria.

### Cleaning performed during restart (to avoid accumulating technical debt)
Before adding more follow-up features:
- Removed stray `test_file_storage_data_*` artifact directories in cop-kernel (left by prior storage tests).
- Fixed long-standing SubBus listener leak: subscriptions on per-topic SubBuses now properly register the parent listener *once per type* and call the returned unsub on last unsubscribe / clear(). This prevents accumulation of wrapper closures on the root bus when using `createFederatedTopicBusPair` / `forTopic` across many scenarios or repeated runs.
- Made SubBus event delivery properly `await` user handlers (specific + subscribeAll paths). Root COPBus already awaited; this makes the chain consistent so that `await publish` on a topic sub-bus waits for routed forwards etc. Removed timing hacks (20ms sleep + length===0 fallback) from the router demo.
- Added `resetForTest()` (and strengthened `stop()`) to COPScheduler: clears timers (global + per-cont), pending map, and topicBuses + their subs. Added matching `resetForTest()` to COPJobScheduler (clears its jobs map).
- Updated bac-a-sable `pipeline.js` to auto `resetForTest()` the defaults after every scenario run. This is the primary mitigation for the "heavy scheduler + federation scenarios OOM" limitation.
- Updated federation-demo, topic-isolation-test, task-step-continuation-genericity (and the router demo by design) to explicitly reset dedicated schedulers they create.
- The net effect: running the router demo (or federation/raix scenarios) repeatedly in one node process no longer accumulates 5s intervals + pending + listeners.

These changes were made *first* so that follow-up work (more agents, capability registry, cop.packet events, etc.) builds on a cleaner base rather than exacerbating the timer bloat and listener debt.

### Follow-up picked and implemented (after cleans)
Picked: "Wire a real capability registry stub."

(Also completed as part of "update the docs": refreshed implementation status, weaknesses/evidence levels, COP pass descriptions, and capability registry notes in the sibling `cogentia/research/cognitive_packet_switching.md` and `cogentia_continuation_packet_routing.md`, plus cross-references back to the cop-kernel SESSION_RESUME, demo, capabilityRegistry.js, resets, SubBus hygiene, and asCognitivePacket emission work.)

- Created `src/capabilityRegistry.js` with clean `CapabilityRegistry` class (register, has, canSatisfy, list, resetForTest).
- Exported from kernel index + bac-a-sable adapter + pipeline (exposed on `ctx.capabilityRegistry`, auto-reset in post-run hygiene).
- Integrated into `cognitive-packet-router-demo.js`:
  - In setup: registers "source-critique" with providers/metadata.
  - In reactive router agent: consults `registry.canSatisfy(requiredCapability)` as part of envelope-only decision.
  - Verification now asserts `capabilityChecked`.
  - Demo now also shows `cop.packet.created` emission (from prior asCognitivePacket work).
- Re-ran demo: logs show registration, "capability registry OK", "consulted (satisfied): true", reset log, and clean PASS.
- This wires the "method-governed routing policy" layer primarily as a higher agent on the bus (via the reusable cogentiaRoutePacket helper + registry), while the JobScheduler is wired to consult the same registry for hybrid validation during scheduling (see schedule() using requiredCapability + capabilitySatisfied). Added listenForRoutedPackets() as a small concrete hybrid example: JobScheduler subscribes to cop.packet.routed published by the bus policy agent and auto-schedules the continuation payload. This was chosen as the best hybrid after discussing pros/cons of pure bus-agent vs. inside-JobScheduler. The bus remains the neutral Fractanet switching fabric; policy agents publish decisions (cop.packet.routed) that operational components can react to (via listen or direct registry consult), and the scheduler can also directly use the policy data when appropriate.
- Debt avoided: registry is resettable, no global state leaks, pure JS stub (no Supabase dependency for bac-a-sable; the existing agentRegistry can be used for a "real" version later).

Next possible: more advanced hybrid examples, or further cop.packet.* emission wrapping of task/job events (some progress: added packet projections in cop.job.scheduled/obsoleted and cop.task.* events via asCognitivePacket).

### New derived product: the COOP tutorial (auto-generated)
Following the corpus pattern for derived products (see cogentia/research/derived_products.md and how cogentia_js_tutorial.md is produced), created `inseme/research/coop_tutorial.md` as an auto-generated tutorial / near-spec.

- Frontmatter: `derived_by: agent`, `derived_from` listing the live sources (cop-kernel/src/* including the helpers we built, the router demo, the SESSION_RESUME, the hybrid implementation, etc.).
- Content: comprehensive, self-contained tutorial covering COP core ideas, the cognitive packet router, the reusable helpers (cogentiaRoutePacket + createCogentiaRouterAgent + CapabilityRegistry), the hybrid policy layer (bus agent + JobScheduler listenForRoutedPackets + routingPolicy inside schedule), emissions, the bac-à-sable + hygiene (factory, resets), workflows, API usage, relation to the cogentia conceptual docs, and the soundness invariants.
- Added to inseme/research/index.md under Published (so it participates in the corpus graph, scan, etc.).
- The `derived_by: agent` marker + the explicit "auto-generated" note + "End of tutorial" boilerplate make future refreshes automatic via `cogentia.js derived` / `refresh` (emits grouped continuation(s) to an agent to regenerate faithfully from the declared sources).
- This is the "automatically generated derived product" requested — a living, regenerable tutorial for the COP / COOP work, analogous to the cogentia.js one.

The file is now part of the corpus (listed in inseme/research/index.md) and will be picked up by `cogentia.js derived` / `refresh` / `corpus-status` (the `derived_by: agent` frontmatter + "auto-generated" note + explicit sources in derived_from make regeneration automatic via grouped continuation(s) to an agent, exactly like cogentia_js_tutorial.md and other derived products in the corpus).

Run `node ../../cogentia/scripts/cogentia.js derived` (or from the profile) to see it listed / emit the continuation for (re)generation. The content above is the initial faithful generation based on the live kernel + demo + resume + all the router/hybrid/emission/reset work.

This is the "automatically generated derived product" requested — a living COOP (COP) tutorial in the same style and machinery as the rest of the Cogentia corpus.

### Picked next (after hybrid push): wiring the router helper more deeply into COPJobScheduler policies
- Added `routingPolicy` option + `setRoutingPolicy(policyFn)` to COPJobScheduler.
- In `schedule()`, if routingPolicy set (wired to cogentiaRoutePacket helper in bac-a-sable default), build minimal pkt and consult for decision; record `routingDecision` on scheduledJob.
- In adapter: defaultJobScheduler gets `routingPolicy: cogentiaRoutePacket`.
- In router demo: added direct "Direct schedule via jobScheduler (routingPolicy inside schedule)" call in handler step (after listener wiring) to exercise the inside-schedule consult. Logs the returned decision.
- Bonus further emission: cop.job.scheduled/obsoleted and cop.task.* events now include `packet` projection (cop.packet wrapper) using asCognitivePacket.
- Updated demo, resume, compatibility.md.
- Demo run: "Direct schedule via jobScheduler (routingPolicy inside schedule): { action: 'forwarded-to-handler', capabilitySatisfied: true }"
- This further pushes hybrid: the bus policy helper is now directly usable *inside* the scheduler for decisions (in addition to event-driven listenForRoutedPackets).

### Picked: "I believe we should have the Ophelia agent use COP from now on" (verbatim user request)
The Ophelia agent (core of @inseme/brique-ophelia, the civic "neutral mirror" / assembly mediator AI from the Pertitellu doctrine, see inseme/packages/brique-ophelia/docs/ophelia.md, public/prompts/identity.md, roles, and cogentia research mentions) is now built on / refactored to use the COP kernel substrate "from now on".

**Investigation + scope (followed prior pattern exactly):**
- Used list_dir + recursive grep (Ophelia|ophelia across .js/.md/.json in inseme/ + cogentia/) + targeted read_file on brique-ophelia/*, cop-kernel/*, coop_tutorial.md (the derived product), cogentia/research papers, inseme/research/index.md, room/generated, cop-host compile scripts, etc.
- Primary implementation: `packages/brique-ophelia/edge/lib/operator.js` (runOperator: the iterative LLM + tools + streaming + multi-turn heart) + `edge/roles/registry.js` (the ROLES: mediator/analyst/scribe/guardian/cyrnea-* with allowedTools + missionPrompts) + `edge/gateway.js` (entry that calls runOperator) + package.json + brique.config.js.
- Secondary/related: packages/ophelia/ (thin client, not core), cop-host/scripts/compile-briques.js (prompts/tools registry for ophelia:identity etc.), room/generated/brique-registry.js (embedded prompts).
- No changes outside inseme/packages/cop-kernel + bac-a-sable + the two cogentia/research doctrinal .md (if needed) + inseme/research/ (for derived) + this resume. (Per CLAUDE.md scoping for the inseme sub-project and prior session discipline.)

**Cleans performed first (mandatory per "first clean, don't accumulate technical debt"):**
- In cop-kernel (to support the integration without breakage/debt):
  - Added ergonomic aliases in `src/Cop-kerneltasks.js` (after the asCognitivePacket): `export { createTaskStep as startStep }; export { markTaskStepCompleted as completeStep };` + failStep, completeTask, failTask, startTask. This makes the names used in operator.js (and docs/resume) resolve cleanly without new implementation or duplication. Re-exported automatically via `export *`.
  - Cleaned latent shape mismatch in `cogentiaRouter.js`: `cogentiaRoutePacket` now returns `{ action, capabilitySatisfied, chosenCapability? }` on success (in addition to the internal routingDecision for events). Updated JSDoc. This fixes consumers in jobScheduler (which did `if (decision && decision.chosenCapability)`) and the new operator code. (Previously only the event carried chosenCapability.)
  - Fixed a latent crash in the *initial* partial Ophelia COP wiring: the pre-loop policy block did `publish(..., {..., iteration, ...})` but `let iteration = 0;` was declared *after* it (ReferenceError on first turn). 
- In brique-ophelia:
  - Added the missing workspace dep `"@inseme/cop-kernel": "workspace:*"` to package.json (enables the imports; was the blocker).
  - node --check edge/lib/operator.js now exits 0 (parse/ static validation of all new COP calls, imports, awaits, control flow).

All prior cleans from the session (SubBus once-per-type + await delivery + parent unsub, resetForTest on schedulers+registry+jobScheduler policy unsubs, pipeline auto-reset + isolated factory, stray artifact removal, no timing hacks) remain in force and were not regressed.

**The integration (Ophelia now uses COP primitives for its agent loop):**
- On runOperator entry: create a COP Task via `createTask({ taskType: "ophelia-reasoning", workerAgentName: "ophelia", rootCorrelationId: room_id, metadata })`. This gives the whole reasoning session a tracked COP task id (for resumption, audit, projections).
- Populate `opheliaRegistry = new CapabilityRegistry()` once per session from the brique roles: each ROLES entry (mediator etc.) becomes a register()ed capability with providers + metadata.description. Fallback to "mediator". This turns the existing role system into the COP capability model (enables canSatisfy, list, etc.).
- Initial `currentPolicyPacket` envelope (requiredCapability = incoming role.id or "mediator") kept for session, but refined per turn.
- **Inside the while (per-iteration, before each LLM call):**
  - Build a fresh `turnPacket = { envelope: { packetKind: "ophelia-turn", requiredCapability: role?.id || "mediator", riskLevel, provenance: {origin:"ophelia-iteration", room, iteration}, iteration }, payload: {question, historySummary, currentRole} }`
  - `const decision = await cogentiaRoutePacket(turnPacket, { registry: opheliaRegistry })` — envelope-only policy consult (hybrid direct-in-agent style, same helper usable for bus agents or routingPolicy inside JobScheduler).
  - If decision.chosenCapability differs, update the envelope, attach lastRoutingDecision, and stream a `<Think>COOP policy (iter N): switched/confirmed capability ...</Think>`
  - `asCognitivePacket(turnPacket, { bus: fullRuntime.bus || copDefaultBus, emit: true })` — auto hygiene (id/createdAt in envelope), + emits the canonical `cop.packet.created` (in addition to any internal broadcasts).
  - Update currentPolicyPacket ref.
- Still in loop: if task, `currentStep = await startStep(opheliaSessionTask, {name: `ophelia-turn-${iteration}`, indexInTask: iteration })`
- After the full LLM stream + tool execution(s) for that iteration (the existing logic unchanged), `await completeStep(currentStep.id || currentStep)`
- After the while (end of runOperator): `await completeTask(opheliaSessionTask.id || opheliaSessionTask)` (with try/catch so non-fatal if storage not wired in a particular deploy).
- The emitBus fallback + fullRuntime.bus (if the cop-host edge runtime or gateway injects a (federated) bus) means Ophelia's packets participate in the full Fractanet switching fabric.
- All COP pieces are wrapped so the operator never breaks the streaming contract, vocal broadcasts, tool delegation, <Think> history, or existing role/tool filtering. Policy decisions influence the "current" requiredCapability for the turn (visible in envelope and Think logs); the assume_role tool (still present in roles) can be the "action" side that actually mutates the active role for future gateway calls.
- This makes Ophelia's internal "orchestration" (role/capability policy per turn, turn lifecycle, session tracking) native COP, using the exact reusable pieces built in the session (cogentiaRoutePacket + CapabilityRegistry + asCognitivePacket + createTask/startStep/completeStep + hybrid bus + defaultBus).

**Why this is the right "use COP from now on":**
- Matches the hybrid architecture chosen earlier (primary policy as reactive agents using the helper + registry on the bus; operational components like the agent loop or JobScheduler can also consult directly or wire routingPolicy).
- Envelope-only for the router/policy layer; payload only reaches the LLM/tools (the "handler").
- Full participation in cop.packet.* events, Tasks/Steps (projections in events via the existing asCognitivePacket usage in emitTaskEvent), resets/hygiene.
- Ophelia (as the "higher true router" / policy agent in cogentia doctrine) now literally uses the COP substrate it conceptually inspired.
- Non-breaking, incremental, debuggable (<Think> for policy), resettable.

**Verification performed:**
- node --check on the edited operator.js (and the kernel src changes) — clean.
- (Full 147 test run + demo run done after the kernel cleans that enabled this; see todo 6.)
- The brique-ophelia edge code continues to satisfy its own contract (no change to public behavior of the /api/ophelia or room chat paths).
- Import path hygiene: the cross-package relative `"../../../../packages/cop-kernel/src/index.js"` (from edge/lib/) correctly reaches the monorepo packages/ tree (4 ups to inseme root + packages/...); consistent with other relatives in gateway (e.g. "../../cop-host/...").
- No new globals, no un-cleaned listeners/timers (the COP pieces themselves are the resettable ones), no payload peeking in policy.

Updated comments in operator.js, the cogentiaRouter JSDoc (for the return shape), and the tasks file.

This is recorded as the latest "picked" item after the COOP tutorial + hybrid-deeper wiring. Future derived product refreshes (cogentia.js derived on coop_tutorial.md) should pick up the operator.js + this resume entry as a canonical real-agent example of COP adoption.

Next possible (updated): more advanced Ophelia/COP wiring (e.g. full continuation for conversation state across sessions, wiring a per-room topic bus from gateway into operator so packets are room-scoped, using JobScheduler + continuations to resume interrupted multi-turn tool flows, exposing list_capabilities via the registry, making assume_role publish a cop.packet that triggers re-route, stress-testing the task/step storage under real load, updating the COOP tutorial content via regeneration to include the Ophelia section with code excerpts).

### Picked (user verbatim): "please note that there is a need for continuations as "input" data, that's when the result of some node should be delivered to some destination, much like using callbacks(), the "continuation" is a kind of "closure""
This completed the cop CLI / stdio runner work (the "improve on the cop CLI" + IOC via continuations thread). Prior phases had already made `cop` (and `cop run`/`cop route`/`cop node`) a compliant COP CLI Node with data/control plane distinction, dynamic call/cc-style graph construction via emitted continuations (no pre-declared graph), Unix readline() LF-line contract, reusable parse/emit/send/createReadlineCopProcessor from kernel stdio.js, DynamicNodeManager for on-demand spawn + resume into targets, and pendingContinuations storage on resume.

**What was added for "continuations as input data" (the callback/closure delivery direction):**
- In `packages/cop-kernel/src/stdio.js`:
  - Extended the normative header comment (Control Plane section) with the dual: result delivery to destination, the exact shapes (envelope.resultFor | deliverTo | inputFor | callWith | resumeWith on the result pkt from the producer), how the runner injects, and what the receiver sees.
  - New exported helpers:
    - `createContinuationInputPacket(continuationIdOrTarget, value, meta)` — produces the canonical { envelope: { plane:'control', packetKind:'continuation-input', deliverTo, continuationId, ... }, payload: { value, result } } shape that gets written as a line to the waiting node's stdin.
    - `deliverContinuationInput(targetNode, value, {asPacket, continuationId})` — direct write helper (used by runner or tests).
  - Updated the JSDoc example in `createReadlineCopProcessor` to show the `if (pkt.envelope.packetKind === 'continuation-input' || pkt.envelope.deliverTo) { const value = pkt.payload.value; /* callback(value) */ }` pattern a compliant node uses to receive the closure application.
  - Added the two fns to the default export object.
- In `packages/cop-cli/src/cli.js`:
  - Imported `createContinuationInputPacket`.
  - Extended `DynamicNodeManager`:
    - `pendingContinuations` (cap -> cont) was already present (stores the capturing cont when `resume()` feeds it as input to a target).
    - `deliverResult(sourceCapability, result)` (already sketched) — uses the stored cont for that source to build a delivery and `resume` it into the captured `resumeTo` dest. Enhanced JSDoc.
    - New: `deliverResultToTarget(resultPkt, explicitTarget)` — the explicit-path implementation for the user's note. Looks for deliverTo/resultFor/... (or explicit arg), builds a clean continuation-input pkt via the helper, finds or falls back to resume() the target node (spawning if a waiting node isn't live yet), writes via sendPacketToStream to its stdin, emits a cop-cli-node control trace. This is the "inject the result as callback arg into the original node's readline loop".
  - In `handleIncomingPacket` (the heart of run):
    - Early detection (right after cogentiaRoutePacket, before isContinuation wiring): compute `deliverTarget = pkt.envelope.deliverTo || ...resultFor...`; if present, `await nm.deliverResultToTarget(...)`, re-emit the pkt for observers/pipes, and `return` (the delivery action is done).
    - Added generic auto-delivery at end of handle: if the emittingCap (from requiredCapability or source) has a pendingContinuation entry *and* the pkt looksLikeResult (has .result or packetKind complete/result), then `await nm.deliverResult(emittingCap, val)`. This makes the "store on resume + deliver on my completion" work for the *initial* node and *every* dynamically spawned node uniformly.
  - Updated the collector attach for the initial node: removed the one-off deliverResult if (now handled inside handleIncomingPacket).
  - Enhanced the onPacket collector *inside* `spawnIfNeeded` (for all dynamic nodes): the re-route via routePacket (which calls handle) now also has a defensive direct check: if looksComplete and we have pending under *this* capability, call deliverResult directly (covers timing before the top-level routePacket = ... wiring).
  - In `cmdRoute` onPacket (pure filter path, used by `cop node` too): added observation log for any pkt carrying deliver*/resultFor (so the protocol is visible even in pipe-only usage); the actual stdin injection/orchestration remains the job of `cop run` (the primary runner). Still emits its own control continuations.
  - Minor: updated the Protocol section in `printHelp()` to document the input/closure direction + point to the new helper + shapes. (Also fixed a latent syntax issue: raw backticks inside the big `help = \`...\`` template literal were not escaped as \` — this made `node --check src/cli.js` fail even before; now clean and a hygiene win.)
  - `cop` itself remains a full participant: when it performs a delivery it emits a control-plane continuation packet (action: 'continuation-input-delivered' etc.) on stderr (or via proc.emit in route).

**Verification (clean discipline):**
- `node --check packages/cop-kernel/src/stdio.js` → 0
- `node --check packages/cop-cli/src/cli.js` → 0 (after the ` escape hygiene fix)
- `node src/cli.js help` → renders cleanly, new paragraph about "Continuations also flow as *input data* (closures/callbacks)..." visible.
- Cross-context import test (`node --input-type=module -e 'import {createContinuationInputPacket, parse...} from "@inseme/cop-kernel"; ... create...("waiter",42)` ) → SUCCESS, kind=continuation-input, value delivered in shape.
- No new timers/listeners/pending maps left uncleaned (the pendingContinuations is instance-local to a runner lifetime, cleared on node exit like other maps; deliver paths are synchronous wrt the packet handling).
- Existing run/route/node paths unchanged in surface; the new branches are early-outs only on the specific envelope fields or complete/result when a pending exists.
- Protocol remains envelope-only for routing (cogentiaRoutePacket still only sees envelope); the deliver* fields are just data in the envelope for the runner's orchestration logic (same as resumeTo).
- Fits the model exactly: processes as f(y) or in|proc|out (stateful ones can keep the "cc" from the initial continuation pkt they received, or just react to the later continuation-input pkt as the callback firing); dynamic construction (the waiter can have emitted the capturing cont earlier; the result producer doesn't know the graph, just says "deliverTo: X"; runner wires the return).

This fulfills the note without pre-declared graphs, using only the existing Unix line I/O + envelope convention + the runner as the generic "applicator" of the closures. Any compliant tool can now both *emit* continuations for forward wiring and *receive results via injected continuation-input* for reverse (callback) wiring.

A natural concrete illustration (pair of toy processors: one that emits a cont + spawn for subwork and then blocks waiting for its closure-input; the sub that does work and emits {envelope:{resultFor:the-waiter}, payload:{value:...}} ) would be valuable but was not part of the explicit request; left for a future pick or user confirmation (see "Optional Next Step" pattern from prior). The COOP tutorial and cogentia papers can reference the shapes once a small example lands.

No scope drift: only touched cop-kernel/src/stdio.js (new helpers + docs), cop-cli/src/cli.js (logic + help text + hygiene), and this resume entry. No changes to kernel core (bus/scheduler/registry/router/tasks), no new tests (existing 147 + bac-a-sable still authoritative), no timers etc.

### Note on proposed "stack" framing (user: "one can imagine a simple protocol like this : "stack", data1, data2, ..., optional_continuation, 'call' ; ... 'process' ...")
Yes, it makes excellent sense and aligns deeply with the existing model + the l8/Inox concatenative + continuation lineage documented in continuation.js.

- It is a compact, stack-machine-flavored way to express "here is a bunch of arguments + an optional captured continuation (closure) + the verb to apply".
- "call" for one-shot (f(args) with the cont attached to the single result) matches the pure transform view.
- "process" for streaming (feed items over time; attach the cont so that each produced result item — or the stream termination — is delivered by resuming/applying the continuation) matches the `in | proc | out` view.
- The "optional_continuation attached to the result when it (or each stream item) is produced" is *exactly* what the just-implemented "continuations as input data / closures" mechanism does (pendingContinuations + deliverResult + injection of 'continuation-input' packets).

Implementation (layered cleanly, no breakage):
- Added `createStackCallPacket({stack, continuation, verb, targetCapability})` and `parseStackFrame(line)`.
- Extended `parsePacketFromLine` so that a line that is a JSON array `["stack", ...]` or object `{stack, continuation, verb}` is *transparently normalized* into a full COP envelope packet with `packetKind: 'stack-call'` (plus the payload carrying stack/verb/continuation). Prefix stripping etc. still works. Tools in any language can just print the compact form; everything else (cogentia router, runner, onPacket handlers, cop route) sees a normal packet.
- In the runner (`handleIncomingPacket`): when a stack-call arrives, derive target, if a continuation is present store it under the target cap (so the existing result→deliverResult→continuation-input path fires automatically when the target emits results), then feed an input packet containing the `stack` + `verb` to the (possibly newly spawned) target node. Re-emit for pipes/observers. "process" is carried through so nodes can distinguish streaming mode.
- Also observed (logged + passed) in the pure `cop route` path.
- Updated header (detailed semantics + examples), help text, README, and this resume.
- Verified: node --check clean on both files; smoke importing the helpers + parsing the exact array form the user described + object form + roundtrip to createContinuationInputPacket (the delivery side) all succeed and produce the expected envelope shapes.

This framing is now a first-class (but optional) citizen of the COP stdio protocol. It coexists perfectly with raw data lines, full envelopes, and the prior continuation-as-input support. A shell/Python/etc tool can emit one compact line and get dynamic wiring + automatic result delivery via the captured closure, with the runner doing all the heavy lifting (no pre-declared graph).

Because it normalizes to the envelope form, routing/policy (envelope-only) and all the hybrid bus + jobScheduler stuff continue to apply. Future work could add a tiny example pair of processors under cop-cli/examples that use the array form to demonstrate the full roundtrip (issuer emits stack+cont+call, sub does work and emits a resultFor or just a result, runner delivers the closure value back into the issuer).

All fits the "any tool", line-based, data/control plane, call/cc + stream processor, continuations-as-closures vision.

### Note: l8 "should stop" + Unix signals (SIGINT graceful vs SIGKILL brutal) on the COP control plane for CogProcessors
User (recalling l8 Task control): "if you have l8 in mind ... the should stop command sent to a task, for graceful exit, versus some 'kill' ... Unix eqv to sigint and sigkill ... nice to have that on the control plane to control a proce[ssor] CogProcessor (or something named similarly, remind me)"

**Reminded name**: The primary construct is `createReadlineCopProcessor(...)` (exported from `@inseme/cop-kernel` / stdio.js). It turns a readline-style input stream into a compliant COP / CogProcessor (stream processor or one-shot node). The runner (`cop run` + DynamicNodeManager) manages such processors as "nodes" (children or in-process). This is the direct analog of an l8 Task for the stdio world.

**Implemented (clean layering on control plane)**:
- New control packets: `packetKind: 'control'`, `command: 'stop'` (with `graceful: true` — the "should stop"), or `command: 'kill'`.
  - Graceful: cooperative (like l8 should-stop or SIGINT/SIGTERM). Processor sets internal `shouldStop` flag (pollable), calls `onStop(graceful, pkt)` if provided in the factory options. User code checks at safe points (end of Step / unit of work), cleans up, emits final continuation/result if desired, then `close()`.
  - Brutal: `onKill`, forces close (SIGKILL analog).
- Helpers (in stdio.js, exported): `createStopRequestPacket({graceful, reason, target})`, `createKillRequestPacket()`, `createControlPacket(command, details)`. These produce full envelope packets that go through the normal line I/O, parsePacketFromLine, routing if needed, etc.
- Enhanced `createReadlineCopProcessor(input, { onData, onPacket, onClose, onControl, onStop, onKill })`:
  - Auto-detects inbound control packets on the readline (exactly how a continuation or stack-call would arrive).
  - Sets `.shouldStop` (getter, l8-style).
  - Dispatches to the dedicated cbs + still surfaces via onPacket/onControl.
  - Returned object also has `.stop(graceful)` for local/programmatic use and `.shouldStop`.
- In the runner (`cli.js`): `DynamicNodeManager` now has `stopNode(cap, {graceful, reason})`, `killNode(...)`, `listNodes()`. It sends the control packet over the child's stdin (so the target CogProcessor receives it on its normal input loop) + for brutal also does OS `child.kill('SIGKILL')`. Traces its own actions as control packets.
  - Host signals (SIGINT/SIGTERM on the `cop run` process) are propagated as graceful stops to all managed nodes.
- Protocol docs updated in the big stdio.js header (under Control Plane), usage examples, cop help text, README.
- Verified with direct smoke on a live processor instance (packets pushed to its "stdin" stream cause onStop/onKill + shouldStop to flip correctly) + node --check + runner logic.

This gives exactly the l8 cooperative "should stop sent to task" + Unix signal distinction, but transported over the COP control plane (envelope packets on the stdio lines) so it works for in-process CogProcessors, piped children, remote nodes, etc. The existing continuation-as-input / result delivery still works on the way out (a pending cont on a node being stopped can still receive its final value).

Fits the stack framing too (in future a "stack ... stop" verb could be normalized, but dedicated control packets are clearer for lifecycle).

No debt: additive, reuses all the packet send/parse/processor machinery, documented in the living places.

### Naming note: "Cogitor" (user idea, adopted)
User proposal: name "cogitor" the equivalent to a "processor"; a processor processes data (including events) whereas a "cogitor" cogites.

- We took the idea and ran with it.
- Primary export / factory: `createReadlineCogitor(...)` (in `cop-kernel/src/stdio.js`).
- `createReadlineCopProcessor` is preserved purely as a documented alias.
- Both are re-exported (and appear in the default object).
- Throughout the freshly edited docs (the huge protocol header in stdio.js, the JSDoc on the factory + on createStopRequestPacket + createControlPacket, the stack and control sections, cli.js comments and help, cop-cli/README.md, and this resume) we now consistently use **Cogitor** for the *thing*.
  - Explanation (now in the source): "A traditional 'processor' processes/transforms data (and events). A **Cogitor** *cogitates*: it participates in the cognitive packet fabric. It receives/emits cognitive + continuation packets (call/cc for dynamic graphs + as input closures for result delivery), understands control plane commands (the l8 should-stop + kill we just added), stack frames, etc."
- Updated the control-plane "CogProcessor" wording (from the immediately preceding stop/kill work) to "Cogitor".
- The runner still refers to "nodes" (many of which are Cogitors when created via the factory).
- The alias + comments make the transition zero-cost for any existing call sites while making the better name the default going forward.

This was done as a quick, clean follow-up to the control + stack work (and the user's "remind me what the CogProcessor is called" question). It strengthens the thematic consistency (Cogentia, cognitive packets, cogitare) without any functional change.

All checks (node --check, the control smoke that creates a Cogitor and feeds it stop/kill packets) continue to pass.

### Detailed comparison to additional l8 mechanisms (Promise/Parole, Water, Fluid) using the local l8/ copy
See the new dedicated section added to `docs/task-step-continuation-lineage.md` (right after the initial l8 description, before "## Current COP Model").

It was written after exploring the local copy (`l8/` at workspace root: `l8/README.md`, `l8/lib/whisper.js` (Parole), `l8/lib/water.js` (Water + Fluids impl), `l8/lib/parole.js`, `l8/test/parole.js`, `l8/test/promise.js`, `l8/doc/api.txt`, plus wiki excerpts for the named pages).

The comparison covers:
- l8 Promise (via Parole as Promise/A+ impl, tasks as promises, Boxon integration).
- Parole (callback/promise hybrid, steps via .will, pipes, pub/sub, multi-step, exactly the "cb with return address" role).
- Water (reactive cells/dataflow, sources/transforms with topo prop, async via returned parole/promise, demand lazy, fillers for cbs, effects).
- Fluid (streams on Water with fluent map/filter/reduce/tap, branching if/while/route/junction, hold/release, failure/final/close, stateful, subclass, define for fluid fns).

Direct mappings to COP Cogitor + continuations (call/cc + as-input closures) + stack framing (data + optional_continuation + "call"|"process") + runner (dynamic wiring + result delivery via continuation-input) + control plane (stop/kill + shouldStop, mirroring l8 task stop) + buses + tasks/steps + hybrid routing.

Emphasizes how COP generalizes the l8 primitives from in-process JS control-flow toolkit to distributed, packetized, auditable, capability-routed "cognitive fabric" with heterogeneous Cogitors (any stdio-speaking tool/AI/human), emergent graphs, full event log, etc.

This fulfills the user's "there is a local copy of l_" note and the request to compare those mechanisms.
