# Implementation Plan: Inseme Modernization & SaaS Evolution

This plan outlines the modernization of Inseme, its transformation into a reusable package, and its
evolution into a full SaaS platform.

## Project Strategy: Three Support Modes

### 1. Mode: Package (`@inseme/room`)

- **Target**: Developers building democratic tools (ex: Kudocracy).
- **Artifact**: `packages/room/`.
- **Status**: Ready. Exported via `index.jsx`.
- **Customization**: Uses Slot-based architecture for UI overrides.

### 2. Mode: Standalone App

- **Target**: Dedicated assembly sites for specific organizations.
- **Artifact**: The root React application.
- **Status**: Ready. Uses file-based prompts and environment variables.

### 3. Mode: SaaS (Service as a Software)

- **Target**: Multi-tenant platform for general public use.
- **Architecture**: Database-driven configuration per room.
- **Status**: Planned (Phase 6).

---

## Technical Architecture

### Core Logic (The "Protocol")

All assembly commands (`?`, `!`, `parole`, etc.) and state management are encapsulated in
`InsemeProvider` and `useInseme`.

### AI Mediation (Ophélia)

- **Edge Functions**: Stateless processing in `netlify/edge-functions/ophelia.js`.
- **Dynamic Prompts**: System prompt can be loaded from a file (Standalone) or a Database (SaaS).
- **Vocal Output**: Native TTS integration with configurable voices.

### Media & Video

- **Jitsi Meet**: Integrated via `@jitsi/react-sdk`.
- **Embeds**: Support for YouTube, Pad, Images via `ModernMediaLayer`.

---

## Phase 6: SaaS Architecture (Multi-Tenancy)

### Database Schema

We will introduce a registry to manage room identities and custom settings.

#### [NEW] `inseme_rooms` Table

- `id`: `uuid` (primary key)
- `slug`: `text` (unique, e.g., 'bastille-2024')
- `owner_id`: `uuid` (links to `auth.users`)
- `name`: `text` (formal name of the assembly)
- `settings`: `jsonb` (Ophélia prompt, voice, Jitsi config, UI theme)
- `created_at`: `timestamptz`

### Dashboard Implementation

- **My Rooms**: List of rooms owned by the user.
- **Room Studio**: UI to configure Ophélia's personality and voice.

### Hook & Edge Adaptation

- **useInseme**: Will attempt to fetch data from `inseme_rooms` if a `slug` is provided.
- **Ophélia API**: Will accept a `room_slug` to fetch specific AI instructions from the DB instead
  of `inseme.md`.

---

## Phase 7: SaaS Marketing & Deployment

### Deployment Automation

We will provide scripts to automate instance setup in `/scripts/`:

- `setup-standalone.sh`: Configures environment and database for a dedicated organization.
- `setup-saas.sh`: Initializes the multi-tenant registry and security policies.

### SaaS Entry Flow

- **Landing Page**: A high-conversion landing page at the root URL.
- **Lead Management**: Integration with an external lead system (CRM/Web-hook) to capture interest
  from potential SaaS clients.

### Lead Management Service

- A `src/lib/leads.js` utility to handle data transmission to the lead system.

### Authentication Enhancements

- **Email/Password**:
  - Update `Login.jsx` with a toggle for "Email" vs "Social/Anonymous".
  - Implement `signInWithPassword` and `signUp` in `AuthModal.jsx`.
  - Handle auth errors (e.g., "User already registered", "Invalid login") gracefully.
- **Nickname Strategy**:
  - Add "Pseudonyme" field to `Login.jsx`.
  - Store nickname in `auth.users` metadata (`full_name`).
  - Pass metadata during `signUp` and `signInAnonymously`.
  - Add UI in `Chat.jsx` (Header) to call `supabase.auth.updateUser()` for on-the-fly name changes.

---

---

## Phase 8: Hybrid Participation (Voice-to-Text)

### Lean Transcription Flow

- **Silent Mode**: Client-side mute for Ophélia (TTS).
- **STT (Speech-to-Text)**:
  - Micro snippets sent to `/api/transcribe` (Whisper).
  - Result stored as a **standard message** with `type: 'transcription'`.
  - Ensures absolute traceability and accessibility.
- **Rich Media Support (URLs)**:
  - Automatic parsing of URLs in messages.
  - Previews/Tags stored in `metadata` for rich rendering of external references.

---

## Phase 9: Governance & Unified Minutes (PV)

Everything is archived in `inseme_messages` using `type` and `metadata`.

- **Unified Message Families**:
  - **Communication**: `chat`, `transcription`, `link` (URLs).
  - **Governance**: `agenda_point`, `proposition`, `vote_result`, `speech_grant`.
  - **Intelligence**: `system_summary`, `knowledge_anchor`, `session_boundary`.
