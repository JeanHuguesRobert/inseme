/**
 * packages/brique-ophelia/edge/lib/prompts/modes.js
 * Spécialisations comportementales d'Ophélia.
 */

import { ALL_BRIQUE_PROMPTS } from "../gen-all-prompts.js";

const p = ALL_BRIQUE_PROMPTS.ophelia || {};

export const OPHELIA_MODES = {
  /**
   * Mode Médiatrice (Inseme) : Gestion de groupe, consensus, temps de parole.
   */
  mediator: (p["mode-mediator"] || "").trim(),

  /**
   * Mode Assistante (Platform) : 1:1, pédagogie, information directe.
   */
  assistant: (p["mode-assistant"] || "").trim(),

  /**
   * Mode Archiviste : Focus sur la recherche historique.
   */
  oracle: (p["mode-oracle"] || "").trim(),
};
