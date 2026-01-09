import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkAllTools() {
  const rootDir = path.join(__dirname, "..");
  const packagesDir = path.join(rootDir, "packages");

  console.log("\n=== RÉCAPITULATIF DES OUTILS D'OPHÉLIA ===\n");

  const allTools = [];

  // 1. Core Tools from Ophelia (lib/tools.js)
  const opheliaToolsPath = path.join(
    packagesDir,
    "brique-ophelia",
    "edge",
    "lib",
    "tools.js"
  );
  if (fs.existsSync(opheliaToolsPath)) {
    const content = fs.readFileSync(opheliaToolsPath, "utf8");
    const toolMatch = content.match(/name:\s*"([^"]+)"/g);
    if (toolMatch) {
      toolMatch.forEach((m) => {
        const name = m.match(/"([^"]+)"/)[1];
        if (!allTools.some((t) => t.name === name)) {
          allTools.push({ name, source: "Core (Ophelia)", type: "core" });
        }
      });
    }
  }

  // 2. Brique Tools from Generated Registry (Dynamic Import)
  const registryPath = path.join(
    packagesDir,
    "room",
    "generated",
    "brique-registry.js"
  );
  if (fs.existsSync(registryPath)) {
    try {
      const registryUrl = pathToFileURL(registryPath).href;
      const { BRIQUES } = await import(registryUrl);

      if (BRIQUES && Array.isArray(BRIQUES)) {
        BRIQUES.forEach((brique) => {
          if (brique.tools && Array.isArray(brique.tools)) {
            brique.tools.forEach((tool) => {
              const name = tool.function?.name;
              if (name && !allTools.some((t) => t.name === name)) {
                allTools.push({
                  name,
                  source: `Brique: ${brique.id}`,
                  type: "delegated",
                });
              }
            });
          }
        });
      }
    } catch (err) {
      console.error("Erreur lors de l'import du registre:", err.message);
    }
  }

  // Affichage
  console.table(
    allTools.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    })
  );

  console.log(`\nTotal: ${allTools.length} outils identifiés.`);

  // 3. Comparaison avec MCP (Analyse textuelle)
  console.log("\n=== COMPARAISON AVEC MCP (Model Context Protocol) ===\n");
  console.log(
    "- Format: Nos outils utilisent le format standard OpenAI/Anthropic (JSON Schema)."
  );
  console.log(
    "- Architecture: Décentralisée via Edge Functions, similaire au concept de 'MCP Servers'."
  );
  console.log(
    "- Transport: HTTP/REST (nos briques) vs MCP (souvent stdio ou HTTP)."
  );
  console.log(
    "- Discovery: Notre 'brique-registry.js' agit comme un catalogue de ressources, proche du 'List Tools' de MCP."
  );
  console.log(
    "- Gap: MCP standardise l'authentification et les 'Resources/Prompts' en plus des 'Tools'."
  );
}

checkAllTools().catch(console.error);
