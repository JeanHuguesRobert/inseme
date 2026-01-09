// main.jsx
// Point d'entrée de l'application
// MULTI-INSTANCES : L'instance Supabase est résolue dynamiquement selon l'URL
// - Sous-domaine : corte.transparence.corsica → instance Corte
// - Paramètre URL : localhost:5173?instance=corte → instance Corte (dev)

import React from "react";
import ReactDOM from "./common/db/client.js";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "@inseme/ui";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import { GlobalStatusProvider } from "./contexts/GlobalStatusContext";
import { CurrentUserProvider } from "./contexts/CurrentUserContext.proxy";
import "./styles/index.css";

// Import des modules multi-instances
import { resolveInstance, getInstance } from "./lib/instanceResolver.js";
import { initSupabaseWithInstance } from "./lib/supabase.js";
import {
  initializeInstance,
  loadInstanceConfig,
  getSupabase,
  getConfig,
} from "./common/config/instanceConfig.client.js";
import { updatePageMeta } from "./lib/meta.js";

// ============================================================================
// LOADER PENDANT L'INIT
// ============================================================================

function showLoader() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    ">
      <div style="
        width: 48px;
        height: 48px;
        border: 4px solid #B35A4A;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <p style="margin-top: 16px; color: #666;">Chargement de l'instance...</p>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
}

function showError(message) {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      background: #fff5f5;
      padding: 20px;
    ">
      <div style="
        max-width: 400px;
        text-align: center;
        background: white;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      ">
        <h1 style="color: #e53e3e; margin-bottom: 16px;">❌ Erreur d'initialisation</h1>
        <p style="color: #666; margin-bottom: 24px;">${message}</p>
        <button onclick="location.reload()" style="
          background: #B35A4A;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        ">
          Réessayer
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// BOOTSTRAP ASYNCHRONE
// ============================================================================

async function bootstrap() {
  console.log("🚀 Démarrage de l'application...");

  // Afficher le loader
  showLoader();

  try {
    // Résoudre l'instance (sous-domaine ou paramètre)
    const instance = await resolveInstance();
    console.log(
      `🏛️ Instance résolue: ${instance.displayName || instance.subdomain} (${instance.source})`
    );

    // Vérifier que l'instance est configurée
    if (!instance.isConfigured && !instance.supabaseUrl) {
      throw new Error(
        "Aucune configuration Supabase trouvée. Vérifiez vos variables d'environnement."
      );
    }

    // Initialiser la configuration globale, not admin / no secrets
    await initializeInstance(null, false, instance);
    await loadInstanceConfig();

    // Mettre à jour les métadonnées de la page (titre, SEO)
    updatePageMeta();

    // TODO: handle not default case
    instance.supabase = getSupabase();

    // 3. Initialiser Supabase module  avec cette  supabaseClient
    // Debug trace, is there or not a supabase instance already?
    console.log(`🔧 initSupabaseWithInstance: ${instance.supabase ? "yes" : "no"}`);
    initSupabaseWithInstance(instance);

    // 5. Stocker l'instance pour accès global
    window.__OPHELIA_INSTANCE__ = instance;

    // 6. Rendre l'application React
    console.log("✅ Initialisation terminée, rendu React...");

    ReactDOM.createRoot(document.getElementById("root")).render(
      <SupabaseProvider>
        <CurrentUserProvider>
          <GlobalStatusProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <App instance={instance} />
              </ErrorBoundary>
            </BrowserRouter>
          </GlobalStatusProvider>
        </CurrentUserProvider>
      </SupabaseProvider>
    );
  } catch (error) {
    console.error("❌ Erreur d'initialisation:", error);
    showError(error.message);
  }
}

// Lancer le bootstrap
bootstrap();
