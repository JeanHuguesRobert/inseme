import React, { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

// Icons mapping based on validation status and source
const getBiodiversityIcon = (observation) => {
  const { validation_status, source } = observation.properties;

  // Base color by validation status
  let color = "gray"; // unverified
  if (validation_status === "confirmed") color = "green";
  if (validation_status === "probable") color = "orange";
  if (validation_status === "rejected") color = "red";

  // Shape by source
  let iconSymbol = "●"; // default circle
  if (source === "citizen") iconSymbol = "👤";
  if (source === "gbif") iconSymbol = "🌐";
  if (source === "inpn") iconSymbol = "🇫🇷";
  if (source === "manual_import") iconSymbol = "📋";

  // Create custom icon with color and symbol
  const iconHtml = `
    <div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
    ">
      ${iconSymbol}
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: "biodiversity-marker",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

export default function BiodiversityLayer({ filters = {}, onObservationClick, className }) {
  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.bbox) params.set("bbox", filters.bbox);
    if (filters.taxon) params.set("taxon", filters.taxon);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    if (filters.validation_status) params.set("validation_status", filters.validation_status);
    if (filters.limit) params.set("limit", filters.limit);

    return params.toString();
  }, [filters]);

  const {
    data: geojson,
    error,
    isLoading,
  } = useSWR(
    queryString
      ? `/api/biodiversity/observations?${queryString}`
      : "/api/biodiversity/observations",
    fetcher
  );

  if (error) {
    console.error("Error loading biodiversity observations:", error);
    return (
      <div className="biodiversity-error p-2 bg-red-100 border border-red-300 rounded">
        Erreur lors du chargement des observations biodiversité
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="biodiversity-loading p-2 bg-blue-50 border border-blue-200 rounded">
        Chargement des observations...
      </div>
    );
  }

  if (!geojson || !geojson.features || geojson.features.length === 0) {
    return (
      <div className="biodiversity-empty p-2 bg-gray-50 border border-gray-200 rounded">
        Aucune observation trouvée pour les filtres actuels
      </div>
    );
  }

  return (
    <>
      {geojson.features.map((feature) => {
        const { geometry, properties } = feature;
        const [lng, lat] = geometry.coordinates;
        const key = properties.id;

        const handleMarkerClick = () => {
          if (onObservationClick) {
            onObservationClick(feature);
          }
        };

        return (
          <Marker
            key={key}
            position={[lat, lng]}
            icon={getBiodiversityIcon(feature)}
            eventHandlers={{
              click: handleMarkerClick,
            }}
          >
            <Popup maxWidth={300}>
              <div className="biodiversity-popup p-2 text-sm">
                {/* Header with names */}
                <div className="font-bold text-base mb-2">
                  {properties.vernacular_name && (
                    <div className="text-green-700">{properties.vernacular_name}</div>
                  )}
                  <div className="text-gray-600 italic">
                    <em>{properties.scientific_name}</em>
                  </div>
                </div>

                {/* Observation details */}
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="font-semibold">Date:</span>{" "}
                    {new Date(properties.observed_at).toLocaleDateString("fr-FR")}
                  </div>

                  {properties.observer_name && (
                    <div>
                      <span className="font-semibold">Observateur:</span> {properties.observer_name}
                    </div>
                  )}

                  <div>
                    <span className="font-semibold">Source:</span>{" "}
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        properties.source === "citizen" ? "bg-blue-100" : "bg-gray-100"
                      }`}
                    >
                      {properties.source}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold">Statut:</span>{" "}
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        properties.validation_status === "confirmed"
                          ? "bg-green-100"
                          : properties.validation_status === "probable"
                            ? "bg-orange-100"
                            : properties.validation_status === "rejected"
                              ? "bg-red-100"
                              : "bg-gray-100"
                      }`}
                    >
                      {properties.validation_status}
                    </span>
                  </div>

                  {properties.count && (
                    <div>
                      <span className="font-semibold">Nombre:</span> {properties.count}
                    </div>
                  )}

                  {properties.habitat && (
                    <div>
                      <span className="font-semibold">Habitat:</span> {properties.habitat}
                    </div>
                  )}

                  {/* Taxonomic details if available */}
                  {properties.taxonomy && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="font-semibold text-xs mb-1">Taxonomie:</div>
                      <div className="text-xs space-y-0.5">
                        {properties.taxonomy.family_name && (
                          <div>Famille: {properties.taxonomy.family_name}</div>
                        )}
                        {properties.taxonomy.order_name && (
                          <div>Ordre: {properties.taxonomy.order_name}</div>
                        )}
                        {properties.taxonomy.class_name && (
                          <div>Classe: {properties.taxonomy.class_name}</div>
                        )}
                        {properties.taxonomy.kingdom && (
                          <div>Règne: {properties.taxonomy.kingdom}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mt-3 pt-2 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${properties.scientific_name} - ${new Date(properties.observed_at).toLocaleDateString("fr-FR")}`
                      )
                    }
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Copier
                  </button>
                  {properties.validation_status === "unverified" && (
                    <button
                      className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement validation action
                        console.log("Validate observation:", properties.id);
                      }}
                    >
                      Valider
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
