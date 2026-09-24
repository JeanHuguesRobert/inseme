/**
 * Instance-aware home:
 * - Olé Olé façade of Agent JHN (host oleole.* / ?facade=oleole)
 * - Personal Twin JHN landing
 * - Civic/default consultations
 *
 * Olé Olé is not a separate product: same Twin (twin:jhn), different service façade.
 */
import { lazy, Suspense } from "react";
import { registerSW } from "virtual:pwa-register";
import { getConfig } from "../common/config/instanceConfig.client.js";
import { isOleoleFacade } from "@inseme/brique-oleole/src/lib/facade-host.js";
import JhnLandingPage from "./JhnLandingPage";
import ConsultationsHome from "./consultations";

const OleoleHome = lazy(() => import("@inseme/brique-oleole/src/pages/OleoleHome.jsx"));

export default function HomeRoute() {
  // Presence / discovery façade of John (same agent, service-scoped UX)
  if (isOleoleFacade()) {
    return (
      <Suspense fallback={<div className="p-8 text-center">Olé Olé…</div>}>
        <OleoleHome registerServiceWorker={registerSW} />
      </Suspense>
    );
  }

  const deploymentKind = String(getConfig("deployment_kind") || "").toLowerCase();
  const appProfile = String(getConfig("application_profile") || "").toLowerCase();
  const subdomain = String(getConfig("subdomain") || "").toLowerCase();
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";

  const isPersonalTwin =
    deploymentKind === "personal" ||
    appProfile === "personal-twin" ||
    subdomain === "jhn" ||
    host.startsWith("jhn.") ||
    host.includes("jhn-baronsmariani");

  if (isPersonalTwin) {
    return <JhnLandingPage />;
  }
  return <ConsultationsHome />;
}
