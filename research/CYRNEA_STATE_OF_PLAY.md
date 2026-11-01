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

## 2026-11-01 — Cyrnea comme prothèse cognitive collective : rapprochement avec Cogentia

**Clarification du Principal :** Cyrnea n'est pas seulement une IA conversationnelle de bar. Son horizon est une **prothèse cognitive collective** : plusieurs capteurs sonores, plusieurs interlocuteurs, une médiation située destinée à accroître la convivialité, d'abord dans un bar. Elle partage avec la prothèse personnelle Agent JHN / Calculette de l'Esprit les principes d'assistance à la perception, à l'attention, à la mémoire et à l'action, mais non le même périmètre de mandat : ici plusieurs personnes et un espace social, sans autorité individuelle unique sur les propos de tous.

**État du code inspecté, à ne pas surestimer :** `packages/room/lib/media/SmartAudio.js` fournit `HostAudioIO`, VAD/silence, `MediaManager`, adaptateur et `AudioQueue` ; `HostAudioIO.startCapture()` ouvre un microphone local (`getUserMedia({audio:true})`), sans orchestration multi-capteurs synchronisés démontrée. `packages/room/lib/media/SemanticCaptor.js` produit intensité, pseudonymes acoustiques et types d'interaction à partir d'heuristiques (ZCR et approximation du centroïde), pas d'une diarisation robuste ou d'une identification fiable des personnes. Cyrnea inclut Ophélia, les zones du bar et les rôles indoor/outdoor ; le test `apps/cyrnea/tests/integration/smart_mic.spec.js` contient des hypothèses/skips, et ne prouve pas un pilote collectif réel.

**Point de vigilance FBF :** `packages/brique-cyrnea/src/pages/VocalConversation.jsx` contient un chemin « Always upload raw audio to storage (PV / Archive) ». Avant tout essai impliquant plusieurs participants, auditer ce chemin, sa base légale et ses conditions de consentement, les droits des personnes présentes, la visibilité de la captation, la durée de conservation et la révocation. Distinguer capture locale temporaire, signaux agrégés, transcription, pseudonymisation, archivage et restitution : ces effets n'ont pas les mêmes risques. Favoriser un pilote synthétique ou volontaire, avec traitement minimal et sans conservation brute par défaut.

**Prochaine recette bornée :** sur des flux synthétiques provenant de deux microphones et au moins trois interlocuteurs simulés, tester l'identité des sources, la synchronisation/latence, le chevauchement des voix, l'incertitude des attributions, la détection d'occasions de médiation, le silence volontaire, l'isolation des participants et l'absence d'archivage non autorisé. Mesurer la convivialité avec des indicateurs choisis par les participants, et notamment vérifier que la médiation n'étouffe pas les conversations naturelles. Réutiliser COP, les mécanismes de routage et la Calculette sans confondre mandats personnels et mandats collectifs.

**Point de rattachement conceptuel :** https://github.com/JeanHuguesRobert/cogentia/issues/233 . **Statut : intention confirmée par le Principal, comparaison architecturale et audit de code seulement ; aucune capacité multi-microphones déployée ni efficacité sociale démontrée.**

## Veille 2025–2026 — reprise différée (01/11/2026)

Le Principal confirme que Cyrnea, prothèse cognitive **collective** destinée à augmenter la convivialité d'un bar par plusieurs capteurs et interlocuteurs, reste volontairement **non prioritaire**. L'interruption depuis près d'un an tenait notamment à une maturité technique insuffisante. Cette veille ne déclenche aucun développement.

**Progrès sourcés :**
- 29/09/2025 : pyannote.audio 4 / Community-1, diarisation open source et alignement avec STT : https://www.pyannote.ai/changelog .
- 04/02/2026 : Mistral Voxtral Realtime, transcription streaming open weights, latence annoncée configurable sous 200 ms : https://mistral.ai/news/voxtral-transcribe-2/ .
- 07/05/2026 : OpenAI GPT-Realtime-2 et Realtime-Whisper, agents vocaux et transcription en flux : https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/ .
- 07/07/2026 : pyannote Live-1 en GA, diarisation en flux annoncée ~300 ms, jusqu'à huit locuteurs : https://www.pyannote.ai/changelog .
- Septembre 2026 : Microsoft VibeVoice-ASR-Streaming 1,5B/7B (transcription et attribution en flux) : https://www.microsoft.com/en-us/research/publication/vibevoice-asr-streaming-technical-report/ . NVIDIA Nemotron 3 (huit locuteurs et chevauchements, erreur non nulle) : https://huggingface.co/blog/nvidia/nemotron-diarization . Pyannote Precision-3 apporte notamment des scores de probabilité locuteur et crosstalk : https://www.pyannote.ai/changelog .

