import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  envDir: "../../",
  server: {
    // Le proxy vers localhost:8888 est géré par Netlify Dev (targetPort: 5173)
    // Ajouter un proxy ici peut créer une boucle de redirection ENOBUFS
  },
  resolve: {
    alias: {
      "@inseme/room": path.resolve(__dirname, "../../packages/room"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/cop-host": path.resolve(
        __dirname,
        "../../packages/cop-host/src"
      ),
      "@inseme/ophelia": path.resolve(
        __dirname,
        "../../packages/ophelia/index.js"
      ),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
      "@inseme/brique-cyrnea": path.resolve(
        __dirname,
        "../../packages/brique-cyrnea/src"
      ),
      "@inseme/brique-kudocracy": path.resolve(
        __dirname,
        "../../packages/brique-kudocracy/src"
      ),
    },
  },
  define: {
    "process.env": {},
  },
  build: {
    sourcemap: true,
    minify: mode === "production" ? "esbuild" : false,
  },
}));
