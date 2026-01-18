import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(), // Ajout du plugin pour Tailwind 4
  ],
  resolve: {
    alias: {
      "@inseme/brique-kudocracy": path.resolve(__dirname, "../../packages/brique-kudocracy/src"),
      "@inseme/brique-wiki": path.resolve(__dirname, "../../packages/brique-wiki/src"),
      "@inseme/brique-communes": path.resolve(__dirname, "../../packages/brique-communes/src"),
      "@inseme/room": path.resolve(__dirname, "../../packages/room/index.jsx"),
      "@inseme/ui/style.css": path.resolve(__dirname, "../../packages/ui/src/index.css"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui/src/index.js"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host/src/index.js"),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy/src/index.js"),
      "@inseme/ophelia": path.resolve(__dirname, "../../packages/ophelia/index.js"),
      "@inseme/brique-ophelia": path.resolve(__dirname, "../../packages/brique-ophelia/index.jsx"),
    },
  },
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    // Gardé car remark-gfm est un module ESM qui nécessite parfois
    // d'être pré-bundlé pour la compatibilité
    include: ["remark-gfm"],
  },
  build: {
    sourcemap: true,
    // Vite 7 utilise esbuild par défaut, mais nous respectons votre condition
    minify: mode === "production" ? "esbuild" : false,
  },
}));
