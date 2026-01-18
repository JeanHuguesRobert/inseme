import React, { useState } from "react";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";
import { getDisplayName } from "../../../cop-host/src/lib/userDisplay.js";
import CitizenMap from "./CitizenMap";
import LocationPicker from "./LocationPicker";
import { appendOrMergeLastModifiedBy } from "../../../cop-host/src/lib/socialMetadata.js";

export default function LocationContributionModal({ post, onClose, onSuccess }) {
  const { currentUser } = useCurrentUser();

  // Extract initial location from the correct metadata structure
  const getInitialLocation = () => {
    const subtype = post?.metadata?.subtype;
    if (subtype === "event") {
      return post?.metadata?.event?.location || null;
    } else if (subtype === "incident") {
      return post?.metadata?.incident?.location || null;
    }
    return post?.metadata?.location || null;
  };

  const [selectedLocation, setSelectedLocation] = useState(getInitialLocation());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  const handleSave = async () => {
    if (!selectedLocation || !selectedLocation.lat || !selectedLocation.lng) {
      setError("Veuillez sélectionner un emplacement sur la carte.");
      return;
    }

    if (!currentUser) {
      setError("Vous devez être connecté pour contribuer une localisation.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const locationData = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        address: selectedLocation.address || null,
      };

      const contributorData = {
        userId: currentUser.id,
        displayName: getDisplayName(currentUser),
        contributedAt: new Date().toISOString(),
      };

      // Determine where to store the location based on post subtype
      let updatedMetadata = { ...post.metadata };
      const subtype = post.metadata?.subtype;

      if (subtype === "event" && updatedMetadata.event) {
        // For events, store in metadata.event.location
        updatedMetadata.event = {
          ...updatedMetadata.event,
          location: locationData,
        };
      } else if (subtype === "incident" && updatedMetadata.incident) {
        // For incidents, store in metadata.incident.location
        updatedMetadata.incident = {
          ...updatedMetadata.incident,
          location: locationData,
        };
      } else {
        // Fallback: store in root metadata.location
        updatedMetadata.location = locationData;
      }

      // Always store contributor info at root level
      updatedMetadata.locationContributedBy = contributorData;

      // Append or merge lastModifiedBy as this is a metadata update
      updatedMetadata = appendOrMergeLastModifiedBy(updatedMetadata, {
        id: currentUser.id,
        displayName: getDisplayName(currentUser),
      });

      const { error: updateError } = await getSupabase()
        .from("posts")
        .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
        .eq("id", post.id);

      if (updateError) throw updateError;

      if (onSuccess) onSuccess(updatedMetadata);
      onClose();
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la localisation:", err);
      setError("Impossible de sauvegarder la localisation. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  };

  const initialPosition =
    selectedLocation?.lat && selectedLocation?.lng
      ? [selectedLocation.lat, selectedLocation.lng]
      : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white  shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {post?.metadata?.location ? "Corriger la localisation" : "Indiquer la localisation"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Fermer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            {post?.metadata?.location
              ? "Cliquez sur la carte pour corriger l'emplacement ou utilisez la recherche d'adresse."
              : "Cliquez sur la carte pour indiquer l'emplacement ou utilisez la recherche d'adresse."}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="h-96  overflow-hidden border border-gray-300">
            <CitizenMap>
              <LocationPicker
                onLocationSelect={handleLocationSelect}
                initialPosition={initialPosition}
              />
            </CitizenMap>
          </div>

          {selectedLocation && selectedLocation.lat && selectedLocation.lng && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-semibold text-blue-900">Position sélectionnée :</p>
              <p className="text-blue-700">
                📍{" "}
                {selectedLocation.address ||
                  `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedLocation}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
