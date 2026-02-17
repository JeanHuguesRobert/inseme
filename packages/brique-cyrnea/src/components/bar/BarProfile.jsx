import React from "react";
import { Icon } from "../Icon"; // Adjust path
import { BarStats } from "./BarStats";
import { BarConnectedUsers } from "./BarConnectedUsers";

/**
 * Fiche détaillée d'un bar
 */
export const BarProfile = ({ bar }) => {
  if (!bar) return null;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">{bar.displayName || bar.name}</h1>
          <p className="text-lg text-gray-600">{bar.slug}</p>
        </div>
        <div className="flex gap-2">
          {bar.isOpen ? (
            <span className="bg-green-500 text-white px-3 py-1 text-sm font-black uppercase">
              Ouvert
            </span>
          ) : (
            <span className="bg-red-500 text-white px-3 py-1 text-sm font-black uppercase">
              Fermé
            </span>
          )}
        </div>
      </div>

      {/* Informations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-black mb-4">Informations</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div>
                <h3 className="font-black text-lg">{bar.displayName || bar.name}</h3>
                <p className="text-sm text-gray-600">
                  {bar.zones?.length ? `${bar.zones.length} zones` : "3 zones"}
                </p>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Zones:</span>
              <span>{bar.zones?.length || 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Créé le:</span>
              <span>{new Date(bar.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Mis à jour:</span>
              <span>{new Date(bar.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black mb-4">Liens sociaux</h2>
          <div className="space-y-2">
            {(bar.facebookUrl || bar.settings?.facebook_url) && (
              <a
                href={bar.facebookUrl || bar.settings?.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline"
              >
                <Icon name="facebook" className="w-4 h-4" />
                Facebook
              </a>
            )}
            {(bar.instagramUrl || bar.settings?.instagram_url) && (
              <a
                href={bar.instagramUrl || bar.settings?.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-pink-600 hover:underline"
              >
                <Icon name="instagram" className="w-4 h-4" />
                Instagram
              </a>
            )}
            {!bar.facebookUrl &&
              !bar.instagramUrl &&
              !bar.settings?.facebook_url &&
              !bar.settings?.instagram_url && <p className="text-gray-500">Aucun lien social</p>}
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div>
        <h2 className="text-xl font-black mb-4">Statistiques</h2>
        <BarStats bar={bar} />
      </div>

      {/* Utilisateurs connectés */}
      <div>
        <h2 className="text-xl font-black mb-4">Utilisateurs connectés</h2>
        <BarConnectedUsers bar={bar} />
      </div>
    </div>
  );
};
