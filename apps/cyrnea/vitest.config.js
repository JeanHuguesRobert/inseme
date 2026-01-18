import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Duplication des alias de vite.config.js pour que les tests unitaires puissent résoudre les imports
      "@inseme/room": path.resolve(__dirname, "../../packages/room"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host/src"),
      "@inseme/ophelia": path.resolve(__dirname, "../../packages/ophelia/index.js"),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
      "@inseme/brique-cyrnea": path.resolve(__dirname, "../../packages/brique-cyrnea/src"),
      "@inseme/brique-kudocracy": path.resolve(__dirname, "../../packages/brique-kudocracy/src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    globals: true,
    setupFiles: [], // Ajouter un fichier de setup si besoin (ex: pour mocker window.matchMedia)
  },
});
