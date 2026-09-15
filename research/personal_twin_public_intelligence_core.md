---
title: Personal Twin public intelligence core — factorize Guide ⊃ John ⊃ surfaces
date: '2026-08-08'
version: '0.1'
license: CC BY-SA 4.0
document_role: operational
document_kind: design-note
visibility: public
status: planned
github_issues:
  platform: https://github.com/JeanHuguesRobert/inseme/issues/37
  corpus: https://github.com/JeanHuguesRobert/cogentia/issues/85
related:
  - research/personal_twin_access_policy.md
  - research/interactions_registry_and_multichannel_messaging.md
  - research/user_personal_twin_link.md
  - research/instance_map.md
  - https://github.com/JeanHuguesRobert/FractaVolta/blob/main/docs/website/guide-chatbot-agile-plan.md
  - https://github.com/JeanHuguesRobert/cogentia/blob/main/docs/digital-twin-agile-roadmap.md
  - https://github.com/JeanHuguesRobert/cogentia/blob/main/docs/cogentia-corpus-navigator-contract.md
  - JeanHuguesRobert/inseme#35
  - JeanHuguesRobert/inseme#36
  - JeanHuguesRobert/inseme#33
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
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


# Personal Twin public intelligence core

**Tracking:** [inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37) ·
[cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85)

**Audience:** all agents. Implementation is multi-repo; this note is the **factorization plan**.

## 1. Product thesis (Principal, 2026-08-08)

### 1.1 Public chat on the Personal Twin

Anonymous (and public-mode) chat on **`https://jhn.baronsmariani.org`** (Agent John / public face)
must be **very comprehensive**: it should know **almost everything public** about the Principal and
what he does, including:

- **All public GitHub repositories** of the corpus / Principal (exclude **private** repos such as
  private overlays).
- **FractaVolta** (and future **FractaVolta SAS** public material) as first-class public knowledge.
- Civic / research / twin public doctrine already in the public corpus views.

### 1.2 Relation to the FractaVolta Guide

The FractaVolta site Guide (`fractavolta.com` widget →
`POST https://cogentia.fractavolta.com/guide/chat`) is a **public, immature, read-only** face of the
twin (see FractaVolta guide agile plan).

**Invariant:**

```text
Personal Twin public chat  ⊇  Guide public chat
(same or richer public knowledge; still read-only for anonymous visitors)
```

- Guide = **subset / specialized** surface (FractaVolta product narrative + public corpus
  navigation).
- John public mode = **superset** of that knowledge for the **person + full public work**, not only
  the company site pitch.
