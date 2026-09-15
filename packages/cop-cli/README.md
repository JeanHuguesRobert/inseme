---
title: 💻 cop-cli - Cognitive Orchestration Protocol CLI
author: unknown
date: '2026-06-12'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: '9167494'
  origin_date: '2026-06-12'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# 💻 cop-cli - Cognitive Orchestration Protocol CLI

**cop-cli** is the command-line interface for interacting with the Cognitive Orchestration Protocol
(COP) in the Inseme monorepo. It allows developers and administrators to manage the ecosystem
directly from the terminal.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

## Continuation Packets over stdio (new runner / Inversion of Control)

The `cop` command now also acts as a very simple generic **runner and router** for
continuation-based orchestration.

Any external tool (Node, Python, shell, whatever) can participate by emitting **continuation
packets** (small JSON objects with an `envelope`) on stdout or stderr.

This turns ordinary processes into "nodes" in a directed graph, with pipe-like composition, data
plane vs control plane, and routing decisions driven by the packet envelope (exactly the same
`cogentiaRoutePacket` + `CapabilityRegistry` used everywhere else in COP).

### Basic usage

```bash
# Supervise a tool and route its packets
cop run node my-agent.js --capability my-agent

# Unix pipe friendly router (data plane passes through)
tool-producing-packets | cop route | consuming-tool

# Multiple stages
cop run producer | cop route --capability stage1 | cop run consumer
```

### How tools emit packets (extremely simple)

**JS tools** (recommended):

```js
import { emitPacket } from "@inseme/cop-kernel";

emitPacket(
  {
    envelope: {
      requiredCapability: "log", // or "my-custom-capability"
      source: "my-tool",
      // ... any other envelope fields (riskLevel, provenance, etc.)
    },
    payload: { message: "hello from continuation" },
  },
  process.stderr
); // control plane recommendation
```

**Any tool** (just print JSON):

```bash
echo '{"envelope":{"requiredCapability":"log"},"payload":{"message":"raw tool"}}'
```

Lines that are valid JSON **and contain an `envelope` object** are treated as packets. Everything
else is data plane (passed through or logged).

### The router

- Uses the reusable, envelope-only `cogentiaRoutePacket` (from cop-kernel).
- Local `CapabilityRegistry` with built-in handlers (`log`, `echo`, ...).
- Easy to extend.
- Stateless by default; can be made stateful using the full COP task/continuation machinery
  (createTask, startStep, etc.) when needed.
- Perfect foundation for building small directed graphs of managed processes.

See `cop help` for the exact subcommands (`cop run`, `cop route`).

This is the practical realization of using COP continuations for Inversion of Control at the CLI /
tool composition level.

## Natural I/O Protocol for COP-Compliant Executables (Data Plane / Control Plane)

**`cop` itself is a compliant "COP CLI Node"** (launch via `cop node`, `cop route`, or
`cop run cop node ...`).

The protocol (fully documented in the header of `@inseme/cop-kernel/src/stdio.js`):

- **I/O is Unix-native**:
  - Input: `readline()` units (LF-terminated lines). Tools loop over lines.
  - Output: LF-separated lines.
    - Plain text / non-`envelope` JSON → **Data plane** (user data, payloads; passed through by
      routers).
    - Valid JSON line **with top-level `"envelope"`** → **Control plane** (continuations, routing
      decisions, capabilities, logs, spawns, etc.).