**Limites :** les benchmarks portent principalement sur réunions/appels, pas plusieurs conversations parallèles dans un bar. La synchronisation de microphones répartis, la parole chevauchée, les sons ambiants et l'identification fiable restent à tester. Microsoft Azure Speech ajoute en juillet 2026 une preview de transcription multicanal en direct limitée à deux canaux : https://learn.microsoft.com/en-us/azure/ai-services/speech-service/releasenotes . Le français mêlé de corse est à benchmarker séparément. Une transcription correcte ne garantit pas qu'Ophélia sache quand intervenir pour *améliorer* la convivialité.

**Droit et minimisation :** la CNIL (20/03/2026) rappelle notamment l'interdiction de coupler captation sonore et vidéoprotection dans les lieux publics concernés : https://www.cnil.fr/fr/les-dispositifs-de-captation-sonore-couples-la-videoprotection . Une analyse distincte RGPD, information/consentement ou autre base valable, proportionnalité, droits des clients et salariés est indispensable pour toute captation de bar ; cette règle sur la vidéoprotection ne détermine pas seule tous les régimes audio. La voie `VocalConversation.jsx` prévoyant l'archivage brut doit être auditée avant toute expérimentation collective.

**Critères pour réexaminer plus tard (sans priorité actuelle) :** essai sur flux synthétiques issus de 2–3 microphones et 3–5 personnes, bruit et chevauchement ; mesurer WER et erreur d'attribution par source, latence et coûts sur pipeline local/hybride/cloud ; vérifier confidentialité et silence par défaut. Un éventuel pilote ne commencerait qu'avec volontaires clairement informés, sur une table plutôt qu'un bar entier, et un indicateur de convivialité défini par les participants. Conclusion : prototype contrôlé aujourd'hui crédible, médiateur collectif ambiant autonome en bar ouvert non démontré.

## 2026-11-01 — Principe de localité, téléphones-capteurs et calcul distant

**Précision du Principal :** l'architecture cible emploie les **smartphones personnels des participants** comme capteurs sonores ; le signal doit devenir le plus tôt possible une observation **riche sémantiquement mais minimisée**. Aucun serveur de traitement intelligent n'est envisagé *dans le bar* : le calcul inférentiel lourd résiderait ailleurs. La confidentialité des propos tenus au comptoir est une exigence **fondatrice**, non une option.

**Arbitrage de localité :** le téléphone peut effectuer au plus près de la source la capture éphémère et le prétraitement peu coûteux (VAD, fins/débuts de prises de parole, silences, chevauchements, indicateurs de bruit ou éventuellement intentions explicitement sollicitées). Le compute distant n'a besoin que de ces événements **si la finalité peut s'en satisfaire**. La transcription, l'ASR avancé, la compréhension fine ou la séparation de voix exigeant des informations plus riches peuvent rendre impossible une anonymisation forte : ne pas les prétendre anonymes par simple retrait du nom, de l'empreinte vocale ou du fichier audio. Pseudonymes, embeddings vocaux, transcriptions, séquences temporelles détaillées et événements rares peuvent permettre corrélation ou réidentification. Source de doctrine : CNIL https://www.cnil.fr/fr/identifier-les-donnees-personnelles ; littérature NIST sur fuite résiduelle dans anonymisation de la voix https://www.nist.gov/publications/evaluating-identity-leakage-speaker-de-identification-systems ; recherche sur l'identification via contenu linguistique https://arxiv.org/abs/2510.12780 .

**Conséquences techniques :** distinguer l'identité de transport du téléphone et les identifiants sociaux des locuteurs ; préférer des agrégats non individualisants, un champ d'observation minimal, des IDs éphémères, une durée de vie bornée, aucun son brut ou transcription par défaut, et une restitution soumise à autorisation explicite. Ne pas présumer qu'un téléphone capte seulement la voix de son propriétaire : il entend aussi les voisins et non-participants. La distribution améliore potentiellement le rapport signal/bruit et l'autonomie du participant, mais ajoute désynchronisation, dérive d'horloge, chevauchements inter-capteurs, batterie, mobilité, réseau et permissions mobile/PWA ; ne pas promettre une captation fiable en arrière-plan/écran verrouillé sur iOS/Android. Un événement social « quelqu'un parle » ne requiert pas l'alignement de phase des microphones ; le beamforming/TDOA, lui, peut demander une précision temporelle bien supérieure : ne pas payer le coût de synchronisation maximale si la fonction ne la demande pas.

**Deux modes de service à séparer :** A) *ambiance préservée*, sans captation des mots ni archivage (statistiques de parole agrégées et indices temporaires, si permis), compatible avec la convivialité et le non-enregistrement ; B) *invocation explicite d'Ophélia*, où les participants concernés consentent à une fenêtre courte de compréhension détaillée, éventuellement traitée à distance sur un canal gouverné. Ne jamais faire glisser tacitement A vers B. Test initial futur : téléphones simulés produisant des événements synthétiques horodatés, mesure de la qualité de médiation par rapport à un baseline sans extraction des mots, et audit de fuite d'informations. **Pas de lancement de Cyrnea ; note de conception en veille.**

