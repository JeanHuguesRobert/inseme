# Magistral Router — Observability, Control & Model Explorer

## Goal

Add three new capabilities to both the standalone **Deno Pilot**
([pilots/reference-js/src/main.js](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/main.js))
and the **Sovereign Node**
([packages/models/src/ai.js](file:///c:/tweesic/inseme/packages/models/src/ai.js)), with all shared
logic living in
[packages/magistral/src/router.js](file:///c:/tweesic/inseme/packages/magistral/src/router.js).

---

## Feature 1 — Per-Node Metrics, Persistence & UI

### What it does

Each node tracks requests, successes, average latency, status, and error log. On startup, previous
metrics are loaded from a JSON file (cold-start warm state). Every N seconds the current metrics are
auto-saved back to that file.

### Shared code — [router.js](file:///c:/tweesic/inseme/packages/magistral/src/router.js)

**[NodeRegistry](file:///c:/tweesic/inseme/packages/magistral/src/router.js#17-77) new fields:**

- `isDirty()` → returns true if state changed since last save
- `clearDirty()` → resets dirty flag after successful save
- `serialize()` → `{ version, savedAt, nodes: { [id]: state } }`
- `loadFrom(snapshot)` → restores node states from serialized snapshot

```js
// On startup:
const saved = JSON.parse(fs.readFileSync("metrics.json", "utf-8"));
registry.loadFrom(saved); // restores node states + version/timestamp

// Every 60s, only if dirty:
setInterval(() => {
  if (!registry.isDirty()) return;
  fs.writeFileSync(
    "metrics.json",
    JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      nodes: registry.serialize(),
    })
  );
  registry.clearDirty();
}, 60_000);
```

### Standalone Pilot ([main.js](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/main.js) — Deno)

- **Cold start**: `Deno.readTextFile('metrics.json')` → `registry.loadFrom(...)`, catch on missing
  file
- **Auto-save**: `setInterval(() => Deno.writeTextFile(...), 30_000)`
- **Endpoint**: `GET /v1/magistral/metrics` already exists — extend response with `avgLatencyMs`
- **Admin UI**
  ([admin.html](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/admin.html)):
  already polling `/v1/magistral/metrics` — add latency column ✅

### Sovereign Node ([ai.js](file:///c:/tweesic/inseme/packages/models/src/ai.js) — Node)

- Same pattern but using `fs.readFileSync/writeFileSync` (already imported)
- Save path: `packages/magistral/.metrics-cache.json`
- **New endpoint**: `GET /v1/magistral/metrics` → returns exact same schema as pilot
- **Admin UI**: extend `/__inspector` or add a dedicated `/magistral` tab

---

## Feature 2 — Provider Enable/Disable (API + UI)

### What it does

Each node can be administratively **forced offline** (disabled) or **re-enabled** without restarting
the process, overriding the automatic exhaustion TTL.

### Shared code — [router.js](file:///c:/tweesic/inseme/packages/magistral/src/router.js)

Add two new methods to
[NodeRegistry](file:///c:/tweesic/inseme/packages/magistral/src/router.js#17-77):

```js
disable(id, (reason = "manual")); // sets status = 'disabled', exhaustedAt = Infinity
enable(id); // clears disabled state, same as recordSuccess
```

[buildRoutingSequence](file:///c:/tweesic/inseme/packages/magistral/src/router.js#82-101) already
skips exhausted nodes — it will skip `disabled` nodes automatically since
[isExhausted()](file:///c:/tweesic/inseme/packages/magistral/src/router.js#42-51) will return true
for `Infinity`.

### HTTP API (both surfaces)

| Method | Path                              | Body          | Effect                         |
| ------ | --------------------------------- | ------------- | ------------------------------ |
| `POST` | `/v1/magistral/nodes/:id/disable` | `{ reason? }` | Mark node as manually disabled |
| `POST` | `/v1/magistral/nodes/:id/enable`  | —             | Re-enable a node               |

> [!NOTE] Admin endpoints are **open** (no `Authorization` header required). The `sesame` key is a
> routing trick, not real security. All endpoints are localhost-only by design.

### UI changes

- [admin.html](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/admin.html) /
  `__inspector` magistral tab: add **Enable/Disable toggle buttons** per row
- Buttons call `POST /v1/magistral/nodes/{id}/disable` or `.../enable`
- Status `pill` shows `disabled` in a distinct yellow color

---

## Feature 3 — Model Explorer

### What it does

An interactive UI that:

1. Shows all configured providers with their current status
2. Has a "Probe" button per provider that calls `GET /v1/models` on that provider's base URL to
   enumerate its available models
3. Shows the results in a table (id, context window if available, cost tier)
4. Has a "Add to map" button to generate a new node descriptor and optionally save it to
   [registry/maps/default.json](file:///c:/tweesic/inseme/packages/magistral/registry/maps/default.json)

### New shared utility — [router.js](file:///c:/tweesic/inseme/packages/magistral/src/router.js)

```js
export async function probeProviderModels(baseUrl, apiKey) {
  const res = await fetch(`${baseUrl}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`Probe failed: ${res.status}`);
  return res.json(); // OpenAI-compatible { data: [...] }
}
```

### HTTP API (both surfaces)

| Method | Path                     | Body                   | Effect                                                             |
| ------ | ------------------------ | ---------------------- | ------------------------------------------------------------------ |
| `POST` | `/v1/magistral/probe`    | `{ baseUrl, apiKey? }` | Probes a provider's `/models` endpoint and returns the list        |
| `POST` | `/v1/magistral/map/add`  | `{ node }`             | Appends a new node to the active in-memory map only                |
| `POST` | `/v1/magistral/map/save` | —                      | Persists current in-memory map to `registry/maps/default-new.json` |

### UI tab — "Explore"

```
[ Provider Base URL ] [ API Key (optional) ] [ Probe ]

Results:
┌────────────────────────────┬──────────┬────────────┐
│ Model ID                   │ Context  │ Tier guess │
├────────────────────────────┼──────────┼────────────┤
│ llama-3.1-8b-instant       │ 131072   │ fast       │  [+ Add to map]
│ llama-3.3-70b-versatile    │ 131072   │ strong     │  [+ Add to map]
└────────────────────────────┴──────────┴────────────┘
```

"Add to map" pre-fills a form: `{ id, url, model, tier, weight }` → confirm → calls
`/v1/magistral/map/add` (in-memory only). A **"💾 Save Map"** button calls `/v1/magistral/map/save`
→ writes to `registry/maps/default-new.json`. The saved file can be reviewed and promoted to
`default.json` manually.

---

## Feature 4 — Traffic Logging & Log Browser

### What it logs

Every call through `route()` produces a **structured log entry**:

```json
{
  "id": "req_01JMAZX…",
  "ts": "2026-02-20T12:33:17.000Z",
  "nodeId": "groq-fast",
  "tier": "fast",
  "model": "llama-3.1-8b-instant",
  "status": 200,
  "latencyMs": 412,
  "promptTokens": 27,
  "completionTokens": 65,
  "stream": false,
  "error": null
}
```

### Shared code — `router.js`

**`TrafficLog` class** (new):

- In-memory **ring buffer** capped at 500 entries
- `append(entry)` — adds entry, marks dirty, trims if over cap
- `tail(n)` — returns last N entries
- `filter({ nodeId?, status?, since? })` — server-side filtering
- `createRouter()` returns `{ route, registry, trafficLog }`

**`route()` changes:**

- Records start time, nodeId, model, stream flag
- On response: appends status, latencyMs, token counts (from response body if non-streaming)
- On error/exhaustion: appends `status: 0, error: message`

### File persistence

- Logs are **append-only NDJSON** to `magistral-traffic.log`
- Each entry written immediately on completion (no batching — log is the source of truth)
- Log file is rotated when it exceeds **10MB** (rename to `magistral-traffic.log.1`, start fresh)
- The ring buffer is rebuilt from the tail of the NDJSON file on cold start (last 500 entries)

### HTTP API (both surfaces)

| Method   | Path                 | Query                           | Effect                                              |
| -------- | -------------------- | ------------------------------- | --------------------------------------------------- |
| `GET`    | `/v1/magistral/logs` | `?n=100&nodeId=&status=&since=` | Returns last N log entries, filtered                |
| `DELETE` | `/v1/magistral/logs` | —                               | Clears in-memory ring buffer (does not delete file) |

### UI tab — "Logs"

```
[ Node ▾ ] [ Status ▾ ] [ Last: 1h ▾ ] [ 🔄 Auto ] [ 🗑 Clear ]

┌──────────────┬──────────────┬────────┬────────┬─────────┬──────────┐
│ Time         │ Node         │ Status │ Tier   │ Latency │ Tokens   │
├──────────────┼──────────────┼────────┼────────┼─────────┼──────────┤
│ 12:33:17.004 │ groq-fast    │ ✅ 200 │ fast   │ 412ms   │ 27→65    │
│ 12:33:15.120 │ local-llama  │ ✅ 200 │ fallbk │ 5577ms  │ 24→12    │
│ 12:33:10.001 │ groq-fast    │ ❌ 429 │ fast   │ 80ms    │ —        │
└──────────────┴──────────────┴────────┴────────┴─────────┴──────────┘
```

- **Clicking a row** expands it into a detail panel:
  - **Non-streaming**: shows full JSON entry (prompt preview, completion preview, token counts)
  - **Streaming**: shows `stream: true` badge + first-token latency + total token count gathered by
    intercepting the SSE chunks during routing + a scrollable preview of the concatenated streamed
    content
- **Auto-refresh** polls `/v1/magistral/logs?n=100` every 3s **but freezes automatically** when the
  user is **not scrolled to the bottom** (tail not visible) — a `⏸ Frozen` pill appears in the
  toolbar with a `▶ Resume` button to re-enable live updates
- Error rows (status ≠ 200) highlighted in red
- Streaming rows show a `⚡ stream` badge in the Status column

---

## Proposed Changes

### [MODIFY] [router.js](file:///c:/tweesic/inseme/packages/magistral/src/router.js)

- Add `serialize()` / `loadFrom()` / `isDirty()` / `clearDirty()` to `NodeRegistry`
- Add `disable(id)` / `enable(id)` to `NodeRegistry`
- Add `TrafficLog` class (ring buffer, filter, tail)
- Wire `TrafficLog.append()` inside `route()` for every outcome
- Add exported `probeProviderModels(baseUrl, apiKey)` utility
- `createRouter()` now returns `{ route, registry, trafficLog }`

---

### [MODIFY] [main.js](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/main.js)

- Cold-start: load `metrics.json` + tail of `magistral-traffic.log` into ring buffer
- 60s auto-save (dirty only) for metrics
- Append-on-complete NDJSON writes to `magistral-traffic.log` (with 10MB rotation)
- `POST /v1/magistral/nodes/:id/disable` + `enable`
- `POST /v1/magistral/probe`
- `POST /v1/magistral/map/add` + `map/save`
- `GET /v1/magistral/logs` + `DELETE /v1/magistral/logs`

### [MODIFY] [admin.html](file:///c:/tweesic/inseme/packages/magistral/pilots/reference-js/src/admin.html)

- Add **latency** column + **disabled** state pill to metrics table
- Add **Enable/Disable** toggle buttons per row
- Add **"Explore" tab**: probe form + results table + "Add to map" + "💾 Save Map"
- Add **"Logs" tab**: filterable log table with auto-refresh + expand-on-click

---

### [MODIFY] [ai.js](file:///c:/tweesic/inseme/packages/models/src/ai.js)

- Cold-start: load metrics snapshot + log tail on `getMagistralRouter()`
- 60s auto-save (dirty only) to `.metrics-cache.json`
- Append-on-complete NDJSON writes to `.magistral-traffic.log` (with 10MB rotation)
- `GET /v1/magistral/metrics`
- `POST /v1/magistral/nodes/:id/disable` + `enable`
- `POST /v1/magistral/probe`
- `POST /v1/magistral/map/add` + `map/save`
- `GET /v1/magistral/logs` + `DELETE /v1/magistral/logs`

### [MODIFY] [ai-inspector.html](file:///c:/tweesic/inseme/packages/models/src/ai-inspector.html)

- Add "Magistral" tab with:
  - Metrics sub-tab (node status + enable/disable)
  - Logs sub-tab (same log browser as `admin.html`)
  - Explore sub-tab (probe + add to map + save)

---

## Verification Plan

### Automated

```bash
# 1. Metrics endpoint
curl http://127.0.0.1:8082/v1/magistral/metrics

# 2. Disable a node
curl -X POST http://127.0.0.1:8082/v1/magistral/nodes/groq-fast/disable

# 3. Confirm it's skipped
curl -X POST http://127.0.0.1:8082/v1/chat/completions ... # should fall to next tier

# 4. Re-enable
curl -X POST http://127.0.0.1:8082/v1/magistral/nodes/groq-fast/enable

# 5. Probe a provider
curl -X POST http://127.0.0.1:8082/v1/magistral/probe \
  -d '{"baseUrl":"https://api.groq.com/openai/v1","apiKey":"..."}'

# 6. Cold-start: kill & restart, check metrics preserved
```

### Manual

- Open `http://127.0.0.1:8082/__admin` → verify Disable/Enable buttons work
- Open Explore tab → probe Groq → see model list → click "Add to map"
