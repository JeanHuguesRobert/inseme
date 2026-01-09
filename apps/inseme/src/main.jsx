import React from "react";
import ReactDOM from "../../platform/src/common/db/client.js";
import App from "./App";
import "./index.css";
import {
  initializeInstance,
  loadInstanceConfig,
} from "../../../packages/cop-host/src/config/instanceConfig.client.js";
import { ErrorBoundary } from "../../../packages/ui/src/index.js";

// Initialisation asynchrone de la configuration (Vault)
const init = async () => {
  try {
    // Initialise le vault (tente de charger depuis Supabase)
    await initializeInstance();
    await loadInstanceConfig();
  } catch (e) {
    console.warn("Vault initialization failed, using env vars only:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

init();
