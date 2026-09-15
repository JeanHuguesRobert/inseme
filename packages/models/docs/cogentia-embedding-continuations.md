---
title: Cogentia Embedding Continuations
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Cogentia Embedding Continuations

## Overview

Cogentia.js does not generate embeddings directly. Instead, it emits **continuations** that external agents process by calling Magistral's embedding API. This maintains separation of concerns:

- **Cogentia.js**: Corpus, index, policy, citations, continuations, sqlite-vec
- **Magistral**: Local inference capacity (completions + embeddings)
- **Agent**: Reads continuations, calls Magistral, returns result.json to Cogentia

## Continuation Flow

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│  Cogentia   │         │   Agent     │         │  Magistral   │
│   .js       │         │  (Worker)   │         │   (Local)    │
└──────┬──────┘         └──────┬──────┘         └──────┬───────┘
       │  1. emit                 │  2. POST              │  3. embeddings
       │  continuation            │  /v1/embeddings       │  (1536 dims)
       │                          │                        │
       │  6. resolve              │  4. result.json       │
       │  continuation            │  (with embeddings)    │
       │◄─────────────────────────┴────────────────────────┘
```

## Continuation Format

When Cogentia needs embeddings for semantic search, it emits:

```json
{
  "type": "continuation",
  "protocol": "cogentia.continuation.v2",
  "id": "ctn_2026_06_24_001",
  "status": "emitted",
  "kind": "embeddings-index",
  "title": "Generate embeddings for N chunks",
  "priority": 1,
  "payload": {
    "embedding_policy_version": "magistral-qwen3-embedding-1536-v1",
    "provider": "magistral",
    "model": "qwen3-embedding-4b",
    "dimensions": 1536,
    "chunks": [
      {
        "chunk_id": 149,
        "content_hash": "1f90b5bc9d7c",
        "text": "...excerpt..."
      }
    ]
  },
  "expected_response": {
    "format": "json",
    "required": ["embeddings"]
  }
}
```

## Agent Processing

The worker (external agent) must:

1. **Read continuations**: `cogentia.js continuation list`
2. **Filter for embeddings**: Look for `kind: "embeddings-index"`
3. **Extract texts**: Get chunk texts from continuation payload
4. **Call Magistral**: `POST /v1/embeddings` with batch input
5. **Build result.json**: Combine chunk metadata with embeddings
6. **Resolve**: `cogentia.js continuation resolve <id> <result.json>`

## Result Format

The agent produces `result.json`:

```json
{
  "provider": "magistral",
  "model": "qwen3-embedding-4b",
  "dimensions": 1536,
  "embedding_policy_version": "magistral-qwen3-embedding-1536-v1",
  "embeddings": [
    {
      "chunk_id": 149,
      "content_hash": "1f90b5bc9d7c",
      "embedding": [0.012, -0.034, ...]
    },
    {
      "chunk_id": 150,
      "content_hash": "b054494444d1",
      "embedding": [0.045, 0.123, ...]
    }
  ]
}
```

## Cogentia Verification

Cogentia.js validates the result before storing:

```javascript
// Cogentia checks:
- chunk_id exists in corpus
- content_hash matches current version
- dimensions === 1536
- embedding_policy_version === current policy
- model === expected model
- provider === expected provider
- embedding is valid numeric array
```

## Idempotence

Embeddings are idempotent by content hash:

```
embedding_key = sha256(
  chunk_content_hash +
  provider +
  model +
  dimensions +
  embedding_policy_version +
  normalization_policy
)
```

Same input + same policy = same logical result.

## Worker Implementation

Example worker pattern:

```javascript
// scripts/cogentia-embed-worker.js

const CONTINUATION_FILE = ".cogentia/continuations/ctn_xxx.json";
const MAGISTRAL_URL = "http://127.0.0.1:8880";

// 1. Read continuation
const continuation = JSON.parse(fs.readFileSync(CONTINUATION_FILE));

// 2. Extract texts
const texts = continuation.payload.chunks.map(c => c.text);

// 3. Call Magistral
const response = await fetch(`${MAGISTRAL_URL}/v1/embeddings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen3-embedding-4b",
    input: texts,
    dimensions: 1536
  })
});

const data = await response.json();

// 4. Build result
const result = {
  provider: "magistral",
  model: "qwen3-embedding-4b",
  dimensions: 1536,
  embedding_policy_version: "magistral-qwen3-embedding-1536-v1",
  embeddings: continuation.payload.chunks.map((chunk, i) => ({
    chunk_id: chunk.chunk_id,
    content_hash: chunk.content_hash,
    embedding: data.data[i].embedding
  }))
};

// 5. Write result.json
fs.writeFileSync("result.json", JSON.stringify(result, null, 2));

// 6. Resolve
execSync(`cogentia.js continuation resolve ${continuation.id} result.json`);
```

## Query Embeddings

For semantic search, the query itself must be embedded:

```
user query
  → Magistral /v1/embeddings
  → query vector (1536 dims)
  → sqlite-vec search
  → ranked results
```

If Magistral is unavailable, Cogentia falls back to keyword/FTS5 search.

## Security & Constraints

- **Local-first**: Embeddings never leave the local network
- **No mixing**: Never merge embeddings from different policies
- **Explicit versioning**: Always track embedding_policy_version
- **Deterministic**: Same text + same policy = same embedding
- **Traceable**: All embeddings link back to corpus source via chunk_id

## Policy Coexistence

Multiple embedding policies can exist but must not be mixed:

```txt
legacy-openai-1536        # Old policy (deprecated)
magistral-qwen3-1536-v1   # Current policy
bge-m3-1024               # Experimental
```

Rule: One active policy per usage. Explicit fusion for cross-policy search.

## Resume Pattern

Continuations are resumable:

```bash
# Agent crashes during processing
cogentia.js continuation list  # Shows "emitted" continuations

# Agent restarts, picks up where it left off
node cogentia-embed-worker.js run  # Re-processes same continuation
```

Same continuation = same logical result (idempotence).
