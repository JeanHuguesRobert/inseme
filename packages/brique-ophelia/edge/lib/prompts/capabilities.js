/**
 * packages/brique-ophelia/edge/lib/prompts/capabilities.js
 * Instructions spécifiques pour l'utilisation des outils.
 */

import { ALL_BRIQUE_PROMPTS } from "../gen-all-prompts.js";

const p = ALL_BRIQUE_PROMPTS.ophelia || {};

export const OPHELIA_CAPABILITIES = {
  sql: (p["capability-sql"] || "").trim(),
  search: (p["capability-search"] || "").trim(),
  democracy: (p["capability-democracy"] || "").trim(),
  logic: (p["capability-logic"] || "").trim(),
  speak: (
    p["capability-speak"] ||
    `
[CAPACITÉ : VOCALISATION (TTS)]
- Tu peux utiliser l'outil 'speak' pour transformer un texte en parole.
- Utilise cette capacité quand on te demande de parler, de lire quelque chose à voix haute, ou pour donner une dimension plus humaine à tes interventions importantes.
- Tu as accès à deux fournisseurs :
  1. OpenAI (par défaut) : Voix nova (pro), shimmer (douce), alloy (neutre).
  2. Kokoro (Local/Souverain) : Voix haute qualité comme af_bella, am_adam, etc.
- Pour utiliser Kokoro, précise provider: 'kokoro' et une voix compatible.
`
  ).trim(),
};