- Both are **readonly** for anonymous visitors (#35 `visitor_anonymous`). Owner / delegate modes are
  separate (private views, mutates under mandate).

### 1.3 Opportunity: one core, many surfaces

Today the **idea** is unified in doctrine; **code is fragmented**. We should factor a **core** and
attach thin surfaces:

| Surface               | User-facing form                                                 |
| --------------------- | ---------------------------------------------------------------- |
| Web UX                | Guide widget, John `/john` chat, future desk                     |
| OpenAI-compatible API | `/v1/chat/completions` (Principal / twin as addressable “model”) |
| MCP provider          | skills + tools (already Cogentia MCP; twin-scoped pack)          |
| CLI                   | `guide-cli`, twin-cli, smoke/eval                                |
| Channels later        | WhatsApp, interactions registry (#36)                            |

```text
        Web UX │ OpenAI │ MCP │ CLI │ Channel adapters
               └────────┬───────────────────────────┘
                        ▼
              PUBLIC INTELLIGENCE CORE
         (view · retrieve · cite · answer · skills)
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Corpus views   Access class   Intelligence bus
     (Cogentia)     (#35)          (Magistral / gateway)
```

---

## 2. Inventory — where fragmentation lives (2026-08-08)

### 2.1 Chat front desks (three stacks)

| Surface                 | Location                                                     | Backend                                        |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| **John / Ophelia UI**   | `inseme` room + Netlify edge `gen-ophelia-*`, brique-ophelia | Instance vault keys, partial Cogentia MCP      |
| **FractaVolta Guide**   | `FractaVolta/docs` widget + `cogentia` `POST /guide/chat`    | Public corpus view + Magistral + agent-gateway |
| **Coding agent OpenAI** | agent-gateway `:8793`, Magistral `:8880`, FreeLLMAPI         | Model capacity, not twin knowledge             |

### 2.2 OpenAI-compatible endpoints (multiple)

| Endpoint family             | Path / port                    | Twin-aware?                       |
| --------------------------- | ------------------------------ | --------------------------------- |
| Cogentia daemon completions | `:8790` `/v1/chat/completions` | Partial (Guide alias)             |
| Ophelia Netlify             | `gen-ophelia-openai-v1`        | Instance persona                  |
| Magistral                   | often `:8880`                  | Router only                       |
| Agent CLI Gateway           | `:8793`                        | Handlers, not corpus SoT          |
| FreeLLMAPI                  | separate product               | Capacity only — **not** twin core |

### 2.3 MCP / skills / tools

| Stack                                               | Role                                                   |
| --------------------------------------------------- | ------------------------------------------------------ |
| **Cogentia MCP** (`cogentia-mcp.js` / HTTP `:8791`) | Mature corpus tools + skills; default **public** view  |
| **Inseme platform MCP** (`apps/platform/mcp`)       | COP / Ophelia / JHN agents; prototype `/ask`           |
| Bridge                                              | `cogentiaMcpClient` on JHN path — not the full John UX |

### 2.4 CLIs

| CLI                        | Role                        |
| -------------------------- | --------------------------- |
| `cogentia.js`              | Corpus truth + daemon       |
| `guide-cli` / `guide-eval` | Same contract as Guide HTTP |
| `cop-cli`                  | COP packets, not public Q&A |
| `agent-gateway-invoke`     | OpenAI-compat invoke        |
| smoke / u-gate scripts     | Deploy checks               |

### 2.5 Knowledge / policy docs (already good intent)

- Guide agile plan: `FractaVolta/docs/website/guide-chatbot-agile-plan.md`
- Digital twin roadmap: `cogentia/docs/digital-twin-agile-roadmap.md`
- Navigator contract: `cogentia/docs/cogentia-corpus-navigator-contract.md`
- Access policy: `inseme/research/personal_twin_access_policy.md` (#35)
- Twin definition: `JeanHuguesRobert/twin/`
- Digital twin engine notes: Ophelia as “legacy ancestor of The Guide”

**Conclusion:** corpus MCP + Guide path are the best **seed for the core**. Ophelia edge is the
richest **product UX** but reimplements retrieval/routing. FreeLLMAPI and raw agent-gateway are
**capacity**, not identity.

---

## 3. Target architecture

### 3.1 Core modules (factorize here)

Name working title: **`twin-public-core`** (package placement TBD — prefer **Cogentia** for
knowledge; **Inseme** for session/access UX glue).

| Module                 | Responsibility                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **View resolver**      | `public` (default for visitors) vs owner/private views; never leak private                          |
| **Corpus scope**       | Which repos/docs are in “public about me” (all public GitHub registered in corpus; exclude private) |
| **Retrieve + cite**    | S7 / FTS / vec / context_pack — reuse Cogentia daemon + MCP tools                                   |
| **Answer policy**      | Read-only for public; refuse acts; honesty when unknown                                             |
| **Persona pack**       | John public vs Guide FractaVolta tone (same facts, different framing)                               |
| **Skill/tool catalog** | Subset of Cogentia skills/tools allowed for public class                                            |
| **Turn runner**        | One function: `runPublicTurn({ query, access_class, persona, stream })`                             |
| **OpenAI adapter**     | Map messages[] → turn runner → SSE/JSON                                                             |
| **MCP adapter**        | Expose same tools/skills with twin persona metadata                                                 |
| **CLI adapter**        | Thin wrapper (guide-cli becomes one client)                                                         |

### 3.2 Surfaces (thin)

| Surface         | Does                                                   | Does not             |
| --------------- | ------------------------------------------------------ | -------------------- |
| Guide widget    | POST core, show citations                              | Own retrieval, keys  |
| John `/john` UI | Auth class, history, stream; call core                 | Second RAG stack     |
| OpenAI clients  | Point at twin base URL + model id e.g. `jhn-public`    | Bypass view policy   |
| MCP clients     | Connect to twin MCP (or Cogentia MCP + persona header) | Open SQLite          |
| CLI             | `ask` / `handoff` / `eval`                             | Duplicate HTTP logic |

### 3.3 Knowledge scope for “public about me”

```text
IN SCOPE (public chat knowledge):
  - All public repos registered in Cogentia corpus state
  - FractaVolta public site + research (incl. future SAS public pages)
  - Public twin definition (JeanHuguesRobert/twin, public research)
  - Public interaction packets (D-level allowed)
  - Public Inseme / Cogentia / barons-Mariani / etc. public docs

OUT OF SCOPE (anonymous):
  - registre-mariani private overlay
  - Private GitHub repos
  - Vault secrets, service roles
  - Owner-only COP private memory
  - Unpublished SAS internal material
```

**Superset of Guide:** Guide may bias retrieval toward FractaVolta product docs; John public must
also surface personal civic work, twin doctrine, full public corpus — including everything Guide can
say.

### 3.4 “I become a kind of LLM”

Expose an OpenAI-compatible surface:

```text
POST {twin_public_base}/v1/chat/completions
Authorization: optional (anonymous public rate limit)
model: "jhn-public" | "fractavolta-guide" | later "jhn-owner"
```

Semantics:

- `jhn-public` = comprehensive public twin (superset knowledge).
- `fractavolta-guide` = Guide persona / scope (subset framing, same core).
- Responses include citation metadata (extensions or system trailers) where possible.
- Not a raw base model: **retrieval-grounded, policy-bound twin face**.

MCP:

- Public tools: search, get_lines, context_pack, skill_list/get, guide_resolve…
- Mutate tools: off for anonymous (existing Cogentia public pack).

---

## 4. Implementation plan (phased)

### Phase 0 — Doctrine & inventory (this doc)

- [x] Inventory of fragments
- [x] Superset invariant Guide ⊆ John public
- [x] Issues #37 / #85 open; pointers in AGENTS / indexes
- [ ] Principal confirm: model ids + SAS public scope when incorporated

### Phase 0.5 — OpenAI surface on Fracta (UX clients ↔ JHN server) — 2026-08-08

Not about local model hosting: JHN **is** the Chat Completions endpoint for Open WebUI / curl / etc.

- [x] `produceGuideTurn` + `cogentia/scripts/lib/jhn-openai-surface.js` (public / Jean Hugues keys)
- [x] `GET/POST https://cogentia.fractavolta.com/guide/v1/{models,chat/completions}`
- [x] Docs: `cogentia/docs/jhn-openai-surface.md`; unit + live smoke scripts
- [ ] Restart mcp-cogentia on fracta; set `COGENTIA_JHN_OWNER_API_KEY` in secrets
- [ ] Live smoke green; optional Open WebUI dogfood

### Phase 1 — Single turn runner behind Guide (Cogentia)

1. Extract shared `runPublicTurn` from `/guide/chat` path (no behavior change). _Partial:_
   `produceGuideTurn` backs Guide non-stream + JHN OpenAI.
2. `guide-cli` and HTTP both call it.
3. Tests: guide-cli + guide-eval still green.
4. Document public repo list used by the view.

### Phase 2 — John public mode uses the same runner (Inseme)

1. For `access_class=visitor_anonymous` (and optionally registered public mode), `/john` / Ophelia
   public path calls twin-public core (HTTP to Cogentia or shared package), **not** a separate RAG.
2. Persona = John; knowledge scope = full public corpus (superset).
3. Owner mode stays private path (later).
4. Remove or quarantine duplicate retrieval in brique-ophelia for public turns.

### Phase 3 — Factorized OpenAI + MCP surfaces

1. One OpenAI-compat adapter over `runPublicTurn` — **started on Fracta** (`/guide/v1/*`); Netlify
   edge can proxy later.
2. Twin MCP pack = Cogentia public tools + persona metadata (`twin:jhn`, surface=`public`).
3. Model catalog documents `jhn-public` and `fractavolta-guide` (+ `jhn-owner` with owner key).

### Phase 4 — Shared web UX kit (optional but valuable)

1. Extract streaming chat widget (citations, SSE status) shared by FractaVolta Guide and John.
2. Theming/persona only; same protocol.
3. Keep Inseme room features (auth, owner tools) as shells around the widget.

### Phase 5 — Eval & governance

1. Expand `guide-eval` → `public-twin-eval` with questions about Principal public work, not only
   FractaVolta pitch.
2. FixBugsFirst: regression when public chat invents private facts.
3. Operium: one health profile for “public intelligence core” endpoints.

### Explicit non-goals (v1)

- Merging FreeLLMAPI into twin identity
- Private owner brain in public core
- Full rewrite of Ophelia civic assembly features
- Claiming OpenAI partnership; only **API shape** compatibility

---

## 5. Repo ownership

| Concern                                                 | Home                 |
| ------------------------------------------------------- | -------------------- |
| Corpus view, retrieve, guide turn, MCP tools, guide-cli | **cogentia** (#85)   |
| John UI, access_class, instance session, COP acts       | **inseme** (#37)     |
| Guide widget chrome on company site                     | **FractaVolta**      |
| Twin identity docs                                      | **JeanHuguesRobert** |
| Private knowledge                                       | **registre-mariani** |
| Live routing / health                                   | **operium**          |

---

## 6. Relation to other FBF issues

| Issue | Link                                                                  |
| ----- | --------------------------------------------------------------------- |
| #33   | Chat must work before deep factoring; public core improves P7 quality |
| #35   | access_class gates core vs private tools                              |
| #36   | Consequential public chats may mint Interaction Packets               |
| #34   | Collective members linking personal twin (orthogonal)                 |

---

## 7. Adjacent idea (not a product commitment) — Twin as coding-agent orchestrator

**Status:** remember only. Principal (2026-08-08): _not_ intended to be proposed or built seriously
right now.

Because the Principal is a **veteran software developer**, a natural _adjacent_ use of the Personal
Twin is as a **coding agent** — with a structural trick:

```text
Twin (John / twin:jhn)
  does not replace coding agents
  uses / routes / mandates other coding agents
  (Grok, Claude, Codex, local gateway adapters, …)
  under owner policy + COP trace
```

That fits existing pieces without inventing a new product line today:

- Agent CLI Gateway + Magistral maps (handlers, not twin identity)
- Public intelligence core (this note) as _knowledge_ about the Principal’s code and doctrine
- Access class `owner` / `delegate` (#35) for who may invoke heavy coding tools
- Mandates / FixBugsFirst so the twin does not claim principal commitment authority

**Do not** treat this as Phase 6 of the public-chat factorization, market “John as a coding
product,” or expand scope of #37/#85. If revived later, open a dedicated issue under twin +
agent-gateway doctrine.

---

## 8. Open questions for Principal

1. Should anonymous John cite GitHub issue/PR text as first-class sources, or only research
   markdown?
2. FractaVolta SAS: when does company material enter public corpus (repo + disclosure)?
3. Prefer core package in **cogentia** only (Inseme as client) vs monorepo workspace package?
4. Public rate limits / abuse policy for OpenAI-compat twin endpoint?

---

## 9. See also

- [Personal twin access policy](personal_twin_access_policy.md)
- [Interactions registry plan](interactions_registry_and_multichannel_messaging.md)
- FractaVolta Guide plan (upstream site)
- Cogentia digital twin roadmap + navigator contract
- Agent CLI Gateway / Magistral boundary (capacity vs identity) )