- **PV Generation**: An AI synthesis function reconstructs the assembly from these typed events.

### Ophélia Prompt Layering

1. **Core Inseme Protocol (Pre-prompt)**: Immutable rules for message tagging, tool usage, and
   assembly lifecycle.
2. **Room Persona (Configurable)**: User-defined tone, voice, and mediation style managed via the
   SaaS Dashboard.

---

## Phase 10: Session Continuity

### Recursive Chaining

### Single Stream Continuity (Checkpoints)

- **Concept**: We stay in the same room. The "Procès-Verbal" (PV) acts as a **Session Boundary**.
- **Context Injection**:
  - When Ophélia is triggered, she queries the _same room's history_ for the **most recent** message
    of `type: 'report'`.
  - This report is injected into the system prompt as "Previous Session Context".
- **Benefit**: No complex room linking. The history acts as the single source of truth.

---

## Phase 11: Nested Assemblies (Commissions)

- **Hierarchy Strategy**: Use `settings.parent_slug` in `inseme_rooms` (JSONB) to define the Plenary
  room.
- **Workflow**:
  1.  Commission debates a specific topic.
  2.  Ophélia generates a **PV** (Report).
  3.  **Promotion**: New tool `promote_to_plenary`.
  4.  Ophélia writes the PV into the **Parent Room** as a `type: 'proposition'`.
- **UI**: Visual indicator in `Chat.jsx` if the room has a parent ("Commission de [Parent]").

---

## Phase 12: Multilingual Agora (Pivot Strategy)

- **Concept**:
  - **Native Language**: User preference (e.g., 'Corsican').
  - **Pivot Language**: Room setting (e.g., 'French').
- **Workflow (Translate-on-Write)**:
  1.  User sends message in **Native**.
  2.  If Native != Pivot, client calls `/api/translate`.
  3.  **Storage**:
      - `message`: Translated content (in Pivot).
      - `metadata.original`: Original content.
      - `metadata.lang`: Source language code.
- **Control Commands**:
  - `inseme lang [code]`: Sets user's **Native Language** (e.g., `inseme lang co`).
  - `inseme pivot [code]`: Sets room's **Pivot Language** (e.g., `inseme pivot fr`).
- **Workflow (Translate-on-Write)**:
  1.  User sends message.
  2.  System checks local `nativeLang` vs room `pivotLang`.
  3.  If different, calls `/api/translate`.
  4.  Stores translated text + metadata `{ original, lang }`.
- **UI**:
  - Tags in chat: "[Traduit de CO]"
  - Toggle to show original.

---

## Phase 13: Governance Export & Vector Readiness

- **Universal Export**: Generate formal PVs in **Markdown** and **PDF**.
  - **Semantic Memory (pgvector)**:
  - **Schema**: Add `embedding vector(1536)` to `inseme_messages`.
  - **Knowledge Anchors**: New message type `knowledge_anchor`. Used to store document chunks or
    past decision summaries with their embeddings.
  - **Retrieval**: Ophélia can use a `semantic_search` tool to fetch relevant anchors from history
    to answer specific legal or historical questions.
  - **Bar / Blog Security**: Move from local "sésame" passwords to group-based permissions (only
    members with edit rights on the bar's blog and configuration can change bar settings and Gazette
    content).

---

## Phase 14: Session Lifecycle & Presence (The "Living Room")

- **Real-time Presence**:
  - Use Supabase Presence to track connected users.
  - **Notifications**: "X joined", "Y left" (ephemeral or system messages).
  - **Empty Room Logic**: If count drops to 0, trigger automatic "Session Checkpoint" (PV generation
    and archiving).
- **Formal Lifecycle**:
  - **Commands**:
    - `inseme open` ("La séance est ouverte") -> Marks Session Start.
    - `inseme close` ("La séance est close") -> Marks Session End + Trigger PV.
  - **Ophélia Awareness**: System prompt updated with "Session Status" (Open/Closed). She nudges
    users to open the session before debating.
- **Session Browser**:
  - "History" view in Chat to list past sessions (identified by `type: 'report'` timestamps).
  - Clicking a past session loads its context.

---

## Phase 15: Deep History & Oracle Tools

- **Goal**: Enable Ophélia to answer precise questions about the past ("Quem a dit X le 12/12?",
  "Combien de votes pour le budget?").
- **Tools**:
  - `consult_archives`: A structured query tool (FTS) to search raw logs.
  - **Features**: Filters by Agent (User), Date Range, Message Type, and Keyword.
- **Data Persistence**:
  - **Tracking**: Clients automatically log a `type: 'presence_log'` message upon joining
    (`useEffect` mount) and leaving (`beforeunload`).
  - **Privacy**: These logs are hidden from the main Chat UI but accessible to Ophélia.
