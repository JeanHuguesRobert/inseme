import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "cyrnea.svg"],
        manifest: {
          name: "Cyrnea - L'IA au Comptoir",
          short_name: "Cyrnea",
          description: "Application PWA pour Inseme Cyrnea",
          theme_color: "#ffffff",
          icons: [
            {
              src: "cyrnea.svg",
              sizes: "192x192",
              type: "image/svg+xml",
            },
            {
              src: "cyrnea.svg",
              sizes: "512x512",
              type: "image/svg+xml",
            },
          ],
        },
      }),
    ],
    envDir: "../../",
    server: {
      port: 5173,
      strictPort: true, // Évite que Vite ne change de port silencieusement, ce qui casserait Netlify Dev
      // Le proxy vers localhost:8888 est géré par Netlify Dev (qui écoute sur 8888 et proxy vers 5173)
      // NE PAS ajouter de proxy ici vers 8888 sous peine de boucle infinie (ENOBUFS)
    },
    resolve: {
      alias: {
        "@inseme/room": path.resolve(__dirname, "../../packages/room"),
        "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
        "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host/src"),
        "@inseme/ophelia": path.resolve(__dirname, "../../packages/ophelia/index.js"),
        "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
        "@inseme/brique-cyrnea": path.resolve(__dirname, "../../packages/brique-cyrnea"),
        "@inseme/brique-cyrnea/pages": path.resolve(
          __dirname,
          "../../packages/brique-cyrnea/src/pages"
        ),
        "@inseme/brique-cyrnea/screens": path.resolve(
          __dirname,
          "../../packages/brique-cyrnea/src/screens"
        ),
        "@inseme/brique-cyrnea/hooks": path.resolve(
          __dirname,
          "../../packages/brique-cyrnea/src/hooks"
        ),
        "@inseme/brique-cyrnea/components": path.resolve(
          __dirname,
          "../../packages/brique-cyrnea/src/components"
        ),
        "@inseme/brique-cyrnea/entities": path.resolve(
          __dirname,
          "../../packages/brique-cyrnea/src/entities"
        ),
        "@inseme/brique-kudocracy": path.resolve(__dirname, "../../packages/brique-kudocracy/src"),
        "@inseme/brique-blog": path.resolve(__dirname, "../../packages/brique-blog"),
      },
    },
    define: {
      // Permet d'injecter des variables globales si nécessaire,
      // mais import.meta.env est généralement suffisant
      "process.env": {},
    },
    build: {
      sourcemap: true,
      minify: mode === "production" ? "esbuild" : false,
    },
  };
});