## 2026-11-01 — Room sociale, sous-rooms éphémères et mobilité conversationnelle

Le Principal précise que `room` désigne un **espace de discussion** et non une pièce physique. Dans un bar, un même lieu ou une tablée importante peut héberger plusieurs conversations simultanées ; les usagers passent librement d'une conversation à l'autre, contribuent parfois à plusieurs, et les sous-rooms émergent, fusionnent et se dissolvent spontanément. Le modèle de Cyrnea doit représenter cette dynamique, sans forcer l'appartenance exclusive ni imposer de découpage automatique rigide. Une room peut être imbriquée, liée, non spatiale ou transitoire ; le lien parent/enfant ne doit pas devenir une barrière de communication.

**État du code au 01/11/2026 :** `packages/room` contient une `room` comme unité d'assemblée et de messagerie, avec `room_id`, présence et gouvernance ; `useHybridPresence` et `useBarPresence` apportent de la présence et des indicateurs ; `BarmanDashboard` propose déjà une salle éphémère « After ». Aucune preuve dans ces fichiers d'une inférence fiable des sous-conversations simultanées ou de leur fusion/partition automatique : il s'agit d'une exigence conceptuelle et non d'une capacité déployée.

**Fondement empirique :** Dunbar, Duncan & Nettle, « Size and structure of freely forming conversational groups », *Human Nature* 6 (1995), DOI 10.1007/BF02734136, observent un plafond habituel autour de quatre personnes pour une conversation spontanée : https://pubmed.ncbi.nlm.nih.gov/24202831/ . Dezecache & Dunbar, « Sharing the joke: the size of natural laughter groups » (2012), observent dans des bars une moyenne de 2,93 personnes par sous-groupe conversationnel et une rareté des sous-groupes au-delà de cinq : https://www.sciencedirect.com/science/article/pii/S1090513812000682 . Il s'agit d'une régularité statistique, non d'une limite absolue ni du nombre de Dunbar de 150 relations sociales ; pas de règle automatique « créer sous-room à 5 personnes ».

**Projection minimale :** distinguer `place_id` éventuel, `room_id` conversationnel, `parent_room_id` optionnel (organisation, non cloisonnement), `participant_id` éphémère, et relations de participation à poids/incertitude et temporalité (`observing`, `contributing`, `left`, etc.). Les transitions utiles : `emerged`, `joined`, `left`, `overlap`, `split`, `merged`, `dissolved`. Le téléphone rapporte seulement des observations minimisées ; ne pas déduire une identité, une conversation ou une appartenance certaine d'une seule proximité acoustique. Corréler avec prudence des événements anonymisés issus de plusieurs téléphones ; la granularité temporelle et les graphes d'interaction peuvent réidentifier des personnes même sans texte ni son. La gouvernance et les droits de visibilité doivent s'appliquer à chaque sous-room, à chaque participation et à chaque destinataire d'une restitution Ophélia.

**Reality Test ultérieur, non prioritaire :** tablée de huit participants synthétiques ; formation A(4)/B(4), chevauchement d'un participant A+B, échanges de participants, apparition d'une troisième conversation et fusion ; vérifier que les observations peuvent être réconciliées sans transcription, sans identification persistante et sans création/fusion imposée. Mesurer erreur de segmentation, latence et intrusion d'Ophélia. Cette note ne relance pas le développement de Cyrnea.

## 2026-11-01 — Hypothèse falsifiable : taille moyenne des sous-groupes et convivialité

**Hypothèse du Principal (veille, non prioritaire) :** la moyenne `2,93` de participants par conversation dans les bars (Dezecache & Dunbar 2012) est un indicateur potentiellement pertinent : tester si la convivialité augmente lorsque la taille des sous-groupes conversationnels augmente. La publication originale précise **2,93 ± 0,05 erreur standard (N=501)** pour les sous-groupes conversationnels, **2,72 ± 0,04** pour les sous-groupes de rire, et **2,8 %** des sous-groupes conversationnels de plus de cinq personnes. Source primaire : https://www.sciencedirect.com/science/article/pii/S1090513812000682 ; DOI 10.1016/j.evolhumbehav.2012.07.002. Dunbar et al. 1995 : plafond habituel d'environ quatre participants actifs, https://pubmed.ncbi.nlm.nih.gov/24202831/ . La moyenne observée n'est ni un objectif à maximiser mécaniquement, ni une preuve de causalité.

