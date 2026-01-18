import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import {
  initializeInstance,
  loadInstanceConfig,
} from "@inseme/cop-host/config/instanceConfig.client.js";
import { initSupabase } from "@inseme/cop-host/client/supabase.js";
import { CurrentUserProvider } from "@inseme/cop-host";
import { ErrorBoundary } from "@inseme/ui";

// Initialisation asynchrone de la configuration (Vault)
const init = async () => {
  try {
    // Initialise Supabase via cop-host qui gère la config dynamique
    const { supabase } = await initSupabase();

    // Initialise le vault avec ce client
    await initializeInstance(supabase);
    await loadInstanceConfig();
  } catch (e) {
    console.warn("Vault initialization failed:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary>
          <CurrentUserProvider>
            <App />
          </CurrentUserProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
};

init();
