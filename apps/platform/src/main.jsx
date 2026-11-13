// main.jsx
// Point d'entrée de l'application
// MULTI-INSTANCES : L'instance Supabase est résolue dynamiquement selon l'URL
// - Sous-domaine : corte.transparence.corsica → instance Corte
// - Paramètre URL : localhost:5173?instance=corte → instance Corte (dev)

import React from "react";
import ReactDOM from "react-dom/client";
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
  getConfig,
} from "./common/config/instanceConfig.client.js";
import { updatePageMeta } from "./lib/meta.js";
import { wrap, unwrap } from "./constants.js";
import { routeRootRecoveryCallback, recoveryLanding } from "./lib/recoveryLanding.js";

// Preserve the recovery callback for Supabase Auth, but render its dedicated form.
// The legacy email template redirects to the JHN origin root.
routeRootRecoveryCallback(window.location, window.history);

// Export global pour utilisation partout sans import
window.wrap = wrap;
window.unwrap = unwrap;

/**
 * Patch global pour intercepter toutes les requêtes sortantes (fetch & XHR)
 * et les faire passer par le proxy si nécessaire.
 */
(function applyGlobalProxyPatches() {
  const forceProxy =
    window.location.search.includes("proxy=1") ||
    import.meta.env.VITE_USE_PROXY === "true" ||
    import.meta.env.VITE_USE_PROXY === "1";

  // Proxy is opt-in. Do NOT wrap all fetches on localhost just because a workstation
  // proxy_url exists in .env/vault — that breaks CSP (connect-src) and is unnecessary
  // when talking to https://*.supabase.co directly (normal JHN dogfood).
  // Enable with ?proxy=1 or VITE_USE_PROXY=true when you intentionally tunnel via localhost:8889.
  if (!forceProxy) return;

  // 1. Patch FETCH
  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    let url =
      typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
    const wrappedUrl = window.wrap(url);

    // Si l'URL a été wrappée, on injecte le header ngrok pour éviter l'écran d'avertissement
    if (wrappedUrl !== url) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      headers.set("ngrok-skip-browser-warning", "true");

      if (input instanceof Request) {
        input = new Request(wrappedUrl, {
          method: input.method,
          headers: headers,
          body: input.body,
          mode: input.mode,
          credentials: input.credentials,
          cache: input.cache,
          redirect: input.redirect,
          referrer: input.referrer,
          integrity: input.integrity,
        });
      } else {
        input = wrappedUrl;
        init = { ...init, headers };
      }
    }

    return originalFetch(input, init);
  };

  // 2. Patch XMLHttpRequest (XHR)
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (url) {
      const wrappedUrl = window.wrap(url.toString());
      if (wrappedUrl !== url.toString()) {
        this._isWrapped = true;
        url = wrappedUrl;
      }
    }
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (this._isWrapped) {
      this.setRequestHeader("ngrok-skip-browser-warning", "true");
    }
    return originalSend.apply(this, [body]);
  };

  console.log("🛠️ Global Proxy Patches applied (fetch & XHR)");
})();

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

    // 1) Client Supabase (singleton cop-host) — AVANT tout getSupabase()
    //    Ne pas appeler getSupabase() ici : le singleton n'existe pas encore.
    console.log(
      `🔧 initSupabaseWithInstance: url=${instance.supabaseUrl ? "yes" : "no"} key=${
        instance.supabaseAnonKey ? "yes" : "no"
      }`
    );
    const supabase = initSupabaseWithInstance(instance);

    // 2) Config vault (même client — évite deux clients disjoints)
    await initializeInstance(supabase, false);
    await loadInstanceConfig();

    // 3) Métadonnées de page (titre, SEO) — après config
    updatePageMeta();

    // 4) Stocker l'instance pour accès global
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