- **Data plane vs Control plane** (the key separation you asked about):
  - **Data plane**: Raw content flowing between nodes/processors (the "what" the computation
    operates on).
  - **Control plane**: COP packets (envelope-driven). The generic `cogentiaRoutePacket` +
    `CapabilityRegistry` only looks at the envelope for decisions. This is how dynamic graphs are
    built on the fly via continuations (call/cc style: emit a continuation describing "the rest of
    the work" or next node).
  - In `envelope`: use `plane: "data" | "control"`, `packetKind` (e.g. "data", "continuation",
    "log", "spawn"), `requiredCapability`, etc.
  - Control packets are often emitted on **stderr** to keep stdout for clean data.

- **json() convention**: For control, prefer `emitPacket(...)` (normalizes via `asCognitivePacket`).
  For quick/raw: `emitJsonLine(obj)` (single-line JSON + \n).

- **Compliant nodes** (your tools + `cop` when acting as node) simply:
  - Read lines (readline).
  - If has `envelope` → control (parse, route/resume using kernel helpers, emit new continuations
    describing actions).
  - Else → data (process or pass).
  - Emit lines for output (data or envelope-JSON).

This is implemented with `createReadlineCogitor` (preferred name for the Cogitor factory),
`createReadlineCopProcessor` (alias), `parsePacketFromLine`, `emitPacket`/`emitJsonLine`,
`sendPacketToStream` in cop-kernel.

`cop route` / `cop node` make the CLI itself a first-class node that emits control-plane
continuations for everything it does (routing, dynamic spawns, etc.), so it can be wired into larger
graphs.

Example (Node stream processor / node):

```js
import { createReadlineCogitor, emitPacket } from "@inseme/cop-kernel";

const proc = await createReadlineCogitor(process.stdin, {
  onData(line) {
    /* data plane */ proc.writeLine("data: " + line);
  },
  onPacket(pkt) {
    /* control plane */
    const result = doWork(pkt);
    // Emit control continuation (may trigger dynamic wiring in the runner)
    emitPacket({ envelope: { requiredCapability: "next", plane: "control" }, payload: result });
  },
});
```

Non-Node tools: same with native line I/O + print single-line JSON for control.

See `cop help` and the protocol header in stdio.js for full details. The `cop` command participates
fully in this protocol when used as a node.

A participant created with `createReadlineCogitor` (or the `createReadlineCopProcessor` alias) is
conceptually a **Cogitor** — it doesn't just process data; it _cogitates_ using cognitive packets,
continuations (as call/cc and as result-delivery closures), the control plane (including the new
stop/kill), and stack frames.

**Continuations as input / closures (callbacks)**: The dual of "emit continuation to wire next" is
result delivery. A producer emits
`{ envelope: { resultFor: "the-waiter" or continuationId, ... }, payload: { value: 42 } }`. The
runner (primarily `cop run`) recognizes it and writes a `packetKind: 'continuation-input'` line (via
`createContinuationInputPacket`) to the waiting node's stdin. The waiter receives it in its
`onPacket` exactly like `myCallback(42)` or `resume(cc, 42)`. This enables dynamic return addresses
("the result of some node delivered to some destination") in the same call/cc + stream-processor
model. See `createContinuationInputPacket` + `deliverResult*` in the sources.

**"stack" framing (lightweight call with attached continuation)**: As a convenient convention (still
turns into normal envelope packets), tools can emit on one line:
`["stack", arg1, arg2, optionalContWithResumeTo, "call"]` or the object form
`{stack: [...], continuation: {...}, verb: "call"|"process"}`. `parsePacketFromLine` (and thus
`createReadlineCogitor`) normalizes it to a `packetKind: 'stack-call'` packet. The runner registers
the optional continuation for result delivery and feeds the stack items as input to the target.
"call" = one-shot (result delivered once via the cont); "process" = streaming (cont can be attached
to items or end-of-stream). This is a natural stack-machine / concatenative style on top of the COP
line protocol and works great with the existing dynamic wiring + closure delivery. See stdio.js
header for the spec and `createStackCallPacket` / `parseStackFrame`.

---

## 🎯 What is it for?

The CLI provides a powerful toolset for managing, testing, and interacting with the Inseme platform
without requiring a graphical interface.

### 1. 🛠️ Ecosystem Management

Tools for initializing, configuring, and monitoring the various components of the Inseme monorepo.

### 2. 🤖 AI Interaction

Direct interface to interact with the LLM controller and other AI-assisted tools.

### 3. 🧪 Testing & Debugging

Utilities for running integration tests and debugging the protocol's behavior.

---

## 🚀 Quick Commands

- **Help**: `cop --help`
- **Version**: `cop --version`
- **Start**: `npm start` (Runs the help command by default)

---

## 🛠️ Project Structure

```
packages/cop-cli/
├── src/
│   ├── cli.js         # Main CLI entry point
│   └── commands/      # Individual command implementations
└── package.json       # Binaries and dependencies
```

---

## ⚖️ Neutrality & Commitment

This infrastructure is a **neutral** technological tool. It is designed to ensure digital
independence and does not support any specific ideology or candidate.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.

---

### #PERTITELLU | CORTI CAPITALE
