import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CitizenMap, LocationPicker } from "@inseme/brique-map";
import SiteFooter from "../components/layout/SiteFooter";

export default function PostLocationPicker() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationState = useLocation();

  const draftKey = searchParams.get("draft") || "post-editor-new";
  const fallbackReturn = locationState.state?.returnTo || "/posts/new";
  const returnTo = searchParams.get("returnTo") || fallbackReturn;
  const initialLocation = useMemo(() => {
    if (locationState.state?.location?.lat && locationState.state.location?.lng) {
      return locationState.state.location;
    }
    if (typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.location?.lat && parsed?.location?.lng) {
            return parsed.location;
          }
        }
      } catch (err) {
        console.warn("Impossible de récupérer la localisation enregistrée:", err);
      }
    }
    return null;
  }, [draftKey, locationState.state]);

  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [status, setStatus] = useState(null);

  const title = locationState.state?.title || "la publication";
  const subtype = locationState.state?.subtype;

  const handleSave = () => {
    if (!selectedLocation) {
      setStatus("Sélectionnez un point sur la carte avant d'enregistrer.");
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const rawDraft = window.sessionStorage.getItem(draftKey);
        const draft = rawDraft ? JSON.parse(rawDraft) : {};
        draft.location = selectedLocation;
        window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.error("Erreur sauvegarde localisation:", err);
      }
    }

    navigate(returnTo);
  };

  const handleClear = () => {
    setSelectedLocation(null);
    if (typeof window !== "undefined") {
      try {
        const rawDraft = window.sessionStorage.getItem(draftKey);
        const draft = rawDraft ? JSON.parse(rawDraft) : {};
        delete draft.location;
        window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.error("Erreur nettoyage localisation:", err);
      }
    }
    setStatus(null);
  };

  const handleCancel = () => {
    navigate(returnTo);
  };

  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: "gps",
        });
        setStatus(null);
      },
      () => setStatus("Impossible de récupérer votre position."),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <button onClick={handleCancel} className="text-sm text-blue-400 hover:underline">
          ← Retour à {title}
        </button>

        <div>
          <h1 className="text-3xl font-semibold">Carte de localisation</h1>
          <p className="text-sm text-gray-400 mt-2">
            Sélectionnez l'emplacement précis pour {title}
            {subtype ? ` (${subtype})` : ""}. La carte est indépendante du formulaire afin d'éviter
            la perte de contenu.
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 overflow-hidden h-[60vh]">
          <CitizenMap
            center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : undefined}
            zoom={selectedLocation ? 15 : 13}
            className="h-full w-full"
          >
            <LocationPicker
              initialPosition={
                selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : null
              }
              onLocationSelect={(loc) => {
                setSelectedLocation({ ...loc, source: "manual" });
                setStatus(null);
              }}
            />
          </CitizenMap>
        </div>

        {selectedLocation ? (
          <div className="text-sm text-green-300">
            Position sélectionnée : {selectedLocation.lat.toFixed(5)},{" "}
            {selectedLocation.lng.toFixed(5)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Cliquez sur la carte pour placer un marqueur.</p>
        )}

        {status && <div className="text-sm text-yellow-400">{status}</div>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-orange-600 text-white font-semibold hover:bg-orange-700"
          >
            Enregistrer et revenir
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="px-4 py-2 border border-gray-700 text-sm hover:border-gray-500"
          >
            📍 Utiliser ma position
          </button>
          {selectedLocation && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 border border-red-500 text-red-400 text-sm hover:bg-red-500/10"
            >
              Effacer la localisation
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-700 text-sm hover:border-gray-500"
          >
            Annuler sans enregistrer
          </button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
