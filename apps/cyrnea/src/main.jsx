import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import {
  initializeInstance,
  loadInstanceConfig,
  getConfig,
} from "@inseme/cop-host/config/instanceConfig.client.js";
import { initSupabase } from "@inseme/cop-host/client/supabase.js";
import { CyrneaUserProvider } from "./contexts/CyrneaUserProvider";
import { ErrorBoundary } from "@inseme/ui";
import { WebVitals } from "@inseme/cop-host/lib/axiom.js";
import { initializeTheBar, initializeTheUser, getRoomIdFromURL, User } from "@inseme/brique-cyrnea";
import LoadingScreen from "./components/LoadingScreen";

// Initialisation asynchrone complète
const init = async () => {
  // Afficher l'écran de chargement
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<LoadingScreen />);

  try {
    console.log("🚀 Starting complete initialization...");

    // 1. Initialiser Supabase et la configuration
    const { supabase } = await initSupabase();
    await initializeInstance(supabase);
    await loadInstanceConfig();
    console.log("✅ Config ok for " + getConfig("community_name"));

    // 2. Récupérer le nom du bar depuis l'URL
    const barName = getRoomIdFromURL();
    console.log("📍 Bar name from URL:", barName);

    // 3. Récupérer les metadata de la room
    const { data: roomMetadata, error: roomError } = await supabase
      .from("inseme_rooms")
      .select("*")
      .eq("slug", barName)
      .maybeSingle();

    if (roomError || !roomMetadata) {
      throw new Error(`Room "${barName}" not found: ${roomError?.message}`);
    }
    console.log("✅ Room metadata loaded:", roomMetadata);

    // 4. Initialiser l'utilisateur depuis localStorage (Global Identity)
    let userData = {};
    try {
      // Use the centralized factory that handles storage, migration, and rich object creation
      const user = User.createAnonymous();
      console.log("✅ User initialized:", user);

      // initializeTheUser expects a User object or raw data.
      // Passing the rich object is cleaner.
      userData = user;
    } catch (e) {
      console.warn("Error initializing user:", e);
      // Fallback if something goes wrong (should be handled by createAnonymous but safety net)
      userData = {
        user_id: "guest-fallback",
        pseudo: "Anonyme",
        role: "client",
        isAnonymous: true,
      };
    }

    // 5. Initialiser les singletons avec les vraies données
    console.log("🔄 Initializing singletons with real data...");

    // Préparer les données pour TheBar avec la bonne structure
    const barDataForInit = {
      ...roomMetadata,
      name: roomMetadata?.settings?.defaultBarName || roomMetadata?.slug || "Établissement",
      displayName:
        roomMetadata?.settings?.displayName ||
        roomMetadata?.settings?.defaultBarName ||
        roomMetadata?.slug ||
        "Établissement",
      status: "active",
    };

    initializeTheUser(userData, roomMetadata);
    initializeTheBar(barDataForInit, { connectedUsers: [] }, []);
    console.log("✅ Singletons initialized successfully");

    // 6. Lancer l'application
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <ErrorBoundary>
            <CyrneaUserProvider>
              <WebVitals />
              <App />
            </CyrneaUserProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (e) {
    console.error("❌ Initialization failed:", e);
    root.render(
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          fontFamily: "Arial, sans-serif",
          color: "red",
          textAlign: "center",
          padding: "20px",
        }}
      >
        Erreur lors du chargement: {e.message}
      </div>
    );
  }
};

init();
