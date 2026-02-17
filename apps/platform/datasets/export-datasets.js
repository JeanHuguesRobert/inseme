// datasets/export-datasets.js
// Script d'export open data Ophélia (wiki, Q&A, docs)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Déclarer __dirname pour ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Exemples de chemins sources (à adapter selon vos données)
const WIKI_SRC = path.join(__dirname, "../public/docs/wiki_pages.json");
const QA_SRC = path.join(__dirname, "../public/docs/qa_pairs.json");
const COUNCIL_SRC = path.join(__dirname, "../public/docs/council_docs.json");

const OUT_WIKI = path.join(__dirname, "wiki_pages.jsonl");
const OUT_QA = path.join(__dirname, "qa_pairs.jsonl");
const OUT_COUNCIL = path.join(__dirname, "council_docs.jsonl");

function exportJsonToJsonl(src, dest) {
  if (!fs.existsSync(src)) return;
  const arr = JSON.parse(fs.readFileSync(src, "utf8"));
  const lines = Array.isArray(arr) ? arr : Object.values(arr);
  fs.writeFileSync(dest, lines.map((x) => JSON.stringify(x)).join("\n"));
  console.log(`✔ Exporté : ${dest}`);
}

exportJsonToJsonl(WIKI_SRC, OUT_WIKI);
exportJsonToJsonl(QA_SRC, OUT_QA);
exportJsonToJsonl(COUNCIL_SRC, OUT_COUNCIL);
