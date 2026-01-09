# 📄 @inseme/brique-actes - Municipal Acts & Citizen Requests

**@inseme/brique-actes** is the administrative transparency module for the Inseme monorepo. It manages the lifecycle of municipal acts and formal citizen requests.

This module ensures that administrative decisions are public, searchable, and that citizens can track the status of their requests in real-time.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

It bridges the gap between the administration and the citizens by providing a transparent workflow for documents and requests.

### 1. 🔍 Administrative Transparency
Search and browse through municipal acts (council minutes, decrees, official notices) with full traceability and PDF export capabilities.

### 2. 📝 Citizen Request Management
Allows citizens to submit formal requests and track their progress through a clear, logged timeline of administrative actions.

### 3. 📊 Accountability Logs
Every action taken by an official is logged in a "Responsibility Log," ensuring high standards of accountability and public auditability.

---

## 🚀 Key Features

- **Acts Dashboard**: A centralized view for all official municipal documents.
- **Request Tracking**: Real-time status updates for citizen demands.
- **AI-Assisted Search**: Tools to quickly find specific acts or statuses (`tool-search-actes`, `tool-get-demande-status`).
- **Export Tools**: Generate official PDF or CSV exports of acts and reports.

---

## 🛠️ Project Structure

```
packages/brique-actes/
├── src/
│   ├── edge/          # AI tools for acts search and status tracking
│   ├── lib/           # Core API and hooks
│   └── pages/         # UI pages (Dashboards, Forms, Lists, Details)
├── tests/             # Specification tests for acts logic
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
