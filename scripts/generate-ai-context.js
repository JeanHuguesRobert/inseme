import fs from "node:fs";
import path from "node:path";

const OUTPUT_FILE = "ARCHITECTURE.md";

const CONFIG = {
  project: "Inseme / Platform",
  tech_stack: ["React", "Supabase", "Netlify Edge Functions", "TailwindCSS", "Monorepo"],
  main_apps: ["apps/cyrnea", "apps/inseme", "apps/platform"],
  ignored: [/node_modules/, /\.git/, /test_file_storage_data_/, /generated/],
};

function getTree(dir, prefix = "") {
  if (!fs.existsSync(dir)) return "";
  let tree = "";
  const entries = fs
    .readdirSync(dir)
    .filter(
      (e) =>
        !CONFIG.ignored.some((reg) => reg.test(e)) && fs.statSync(path.join(dir, e)).isDirectory()
    )
    .sort();

  entries.forEach((e, i) => {
    const isLast = i === entries.length - 1;
    tree += `${prefix}${isLast ? "└── " : "├── "}${e}/\n`;
    tree += getTree(path.join(dir, e), prefix + (isLast ? "    " : "│   "));
  });
  return tree;
}

const content = `
# 🏗️ Architecture Project Context (AI-Ready)

> Ce fichier est auto-généré. Il sert de carte de contexte pour les outils de Vibe Coding et les LLM.

## 🛠 Tech Stack
${CONFIG.tech_stack.map((s) => `- ${s}`).join("\n")}

## 📂 Structure des Applications
${CONFIG.main_apps.map((a) => `- **${a}**: Application principale`).join("\n")}

## 🧩 Cartographie des Briques (\`packages/\`)
Toutes les briques suivent le pattern : \`src/\` pour la logique et \`public/prompts/\` pour les identités de l'IA.

## 🗺 Arborescence Simplifiée (Répertoires uniquement)
\`\`\`text
${getTree(process.cwd())}
\`\`\`

## 📜 Règles de Contribution (Vibe Coding)
1. **Prompts** : Toujours vérifier \`public/briques/[nom]/prompts/\` avant de modifier le comportement d'un agent.
2. **Génération** : Les dossiers \`generated/\` sont ignorés par Git, ne pas y placer de code manuel.
3. **Edge Functions** : Prioriser les Netlify Edge Functions dans \`netlify/edge-functions/\`.

---
*Dernière mise à jour : ${new Date().toLocaleString()}*
`;

fs.writeFileSync(OUTPUT_FILE, content);
console.log(`✅ ${OUTPUT_FILE} généré avec succès.`);
