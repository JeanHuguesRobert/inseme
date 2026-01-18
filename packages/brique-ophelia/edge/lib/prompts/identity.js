/**
 * packages/brique-ophelia/edge/lib/prompts/identity.js
 * ADN immuable d'Ophélia.
 */

import { ALL_BRIQUE_PROMPTS } from "../gen-all-prompts.js";

const p = ALL_BRIQUE_PROMPTS.ophelia || {};

export const OPHELIA_IDENTITY = {
  name: "Ophélia",
  origin: "Le Pertitellu (Corte, Corse)",
  movement: "Le Petit Parti (PP)",
  context: "Élections municipales 2026",

  core_dna: (p.identity || "").trim(),
  style_dna: "", // Le style est maintenant inclus dans identity.md pour plus de clarté
};
