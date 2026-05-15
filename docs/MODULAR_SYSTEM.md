---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/docs/MODULAR_SYSTEM.md
last_stamped_at: 2026-05-15
---

# 🏗️ Inseme Modular System Architecture

The Inseme ecosystem is built on a highly modular architecture designed for **Liquid Democracy**,
**Digital Sovereignty**, and **Collective Intelligence**. This document explains the core principles
of our design.

---

## 🧩 The "Brick" (Brique) Philosophy

Instead of a monolithic application, Inseme is composed of independent, reusable modules called
**Bricks**. Each brick provides a specific domain of functionality.

### 1. Functional Independence

Each brick (e.g., `brique-wiki`, `brique-tasks`, `brique-blog`) is self-contained. It contains its
own:

- **UI Components**: Specialized views and interactive elements.
- **Edge Logic**: API handlers and AI tools.
- **Data Models**: Domain-specific schemas.

### 2. Orchestration vs. Coupling

Bricks do not directly depend on each other. Instead, they are orchestrated by a central kernel.
This allows for:

- **Hot-swapping**: Replacing one implementation of a feature with another.
- **Selective Deployment**: Instances (e.g., for different communes) can choose which bricks to
  activate.
- **Uniform AI Access**: Every brick can expose "Tools" to the AI mediator (Ophélia).

---

## 🧠 COP: Cognitive Orchestration Protocol

The **Cognitive Orchestration Protocol (COP)** is the "nervous system" of Inseme. It handles:

- **Service Discovery**: Identifying which bricks are available in the current instance.
- **Agent Lifecycle**: Managing autonomous AI agents and their permissions.
- **Multi-Runtime Execution**: Running logic across different environments (Browser, Edge, Local
  Server).
- **Auditability**: Every action mediated by COP is logged in an unalterable history, ensuring
  transparency.

---

## 🤖 AI as a Mirror (Ophélia)

Unlike traditional platforms where AI is a "black box" or a "commander," Inseme implements AI as a
**Neutral Mirror**:

- **No Authority**: The AI cannot block or mandate human actions.
- **Conflict Detection**: Instead of denying permissions, the AI highlights potential conflicts or
  inconsistencies in the group's decisions.
- **Collective Memory**: The AI acts as a "Living Record," capable of answering questions about past
  sessions or current consensus across all bricks.

---

## 🛡️ Sovereign Infrastructure

Digital independence is a core requirement. The system is designed to run entirely **On-Premise**:

- **Local LLMs**: Using `@kudocracy/models`, inference is performed on local servers, ensuring data
  never leaves the community's infrastructure.
- **Open Standard**: The system uses OpenAI-compatible APIs, making it easy to switch between local
  models or public providers if desired.
- **Decentralized Data**: Multi-instance support ensures each community owns and manages its own
  database and logs.

---

## 📂 Repository Structure

```
inseme/
├── apps/              # Deployment-ready applications (Platform, Agora, Cyrnea)
├── packages/          # The Modular Library
│   ├── brique-*       # Functional modules (Wiki, Blog, Tasks, etc.)
│   ├── cop-*          # Core protocol and orchestration kernel
│   ├── kudocracy      # Governance logic and voting models
│   ├── models         # Local LLM controller
│   └── ui             # Shared design system
└── docs/              # Detailed architectural documentation
```

---

### #PERTITELLU | CORTI CAPITALE
