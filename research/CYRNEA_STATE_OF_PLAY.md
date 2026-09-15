---
title: Cyrnea — State of Play (Initial Assessment)
author: Grok 4.3 (xAI), for Jean Hugues Robert
affiliation: Jean Hugues Robert / C.O.R.S.I.C.A. / Institut Mariani
date: '2026-05-28'
license: CC BY-SA 4.0
status: working-note
corpus_role: source
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/CYRNEA_STATE_OF_PLAY.md
last_stamped_at: '2026-06-01'
language: en
document_role: source
document_kind: working-note
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: working-note
classification_confidence: medium
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Cyrnea — State of Play (Initial Assessment)

**Repository:** inseme (https://github.com/JeanHuguesRobert/inseme)  
**Focus Application:** Cyrnea (`apps/cyrnea` + `packages/brique-cyrnea`)  
**Date of Assessment:** 2026-05-28  
**Assessed By:** Grok 4.3 (xAI) — initial état des lieux for collaborative work with Jean Hugues
Robert / C.O.R.S.I.C.A. / Institut Mariani  
**Purpose:** Living reference document for human collaborators and AI agents. Designed to be evolved
incrementally. All future changes to Cyrnea or its integration should update this file.  
**Language:** English (per request) for maximum interoperability with other agents.  
**License:** CC BY-SA 4.0 (aligned with project)

---

## 1. Executive Summary

Cyrnea ("L'IA au Comptoir" / AI at the Counter) is one of three primary host applications in the
Inseme monorepo. It is a **Progressive Web App (PWA)** specialized for **convivial social spaces**
(village bars, cafés, community venues) in Corsica and beyond.

Its core proposition: transform the physical bar counter into a digitally-augmented social space
using a localized, neutral AI mediator called **Ophélia**, real-time presence/chat, gamified
rituals, collaborative gazette ("Fil"), music/playlist control, and barman tooling — all while
preserving strong privacy (client data lives in localStorage; bar state in Supabase rooms metadata).

**Strategic Role in the Corpus:**

- Concrete, high-visibility deployment surface for the broader "six-repo" ecosystem (MareNostrum /
  FractaVolta / Cogentia / Inseme / barons-Mariani / Inox).
- Embodies "Layer 4" (civic / cognitive) of the FractaVolta stack in a human, place-based context.
- Testbed for "barman-friendly", gift-economy-inspired (Mauss), sovereignty-preserving social tech.
- Early proving ground for multi-tenant COP (Cognitive Orchestration Protocol) + brique composition
  in real-world hospitality settings.

**Current Maturity:** Functional prototype with rich feature surface in `brique-cyrnea`, but
**significant in-flight refactoring debt**, especially around the ClientMiniApp (major feature
regression vs. full backup). Deployable via Netlify + Supabase, multi-bar capable in theory.
Actively referenced in technical roadmap for ethics, multi-instance hardening, and product
integration (e.g., Actes brick in bar context).

---

## 2. Repository & Platform Context

Inseme is the **deployable civic platform** of the Jean Hugues Robert corpus:

- MIT-licensed, citizen-governed aspiration.
- Three host apps: `apps/platform` (Kudocracy.Survey / consultations), `apps/inseme` (Agora / liquid
  democracy), `apps/cyrnea` (conviviality / bars).
- Core abstraction: **Briques** (self-contained functional modules: brique-ophelia, brique-fil,
  brique-democracy, brique-actes, brique-blog, brique-cyrnea, brique-auxilia, brique-map, etc.).
- Orchestration: **COP** (Cognitive Orchestration Protocol) via `packages/cop-*` (core, host,
  kernel, prolog).
- AI Mediator: **Ophélia** — neutral mirror, not authority; role-specific prompts (including
  dedicated `cyrnea-indoor.md` / `cyrnea-outdoor.md`); supports local LLMs + OpenAI compat; Prolog
  execution; RAG; tools exposed by briques.
- Data: Supabase (PostgreSQL + Realtime + Auth + RLS); rooms/messages tables central; heavy use of
  JSONB metadata for instance/bar config.
- Frontend: React 18/19 + Vite + Tailwind v4 + React Router + dnd-kit + framer-motion + Leaflet (for
  map integrations).
- Deployment: Netlify (Edge Functions for AI, Vite PWA); dynamic instance resolution via subdomains
  (theoretical).
- Related high-level docs: `ARCHITECTURE.md`, `ROADMAP-TECH.md`, `docs/MODULAR_SYSTEM.md`,
  `packages/cop-host/BRIQUE_SPEC.md`, research corpus-status + concepts.

Cyrnea is explicitly called out as a **primary consumer** of multiple briques and as a deployment
target for future ones (Auxilia, Actes integration in bar context, Cogentia Commons).

---

## 3. Cyrnea Application Structure & Ownership

### 3.1 Host App (Thin Orchestrator)

**Location:** `apps/cyrnea/`

- **package name:** `@inseme/app-cyrnea`
- **Entry points** (from App.jsx):
  - `/bar/:roomId` → `BarmanDashboard` (from `@inseme/brique-cyrnea`)
  - `/app/:roomId` or catch-all → `ClientMiniApp`
  - `/vocal/:roomId`, `/radio/:roomId`, `/gazette*`, blog routes, legal.
- **Key local files:** very small surface (`src/App.jsx`, `main.jsx`, `CyrneaUserProvider`,
  `LegalPage`, Supabase client shim, generated `brique-registry.js`).
- **Build:** `pnpm run compile:briques && vite` (or netlify dev). Compile step injects briques via
  `packages/cop-host/scripts/compile-briques.js`.
- **PWA:** `vite-plugin-pwa` enabled; dynamic manifest/SEO noted as P2 roadmap item (currently
  static).
- **Tests:** Playwright integration + Vitest (limited unit coverage; integration tests for API,
  briques, tools, smart-mic).
- **Netlify:** Minimal `netlify.toml`; heavy reliance on Edge Functions served from
  `.netlify/functions-serve` (wiki ops, ophelia prolog, tipping, instance bridge, etc.).
- **Known oddity:** Duplicate nested path `apps/cyrnea/apps/cyrnea/.netlify` — likely build/worktree
  artifact; candidate for cleanup.

**Scripts (monorepo root):**

- `cyrnea:dev`, `cyrnea:backend`, `cyrnea:build`, `cyrnea:all` (turbo with models + tunnel).

### 3.2 Core Logic Package (The Real Cyrnea)

**Location:** `packages/brique-cyrnea/`

- **Description (package.json):** "Brique pour la convivialité au bar (jeux, musique, défis)"
- **Exports:** `BarmanDashboard`, `ClientMiniApp`, `VocalConversation`, `RadioView`,
  `getRoomIdFromURL`, etc.
- **Rich internal structure:**
  - `src/pages/`: BarmanDashboard (2024 LOC, has `.refactor-wip.jsx` sibling), ClientMiniApp
    (current 740 LOC vs `.backup` 3014 LOC), VocalConversation, RadioView, FundingWidget,
    SpecialEventModal.
  - `src/hooks/`: useAuth, useBarman, useBarData, useBarMessages, usePresence / useHybridPresence,
    useTheBar, useTheUser, etc.
  - `src/lib/`: gameManager, playlistManager, presence, roles, vibeMonitor, almanac.
  - `src/components/`: Extensive (bar/_, user/_, camera/_, Ophelia_ inputs/screens, GameInterface,
    TipModal, InviteModal, MusicControl, BroadcastOverlay, etc.).
  - `src/entities/`, `src/services/`, `src/singletons/` (TheBar, TheUser), `src/storage/`,
    `src/types/`, `src/utils/`.
  - `src/contexts/AppContext.jsx`, `src/init/`.
  - `specs/COCKTAILS_AND_ROLES.md` (role switching, tax-deductible gifts, mixology).
  - `STORAGE_ARCHITECTURE.md` (canonical privacy design doc).
  - `brique.config.js`, `index.js`.
- **Dependencies:** `@inseme/cop-host`, `@inseme/room`, `@inseme/ui`; react-camera-pro, tau-prolog,
  lucide-react.

**Critical Technical Debt Flag (Jan 2026 ROADMAP-TECH.md § REEVALUATION COMPLÈTE):**

- ClientMiniApp was aggressively slimmed during a modular refactor.
- Full-featured backup (3k+ LOC) contains many missing or incomplete capabilities (advanced TipModal
  with Stripe/Wero/physical + phone reveal, full tag system `@barman/@clients`, After mode, complete
  BroadcastOverlay types, GameInterface audio/grid, public links management, zone defaults, mobile
  detection, legal mentions, etc.).
- Detailed audit + phased reinjection plan exists in ROADMAP but appears only partially executed.
  Current slim version has good hook/component separation but **high risk of user-facing
  regression**.
- Related: `BarmanDashboard.refactor-wip.jsx` also present.

This is the **highest-priority internal item** for Cyrnea stability.

### 3.3 Public Assets & Prompts

`apps/cyrnea/public/briques/...` and `packages/brique-ophelia/public/prompts/roles/cyrnea-*.md`
contain specialized identities:

- `cyrnea-indoor`: "âme du Bar Cyrnea et experte en macagna corse" — facilitator, rituals (Tournée,
  Macagna, Café Suspendu), laughter, authentic Corsican vibe, indoor contemplative (chess,
  crosswords).
- `cyrnea-outdoor`: More animated, louder conversations, smoking, "refaire le monde".

These are loaded via the COP/brique registry and central to the "Ophélia du Bar" experience.

---

## 4. Feature Inventory & Status (as of assessment)

| Area                  | Key Components                                                                   | Status / Notes                                                                                  | Source                  |
| --------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| Barman Control        | BarmanDashboard, ZoneManager, MusicControl, Settings                             | Functional; 2k LOC surface; refactor WIP sibling file                                           | brique-cyrnea           |
| Client Experience     | ClientMiniApp (screens: Fil, Legends, City, Games, Profile), OpheliaInput/Screen | Core chat + navigation present; many advanced sub-features missing vs backup (see debt section) | brique-cyrnea + App.jsx |
| Real-time / Presence  | usePresence, useHybridPresence, useBarPresence, InsemeProvider (room)            | Hybrid (Supabase + local?) presence; central to vibe                                            | hooks + room package    |
| AI Mediator (Ophélia) | VocalConversation, Ophelia components, prolog-executor, role prompts             | Strong integration; dedicated Cyrnea roles; Edge + local LLM paths                              | brique-ophelia + cyrnea |
| Rituals / Social      | TipModal, InviteModal, BroadcastOverlay, FundingWidget                           | Basic present; advanced payments/animations in backup only                                      | brique-cyrnea           |
| Games & Vibe          | GameInterface, gameManager, vibeMonitor, almanac                                 | Present in modular form; completeness uncertain post-refactor                                   | lib + components        |
| Gazette / Fil         | GazetteView (in App), brique-fil integration                                     | Leverages shared brique-blog/fil                                                                | App.jsx + brique-fil    |
| Music / Playlist      | playlistManager, collaborative lists                                             | Core feature per READMEs                                                                        | lib                     |
| Privacy / Storage     | localStorage for users + Supabase rooms metadata + messages                      | Well-documented philosophy; "barman's phone as source of truth"                                 | STORAGE_ARCHITECTURE.md |
| PWA / Mobile          | vite-plugin-pwa, camera-pro, responsive Mondrian UI                              | Installable; dynamic manifest/SEO/robots pending (P2)                                           | app config + ROADMAP    |
| Multi-tenant / Bars   | roomId from URL, cop-host instance resolution, metadata JSONB                    | Theoretical strong; practical resolver disabled in cyrnea netlify.toml per ROADMAP              | cop-host + ROADMAP      |
| Legal / Ethics        | LegalPage (terms/privacy), Ophélia governance notes                              | Basic pages; full bar-specific ethics/logging policy still open (ROADMAP P2)                    | src + ROADMAP           |

**Integration with other briques:** Heavy consumer of brique-ophelia, brique-blog/fil, room,
cop-host, ui. Future/planned: brique-actes (council minutes in bar context), brique-auxilia (digital
hospitality / data+ battery sharing), brique-democracy, brique-map.

---

## 5. Dependencies, Integration Points & Ecosystem Links

**Internal (workspace):**

- `@inseme/brique-cyrnea` (core)
- `@inseme/brique-ophelia`, `@inseme/brique-blog`, `@inseme/brique-fil`
- `@inseme/cop-host`, `@inseme/cop-prolog`, `@inseme/room`, `@inseme/ui`
- `@inseme/models` (sovereign LLM, optional in cyrnea:all turbo)

**External:**

- React 18, Vite 7, Tailwind 4, Supabase JS, Netlify Edge/Functions, OpenAI SDK (fallback), Leaflet
  (transitive), Axiom logging, LogLayer, framer-motion, etc.
- Prolog: tau-prolog (client), server-side executor in ophelia edge.

**Cross-Repo / Strategic:**

- Consumed by / references in brique-auxilia (AUXILIA.md positions Auxilia as composable in cyrnea
  among other hosts).
- ROADMAP-TECH explicitly calls for Actes + Cyrnea product flows ("On parle du dernier conseil ?").
- Part of #PERTITELLU / Corte capital experiments; aligned with C.O.R.S.I.C.A. (1995).
- Layer 4 of DHITL / FractaVolta vision (human-in-the-loop democratic cognition in physical third
  places).

**Build / Dev Tooling:**

- pnpm + Turbo monorepo.
- Node Git hooks + lint-staged + ESLint 9 + Prettier.
- Playwright + Vitest.
- Netlify CLI for local Edge simulation.
- Tunnel scripts (ngrok/cloudflare?) for mobile testing.

---

## 6. Deployment, Ops & Environment

- **Local Dev:** `pnpm cyrnea:dev` (or backend/netlify dev on :8888). Requires Supabase project +
  env, Netlify auth, tunnel for some features.
- **Prod:** Netlify (static + Edge Functions). Multi-instance via subdomains (corte.inseme.app,
  etc.) — resolver currently disabled in Cyrnea's netlify.toml per ROADMAP.
- **Data:** Supabase project(s) shared across Inseme/Cyrnea (see docs for migrations, GBIF imports
  in biodiversity context, room/message tables).
- **Logging:** Axiom + LogLayer (structured, used in App navigation + hooks).
- **Known Operational Items (ROADMAP):**
  - Instance resolver stability.
  - Dynamic PWA manifest / SEO per bar.
  - Secure upload paths (R2 vs Supabase direct).
  - Bridge Deno/Node removed (good).
  - Cache cleaning done (2026-01).

---

## 6.5 Launch & Development Workflow (Scripts de Lancement)

This section is the current canonical reference for how to start working on Cyrnea. It was added as
the agreed starting point for concrete engineering work.

### Primary Launch Commands (from monorepo root)

| Command               | What it does                                                            | When to use                                         |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| `pnpm cyrnea:dev`     | `compile:briques && vite` in `apps/cyrnea`                              | Quick frontend iteration (no Edge)                  |
| `pnpm cyrnea:backend` | `check-tunnel.js && netlify dev --cwd apps/cyrnea --port 8888`          | Real work (Edge Functions + AI)                     |
| `pnpm cyrnea:all`     | Turbo parallel: cyrnea dev + sovereign models + platform tunnel         | Full local stack (recommended for Cyrnea + Ophélia) |
| `pnpm cyrnea:build`   | `compile:briques && vite build`                                         | Production build                                    |
| `pnpm cyrnea:tunnel`  | Delegates to `apps/platform/scripts/tunnel.js` (ngrok/cloudflared + QR) | Mobile testing / exposing Edge                      |

### The Critical `compile:briques` Step

Every dev and build for Cyrnea runs:

```bash
node ../../packages/cop-host/scripts/compile-briques.js
```

This script (≈820 LOC) performs a full monorepo scan on every invocation:

- Discovers all `brique.config.js` (currently ~13 in `packages/`)
- For each host app (`cyrnea`, `inseme`, `platform`):
  - Generates **Netlify Functions wrappers** (`netlify/functions/gen-*.js`) with logging
  - Generates **Edge Function wrappers** (`netlify/edge-functions/gen-*.js` + tool handlers)
  - Creates symlinks (or copies on Windows) from each brique's `public/` into
    `apps/cyrnea/public/briques/<id>/`
  - Writes `apps/cyrnea/src/generated/brique-registry.js` (BRIQUES array + CONSOLIDATED_PROMPTS +
    lazy component imports for all routes)
  - Generates tool/prompt registries used by Ophélia
  - Touches comments in the app's `netlify.toml`
  - Cleans "orphan" generated files
  - (Optionally) syncs some non-@inseme dependencies into the host app's package.json

**Consequences for developer experience:**

- Heavy startup cost (glob + many file writes + dynamic imports of every brique.config).
- Generated artifacts live inside the source tree (`netlify/`, `public/briques/`, `src/generated/`).
- On Windows, symlink creation often falls back to `junction` or full copy.
- The step is not skipped on pure frontend changes.

### The `check-tunnel.js` Gate

`pnpm cyrnea:backend` and some turbo flows first execute:

`node scripts/check-tunnel.js`

Behavior:

- Parses `.env` + process env for `HTTP_PROXY` / `HTTPS_PROXY`.
- If a proxy is declared, it **actively tests connectivity** (Deno `connect` or Node `net`).
- On failure → prints warning + **hard `process.exit(1)`** to prevent the famous Deno-in-Netlify-CLI
  connectivity bugs.
- Otherwise silent pass-through.

This script was introduced as a defensive measure on Windows/proxy-heavy environments (very relevant
for this machine).

### Full "Realistic" Local Stack

To have the Cyrnea experience that matches production (Ophélia vocal, tools, real Edge behavior,
mobile onboarding QR):

1. Valid Supabase project with the Inseme schema + proper RLS.
2. Netlify CLI installed and authenticated.
3. A tunnel (ngrok or cloudflared) running so that Edge Functions and mobile clients can reach the
   local server.
4. (Optional but powerful) Local sovereign LLM server via `@inseme/models`.
5. Correct proxy variables (or none) so that `check-tunnel.js` passes.

The `cyrnea:all` turbo command tries to orchestrate 3 of these in parallel.

### Current Pain Points (Launch Experience)

- `compile:briques` on every `dev` is the #1 source of friction.
- No fast "frontend-only" mode that avoids the full brique compilation.
- `check-tunnel.js` can be surprising / blocking on first runs or after network changes.
- Generated files pollute `git status` unless carefully ignored or committed (current state mixes
  both).
- Tunnel + Netlify dev + Vite + models = complex mental model for a new contributor or AI agent.
- Documentation of the exact required environment variables and one-command setup is scattered
  (ROADMAP, PROXY_TUNNEL.md, various READMEs).

---

## 6.6 Environment Requirements & Secrets (Cyrnea)

(Placeholder — to be completed with actual variables from .env and Vault usage as we work from the
launch scripts.)

Typical needs:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, service role for some operations.
- OpenAI or local LLM keys (depending on sovereign mode).
- Axiom logging tokens (optional but active in Cyrnea).
- Tunnel provider credentials / tokens.

No public production URL documented in this assessment pass; demo flows reference
`localhost:8888/bar/cyrnea` and `/app/cyrnea`.

---

## 7. Known Issues, Risks & Technical Debt (Prioritized)

1. **ClientMiniApp Feature Regression (P0 — Critical)**: 740 LOC vs 3014 LOC backup. Detailed
   reinjection plan exists **only** as a long section inside ROADMAP-TECH.md (Jan 2026, lines
   ~158–260+); exhaustive filesystem search for "_REINJECT_", "_reinjection_", or "_ClientMini_"
   across the entire repo found **no standalone REINJECTION_PLAN.md** (only the source + .backup
   files plus node_modules copies). The plan was never extracted to its own file. High risk to user
   experience, rituals, games, tips, broadcasts, tags, After mode, etc. Requires systematic audit +
   phased port from backup or fresh reimplementation.
2. **Refactor WIP Artifacts**: `BarmanDashboard.refactor-wip.jsx`, backup files, possible dead code
   in src. Cleanup + consolidation needed.
3. **Multi-Instance / Resolver Disabled**: Cyrnea-specific netlify.toml has resolver turned off.
   Blocks reliable per-bar (per-commune) theming, config, PWA identity.
4. **Dynamic PWA / SEO / Sitemaps (P2)**: Static manifest hurts bar-specific install +
   discoverability.
5. **Ophélia Ethics & Governance in Bar Context (P2)**: Prompts are strong (non-partisan,
   facilitator), but logging policy, prompt change governance, limits of use in social venues (no
   profiling, no reporting), legal (RGPD, electoral, press) not yet formalized. Especially sensitive
   for "bar as public sphere".
6. **Actes Integration & Bar Rituals (P3)**: Desired product bridge ("talk about last council in the
   bar") not implemented.
7. **Nested Dupe Path**: `apps/cyrnea/apps/cyrnea` artifact — investigate/remove.
8. **Test Coverage**: Integration exists; unit thin. Post-refactor verification needed.
9. **Documentation Drift**: Some specs and ROADMAP items predate current slim ClientMiniApp.
10. **Financial / Resource Context** (from sibling CONTEXT.md in jhr): Limited runway; favors
    low-cost, incremental, open approaches.

**Positive Mitigations:** Strong modular design (once reinjection complete), excellent privacy
philosophy, rich Ophélia specialization for context, active high-level roadmap ownership, alignment
with larger anti-capture / sovereignty corpus.

---

## 8. Philosophical & Strategic Alignment

Cyrnea is not "just another bar app." It operationalizes several core tenets of the Possibilist /
C.O.R.S.I.C.A. / DHITL project:

- **One Human, One Voice** extended to physical third places.
- **Gift / Counter-Gift** (Mauss) over transactional payments (trust-based tips, suspended coffee
  rituals).
- **Cognitive Sovereignty** in convivial settings: AI as mirror/facilitator ("macagna" expert),
  never surveillant or judge.
- **Territorial Laboratory**: Corsica (Corte) as legible scale for experiments that can generalize
  (Mediterranean, rural Europe).
- **Anti-Capture by Design**: LocalStorage primacy for users, JSONB metadata per room (bar owns its
  state), open MIT, no platform lock-in.
- **Democratic Reversibility & Optionality**: Modular briques allow communities to compose (or fork)
  their own experience.
- **Transmissible Memory**: Bar as living archive of local conversation, rituals, contributions
  (gazette, messages, vibe history).

It sits at the intersection of **infrastructure (FractaVolta photon-to-civic)** and **lived social
practice**.

---

## 9. Open Questions & Recommended Next Steps (for Evolution)

**Immediate (Stabilization):**

- Execute or refresh the ClientMiniApp reinjection audit + feature port (use ROADMAP plan as base;
  compare backup line-by-line against current modular hooks/components).
- Remove or justify backup/WIP files; establish single source of truth.
- Re-enable + harden instance-resolver for Cyrnea (coordinate with platform/inseme apps).
- Add regression tests covering the "missing" features once reinjected.

**Product / Integration (P2-P3 per ROADMAP):**

- Define and prototype "Actes au Bar" flows (Ophélia tools + UI entry points for council minutes,
  demandes).
- Evaluate brique-auxilia integration (mobile data/battery sharing as "digital hospitality" ritual).
- Formalize Ophélia bar ethics charter + logging/retention policy (document in dedicated section or
  new ETHICS_CYRNEA.md).
- Dynamic PWA manifest + per-instance SEO.

**Architectural / Governance:**

- Contribute to or consume `brique-cogentia-commons` when ready.
- Explore Kudocracy governance of Cyrnea config/prompts (per ROADMAP P3).
- Document concrete multi-bar deployment story (one Netlify + multiple Supabase tenants or shared
  with RLS?).

**For AI Agents Working Here:**

- Always consult this file + ROADMAP-TECH.md + brique-cyrnea/STORAGE_ARCHITECTURE.md + ophelia
  prompts before editing Cyrnea flows.
- Prefer extending via new briques or COP tools rather than monolithizing into App.jsx or
  ClientMiniApp.
- Preserve the localStorage + room-metadata split; never push user pseudonyms/identifiers to central
  auth without explicit review.
- When touching Ophélia roles or tools for Cyrnea, update the corresponding prompt files and
  registry.
- Log significant changes back into this STATE_OF_PLAY with "Change Log" section + date.

**Measurement of Success:**

- ClientMiniApp feature parity (or better) with the 3k-line backup while keeping modular benefits.
- At least one live bar deployment (Corte pilot?) with measurable social rituals activated.
- Clear ethics doc + resolver + PWA hardening landed.
- Cyrnea referenced positively in corpus-level papers/dashboards.

---

## 10. Change Log (Living — Append New Entries at Top)

**2026-05-31 — Resumption of work (Grok 4.3 + human, via cogentia corpus session)**

- **Dev health snapshot** (`pnpm cyrnea:doctor` from canonical tree): 60% iterative readiness.
  - ✅ Node 24 / pnpm 10.28, monorepo root, .env present, Supabase URL, Netlify CLI.
  - ⚠️ 22 modified files (structural changes detected → recommend full compile, not --no-compile).
  - ⚠️ brique-registry last generated ~53 hours ago.
  - ⚠️ Proxy variables in .env (check-tunnel.js may block some flows).
- **ClientMiniApp debt confirmed still open** (cross-ref to Jan 2026 ROADMAP "REEVALUATION COMPLÈTE"
  P1 section + May 28 initial assessment):
  - Current modular `TipModal.jsx` forces `method: "manual"` only; no Stripe / Wero / physical
    payment flows or phone_visibility reveal logic from the 130 kB backup (the P0 item).
  - `ClientMiniApp.jsx` (30 kB) vs `.backup` (130 kB) gap remains the #1 technical debt.
- **Corpus view** (via `cogentia status` / `list` / `lint`): inseme now reports in sync (previously
  1 behind on cached refs); 331 MD files (heavy ignore list), 1 unreferenced; frontmatter mostly
  clean on research/ docs.
- **Open threads pulled from inseme's own research/**:
  - In Progress (index.md): `@inseme/brique-cogentia-commons` (spec in cogentia repo, impl pending),
    COP v0.3+ federation events, per-instance deployment hardening.
  - Cyrnea: ClientMiniApp parity + live bar pilot + ethics/resolver/PWA.
  - COP: shift to async/traceable core (synchronous UIs deprioritized for now).
- Agent task list created for systematic resumption (audit → port P0 features → update views → COP /
  brique-cogentia-commons).
- All actions governed by the project AGENTS.md / .ai-rules.md / .rules.md and the corpus
  agent_brief (draft only; human arbiter on Layer 3).

**2026-05-28 — Smart auto-detection + Dev Doctor (Grok)**

- Enhanced launcher with **automatic intelligent compile skipping**:
  - Uses `git status` to analyze changed files.
  - If only changes are inside `packages/brique-cyrnea/src/` (or similar UI areas) and no structural
    files (brique.config, prompts, edge, etc.) were touched → automatically uses fast `--no-compile`
    mode.
  - Clear messaging explaining the decision.
- New tool: `pnpm cyrnea:doctor` (`scripts/cyrnea-doctor.js`)
  - Focused on "Am I ready for a fast iterative development session?"
  - Checks: environment, git changes (with --no-compile recommendation), freshness of
    brique-registry, .env + proxy risks, Netlify CLI, etc.
  - Gives a readiness percentage + actionable advice.
- Both tools are now core parts of the Cyrnea DX for iterative work.

**2026-05-28 — Initial état des lieux (Grok)**

- Comprehensive inventory of apps/cyrnea + packages/brique-cyrnea.
- Identified ClientMiniApp regression as #1 technical debt (740 vs ~3014 LOC).
- Mapped integrations, Ophélia Cyrnea roles, privacy architecture, ROADMAP cross-references.
- Created this document as primary evolving reference for future AI/human work on Cyrnea.
- Noted nested dupe path artifact and disabled resolver.
- Placed in `research/CYRNEA_STATE_OF_PLAY.md` for discoverability alongside index.md /
  corpus-status.md.

_(Future entries will record: feature reinjections, architectural decisions, deployments, prompt
changes, ethics docs, brique adoptions, etc. Each entry should include date, actor, summary, and
links to PRs/commits/docs.)_

---

## Appendix: Quick File Map for Agents

- **Thin host shell:** `apps/cyrnea/src/App.jsx`, `package.json`, `netlify.toml`, `vite.config.js`
- **Core implementation:**
  `packages/brique-cyrnea/src/pages/{ClientMiniApp.jsx, BarmanDashboard.jsx, ...}`, `src/hooks/*`,
  `src/lib/*`, `STORAGE_ARCHITECTURE.md`, `specs/COCKTAILS_AND_ROLES.md`
- **AI specialization:** `packages/brique-ophelia/public/prompts/roles/cyrnea-*.md` + edge/roles/
- **Orchestration & Registry:** `packages/cop-host/`, `packages/room/generated/brique-registry.js`
- **Roadmap & Constraints:** `ROADMAP-TECH.md` (esp. ClientMiniApp section + P2
  ethics/multi-instance), `docs/MODULAR_SYSTEM.md`
- **Cross-brick context:** `packages/brique-auxilia/AUXILIA.md`, research/ files, sibling repos
  (cogentia, FractaVolta, barons-Mariani)
- **Tests:** `apps/cyrnea/tests/`, `packages/brique-cyrnea` (minimal)

---

_This document is intentionally factual, diagnostic, and forward-looking. It does not replace code
comments or specialized specs — it orients them. Update it whenever the ground truth of Cyrnea
changes._

**Maintained collaboratively. Fork, challenge, improve.**

### #PERTITELLU | CORTI CAPITALE | Possibilism in Practice
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Inseme](../README.md)
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
