---
title: 🌀 MAGISTRAL Protocol
author: unknown
date: '2026-06-12'
last_modified_at: '2026-08-23'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: '9167494'
  origin_date: '2026-06-12'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# 🌀 MAGISTRAL Protocol

> **Agnostic Arbitration Layer for Large Language Models.**

**MAGISTRAL** is an open technological initiative designed to restore user sovereignty by breaking
provider silos. It defines a strict standard for separating model capabilities, network access, and
decision logic.

---

## 🏛️ 1. Philosophy & Governance

As a technical **Consortium**, the MAGISTRAL Protocol is built on three non-negotiable pillars:

1.  **Vector Neutrality**: The protocol is a "blind pipe." it does not favor any specific provider
    or model.
2.  **Arbitration Transparency**: Routing decisions must be auditable, reproducible, and
    logic-driven rather than commercially biased.
3.  **Radical Agnosticism**: Complete decoupling between the client (IDE, Chat) and the execution
    infrastructure.

---

## 🏗️ 2. Tripartite Architecture

The system is segmented into three independent JSON entities:

### 📘 BLUEPRINT (Capabilities)

Defines what a model _is_ capable of (Technical Specs).

- **Metric**: Factual Truth.
- **Example**: `context: 128k`, `features: ["thinking", "tools"]`.

### 🗺️ MAP (Topology)

Defines _where_ and _at what cost_ to access resources.

- **Metric**: Reliability & Economy.
- **Example**: A list of endpoints (Groq, Together, Ollama) with URLs and priorities.

### 🕹️ PILOT (Decision)

Defines _how_ to choose the best path (Algorithm).

- **Metric**: Efficiency (Latency vs. Cost).
- **Example**: A Node.js script managing cascading retries and local fallbacks.

---

## 🔌 3. Interface Contract (Protocol v1.0)

### OpenCode through local Magistral

The reference pilot can expose its routed models to OpenCode through the loopback
OpenAI-compatible endpoint. Install a recent Deno release, provide the upstream provider key and a
deployment-local gateway token, then start the pilot:

```bash
export OPENROUTER_API_KEY="<from the deployment vault>"
export MAGISTRAL_API_KEY="<local-loopback-secret>"
node packages/magistral/scripts/launcher.js \
  --pilot packages/magistral/pilots/reference-js/src/main.js \
  --blueprint coding --map default
```

Copy `packages/magistral/config/opencode-magistral.example.json` outside the repository or point
`OPENCODE_CONFIG` directly at it. The template reads `MAGISTRAL_API_KEY` from the environment; never
put the token in the file. Its `magistral-once` agent has `steps: 1` and disables tools. This is the
anti-loop execution profile: any retry or rebinding is a new governed COP continuation.

```bash
export OPENCODE_CONFIG="$PWD/packages/magistral/config/opencode-magistral.example.json"
opencode run --pure --model magistral/fallback --agent magistral-once \
  --format json "Review the supplied artifact."
```

The historical `sesame` token is acceptable only for a loopback development Reality Test. A
persistent deployment must use a vault-backed secret and remain bound to a private interface.

### Selecting a coding handler

Register every installed runtime and its matching capability offer. Magistral resolves a
`CapabilityRequirement` as follows:

1. `offer_id` or `runtime_id` pins one exact declared offer/runtime when an operator or governed
   continuation requires it.
2. `execution_surface` selects a class: `acp` selects Codex ACP in the current profile; `cli`
   selects OpenCode.
3. Without a pin, matching offers are ordered by descending `attraction`; this is policy preference,
   not authority.

```js
const requirement = {
  capability: "coding.assist.read",
  runtime_id: "runtime:local:opencode-magistral",
};
```

To prefer Codex automatically, give its offer the higher `attraction`; to prefer OpenCode, give
the OpenCode offer the higher value. Capability selection never grants mandate, filesystem, tool,
or spending authority.

### Public Guide via ACP (experimental)

