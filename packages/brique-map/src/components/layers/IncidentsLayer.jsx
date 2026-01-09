import React from "react";
import { Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import { getLatestModifier } from "../../../../cop-host/src/lib/socialMetadata.js";

export default function IncidentsLayer({ incidents }) {
  return (
    <>
      {incidents.map((item) => {
        const { incident, id, title, subtitle } = item;
        // Check if location exists in metadata (which is where we store it now)
        // The item structure from Incidents.jsx might need adjustment to pass the full metadata or location
        // For now, let's assume item.location or item.metadata.location exists.
        // Based on my plan, I need to ensure Incidents.jsx passes this info.

        const location = item.location || (item.metadata && item.metadata.location);

        if (!location || !location.lat || !location.lng) return null;

        const latest = getLatestModifier(item.metadata, item);
        return (
          <Marker key={id} position={[location.lat, location.lng]}>
            <Popup>
              <div className="text-sm">
                <h3 className="font-bold">{title}</h3>
                {subtitle && <p className="italic">{subtitle}</p>}
                {latest && latest.id !== item.authorId && (
                  <p className="text-xs">Dernière mise à jour par {latest.displayName}</p>
                )}
                <p className="mt-1">Statut: {incident.status}</p>
                <Link to={`/posts/${id}`} className="text-blue-600 underline">
                  Voir le détail
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
