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
      "@inseme/room": path.resolve(__dirname, "../../packages/room"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host"),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
      "@inseme/ophelia": path.resolve(
        __dirname,
        "../../packages/ophelia/index.js"
      ),
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
