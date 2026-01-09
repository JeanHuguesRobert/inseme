// src/pages/InstanceSelector.jsx
// Page de sélection d'instance (affichée quand aucune instance n'est détectée)
// Permet à l'utilisateur de choisir sa communauté

import { useState, useEffect } from "react";
import { getInstanceUrl } from "../lib/instanceResolver.js";

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function InstanceSelector() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadInstances();
  }, []);

  async function loadInstances() {
    try {
      // Charger depuis l'API
      const response = await fetch("/api/instances-list");
      if (response.ok) {
        const data = await response.json();
        setInstances(data);
      } else {
        // Fallback sur des instances statiques
        setInstances(STATIC_INSTANCES);
      }
    } catch (err) {
      console.warn("Could not load instances from API, using static list");
      setInstances(STATIC_INSTANCES);
    } finally {
      setLoading(false);
    }
  }

  const filteredInstances = instances.filter(
    (instance) =>
      instance.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInstanceClick = (subdomain) => {
    const url = getInstanceUrl(subdomain, "/");
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="py-8 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🏛️ Bienvenue sur Ophélia</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Plateforme de démocratie participative et de transparence citoyenne.
            <br />
            Choisissez votre communauté pour commencer.
          </p>
        </div>
      </header>

      {/* Recherche */}
      <div className="container mx-auto px-4 mb-8">
        <div className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="🔍 Rechercher une communauté..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
          />
        </div>
      </div>

      {/* Liste des instances */}
      <div className="container mx-auto px-4 pb-16">
        {filteredInstances.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucune communauté trouvée pour "{searchTerm}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {filteredInstances.map((instance) => (
              <InstanceCard
                key={instance.subdomain}
                instance={instance}
                onClick={() => handleInstanceClick(instance.subdomain)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-gray-200">
        <p className="text-gray-500 text-sm">
          Votre communauté n'est pas listée ?{" "}
          <a href="/onboarding" className="text-primary-600 hover:underline">
            Créer une nouvelle instance →
          </a>
        </p>
        <p className="text-gray-400 text-xs mt-4">
          Propulsé par{" "}
          <a
            href="https://github.com/JeanHuguesRobert/survey"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Kudocracy.Survey
          </a>{" "}
          — Open Source
        </p>
      </footer>
    </div>
  );
}

// ============================================================================
// COMPOSANT CARTE D'INSTANCE
// ============================================================================

function InstanceCard({ instance, onClick }) {
  const typeLabels = {
    municipality: "🏛️ Commune",
    epci: "🏘️ Intercommunalité",
    region: "🗺️ Région",
    association: "🤝 Association",
    university: "🎓 Université",
    cooperative: "🌱 Coopérative",
    cse: "👷 CSE",
    copropriete: "🏢 Copropriété",
  };

  return (
    <button
      onClick={onClick}
      className="block w-full text-left p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] border border-gray-100"
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ backgroundColor: instance.primaryColor || "#B35A4A" }}
        >
          {instance.logoUrl ? (
            <img
              src={instance.logoUrl}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            instance.displayName.charAt(0).toUpperCase()
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg text-gray-900 truncate">{instance.displayName}</h2>
          <p className="text-sm text-gray-500">
            {typeLabels[instance.instanceType] || instance.instanceType}
          </p>
          {instance.metadata?.region && (
            <p className="text-xs text-gray-400 mt-1">📍 {instance.metadata.region}</p>
          )}
          {instance.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{instance.description}</p>
          )}
        </div>

        {/* Flèche */}
        <div className="text-gray-400 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// INSTANCES STATIQUES (fallback)
// ============================================================================

const STATIC_INSTANCES = [
  {
    subdomain: "corte",
    displayName: "Ville de Corte",
    instanceType: "municipality",
    primaryColor: "#B35A4A",
    description:
      "Plateforme de transparence citoyenne de la ville de Corte, capitale historique de la Corse.",
    metadata: { region: "Corse", insee: "2B096" },
  },
  // Ajouter d'autres instances ici au fur et à mesure
];
