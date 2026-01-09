import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { parseLocationInput } from "../lib/locationParser.js";
import { getConfig } from "@inseme/cop-host";

export default function AddressSearchControl({ onLocationSelect }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Disable map dragging/zooming when interacting with the search input
    if (!map) return;
    const disableMapInteraction = () => {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
    };
    const enableMapInteraction = () => {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener("mouseenter", disableMapInteraction);
      wrapper.addEventListener("mouseleave", enableMapInteraction);
      wrapper.addEventListener("focusin", disableMapInteraction);
      wrapper.addEventListener("focusout", enableMapInteraction);
    }

    return () => {
      if (wrapper) {
        wrapper.removeEventListener("mouseenter", disableMapInteraction);
        wrapper.removeEventListener("mouseleave", enableMapInteraction);
        wrapper.removeEventListener("focusin", disableMapInteraction);
        wrapper.removeEventListener("focusout", enableMapInteraction);
      }
      // Ensure map interaction is re-enabled if component unmounts
      if (map) {
        map.dragging.enable();
        map.scrollWheelZoom.enable();
      }
    };
  }, [map]);

  const handleSearch = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!query.trim()) return;

    // First, try to parse as a direct location (URL or lat,lng)
    // Get default center from vault or env
    const lat = getConfig("map_default_lat");
    const lng = getConfig("map_default_lng");
    let centerLat, centerLng;
    if (lat && lng) {
      centerLat = lat;
      centerLng = lng;
    } else {
      const defaultCenterStr = import.meta.env.VITE_MAP_DEFAULT_CENTER || "42.3094,9.1490";
      [centerLat, centerLng] = defaultCenterStr.split(",").map(parseFloat);
    }
    const center = { lat: centerLat, lng: centerLng };

    const parsedLocation = parseLocationInput(query, { center, maxDistanceKm: 200 });
    if (parsedLocation) {
      handleSelect({
        lat: parsedLocation.lat,
        lon: parsedLocation.lng,
        display_name: parsedLocation.name,
        place_id: "manual-" + Date.now(), // Fake ID for internal use
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5`
      );
      const data = await response.json();
      setResults(data);
      setIsOpen(true);
    } catch (error) {
      console.error("Erreur de géocodage:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    map.flyTo([lat, lon], 16);
    setResults([]);
    setIsOpen(false);
    setQuery(result.display_name);

    if (onLocationSelect) {
      onLocationSelect({
        lat,
        lng: lon,
        address: result.display_name,
        raw: result,
      });
    }
  };

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar" ref={wrapperRef}>
        <div className="bg-white p-1 rounded shadow-md relative group">
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une adresse..."
              className="px-2 py-1 text-sm border-none outline-none w-48 focus:w-64 transition-all text-gray-800"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="p-1 text-gray-600 hover:text-gray-900"
              title="Rechercher"
            >
              {isSearching ? (
                <span className="animate-spin block h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
            </button>
          </form>

          {isOpen && results.length > 0 && (
            <ul className="absolute top-full right-0 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto z-[1000]">
              {results.map((result) => (
                <li
                  key={result.place_id}
                  onClick={() => handleSelect(result)}
                  className="px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer border-b last:border-none"
                >
                  {result.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
