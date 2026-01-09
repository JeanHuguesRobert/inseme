# 🗳️ Inseme Monorepo - Citizen Ecosystem & Liquid Democracy

Welcome to the **Inseme** repository, an **open-source** and **neutral** digital infrastructure dedicated to citizen participation, augmented deliberation, and democratic transparency.

This project brings together the tools of the **#PERTITELLU** citizen movement (Corte, Corsica) and aims to provide free solutions to empower citizens.

---

## 🏗️ Modular Architecture

Inseme is designed as a modular ecosystem of "Bricks" orchestrated by a central protocol. This ensures flexibility, sovereignty, and collective intelligence.

> **[Read the Detailed Modular System Documentation](docs/MODULAR_SYSTEM.md)**

---

## 🏛️ Repository Structure

The project is organized as a monorepo (Turbo) to facilitate code sharing between the different components of the ecosystem:

### 📱 Applications (`/apps`)

- **`apps/platform` (Kudocracy.Survey)**: The consultation and engagement platform.
  - **Focus**: Consultations, Collaborative Wiki, Citizen Gazette, Social Café.
  - **Architecture**: Multi-instance (Corte, Bastia, Università di Corsica, etc.).
- **`apps/inseme` (The Agora)**: Direct and liquid democracy tool.
  - **Focus**: Physical/remote assemblies, instant voting, digital gestures.
  - **AI**: Ophélia (AI Mediator) integrated via Edge Functions.
- **`apps/cyrnea` (Cyrnea)**: Social and gamified experience for community spaces.
  - **Focus**: Bar animation, quizzes, collaborative playlists, Vibe Monitor.

### 📦 Key Packages (`/packages`)

The ecosystem is composed of several specialized packages:

- **`packages/cop-*`**: Cognitive Orchestration Protocol (Kernel, CLI, Host).
- **`packages/brique-*`**: Functional modules (Wiki, Blog, Tasks, Group, etc.).
- **`packages/models`**: Sovereign LLM controller for local inference.
- **`packages/kudocracy`**: Core governance models and liquid democracy logic.
- **`packages/ui`**: Shared design system and component library.

---

## 🎯 Key Features

### 1. 💬 Ophélia — The AI Mediator
Ophélia is the platform's AI. She answers questions, helps formulate ideas, guides users through processes, and facilitates consensus during debates without ever imposing herself.

### 2. 🗳️ Liquid Democracy (Kudocracy)
Allows users to submit proposals, vote, and delegate their voice to a trusted person on a specific topic. The Agora (`apps/inseme`) pushes this concept further with real-time digital gestures.

### 3. 🛡️ Digital Sovereignty
Built-in support for local LLMs via `@kudocracy/models`, ensuring that sensitive data and democratic deliberations stay within your infrastructure.

---

## 🚀 Technology (Modern Stack)

- **Frontend**: React (v18/v19) + Vite + Tailwind CSS.
- **Backend Realtime**: Supabase (PostgreSQL, Realtime, Auth).
- **AI Orchestration**: Multi-provider support (OpenAI, Local LLMs via GGUF).
- **Multi-Instance**: Dynamic subdomain-based resolution for per-commune deployment. [See Multi-Instance Doc](packages/cop-host/docs/MULTI_INSTANCE.md).

---

## 🛠️ Installation & Development

### Prerequisites
- Node.js (v20+ recommended)
- Netlify CLI (`npm install netlify-cli -g`)

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/JeanHuguesRobert/inseme.git
   cd inseme
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Launch an application**:
   ```bash
   # For the Citizen Platform (Survey)
   npm run platform:dev

   # For the Inseme Agora
   npm run inseme:dev
   ```

---

## ⚖️ Neutrality & Commitment

Inseme is a **neutral** and **independent** infrastructure. It does not finance, promote, or support any political party, electoral campaign, candidate, or list. It provides digital tools usable by any citizen, collective, or institution wishing to strengthen local democracy.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.
- Made with ❤️ in Corte, Corsica.

---

### #PERTITELLU | CORTI CAPITALE