- **Backend**:
  - New Edge Function `/api/history` (or extending `vector-search`).
  - New Edge Function `/api/history` (or extending `vector-search`).
  - Uses Supabase `textSearch` and filter builders.

---

## Phase 16: Liquid Roles & Conflict Mediation

- **Philosophy**: "Roles are performed, not assigned." No hard-coded permissions.
- **Mechanism**:
  - **Open Access**: Any participant can trigger `inseme open/close`.
  - **Anomaly Detection**:
    - Ophélia monitors the logs for rapid state flips (Open -> Close -> Open).
    - She monitors for "coherence breaks" (e.g., closing while a vote is active).
  - **Mediation**:
    - If an anomaly occurs, Ophélia intervenes: "It seems there is confusion about the session
      status."
    - She encourages users to self-attribute roles: "Who is chairing today?"
- **Implementation**:
  - Remove any "Owner only" checks for lifecycle commands.
  - Update Ophélia's prompt to detect _social_ conflicts rather than just enforcing rules.

---

## Phase 17: Operational Usability (Real-Life Ready)

- **Goal**: Remove friction for non-technical users.
- **Living Agenda**:
  - **Concept**: A dynamic list of points (`items`) that structures the debate.
  - **Data**: Stored in `inseme_messages` as `type: 'agenda_update'` (snapshot of the full list).
  - **UI**: A sticky "Agenda" panel. Clicking an item sets it as "Current Topic".
  - **Ophélia**: Contextual awareness ("We are discussing item 3, please save that for item 4").
- **Zero-Command Mobile UI**:
  - **Action Bar**: Fixed bottom bar on mobile with big touch targets.
  - **Buttons**:
    - ✋ **Parole**: Toggles request.
    - 🗳️ **Voter**: Opens a vote drawer/modal.
    - 🚪 **Bye**: Quick delegation flow.
  - **Simplification**: Hide complex slash commands behind visual metaphors.

---

## Phase 18: Documentation & Marketing Polish

- **Goal**: Align the branding with the "Liquid Democracy" philosophy.
- **Updates**:
  - **Landing Page**: Rebrand as "L'Agora Vivante". Highlight "Human Sovereignty" and "AI
    Mediation".
  - **README**: Define the "Protocol for Human Assembly".
  - **Walkthrough**: Conclude with the vision of the "Organic Assembly".

---

## Phase 19: Collective Intelligence & Analytics

- **Goal**: Provide organizations with deep insights into their democratic health.
- **Participation Metrics**:
  - Real-time heatmaps of engagement.
  - Diversity of speech tracking (ensuring minority voices are heard).
- **Consensus Analytics**:
  - Sentiment analysis of the room over time.
  - Identification of "bottleneck" topics that require mediation.
- **Dashboard**: A dedicated "Intelligence" tab in the SaaS portal.

---

## Phase 20: API & Ecosystem Integrations

- **Goal**: Turn Inseme into a platform for other democratic tools.
- **Webhooks**: Notify external apps (Discord, Slack, Notion) of final decisions or report
  generation.
- **External Tools API**: Allow developers to build custom "Inseme Tools" (e.g., a specific budget
  calculator).
- **OAuth Support**: Securely integrate with organizational identities.

---

## Phase 21: Enterprise SaaS & Sustainability

- **Goal**: Ensure the long-term viability of the platform.
- **Billing & Subscriptions**:
  - Stripe integration for "Premium" rooms (unlimited history, custom LLM models).
  - Free tier for grassroots collectives.
- **White Labeling**: Allow organizations to use custom domains and themes.
- **SLA & Compliance**: GDPR-compliant data handling and export tools.

---

## Phase 22: Conclusion: Towards the Global Agora

- **Goal**: Scale the "Organic Assembly" to the world.
- **Global Search**: Discover public assemblies and join as a guest/observer.
- **Decentralized Storage**: Optional archival to IPFS for immutable democratic records.
- **Final Vision**: A global network of interlinked assemblies, mediated by AI but governed by
  humans.

---

## Verification Plan

### Automated Tests

- **Auth Flow**: Verify anonymous and social logins.
- **Sync Test**: Multi-tab synchronization of votes and chat.
- **Package Test**: Verify `@inseme/core` can be imported by an external mock.
- **Edge Logic**: Unit tests for transcription and translation edge functions.

### SaaS Validation

- **Multi-tenant Test**: Create two rooms with different Ophélia prompts and verify their behaviors
  independently.
- **Ownership Test**: Verify only owners can edit room settings via RLS.
- **Billing Flow**: Mock Stripe checkout and verify room feature activation.

### Human-in-the-Loop (QA)

- **Mediation Stress Test**: Simulate a heated debate and verify Ophélia's conflict resolution
  triggers.
- **Zero-Command UX**: Conduct a user test with non-technical participants using only the Mobile
  Action Bar.
