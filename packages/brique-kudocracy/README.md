# 🗳️ @inseme/brique-kudocracy - Voting & Liquid Democracy

**@inseme/brique-kudocracy** is the core governance and decision-making engine for the Inseme monorepo. It implements advanced voting systems and liquid democracy principles.

This module allows communities to propose ideas, debate them, and reach consensus through various voting mechanisms and delegation systems.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

It provides the tools necessary for modern, transparent, and scalable collective decision-making.

### 1. 💡 Proposition Management
Citizens can create, edit, and search for propositions. Each proposition serves as a focal point for debate and consensus-building.

### 2. 💧 Liquid Democracy
Implements dynamic vote delegation, allowing citizens to trust experts or peers on specific topics while retaining the ability to vote directly at any time.

### 3. 🛡️ Rule-Based Governance
Uses a logic-based engine (Prolog-compatible) to manage complex governance rules, ensuring that every vote and delegation follows the community's established charter.

---

## 🚀 Key Features

- **Voting Dashboard**: Real-time visualization of ongoing consultations and voting trends.
- **Delegation Manager**: Interface to manage trusted delegates and topical delegations.
- **AI Recommendation**: Ophélia-assisted voting recommendations based on past preferences and group consensus.
- **Governance Settings**: Customizable rules for voting thresholds, periods, and delegation chains.

---

## 🛠️ Project Structure

```
packages/brique-kudocracy/
├── src/
│   ├── components/    # Voting buttons, proposition cards, and dashboards
│   ├── edge/          # AI tools for search, voting, and delegation
│   ├── hooks/         # Voting and recommendation logic
│   ├── lib/           # Propositions and consultations management
│   └── pages/         # Main governance and proposition pages
├── tests/             # Democracy logic specification tests
├── brique.config.js   # Module configuration
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