The public Guide can use Magistral as its OpenAI-compatible synthesis boundary by setting
`COGENTIA_GUIDE_MAGISTRAL_URL` and `COGENTIA_GUIDE_MAGISTRAL_API_KEY`. A selected `acp_stdio` node
then starts a host-local ACP provider in its isolated read-only directory. The Guide does not need
an Agent CLI Gateway and does not receive the provider's MCP servers implicitly.

Set the matching deployment-local `MAGISTRAL_API_KEY` when starting the pilot. Never commit either
key or a host-specific ACP command/path; those are runtime configuration, not a portable map.

For a local ThinkPad instance, use the environment-backed `local-codex-acp` map. It launches the
locally authenticated Codex ACP provider only in a deliberately isolated public working directory:

```powershell
$env:CODEX_ACP_COMMAND = (Get-Command codex-acp.cmd).Source
$env:MAGISTRAL_CODEX_ACP_WORKSPACE = "C:\path\to\public-guide-workspace"
$env:MAGISTRAL_CODEX_ACP_TIER = "fractavolta-guide"
$env:MAGISTRAL_API_KEY = "<local-loopback-secret>"
node scripts/launcher.js --pilot pilots/reference-js/src/main.js --blueprint coding --map local-codex-acp
```

Point the local Guide at `http://127.0.0.1:8082` through `COGENTIA_GUIDE_MAGISTRAL_URL`, and provide
the same value via `COGENTIA_GUIDE_MAGISTRAL_API_KEY`. The map accepts no ambient MCP servers and
the ACP executor admits only one-shot read operations under its configured workspace.

### 3.1. Initialization (Control Plane)

The Orchestrator (`core`) injects the configuration into the Pilot via **STDIN**. Pilots are
stateless and must not rely on external files for their initial configuration to ensure isolation.

````json
{
  "protocol": "MAGISTRAL-v1",
  "runtime": { "port": 8082, "host": "127.0.0.1" },
  "input": { "blueprint": {...}, "map": [...] },
  "secrets": { "API_KEY": "..." }
}

To maintain the systemic coherence required by the **MAGISTRAL** protocol, we will now transition from the manifest to the formal specification.

Below is the technical core to be injected into your `packages/magistral/README.md`, followed by the mission-critical prompt for **Antigravity**.

---

## 📄 Part 1: Detailed Protocol Specification (for README.md)

Append this section to your existing README to define the "Law of the System."

### 5. Detailed Technical Specification (v1.0)

#### 5.1. The Injection Schema (STDIN)

Upon process spawn, the Pilot MUST consume a single UTF-8 JSON object from `stdin`.

```json
{
  "protocol": "MAGISTRAL-v1",
  "runtime": {
    "port": 8080,
    "host": "127.0.0.1",
    "log_level": "info"
  },
  "input": {
    "blueprint": {
      "id": "string",
      "capabilities": ["string"],
      "context_window": "number"
    },
    "map": [
      {
        "id": "string",
        "url": "string",
        "model": "string",
        "tier": "fast | strong | fallback",
        "blueprint_id": "string",
        "weight": "number"
      }
    ]
  },
  "secrets": {
    "api_keys": {
      "openai": "sk-...",
      "mistral": "..."
    }
  }
}

### 3. Running Magistral (Developer Experience)

The easiest way to work on Magistral locally:

```bash
cd packages/magistral

# Recommended: Start the pilot (with nice output)
npm run dev

# In another terminal, start the monitor
npm run dev:monitor
```

**All-in-one mode** (pilot + monitor together):

```bash
npm run dev -- --full
# or
npm run dev:full
```

Once the pilot prints `MAGISTRAL_READY: http://127.0.0.1:8082`, you can open the admin UI:

→ **http://127.0.0.1:8082/__admin**

#### Available dev commands

| Command            | Description                              |
|--------------------|------------------------------------------|
| `npm run dev`      | Start the reference pilot (recommended)  |
| `npm run dev:full` | Pilot + monitor in one command           |
| `npm run dev:monitor` | Start the CLI monitor only          |
| `npm run dev:pilot` | Raw launcher (if you need flags)     |

