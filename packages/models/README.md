---
title: 🏛️ @kudocracy/models - Sovereign LLM Controller
author: unknown
date: '2026-07-12'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 4a5b548
  origin_date: '2026-07-12'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# 🏛️ @kudocracy/models - Sovereign LLM Controller

**@kudocracy/models** is the sovereign Large Language Model (LLM) manager for the Inseme monorepo.
It enables running AI models locally (On-Premise) via an OpenAI-compatible interface.

> For an overview of the ecosystem (Agora, AI, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

This package transforms any machine into a private AI inference server. It leverages
`llama-cpp-python` to provide optimal performance on both CPU and GPU.

### 1. 🛡️ Total Sovereignty

Your data never leaves your infrastructure. Inference is performed locally on your own servers.

### 2. 🔄 Standard Interface

Exposes a REST API compatible with the OpenAI standard (v1), allowing the use of any existing client
(LangChain, OpenAI SDK, etc.).

### 3. 📦 Model Registry

Manages a catalog of optimized models (GGUF) tested for stability and performance, including the
**Qwen 2.5** and **Llama 3.2** families.

---

## 🐍 Conda (env `inseme`)

Conda is **not** loaded at PowerShell startup (saves ~30s per `pwsh`). It is only needed here for
`model:pull` / Python download scripts.

```powershell
# Interactive inseme Python work:
. ..\..\scripts\use-conda.ps1 -Env inseme

# Or npm (uses conda-run.ps1, no profile hook):
npm run model:pull
```

## 🚀 Quick Commands

- **Start the server**: `npm run llm:up` (Uses the default Qwen 2.5 Coder 1.5B model)
- **Stop the server**: `npm run llm:down`
- **Check status**: `npm run llm:status`
- **Inference test**: `npm run llm:test`
- **Download model**: `npm run model:download [model-id]`

### Advanced Options

You can pass options to the start script:

```bash
npm run llm:up -- --model llama-3.2-3b --port 8081 --threads 4
```

---

## 🛠️ Project Structure

```
packages/models/
├── src/
│   ├── ai.js          # Unified AI server (LLM + TTS + Embeddings)
│   └── providers/
│       └── ollama.js  # Ollama embedding provider
├── scripts/
│   ├── download.js    # JS utility to list/download models
│   └── download.py    # Python download script (HuggingFace)
├── tests/             # Test suite (Unit, Integration, Real)
├── registry.js        # Catalog of supported models
├── docs/
│   ├── magistral-embeddings.md
│   └── cogentia-embedding-continuations.md
└── package.json       # Scripts and dependencies
```

---

## 🔍 Embeddings (Semantic Search)

The package now supports **local text embeddings** via an OpenAI-compatible API.

### Quick Setup with Ollama

```bash
# 1. Install Ollama (https://ollama.com/download)
# 2. Pull the embedding model
ollama pull qwen3-embedding-4b

# 3. Start the AI server with embeddings enabled
MAGISTRAL_EMBEDDINGS_ENABLED=true npm run llm:up

# 4. Test embeddings
curl http://127.0.0.1:8880/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3-embedding-4b", "input": "La Corse doit viser une autonomie de capacité."}'
```

### Supported Embedding Models

| Model              | Provider | Dimensions | Method          |
| ------------------ | -------- | ---------- | --------------- |
| qwen3-embedding-4b | Ollama   | 1536       | MRL (2560→1536) |

View all available models:

```bash
npm run model:download help
```

### Configuration

```bash
MAGISTRAL_EMBEDDINGS_ENABLED=true
MAGISTRAL_EMBEDDINGS_PROVIDER=ollama
MAGISTRAL_EMBEDDING_MODEL=qwen3-embedding-4b
MAGISTRAL_EMBEDDING_DIMENSIONS=1536
MAGISTRAL_EMBEDDING_POLICY=magistral-qwen3-embedding-1536-v1
MAGISTRAL_OLLAMA_URL=http://127.0.0.1:11434
```

### Documentation

- [Magistral Embeddings API](docs/magistral-embeddings.md)
- [Cogentia Continuation Pattern](docs/cogentia-embedding-continuations.md)

---

## ⚖️ Neutrality & Commitment

This infrastructure is a **neutral** technological tool. It is designed to ensure digital
independence and does not support any specific ideology or candidate.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.

---

### #PERTITELLU | CORTI CAPITALE
