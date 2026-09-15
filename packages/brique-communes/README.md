---
title: 🏘️ @inseme/brique-communes - National Communes & Consultations
author: unknown
date: '2026-01-09'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: abb374c
  origin_date: '2026-01-09'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# 🏘️ @inseme/brique-communes - National Communes & Consultations

**@inseme/brique-communes** is the large-scale territorial management module for the Inseme
monorepo. It is designed to handle data and consultations for the 36,000 communes of France.

This module enables national-level democratic engagement by providing tools to manage local data at
scale and facilitate consultations that span across multiple municipalities.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

It provides the infrastructure for territorial democracy at the national scale, ensuring that local
specificities are respected within a global framework.

### 1. 📂 Territorial Data Management

Comprehensive management of commune-level information, facilitating local governance for any of the
36,000 French municipalities.

### 2. 🗳️ National & Local Consultations

Infrastructure for launching and managing consultations that can be targeted at specific communes or
scaled to a national level.

### 3. 🗺️ Ingestion & Crawling

Advanced scripts for ingesting municipal data (agendas, maps, news) directly from official commune
sources.

---

## 🚀 Key Features

- **Consultation Dashboard**: View and participate in local and national democratic processes.
- **Automated Ingestion**: Crawlers designed to synchronize data from municipal websites (Corte
  example included).
- **Commune Resolver**: Logic to handle multi-commune instances and localized content delivery.

---

## 🛠️ Project Structure

```
packages/brique-communes/
├── scripts/
│   └── ingestion/     # Data crawlers and setup scripts for communes
├── src/
│   ├── lib/           # Consultation and commune management logic
│   └── pages/         # UI for national and local consultations
├── brique.config.js   # Module configuration
└── package.json       # Dependencies and metadata
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
