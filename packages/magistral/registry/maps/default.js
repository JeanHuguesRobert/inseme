// GENERATED AUTOMATICALLY BY BRIQUE COMPILER
// Source: default.json

export default [
  {
    "id": "groq-fast",
    "url": "https://api.groq.com/openai/v1/chat/completions",
    "model": "llama-3.1-8b-instant",
    "tier": "fast",
    "blueprint_id": "coding",
    "weight": 10
  },
  {
    "id": "together-strong",
    "url": "https://api.together.xyz/v1/chat/completions",
    "model": "meta-llama/Llama-3.1-70B-Instruct-Turbo",
    "tier": "strong",
    "blueprint_id": "coding",
    "weight": 10
  },
  {
    "id": "ollama-fallback",
    "url": "http://127.0.0.1:8081/v1/chat/completions",
    "model": "qwen2.5:3b",
    "tier": "fallback",
    "blueprint_id": "coding",
    "weight": 1
  }
];
