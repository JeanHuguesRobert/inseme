import React, { useEffect, useState } from "react";
import BarmanDashboard from "@inseme/brique-cyrnea/pages/BarmanDashboard";
import ClientMiniApp from "@inseme/brique-cyrnea/pages/ClientMiniApp";
import { useCurrentUser } from "@inseme/cop-host";
import { InsemeProvider } from "@inseme/room";
import { supabase } from "./lib/supabase.js";

/**
 * App Cyrnea - Orchestrateur
 * Route vers le Dashboard Barman ou la Mini-App Client.
 */
function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const { currentUser: user } = useCurrentUser();
  const roomId = "cyrnea-general";

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <InsemeProvider
      roomName={roomId}
      user={user}
      supabase={supabase}
    >
      {route.startsWith("/bar") ? (
        <BarmanDashboard roomId={roomId} />
      ) : (
        <ClientMiniApp roomId={roomId} />
      )}
    </InsemeProvider>
  );
}

export default App;
