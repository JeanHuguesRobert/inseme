import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { supabase } from "./lib/supabase.js";
import {
  initializeInstance,
  loadInstanceConfig,
} from "@inseme/cop-host/config/instanceConfig.client.js";
import { CurrentUserProvider } from "@inseme/cop-host";
import { ErrorBoundary } from "@inseme/ui";

// Initialisation asynchrone de la configuration (Vault)
const init = async () => {
  try {
    // Initialise le vault avec notre client Supabase local
    // Cela évite que cop-host ne tente d'en créer un nouveau sans variables d'env
    await initializeInstance(supabase);
    await loadInstanceConfig();
  } catch (e) {
    console.warn("Vault initialization failed, using env vars only:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

init();
