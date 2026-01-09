# 💬 @inseme/brique-ophelia - Ophélia Vocal Chat & AI Moderator

**@inseme/brique-ophelia** is the "Organic Assembly" protocol and AI-assisted moderation engine for the Inseme monorepo. It provides a real-time democratic space where roles are performed, not assigned.

Designed for **Liquid Democracy**, it replaces rigid permissions with AI-assisted mediation, allowing any group—from Municipal Councils to Co-ownerships—to self-organize, debate, and trace decisions without bureaucracy.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

Ophélia acts as a "Living Record" and a mirror for the group, ensuring transparency and continuity in collective discussions.

### 1. 🛡️ Human-First Moderation
No hard-coded permissions. Anyone can open a session. The group decides legitimacy, while the AI observes and highlights potential conflicts.

### 2. 🤖 AI as Mirror (Ophélia)
Ophélia observes, validates coherence, and archives history, but never commands. She can answer "Who was here yesterday?" or "What was the decision on X?".

### 3. 📜 Traceability
Every action (Vote, Speech, Presence) is logged to build an unalterable history, enabling the generation of Official Reports and deep-text search on raw logs.

---

## 🚀 Key Features

- **InsemeRoom**: A full-featured assembly room component with native Jitsi Meet integration.
- **Liquid Roles**: Conflict detection instead of permission denial.
- **Liquid Voting**: Dynamic vote delegation (`bye` command).
- **Oracle Mode**: Ask questions about past sessions or current consensus.

---

## 🛠️ Project Structure

```
packages/brique-ophelia/
├── components/        # UI components (OpheliaChat, etc.)
├── edge/              # Edge functions and AI logic
│   ├── lib/           # Prompts, tools, and provider management
│   └── gateway.js     # Main API entry point
├── docs/              # Detailed technical documentation
├── index.jsx          # Main package entry point
└── package.json       # Dependencies and metadata
```

---

## ⚖️ Neutrality & Commitment

This infrastructure is a **neutral** technological tool. It is designed to ensure digital independence and does not support any specific ideology or candidate.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.

---

### #PERTITELLU | CORTI CAPITALE
