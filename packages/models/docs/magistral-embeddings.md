---
title: Magistral Embeddings
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

# Magistral Embeddings

## Overview

Magistral now provides local text embedding capabilities through an OpenAI-compatible API. This enables semantic search, RAG, and other vector-based operations without relying on external services.

## Architecture

```
Magistral (ai.js)
  ├── POST /v1/embeddings  ← OpenAI-compatible endpoint
  ├── Ollama Provider      ← Local embedding generation
  └── 1536 dimensions      ← Matryoshka Representation Learning (MRL)
```

## Configuration

Set the following environment variables:

```bash
MAGISTRAL_EMBEDDINGS_ENABLED=true
MAGISTRAL_EMBEDDINGS_PROVIDER=ollama
MAGISTRAL_EMBEDDING_MODEL=qwen3-embedding-4b
MAGISTRAL_EMBEDDING_DIMENSIONS=1536
MAGISTRAL_EMBEDDING_POLICY=magistral-qwen3-embedding-1536-v1
MAGISTRAL_EMBEDDING_BATCH_SIZE=8
MAGISTRAL_EMBEDDING_MAX_INPUT_CHARS=12000
MAGISTRAL_OLLAMA_URL=http://127.0.0.1:11434
```

## API Usage

### POST /v1/embeddings

Single input:

```bash
curl http://127.0.0.1:8880/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding-4b",
    "input": "La Corse doit viser une autonomie de capacité.",
    "dimensions": 1536
  }'
```

Batch input:

```bash
curl http://127.0.0.1:8880/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding-4b",
    "input": [
      "Le corpus source reste souverain.",
      "Les produits sont des déclinaisons du corpus."
    ],
    "dimensions": 1536
  }'
```

Response format (OpenAI-compatible):

```json
{
  "object": "list",
  "model": "qwen3-embedding-4b",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.012, -0.034, ...]
    }
  ],
  "usage": {
    "prompt_tokens": 123,
    "total_tokens": 123
  }
}
```

## Embedding Policy

All embeddings follow the policy: `magistral-qwen3-embedding-1536-v1`

This policy is versioned and must be stored alongside embeddings for traceability:
- **Provider**: ollama (local)
- **Model**: qwen3-embedding-4b (native: 2560 dims → truncated to 1536 via MRL)
- **Dimensions**: 1536
- **Method**: MRL (Matryoshka Representation Learning) truncation

## Health Check

```bash
curl http://127.0.0.1:8880/health
```

Response when embeddings are available:

```json
{
  "status": "ok",
  "service": "magistral",
  "capabilities": {
    "chat_completions": true,
    "completions": true,
    "tts": true,
    "embeddings": true
  },
  "embeddings": {
    "enabled": true,
    "provider": "ollama",
    "model": "qwen3-embedding-4b",
    "dimensions": 1536,
    "policy": "magistral-qwen3-embedding-1536-v1"
  }
}
```

## Error Responses

### Provider unavailable

```json
{
  "error": {
    "type": "embedding_provider_unavailable",
    "message": "Embedding provider 'ollama' is not available. Ensure Ollama is running on http://127.0.0.1:11434"
  }
}
```

### Dimension mismatch

```json
{
  "error": {
    "type": "invalid_dimensions",
    "message": "Requested dimensions 512 not supported. Current policy requires 1536"
  }
}
```

### Disabled

```json
{
  "error": {
    "type": "embeddings_disabled",
    "message": "Embeddings are not enabled. Set MAGISTRAL_EMBEDDINGS_ENABLED=true"
  }
}
```

## Requirements

- **Ollama** running locally with `qwen3-embedding-4b` model
- Install Ollama: `ollama pull qwen3-embedding-4b`

## Implementation Details

- **Provider**: `packages/models/src/providers/ollama.js`
- **Server**: `packages/models/src/ai.js`
- **Dimensions**: 1536 (MRL truncation from native 2560)
- **Deterministic**: Yes (same input = same embedding)
- **Batch processing**: Up to 8 texts per request

## Limitations

1. Ollama must be running locally for embeddings to work
2. Only qwen3-embedding-4b model is currently supported
3. Maximum input length: 12000 characters per text
4. Batch size limited to 8 requests

## Future Work

- Add support for llama.cpp embeddings endpoint
- Add Python SentenceTransformers provider
- Add configurable dimension reduction methods
- Add embedding cache for repeated inputs