**H1 :** à contexte comparable, plus la taille moyenne des conversations spontanées est élevée, plus les participants déclarent une convivialité élevée. **H2 :** effet non linéaire ou optimum, avec dégradation possible si grand groupe, brouhaha, domination ou exclusion. **H0 :** relation absente ou expliquée par des facteurs de confusion. La mesure indépendante de convivialité (évaluations brèves et volontaires : inclusion, plaisir, sentiment d'écoute, envie de revenir) ne doit pas être calculée à partir du même indicateur de taille utilisé comme prédicteur, sous peine de circularité.

**Protocole futur :** unités d'observation `room`/sous-room × fenêtre temporelle, `group_size` incluant les auditeurs effectivement engagés mais distinguant le nombre de locuteurs actifs ; moyenne pondérée par durée, médiane et distribution, part de personnes seules ou exclues, fréquence des changements de groupe, équilibre des tours de parole, rires partagés. Tester la dépendance au nombre total de présents, bruit ambiant, disposition physique, relations préexistantes et moments de la soirée. Les sous-rooms chevauchantes peuvent compter un même participant plusieurs fois : expliciter dénominateurs et incertitude. Comparaisons inter-soirées ou, si accord des participants, essais alternant Ophélia activée/désactivée, sans pousser artificiellement les gens à se rassembler. Captation audio minimisée et éphémère, aucun verbatim ni profil nominatif. **Conclusion actuelle : hypothèse intéressante, non validée. Ne pas lancer Cyrnea.**

## 2026-11-01 — État de l'art dynamique des groupes et agents facilitateurs (veille)

Le projet Cyrnea relève de la psychologie sociale des petits groupes, de l'analyse conversationnelle, de la sociométrie des interactions, du *social signal processing* et des **Group Conversational Agents** (GCA). Il vise la convivialité humaine, non l'optimisation du seul volume de parole ni la substitution du groupe par une IA. La taille moyenne observée de 2,93 sous-groupes de conversation (Dezecache & Dunbar 2012) est **descriptive**, pas un optimum normatif. Le facteur d'intelligence collective décrit par Woolley et al. 2010 est lié, entre autres, à la sensibilité sociale et à l'équilibre des tours de parole, dans des groupes de travail, non nécessairement dans un bar : https://pubmed.ncbi.nlm.nih.gov/20929725/ . Les *F-formations* et communautés temporelles permettent de modéliser sous-rooms et transitions.

**Références récentes :**
- Li et Tang, *Group Conversational Agents: A Review of Designs that Support and Shape Group Interaction*, ACM DIS 2026, revue de 53 études : orientation, conflit, alignement, exécution ; arbitrages visibilité/discrétion, autonomie/initiative, autorité/propriété du groupe. https://doi.org/10.1145/3800645.3812934
- Liao, Sou et Wu, *Contextual-Temporal Language Structures for Conversation Group Detection in Proximal Spaces*, GLOBECOM décembre 2025, smartphones, événements temporels sans texte brut et Louvain ; **73 % d'accuracy** moyenne selon l'abstract sur leurs tests : https://scholars.lib.ntu.edu.tw/handle/123456789/740431 . Ce pourcentage n'est ni une précision statistique (precision) ni un résultat démontré en bar Cyrnea.
- Houde et al., *Controlling AI Agent Participation in Group Conversations*, IUI 2025 : les utilisateurs souhaitent contrôler quand, où et sur quoi l'agent intervient, et rejettent sa domination. https://arxiv.org/abs/2501.17258
- Parisi et al., *Real-Time Group Dynamics with LLM Facilitation*, FAccT 2026, N=879, groupes textuels de trois : préférence des participants pour l'agent, sans amélioration significative du consensus ni de l'équité de participation, et influence mesurable sur certains résultats. https://deepmind.google/research/publications/224297/
- Møller et al., *The impact of generative AI on social media*, Scientific Reports février 2026 : assistance générative parfois associée à davantage d'engagement mais moindre authenticité et qualité perçues. https://pmc.ncbi.nlm.nih.gov/articles/PMC13002914/
- DialogLab, ACM UIST 2025 : simulation et évaluation de conversations hybrides multi-participants avant tout pilote humain : https://research.google/pubs/dialoglab-authoring-simulating-and-testing-dynamic-group-conversations-in-hybrid-human-ai-conversations-2/ .

**Programme de recherche, non lancement :** séparer trois mesures indépendantes : (1) dynamique observable de groupes/rooms et changements de sous-room, (2) convivialité vécue volontairement rapportée, (3) effet causal de la médiation d'Ophélia contre condition sans médiation. Hypothèses rivales : augmenter les tailles moyennes n'augmente pas nécessairement le bien-être ; trop d'interventions réduit l'authenticité ; une facilitation appréciée peut orienter ou exclure sans qu'on le remarque. Ne pas interpréter des corrélations de données acoustiques comme des états mentaux, intentions ou émotions certains. Poursuivre prioritairement JHN ; Cyrnea reste en veille.
