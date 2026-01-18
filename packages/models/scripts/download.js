import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOVEREIGN_MODELS } from "../registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On remonte de 3 niveaux depuis packages/models/scripts/ pour atteindre la racine du repo
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ROOT_MODELS_DIR = path.join(REPO_ROOT, "models");

async function downloadModel(id) {
  const model = SOVEREIGN_MODELS[id];
  if (!model) {
    console.error("Modèle inconnu :", id);
    return;
  }

  if (!fs.existsSync(ROOT_MODELS_DIR)) {
    console.log("Création du dossier :", ROOT_MODELS_DIR);
    fs.mkdirSync(ROOT_MODELS_DIR, { recursive: true });
  }

  const targetPath = path.join(ROOT_MODELS_DIR, model.filename);
  if (fs.existsSync(targetPath)) {
    console.log(`Le modèle "${model.name}" est déjà présent dans ${ROOT_MODELS_DIR}`);
    return;
  }

  console.log(`--- Registre Kudocracy : ${model.name} ---`);
  console.log("Cible :", targetPath);

  console.log("\nPour télécharger automatiquement (nécessite Python + huggingface_hub) :");
  console.log(`pnpm run model:pull`);

  console.log("\nOu manuellement via curl :");
  console.log(`curl -L "${model.url}" -o "${targetPath}"`);
}

const modelId = process.argv[2] || "qwen-2.5-coder-1.5b";
downloadModel(modelId);
