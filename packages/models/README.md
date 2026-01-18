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

## 🚀 Quick Commands

- **Start the server**: `npm run llm:up` (Uses the default Qwen 2.5 Coder 1.5B model)
- **Stop the server**: `npm run llm:down`
- **Check status**: `npm run llm:status`
- **Inference test**: `npm run llm:test`

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
│   └── llm.js         # Main controller (CLI & Process Manager)
├── scripts/
│   ├── download.js    # JS utility to list models
│   └── download.py    # Python download script (HuggingFace)
├── tests/             # Test suite (Unit, Integration, Real)
├── registry.js        # Catalog of supported models
└── package.json       # Scripts and dependencies
```

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