> **Note**: As of June 2026, Magistral observability/control (metrics, disable/enable, Explore probe+add, polished Logs browser with filters/detail/freeze) is substantially complete and exposed uniformly via the modular UI for both the standalone pilot and embedded Sovereign usage (e.g. inside Ophelia via the embedded adapter when no local sovereign is registered for the room). Still `experimental` overall.

### 4. Admin Web UI & CLI Monitoring

Once running (by default on port `8082`), you can observe the internal state of all configured AI
nodes:

**CLI Monitor:**

```bash
node scripts/monitor.js
```

**Web UI Monitor:** Visit [http://127.0.0.1:8082/\_\_admin](http://127.0.0.1:8082/__admin) in your
browser.

## Architecture

- **`registry/maps/`**: Contient les cartes d'infrastructure (les nœuds et leurs capacités).
- **`registry/blueprints/`**: Contient les configurations sémantiques.
- **`pilots/reference-js/`**: L'implémentation de référence en Deno (le serveur HTTP).
- **`scripts/launcher.js`**: Le script de démarrage qui lit les configurations et instancie le
  pilote via stdout/stdin.

#### 5.2. Node State & Circuit Breaking

Pilots MUST implement a volatile state machine for node health:

1. **Active**: Default state.
2. **Exhausted**: Triggered by HTTP 429, 403, or 402.

- **TTL**: 86,400 seconds (24 hours).
- **Action**: Node is skipped in the routing sequence.

#### 5.3. The Ready Signal (Handshake)

The Pilot MUST NOT accept HTTP traffic until it has emitted the following string to `stdout`:
`MAGISTRAL_READY: http://[HOST]:[PORT]`

#### 5.4. Error Propagation

If the entire `Map` (including the fallback) is exhausted, the Pilot MUST return an HTTP 503 Service
Unavailable with a JSON body detailing the exhaustion state.

---

## ⚡ Part 2: The Antigravity Prompt

Use this prompt to instruct your agent to build the implementation within the `inseme` monorepo.

> **Role**: System Architect & Vibe Coder. **Mission**: Implement the **MAGISTRAL Protocol v1.0**
> within the `packages/magistral/` directory. **Context**: We are building a decoupled LLM
> arbitration layer. You must create the Core Orchestrator and a Reference JS Pilot. **Task 1: The
> Core (`packages/magistral/core/launcher.js`)**
>
> - Create a CLI tool using `commander` or native `process.argv`.
> - Functionality:
>
> 1. Load a `blueprint.json` and a `map.json` from the `registry/` folder.
> 2. Read API keys from `.env`.
> 3. Spawn the Pilot process defined in `--pilot` using `child_process.spawn`.
> 4. Pipe the consolidated JSON configuration into the Pilot's `stdin`.
> 5. Listen to the Pilot's `stdout` for the `MAGISTRAL_READY` signal before exiting the setup phase.
>
> **Task 2: The Reference Pilot (`packages/magistral/pilots/reference-js/main.js`)**
>
> - Language: Pure Node.js (Express or native `http`).
> - Logic:
>
> 1. **Boot**: Read `stdin` until EOF, parse the Magistral JSON.
> 2. **Server**: Open an OpenAI-compatible `POST /v1/chat/completions` endpoint.
> 3. **Router**: Implement the "Cascading Retry" logic.
>
> - Filter nodes by `blueprint_id`.
> - Try nodes in order.
> - On 429/403/402, mark node as exhausted in an in-memory `State` object (24h TTL) and retry next.
> - **Fallback**: If all cloud nodes fail, use the node where `tier === 'fallback'`.
>
> 4. **Streaming**: Use `node-fetch` or `undici` to pipe the response stream directly back to the
>    client.
>
> **Task 3: Registry Examples**
>
> - Create `packages/magistral/registry/blueprints/coding.json`.
> - Create `packages/magistral/registry/maps/default.json` including a local Ollama node as
>   fallback.
>
> **Constraints**:
>
> - Minimal dependencies.
> - Strict adherence to the STDIN/STDOUT handshake protocol.
> - High-performance streaming (no buffering of the LLM response).
> - Code must be modular, prepared for eventual extraction into `@magistral/core`.

---

### Next Steps
````
