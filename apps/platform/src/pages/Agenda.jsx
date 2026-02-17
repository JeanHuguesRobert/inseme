import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import {
  isDeleted,
  getPostTitle,
  getPostSubtitle,
  enrichUserMetadata,
  getDisplayName,
} from "@inseme/cop-host";
import { getPostEvent, getPostGazette } from "../lib/postPredicates.js";
import { CitizenMap, EventsLayer, LocationContributionModal } from "@inseme/brique-map";

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Agenda() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGazette = searchParams.get("gazette") || "all";
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const handleCelebrate = (e) => {
      const { level } = e.detail;
      setNotification({ type: "celebrate", level });
      setTimeout(() => setNotification(null), level === "imperial" ? 5000 : 2000);
    };

    const handleBell = () => {
      setNotification({ type: "bell" });
      setTimeout(() => setNotification(null), 3000);
    };

    window.addEventListener("inseme:celebrate", handleCelebrate);
    window.addEventListener("inseme:bell_ring", handleBell);
    return () => {
      window.removeEventListener("inseme:celebrate", handleCelebrate);
      window.removeEventListener("inseme:bell_ring", handleBell);
    };
  }, []);
  const [viewMode, setViewMode] = useState("list"); // "list" or "map"
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [locationModalPost, setLocationModalPost] = useState(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedGazette, setSelectedGazette] = useState(null);
  const HISTORY_PAGE_SIZE = 6;

  useEffect(() => {
    setSelectedGazette(initialGazette);
  }, [initialGazette]);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: supabaseError } = await getSupabase()
          .from("posts")
          .select("*, users(id, display_name, metadata)")
          .eq("metadata->>subtype", "event")
          .order("created_at", { ascending: true });
        if (supabaseError) throw supabaseError;
        const activePosts = (data || [])
          .filter((post) => !isDeleted(post))
          .map((post) => ({
            ...post,
            users: enrichUserMetadata(post.users),
          }));
        const normalizedEvents = activePosts
          .map((post) => {
            const eventData = getPostEvent(post);
            if (!eventData?.date) return null;
            const eventDate = new Date(eventData.date);
            if (Number.isNaN(eventDate.getTime())) return null;
            return {
              id: post.id,
              title: getPostTitle(post),
              subtitle: getPostSubtitle(post),
              gazette: getPostGazette(post),
              authorName: getDisplayName(post.users) || "Anonyme",
              eventDate,
              location: eventData.location || null,
              duration: eventData.duration || null,
              metadata: eventData,
            };
          })
          .filter(Boolean);
        setEvents(normalizedEvents);
      } catch (err) {
        console.error("Erreur chargement agenda:", err);
        setError("Impossible de charger les événements. Réessayez plus tard.");
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const gazetteOptions = useMemo(() => {
    const set = new Set();
    events.forEach((event) => {
      if (event.gazette) set.add(event.gazette);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

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

  const filteredEvents = events.filter((event) => {
    if (selectedGazette === "all") return true;
    return event.gazette === selectedGazette;
  });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const upcomingEvents = filteredEvents
    .filter((event) => event.eventDate >= now)
    .sort((a, b) => a.eventDate - b.eventDate);

  const allPastEvents = filteredEvents
    .filter((event) => event.eventDate < now)
    .sort((a, b) => b.eventDate - a.eventDate);

  // Recent past events (within last week)
  const recentPastEvents = allPastEvents.filter((event) => event.eventDate >= oneWeekAgo);

  // Older events (more than 1 week ago)
  const olderPastEvents = allPastEvents.filter((event) => event.eventDate < oneWeekAgo);

  // Pagination for full history view
  const totalHistoryPages = Math.ceil(allPastEvents.length / HISTORY_PAGE_SIZE);
  const paginatedPastEvents = showFullHistory
    ? allPastEvents.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
    : recentPastEvents;

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
    // Reload events to reflect the updated location
    const { data, error: supabaseError } = await getSupabase()
      .from("posts")
      .select("*, users(id, display_name, metadata)")
      .eq("metadata->>subtype", "event")
      .order("created_at", { ascending: true });

    if (!supabaseError && data) {
      const activePosts = (data || [])
        .filter((post) => !isDeleted(post))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));

      const normalizedEvents = activePosts
        .map((post) => {
          const eventData = getPostEvent(post);
          if (!eventData?.date) return null;
          const eventDate = new Date(eventData.date);
          if (Number.isNaN(eventDate.getTime())) return null;
          return {
            id: post.id,
            title: getPostTitle(post),
            subtitle: getPostSubtitle(post),
            gazette: getPostGazette(post),
            authorName: getDisplayName(post.users) || "Anonyme",
            eventDate,
            location: eventData.location || null,
            duration: eventData.duration || null,
            metadata: post.metadata,
          };
        })
        .filter(Boolean);

      setEvents(normalizedEvents);
    }
  };

  const renderEventCard = (event) => (
    <article
      key={event.id}
      className="border border-[#d4c49c] bg-white/70 p-4  shadow-sm space-y-2"
    >
      <header>
        <div className="text-sm uppercase tracking-wide text-[#8f6d3f] font-semibold">
          {event.gazette ? `Gazette: ${event.gazette}` : "Hors gazette"}
        </div>
        <h3 className="text-2xl font-['Playfair_Display'] text-[#2c241b]">{event.title}</h3>
        {event.subtitle && <p className="italic text-[#4b3c2f]">{event.subtitle}</p>}
      </header>
      <dl className="text-sm text-[#2c241b] space-y-1">
        <div>
          <dt className="font-semibold inline">📅 Date:</dt>{" "}
          <dd className="inline">{formatDate(event.eventDate)}</dd>
        </div>
        <div>
          <dt className="font-semibold inline">🕒 Heure:</dt>{" "}
          <dd className="inline">{formatTime(event.eventDate)}</dd>
        </div>
        {event.location && (
          <div>
            <dt className="font-semibold inline">📍 Lieu:</dt>{" "}
            <dd className="inline">{event.metadata?.location?.address || event.location}</dd>
            <div className="inline-flex gap-2 ml-2">
              {event.metadata?.location?.lat ? (
                <>
                  <button
                    onClick={() => handleViewOnMap(event.metadata.location)}
                    className="text-xs bg-[#2c241b] text-[#f4e4bc] px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                  >
                    Voir sur la carte
                  </button>
                  <button
                    onClick={() => handleLocationContribution(event)}
                    className="text-xs border border-[#2c241b] text-[#2c241b] px-2 py-0.5 rounded hover:bg-[#2c241b] hover:text-[#f4e4bc] transition-colors"
                    title="Suggérer une correction de lieu"
                  >
                    ✏️ Corriger
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleLocationContribution(event)}
                  className="text-xs bg-accent text-white px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                  title="Indiquer le lieu de cet événement"
                >
                  📍 Je sais où c'est !
                </button>
              )}
            </div>
          </div>
        )}
        {event.metadata?.locationContributedBy && (
          <div className="text-xs text-gray-500 italic mt-1">
            Localisation fournie par {event.metadata.locationContributedBy.displayName}
          </div>
        )}
        {event.duration && (
          <div>
            <dt className="font-semibold inline">⏱️ Durée:</dt>{" "}
            <dd className="inline">{event.duration}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold inline">✍️ Auteur:</dt>{" "}
          <dd className="inline">{event.authorName}</dd>
        </div>
      </dl>
      <div>
        <Link
          to={`/social?tab=posts&linkedType=post&linkedId=${event.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2c241b] underline"
        >
          ☕ Voir la discussion
        </Link>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#f4e4bc] text-[#2c241b] font-serif p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-[#fdf7e3] border border-[#d4c49c] shadow-lg p-6 space-y-6">
        <header className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.3em]">Pertitellu</p>
          <h1 className="text-4xl font-['Cinzel'] tracking-[0.2em]">Agenda citoyen</h1>
          <p className="italic text-lg text-[#4b3c2f]">
            Toutes les publications de type événement, classées par Gazette
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
          <div className="text-center italic">Chargement des événements...</div>
        ) : error ? (
          <div className="text-center text-red-700 font-semibold">{error}</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center italic">Aucun événement trouvé pour ce filtre.</div>
        ) : viewMode === "map" ? (
          <div className="h-[600px] w-full border border-[#d4c49c]  overflow-hidden shadow-inner">
            <CitizenMap center={mapCenter} zoom={mapZoom}>
              <EventsLayer events={filteredEvents} />
            </CitizenMap>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-2xl font-['Playfair_Display'] mb-4">À venir</h2>
              {upcomingEvents.length === 0 ? (
                <p className="italic text-sm text-[#4b3c2f]">Pas d'événement à venir.</p>
              ) : (
                <div className="grid gap-4">{upcomingEvents.map(renderEventCard)}</div>
              )}
            </section>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-['Playfair_Display']">
                  {showFullHistory ? "Historique complet" : "Passés récemment"}
                </h2>
                {allPastEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullHistory(!showFullHistory);
                      setHistoryPage(1);
                    }}
                    className="text-sm font-sans px-3 py-1 border border-[#2c241b] rounded-full hover:bg-[#2c241b] hover:text-[#f4e4bc] transition"
                  >
                    {showFullHistory ? "← Voir récents" : `📚 Voir tout (${allPastEvents.length})`}
                  </button>
                )}
              </div>

              {paginatedPastEvents.length === 0 ? (
                <p className="italic text-sm text-[#4b3c2f]">
                  {showFullHistory
                    ? "Pas d'événement passé enregistré."
                    : "Aucun événement passé cette semaine."}
                </p>
              ) : (
                <>
                  <div className="grid gap-4">{paginatedPastEvents.map(renderEventCard)}</div>

                  {/* Show hint about older events when not in full history mode */}
                  {!showFullHistory && olderPastEvents.length > 0 && (
                    <p className="text-center text-sm text-[#4b3c2f] mt-4 italic">
                      {olderPastEvents.length} événement{olderPastEvents.length > 1 ? "s" : ""} plus
                      ancien{olderPastEvents.length > 1 ? "s" : ""} masqué
                      {olderPastEvents.length > 1 ? "s" : ""}.{" "}
                      <button
                        type="button"
                        onClick={() => setShowFullHistory(true)}
                        className="underline hover:text-[#2c241b]"
                      >
                        Afficher l'historique complet
                      </button>
                    </p>
                  )}

                  {/* Pagination controls for full history */}
                  {showFullHistory && totalHistoryPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-6 font-sans">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-3 py-1 border border-[#2c241b] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2c241b] hover:text-[#f4e4bc] transition"
                      >
                        ← Précédent
                      </button>
                      <span className="text-sm">
                        Page {historyPage} / {totalHistoryPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage === totalHistoryPages}
                        className="px-3 py-1 border border-[#2c241b] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2c241b] hover:text-[#f4e4bc] transition"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        <div className="text-center text-sm font-sans">
          <Link to="/gazette" className="underline">
            ← Retourner à la Gazette
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
