import React, { useEffect, useState } from "react";
import { MapContainer, LayersControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import LocateControl from "./LocateControl";
import GeoportalControls from "./GeoportalControls";
import MunicipalPoiLayer from "./layers/MunicipalPoiLayer";
import MunicipalEventsLayer from "./layers/MunicipalEventsLayer";
import BiodiversityLayer from "./layers/BiodiversityLayer";
import { getConfig } from "@inseme/cop-host";

// Fix pour les icônes Leaflet manquantes
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// Coordonnées par défaut (Corte)
const DEFAULT_COORDS = [42.3094, 9.149];

// Helper pour obtenir les coordonnées depuis le vault ou env
function getDefaultCenter() {
  // Essayer le vault d'abord
  const lat = getConfig("map_default_lat");
  const lng = getConfig("map_default_lng");
  if (lat && lng) {
    return [Number(lat), Number(lng)];
  }
  // Fallback
  return DEFAULT_COORDS;
}

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

export default function CitizenMap({
  center,
  zoom = 13,
  children,
  className = "h-full w-full",
  biodiversityFilters = {},
}) {
  const defaultCenter = getDefaultCenter();
  const defaultZoom = getConfig("map_default_zoom", zoom);

  return (
    <MapContainer
      center={center || defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom={true}
      className={className}
      style={{ minHeight: "400px", width: "100%", height: "100%" }}
    >
      <GeoportalControls />
      <MapController center={center} zoom={defaultZoom} />

      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Points d'intérêt">
          <MunicipalPoiLayer />
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Événements">
          <MunicipalEventsLayer />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Biodiversité">
          <BiodiversityLayer filters={biodiversityFilters} />
        </LayersControl.Overlay>
      </LayersControl>

      <LocateControl />
      {children}
    </MapContainer>
  );
}
