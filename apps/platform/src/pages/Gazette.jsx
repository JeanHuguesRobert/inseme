import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { isDeleted, enrichUserMetadata } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import GazetteLayout from "../components/gazette/GazetteLayout";
import GazettePost from "../components/gazette/GazettePost";
import { isEventPost, getPostEvent } from "../lib/postPredicates.js";
import { getConfig } from "../common/config/instanceConfig.client.js";

// Collapsible help banner for editors
function CollapsibleHelpBanner({ gazetteName }) {
  const [isOpen, setIsOpen] = useState(() => {
    // Check localStorage to see if banner was previously closed
    const stored = localStorage.getItem(`gazette-help-${gazetteName}`);
    return stored !== "closed";
  });

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(`gazette-help-${gazetteName}`, "closed");
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mb-4 text-sm text-[#2c241b] underline hover:no-underline font-sans break-inside-avoid-column"
      >
        💡 Afficher l'aide éditeur
      </button>
    );
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 font-sans text-sm break-inside-avoid-column">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-bold text-blue-900">💡 Guide de l'éditeur</h3>
        <button
          onClick={handleClose}
          className="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      <ul className="text-blue-800 space-y-1 text-xs sm:text-sm">
        <li>✍️ Cliquez sur "Rédiger un article" en haut pour créer un article</li>
        <li>📝 Utilisez le format Markdown pour formater votre texte</li>
        <li>✏️ Cliquez sur [Modifier] sur vos articles pour les éditer</li>
        <li>🗑️ Cliquez sur [Supprimer] pour retirer un article de la Gazette</li>
      </ul>
    </div>
  );
}

// Helper to get the Monday of the week for a given date
function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper to format date range
function formatDateRange(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);

  const options = { day: "numeric", month: "long" };
  const startStr = startDate.toLocaleDateString("fr-FR", options);
  const endStr = end.toLocaleDateString("fr-FR", { ...options, year: "numeric" });

  return `Semaine du ${startStr} au ${endStr}`;
}

export default function Gazette() {
  const { name } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const gazetteName = name || "global";
  const { currentUser } = useCurrentUser();
  const [isEditor, setIsEditor] = useState(false);
  const [editorGroupId, setEditorGroupId] = useState(null);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    loadPosts();
    checkEditorStatus();
  }, [gazetteName, currentUser]);

  async function checkEditorStatus() {
    if (!currentUser) {
      setIsEditor(false);
      return;
    }

    try {
      // Determine target group name
      let targetGroupName = gazetteName;
      if (gazetteName === "global") {
        targetGroupName = getConfig(
          "global_gazette_editor_group",
          import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette"
        );
      }

      // Find group by name (case insensitive matching could be better but let's stick to exact for now as per request)
      const { data: group } = await getSupabase()
        .from("groups")
        .select("id")
        .eq("name", targetGroupName)
        .single();

      if (group) {
        // Check membership
        const { data: member } = await getSupabase()
          .from("group_members")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", currentUser.id)
          .single();

        if (member) setIsEditor(true);
        setEditorGroupId(group.id);
      }
    } catch (err) {
      console.error("Error checking editor status:", err);
    }
  }

  // Update selected week from URL or default to latest
  useEffect(() => {
    const weekParam = searchParams.get("week");
    if (weekParam) {
      setSelectedWeek(weekParam);
    } else if (weeks.length > 0 && !selectedWeek) {
      // Default to the most recent week
      setSelectedWeek(weeks[0].dateString);
    }
  }, [weeks, searchParams, selectedWeek]);

  async function loadPosts() {
    try {
      setLoading(true);

      const { data, error } = await getSupabase()
        .from("posts")
        .select("*, users(id, display_name, metadata)")
        .eq("metadata->>gazette", gazetteName)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filter deleted and enrich user metadata
      const activePosts = (data || [])
        .filter((p) => !isDeleted(p))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));

      // Group posts by week
      const postsByWeek = {};
      activePosts.forEach((post) => {
        const date = new Date(post.created_at);
        const monday = getMonday(date);

        // Create a stable key based on local date string YYYY-MM-DD
        const year = monday.getFullYear();
        const month = String(monday.getMonth() + 1).padStart(2, "0");
        const day = String(monday.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        if (!postsByWeek[dateString]) {
          postsByWeek[dateString] = {
            timestamp: monday.getTime(), // Keep timestamp for sorting
            posts: [],
          };
        }
        postsByWeek[dateString].posts.push(post);
      });

      // Create weeks array for selector
      const sortedWeeks = Object.keys(postsByWeek)
        .map((dateString) => ({
          dateString,
          timestamp: postsByWeek[dateString].timestamp,
          label: formatDateRange(new Date(postsByWeek[dateString].timestamp)),
          posts: postsByWeek[dateString].posts,
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Descending order

      setWeeks(sortedWeeks);
      setPosts(activePosts); // Keep all posts in state if needed, but we use weeks mostly
    } catch (err) {
      console.error("Error loading gazette posts:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleWeekChange = (dateString) => {
    setSelectedWeek(dateString);
    setSearchParams({ week: dateString });
  };

  const parseWeekDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split("-").map(Number);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
    return new Date(year, month - 1, day);
  };

  if (loading) {
    return (
      <GazetteLayout
        title={gazetteName === "global" ? "LA GAZETTE" : `GAZETTE: ${gazetteName.toUpperCase()}`}
      >
        <div className="text-center italic">Chargement des nouvelles...</div>
      </GazetteLayout>
    );
  }

  const currentWeekPosts = weeks.find((w) => w.dateString === selectedWeek)?.posts || [];
  const mondayDate = parseWeekDate(selectedWeek);
  const hasUpcomingEvents =
    !!mondayDate &&
    currentWeekPosts.some((post) => {
      if (!isEventPost(post)) return false;
      const eventData = getPostEvent(post);
      if (!eventData?.date) return false;
      const eventDate = new Date(eventData.date);
      if (Number.isNaN(eventDate.getTime())) return false;
      return eventDate.getTime() > mondayDate.getTime();
    });
  const agendaPath =
    gazetteName && gazetteName !== "global"
      ? `/agenda?gazette=${encodeURIComponent(gazetteName)}`
      : "/agenda";
  const agendaButton = hasUpcomingEvents ? (
    <Link
      to={agendaPath}
      className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#2c241b] font-['Playfair_Display'] text-base uppercase tracking-wide bg-transparent hover:bg-[#2c241b] hover:text-[#f4e4bc] transition-colors"
    >
      📅 Agenda
    </Link>
  ) : null;

  return (
    <GazetteLayout
      title={gazetteName === "global" ? "LA GAZETTE" : `GAZETTE: ${gazetteName.toUpperCase()}`}
      isEditor={isEditor}
      gazetteName={gazetteName}
      editorGroupId={editorGroupId}
      weeks={weeks}
      selectedWeek={selectedWeek}
      onWeekChange={handleWeekChange}
      extraHeaderActions={agendaButton}
    >
      {isEditor && <CollapsibleHelpBanner gazetteName={gazetteName} />}

      {weeks.length === 0 ? (
        <div className="text-center italic mt-8">
          <p>Aucune nouvelle à afficher pour le moment.</p>
        </div>
      ) : (
        <>
          {currentWeekPosts.length === 0 ? (
            <div className="text-center italic mt-8">
              <p>Pas de nouvelles pour cette semaine.</p>
            </div>
          ) : (
            currentWeekPosts.map((post) => (
              <GazettePost
                key={post.id}
                post={post}
                isEditor={isEditor}
                gazetteName={gazetteName}
              />
            ))
          )}
        </>
      )}
    </GazetteLayout>
  );
}
