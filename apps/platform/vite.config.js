import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@inseme/room": path.resolve(__dirname, "../../packages/room"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host"),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
      "@inseme/ophelia": path.resolve(__dirname, "../../packages/ophelia/index.js"),
      "@inseme/brique-kudocracy": path.resolve(__dirname, "../../packages/brique-kudocracy/src"),
      "@inseme/brique-communes": path.resolve(__dirname, "../../packages/brique-communes/src"),
      "@inseme/brique-tasks": path.resolve(__dirname, "../../packages/brique-tasks/src"),
      "@inseme/brique-map": path.resolve(__dirname, "../../packages/brique-map/src"),
      "@inseme/brique-actes": path.resolve(__dirname, "../../packages/brique-actes/src"),
      "@inseme/brique-group": path.resolve(__dirname, "../../packages/brique-group/src"),
      "@inseme/brique-ophelia": path.resolve(__dirname, "../../packages/brique-ophelia/index.jsx"),
    },
  },
  optimizeDeps: {
    include: [],
  },
  build: {
    sourcemap: true,
    minify: mode === "production" ? "esbuild" : false,
  },
  server: {
    watch: {
      usePolling: false,
      interval: 500,
    },
    hmr: {
      overlay: true,
    },
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false,
      },
    },
  },
}));
