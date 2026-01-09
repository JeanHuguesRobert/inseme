# 🗺️ @inseme/brique-map - Citizen Cartography & GIS

**@inseme/brique-map** is the geospatial visualization module for the Inseme monorepo. It provides an interactive map for tracking community events, incidents, and municipal points of interest.

This module empowers citizens and administrations to visualize local data geographically, facilitating better coordination and awareness.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

It provides a spatial dimension to community information, making it easier to understand local context and needs.

### 1. 📍 Incident & Event Mapping
Real-time visualization of community-reported incidents and upcoming events on an interactive map.

### 2. 🏢 Municipal GIS Integration
Display of official municipal data, including Points of Interest (POIs) and municipal events, directly on the citizen map.

### 3. ✍️ Citizen Contributions
Allows citizens to contribute geographical data, such as marking the location of an incident or suggesting a new point of interest.

---

## 🚀 Key Features

- **Interactive Map**: Built with Leaflet for smooth, cross-platform geographical browsing.
- **Layer Management**: Toggle between different data layers (Events, Incidents, Municipal POIs).
- **Location Contribution**: A streamlined modal for citizens to pick locations and submit reports.
- **AI Tooling**: Search and interact with geographical data via Ophélia (`tool-search-map`).

---

## 🛠️ Project Structure

```
packages/brique-map/
├── src/
│   ├── components/    # Map controls, layers, and interactive elements
│   ├── edge/          # AI tools for map search and data retrieval
│   ├── lib/           # Location parsing and utility functions
│   └── pages/         # Main interactive map page
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
