/**
 * @kudocracy/models/registry.js
 * Registre central des modèles IA pour Kudocracy.
 */

export const SOVEREIGN_MODELS = {
  "qwen-2.5-coder-1.5b": {
    name: "Qwen 2.5 Coder 1.5B",
    filename: "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    description: "Modèle léger et souverain, excellent pour le code et la logique de base.",
    context_window: 32768,
    recommended_threads: 4,
    tags: ["local", "sovereign", "coder"],
  },
  "llama-3.2-3b": {
    name: "Llama 3.2 3B",
    filename: "llama-3.2-3b-instruct.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    description: "Excellent compromis performance/taille pour la discussion générale.",
    context_window: 128000,
    recommended_threads: 4,
    tags: ["local", "sovereign", "general"],
  },
};

export const REMOTE_MODELS = {
  fast: {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-haiku-20240307",
    groq: "llama-3.1-8b-instant",
    mistral: "mistral-small-latest",
  },
  advanced: {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-latest",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-large-latest",
  },
};

export const TRANSCRIPTION_MODELS = {
  openai: "whisper-1",
  groq: "whisper-large-v3",
};

export const SOVEREIGN_TTS = {
  "kokoro-v0.19": {
    name: "Kokoro TTS 82M",
    repo: "hexgrad/Kokoro-82M",
    lang: "fr-FR",
    voices: ["ff_siwis", "fr_fr_denise"], // ff_siwis est très stable en français
    port: "8880",
  },
};

export const getModelByTag = (tag) => {
  return Object.values(SOVEREIGN_MODELS).filter((m) => m.tags.includes(tag));
};
