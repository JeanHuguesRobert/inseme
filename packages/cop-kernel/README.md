---
title: 🧠 @inseme/cop-kernel - COP Runtime & Orchestration
author: unknown
date: '2026-06-01'
last_modified_at: '2026-11-18'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: f4ce9c7
  origin_date: '2026-06-01'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# 🧠 @inseme/cop-kernel - COP Runtime & Orchestration

**@inseme/cop-kernel** is the runtime engine for the Cognitive Orchestration Protocol (COP) in the
Inseme monorepo. It provides the essential infrastructure for managing handlers, nodes, and their
interactions.

Built on top of `cop-core`, the kernel handles the practical execution of the protocol, ensuring
that various components can communicate and collaborate effectively.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

> For the implementation-profile status of this package, see [`PROFILE.md`](PROFILE.md).

---

## 🎯 What is it for?

It serves as the "Operating System" for the Inseme ecosystem, providing the runtime helpers and
registries needed for a decentralized, AI-assisted platform.

### 1. 🤖 handler & Node Management

Utilities for defining, registering, and managing the lifecycle of autonomous handlers and protocol
nodes.

### 2. 📋 Service Registry

A centralized registry for discovering and interacting with available services and capabilities
within the ecosystem.

### 3. 🔄 Interaction Orchestration

Helpers for managing complex multi-handler interactions and ensuring protocol compliance across the
runtime.

---

## 🛠️ Project Structure

```
packages/cop-kernel/
├── PROFILE.md      # Implementation profile and conformance status
├── src/
│   ├── handlers/        # handler definition and management logic
│   ├── nodes/         # Node utilities and helpers
│   ├── registry/      # Service and capability registries
│   └── index.js       # Main kernel entry point
└── package.json       # Dependencies and metadata
```

---

## FractaRouting — three-node read-only Reality Test (2026-11-18)

The initial significant compute mesh is Fracta2, the ThinkPad and an
Android Termux phone. This does **not** preclude additional nodes later.
External GitHub builders and LLM/embedding providers are separate capability
providers; their implementation is not part of this initial three-node test.

From **Fracta2**, with existing SSH aliases and a locally running ONA:

```sh
node packages/cop-kernel/scripts/fractarouting-three-node-preflight.js
node --test packages/cop-kernel/test/fractaroutingNextHopProjection.test.js
```

The first command computes the same fixed arithmetic expression locally and
over the two existing SSH routes, recording one bounded round-trip observation.
The reported times include SSH and Node.js startup, so they are **not**
normalized CPU or throughput benchmarks. It reads ONA's locally discovered
peer attractors, then asks the **existing** COP router's read-only
`projectCognitiveNextHop()` for a packet requiring
`cogentia.packet.handler.v1`. No packet is sent, claimed or accounted by this
diagnostic, and no new capability is registered from an SSH success.

An ONA `operium.node.v1` attractor is only node observability. Current actual
result: all three Node.js arithmetic probes respond, but the local ONA
registry advertises no `cogentia.packet.handler.v1` capacity, so the routing
decision is correctly **`park_no_route`**, not a fabricated forwarding
success. The phone is technically reachable even though it is not presently
an ONA peer-attractor candidate. Packet-locality, independent handler offers,
route/queue measurements and COP custody receipts remain separate work.

The pure projection accepts validated local capability offers, node-local
fresh neighbor records, and independently verified COP path-trace projections
when available. It distinguishes local candidate, next-hop candidate and
durable-park recommendation, including hop budgets, cycle detection, TTL and
packet closure constraints. A candidate **never** means authorization or
transfer confirmation. Actual routing must continue to use the existing
CPS/COP claim, mandate, execution, effect receipt and Ithaca return path.
See [Cognitive desire paths](https://github.com/JeanHuguesRobert/inseme/issues/50)
and [FractaRouting C0](https://github.com/JeanHuguesRobert/inseme/issues/122).

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
