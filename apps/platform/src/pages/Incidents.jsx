import React, { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@inseme/cop-host";
import { useNavigate } from "react-router-dom";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import {
  isDeleted,
  enrichUserMetadata,
  getDisplayName,
  getPostTitle,
  getPostSubtitle,
  getPostIncident,
  getLatestModifier,
} from "@inseme/cop-host";
import { getPostGazette } from "../lib/postPredicates.js";
import { CitizenMap, IncidentsLayer, LocationContributionModal } from "@inseme/brique-map";

const STATUS_LABELS = {
  open: "Ouvert",
  investigating: "Investigation",
  monitoring: "Surveillance",
  resolved: "Résolu",
};

const SEVERITY_LABELS = {
  low: "Faible",
  medium: "Modérée",
  high: "Élevée",
  critical: "Critique",
};

const STATUS_ORDER = ["open", "investigating", "monitoring", "resolved"];
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export default function Incidents() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGazette = searchParams.get("gazette") || "all";
  const [selectedGazette, setSelectedGazette] = useState(initialGazette);
  const [viewMode, setViewMode] = useState("list"); // "list" or "map"
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [locationModalPost, setLocationModalPost] = useState(null);

  const [editorGazettes, setEditorGazettes] = useState([]);

  useEffect(() => {
    setSelectedGazette(initialGazette);
  }, [initialGazette]);

  useEffect(() => {
    async function loadEditorGazettes() {
      if (!currentUser) return;
      try {
        const { data, error } = await getSupabase()
          .from("group_members")
          .select("group_id, groups(name)")
          .eq("user_id", currentUser.id);
        if (error) throw error;
        const names = (data || []).map((d) => d.groups?.name).filter(Boolean);
        setEditorGazettes(names);
      } catch (err) {
        console.warn("Error loading editor group names", err);
      }
    }
    loadEditorGazettes();
  }, [currentUser]);

  useEffect(() => {
    async function loadIncidents() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: supabaseError } = await getSupabase()
          .from("posts")
          .select("*, users(id, display_name, metadata)")
          .eq("metadata->>subtype", "incident")
          .order("created_at", { ascending: false });
        if (supabaseError) throw supabaseError;
        const activePosts = (data || [])
          .filter((post) => !isDeleted(post))
          .map((post) => ({
            ...post,
            users: enrichUserMetadata(post.users),
          }));

        const normalized = activePosts
          .map((post) => {
            const incident = getPostIncident(post);
            if (!incident) return null;
            return {
              id: post.id,
              title: getPostTitle(post),
              subtitle: getPostSubtitle(post),
              gazette: getPostGazette(post),
              authorName: getDisplayName(post.users) || "Anonyme",
              authorId: post.author_id,
              metadata: post.metadata,
              createdAt: new Date(post.created_at),
              incident,
              location: post.metadata?.location || null,
            };
          })
          .filter(Boolean);

        setIncidents(normalized);
      } catch (err) {
        console.error("Erreur chargement incidents:", err);
        setError("Impossible de charger les incidents. Réessayez plus tard.");
      } finally {
        setLoading(false);
      }
    }
    loadIncidents();
  }, []);

  const gazetteOptions = useMemo(() => {
    const set = new Set();
    incidents.forEach((incident) => {
      if (incident.gazette) set.add(incident.gazette);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [incidents]);

  const handleGazetteChange = (value) => {
    setSelectedGazette(value);
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("gazette");
    } else {
      params.set("gazette", value);
    }
    setSearchParams(params);
  };

  const filteredIncidents = incidents.filter((incident) => {
    if (selectedGazette === "all") return true;
    return incident.gazette === selectedGazette;
  });

  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    const statusDiff =
      STATUS_ORDER.indexOf(a.incident.status || "open") -
      STATUS_ORDER.indexOf(b.incident.status || "open");
    if (statusDiff !== 0) return statusDiff;
    const severityDiff =
      SEVERITY_ORDER.indexOf(a.incident.severity || "medium") -
      SEVERITY_ORDER.indexOf(b.incident.severity || "medium");
    if (severityDiff !== 0) return severityDiff;
    return b.createdAt - a.createdAt;
  });

  const activeIncidents = sortedIncidents.filter(
    (incident) => incident.incident.status !== "resolved"
  );
  const resolvedIncidents = sortedIncidents.filter(
    (incident) => incident.incident.status === "resolved"
  );

  const handleViewOnMap = (location) => {
    if (location && location.lat && location.lng) {
      setMapCenter([location.lat, location.lng]);
      setMapZoom(16);
      setViewMode("map");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLocationContribution = (post) => {
    setLocationModalPost(post);
  };

  const handleLocationModalClose = () => {
    setLocationModalPost(null);
  };

  const handleLocationSuccess = async () => {
    // Reload incidents to reflect the updated location
    const { data, error: supabaseError } = await getSupabase()
      .from("posts")
      .select("*, users(id, display_name, metadata)")
      .eq("metadata->>subtype", "incident")
      .order("created_at", { ascending: false });

    if (!supabaseError && data) {
      const activePosts = (data || [])
        .filter((post) => !isDeleted(post))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));

      const normalized = activePosts
        .map((post) => {
          const incident = getPostIncident(post);
          if (!incident) return null;
          return {
            id: post.id,
            title: getPostTitle(post),
            subtitle: getPostSubtitle(post),
            gazette: getPostGazette(post),
            authorName: getDisplayName(post.users) || "Anonyme",
            createdAt: new Date(post.created_at),
            incident,
            location: post.metadata?.location || null,
            metadata: post.metadata,
          };
        })
        .filter(Boolean);

      setIncidents(normalized);
    }
  };

  const renderIncidentCard = (item) => {
    const { incident } = item;
    const nextUpdate = incident.nextUpdate
      ? new Date(incident.nextUpdate).toLocaleString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const latestModifier = getLatestModifier(item.metadata, item);

    return (
      <article key={item.id} className="border border-red-200 bg-white/80 p-4  shadow-sm space-y-3">
        <header>
          <div className="text-xs uppercase tracking-wide text-red-700 font-semibold">
            {item.gazette ? `Gazette: ${item.gazette}` : "Incident interne"}
          </div>
          <h3 className="text-2xl font-['Playfair_Display'] text-[#2c241b]">{item.title}</h3>
          {item.subtitle && <p className="italic text-[#4b3c2f]">{item.subtitle}</p>}
        </header>
        <dl className="text-sm text-[#2c241b] space-y-1">
          <div>
            <dt className="font-semibold inline">📅 Créé le:</dt>{" "}
            <dd className="inline">{item.createdAt.toLocaleString("fr-FR")}</dd>
          </div>
          <div>
            <dt className="font-semibold inline">⚠️ Statut:</dt>{" "}
            <dd className="inline">{STATUS_LABELS[incident.status] || incident.status || "--"}</dd>
          </div>
          <div>
            <dt className="font-semibold inline">🔥 Sévérité:</dt>{" "}
            <dd className="inline">
              {SEVERITY_LABELS[incident.severity] || incident.severity || "--"}
            </dd>
          </div>
          {incident.impact && (
            <div>
              <dt className="font-semibold inline">🌐 Impact:</dt>{" "}
              <dd className="inline">{incident.impact}</dd>
            </div>
          )}
          {incident.contact && (
            <div>
              <dt className="font-semibold inline">👤 Contact:</dt>{" "}
              <dd className="inline">{incident.contact}</dd>
            </div>
          )}
          {nextUpdate && (
            <div>
              <dt className="font-semibold inline">⏰ Prochaine mise à jour:</dt>{" "}
              <dd className="inline">{nextUpdate}</dd>
            </div>
          )}
        </dl>
        <div className="text-sm text-[#4b3c2f] flex flex-wrap gap-2 items-center">
          <span>Auteur : {item.authorName}</span>
          {latestModifier && latestModifier.id !== item.authorId && (
            <span>• Mis à jour par {latestModifier.displayName}</span>
          )}
          {item.location && item.location.lat ? (
            <>
              <button
                onClick={() => handleViewOnMap(item.location)}
                className="text-xs bg-[#2c241b] text-[#f4e4bc] px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
              >
                Voir sur la carte
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLocationContribution(item)}
                  className="text-xs border border-[#2c241b] text-[#2c241b] px-2 py-0.5 rounded hover:bg-[#2c241b] hover:text-[#f4e4bc] transition-colors"
                  title="Suggérer une correction de lieu"
                >
                  ✏️ Corriger
                </button>
                {currentUser &&
                  (currentUser.id === item.authorId ||
                    (item.gazette && editorGazettes.includes(item.gazette))) && (
                    <button
                      onClick={() => navigate(`/incidents/${item.id}/edit`)}
                      className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded"
                    >
                      Modifier
                    </button>
                  )}
              </div>
            </>
          ) : (
            <button
              onClick={() => handleLocationContribution(item)}
              className="text-xs bg-accent text-white px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
              title="Indiquer le lieu de cet incident"
            >
              📍 Je sais où c'est !
            </button>
          )}
        </div>
        {item.metadata?.locationContributedBy && (
          <div className="text-xs text-gray-500 italic mt-1">
            Localisation fournie par {item.metadata.locationContributedBy.displayName}
          </div>
        )}
        <div>
          <Link
            to={`/incidents/${item.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2c241b] underline"
          >
            📄 Consulter l'incident
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbeee2] text-[#2c241b] font-serif p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-[#fffaf3] border border-[#ebd1b5] shadow-lg p-6 space-y-6">
        <header className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.3em]">Pertitellu</p>
          <h1 className="text-4xl font-['Cinzel'] tracking-[0.2em]">Centre Incidents</h1>
          <p className="italic text-lg text-[#4b3c2f]">
            Suivi en temps réel des incidents déclarés sur la plateforme
          </p>
        </header>

        {gazetteOptions.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center justify-center font-sans text-sm">
            <span className="uppercase tracking-wide text-[#4b3c2f]">Filtrer par Gazette :</span>
            <button
              type="button"
              className={`px-3 py-1 border border-[#2c241b] rounded-full transition ${
                selectedGazette === "all" ? "bg-[#2c241b] text-[#f4e4bc]" : "bg-transparent"
              }`}
              onClick={() => handleGazetteChange("all")}
            >
              Toutes
            </button>
            {gazetteOptions.map((gazette) => (
              <button
                key={gazette}
                type="button"
                className={`px-3 py-1 border border-[#2c241b] rounded-full transition ${
                  selectedGazette === gazette ? "bg-[#2c241b] text-[#f4e4bc]" : "bg-transparent"
                }`}
                onClick={() => handleGazetteChange(gazette)}
              >
                {gazette}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end mb-4">
          {currentUser && (
            <div className="mr-2">
              <button
                onClick={() => navigate("/incidents/new")}
                className="px-3 py-1 bg-accent text-white rounded"
              >
                Déclarer un incident
              </button>
            </div>
          )}
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 text-sm font-medium border border-gray-900 rounded-l-lg ${
                viewMode === "list"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-900 hover:bg-gray-100"
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 text-sm font-medium border border-gray-900 border-l-0 rounded-r-lg ${
                viewMode === "map"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-900 hover:bg-gray-100"
              }`}
            >
              Carte
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center italic">Chargement des incidents...</div>
        ) : error ? (
          <div className="text-center text-red-700 font-semibold">{error}</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center italic">Aucun incident trouvé pour ce filtre.</div>
        ) : viewMode === "map" ? (
          <div className="h-[600px] w-full border border-[#ebd1b5]  overflow-hidden shadow-inner">
            <CitizenMap center={mapCenter} zoom={mapZoom}>
              <IncidentsLayer incidents={filteredIncidents} />
            </CitizenMap>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-2xl font-['Playfair_Display'] mb-4">Incidents actifs</h2>
              {activeIncidents.length === 0 ? (
                <p className="italic text-sm text-[#4b3c2f]">Pas d'incident en cours.</p>
              ) : (
                <div className="grid gap-4">{activeIncidents.map(renderIncidentCard)}</div>
              )}
            </section>
            <section>
              <h2 className="text-2xl font-['Playfair_Display'] mb-4">Incidents résolus</h2>
              {resolvedIncidents.length === 0 ? (
                <p className="italic text-sm text-[#4b3c2f]">Pas d'incident résolu enregistré.</p>
              ) : (
                <div className="grid gap-4">{resolvedIncidents.map(renderIncidentCard)}</div>
              )}
            </section>
          </div>
        )}

        <div className="text-center text-sm font-sans">
          <Link to="/social?tab=posts" className="underline">
            ← Retourner au Café social
          </Link>
        </div>
      </div>

      {locationModalPost && (
        <LocationContributionModal
          post={locationModalPost}
          onClose={handleLocationModalClose}
          onSuccess={handleLocationSuccess}
        />
      )}
    </div>
  );
}
