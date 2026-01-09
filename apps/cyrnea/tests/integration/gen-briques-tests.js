// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

import tests_actes_actes from "../../../../packages/brique-actes/tests/actes.spec.js";
import tests_fil_fil from "../../../../packages/brique-fil/tests/fil.spec.js";
import tests_democracy_democracy from "../../../../packages/brique-kudocracy/tests/democracy.spec.js";
import tests_wiki_wiki from "../../../../packages/brique-wiki/tests/wiki.spec.js";

export default function registerAllBriqueTests(test, expect) {
  // Brique: Actes Administratifs
  if (typeof tests_actes_actes === "function") {
    tests_actes_actes(test, expect);
  }

  // Brique: Le Fil
  if (typeof tests_fil_fil === "function") {
    tests_fil_fil(test, expect);
  }

  // Brique: Gouvernance Citoyenne
  if (typeof tests_democracy_democracy === "function") {
    tests_democracy_democracy(test, expect);
  }

  // Brique: Wiki Collaboratif
  if (typeof tests_wiki_wiki === "function") {
    tests_wiki_wiki(test, expect);
  }
}
