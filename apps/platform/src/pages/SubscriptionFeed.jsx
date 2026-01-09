import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import {
  isDeleted,
  getMetadata,
  enrichUserMetadata,
  getDisplayName,
} from "@inseme/cop-host";
import { useSubscriptionNotifications } from "../lib/useSubscriptionNotifications.js";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Configuration des types de contenu avec icônes et labels
 */
const CONTENT_TYPE_CONFIG = {
  post: {
    icon: "💬",
    label: "Post",
    color: "bg-orange-500/20 text-orange-300",
    route: (id) => `/posts/${id}`,
  },
  proposition: {
    icon: "💡",
    label: "Proposition",
    color: "bg-blue-500/20 text-blue-300",
    route: (id) => `/kudocracy/${id}`,
  },
  wiki_page: {
    icon: "📄",
    label: "Wiki",
    color: "bg-green-500/20 text-green-300",
    route: (id) => `/wiki/${id}`,
  },
  user: {
    icon: "👤",
    label: "Utilisateur",
    color: "bg-purple-500/20 text-purple-300",
    route: (id) => `/users/${id}`,
  },
  group: {
    icon: "👥",
    label: "Groupe",
    color: "bg-teal-500/20 text-teal-300",
    route: (id) => `/groups/${id}`,
  },
  mission: {
    icon: "🎯",
    label: "Mission",
    color: "bg-red-500/20 text-red-300",
    route: (id) => `/missions/${id}`,
  },
  task_project: {
    icon: "📋",
    label: "Projet",
    color: "bg-yellow-500/20 text-yellow-300",
    route: (id) => `/tasks/${id}`,
  },
  fil_item: {
    icon: "📰",
    label: "Le Fil",
    color: "bg-indigo-500/20 text-indigo-300",
    route: (id) => `/posts/${id}`,
  },
  tag: {
    icon: "🏷️",
    label: "Tag",
    color: "bg-pink-500/20 text-pink-300",
    route: (id) => `/social?tag=${id}`,
  },
};

/**
 * Page de gestion des abonnements avec flux d'activité
 */
export default function SubscriptionFeed() {
  const { currentUser, userStatus } = useCurrentUser();
  const { unreadCount, markAsRead, refresh } = useSubscriptionNotifications(currentUser?.id);

  const [subscriptions, setSubscriptions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("feed"); // feed | manage
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (userStatus === "signed_in" && currentUser) {
      loadSubscriptions();
    }
  }, [currentUser, userStatus, filter]);

  async function loadSubscriptions() {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Charger tous les abonnements avec metadata
      let query = getSupabase()
        .from("content_subscriptions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("last_activity_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("content_type", filter);
      }

      const { data: subs, error } = await query;
      if (error) throw error;

      setSubscriptions(subs || []);

      // Charger les détails de contenu pour chaque abonnement
      await loadContentDetails(subs || []);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadContentDetails(subs) {
    if (!subs.length) {
      setActivities([]);
      return;
    }

    const enrichedSubs = [];

    // Grouper par type pour requêtes optimisées
    const byType = subs.reduce((acc, sub) => {
      if (!acc[sub.content_type]) acc[sub.content_type] = [];
      acc[sub.content_type].push(sub);
      return acc;
    }, {});

    // Posts
    if (byType.post?.length) {
      const ids = byType.post.map((s) => s.content_id);
      const { data } = await getSupabase()
        .from("posts")
        .select("id, content, metadata, created_at, users(id, display_name)")
        .in("id", ids);

      byType.post.forEach((sub) => {
        const post = data?.find((p) => p.id === sub.content_id);
        if (post && !isDeleted(post)) {
          enrichedSubs.push({
            ...sub,
            title: getMetadata(post, "title") || post.content?.slice(0, 50) || "Sans titre",
            author: getDisplayName(post.users),
            authorId: post.users?.id,
          });
        }
      });
    }

    // Propositions
    if (byType.proposition?.length) {
      const ids = byType.proposition.map((s) => s.content_id);
      const { data } = await getSupabase()
        .from("propositions")
        .select("id, title, author_id, users(id, display_name)")
        .in("id", ids);

      byType.proposition.forEach((sub) => {
        const prop = data?.find((p) => p.id === sub.content_id);
        if (prop) {
          enrichedSubs.push({
            ...sub,
            title: prop.title,
            author: getDisplayName(prop.users),
            authorId: prop.users?.id,
          });
        }
      });
    }

    // Groupes
    if (byType.group?.length) {
      const ids = byType.group.map((s) => s.content_id);
      const { data } = await getSupabase()
        .from("groups")
        .select("id, name, description")
        .in("id", ids);

      byType.group.forEach((sub) => {
        const group = data?.find((g) => g.id === sub.content_id);
        if (group && !isDeleted(group)) {
          enrichedSubs.push({
            ...sub,
            title: group.name,
            description: group.description,
          });
        }
      });
    }

    // Missions
    if (byType.mission?.length) {
      const ids = byType.mission.map((s) => s.content_id);
      const { data } = await getSupabase()
        .from("groups")
        .select("id, name, description, metadata")
        .in("id", ids)
        .eq("metadata->>type", "mission");

      byType.mission.forEach((sub) => {
        const mission = data?.find((m) => m.id === sub.content_id);
        if (mission) {
          enrichedSubs.push({
            ...sub,
            title: mission.name,
            description: mission.description,
          });
        }
      });
    }

    // Users
    if (byType.user?.length) {
      const ids = byType.user.map((s) => s.content_id);
      const { data } = await getSupabase()
        .from("users")
        .select("id, display_name, metadata")
        .in("id", ids);

      byType.user.forEach((sub) => {
        const user = data?.find((u) => u.id === sub.content_id);
        if (user) {
          enrichedSubs.push({
            ...sub,
            title: getDisplayName(enrichUserMetadata(user)),
          });
        }
      });
    }

    // Ajouter les autres types sans enrichissement
    const handledTypes = ["post", "proposition", "group", "mission", "user"];
    subs.forEach((sub) => {
      if (!handledTypes.includes(sub.content_type)) {
        enrichedSubs.push({
          ...sub,
          title: sub.metadata?.title || `${sub.content_type}:${sub.content_id.slice(0, 8)}`,
        });
      }
    });

    // Trier par activité récente
    enrichedSubs.sort(
      (a, b) =>
        new Date(b.last_activity_at || b.created_at) - new Date(a.last_activity_at || a.created_at)
    );

    setActivities(enrichedSubs);
  }

  async function handleUnsubscribe(contentType, contentId) {
    if (!confirm("Voulez-vous vous désabonner de ce contenu ?")) return;

    try {
      const { error } = await getSupabase()
        .from("content_subscriptions")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (error) throw error;

      loadSubscriptions();
      refresh();
    } catch (err) {
      console.error("Error unsubscribing:", err);
      alert("Erreur lors du désabonnement");
    }
  }

  async function handleMarkRead(sub) {
    await markAsRead(sub.content_type, sub.content_id);
    loadSubscriptions();
  }

  // Loading state
  if (userStatus === "signing_in" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement de vos abonnements...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">🔔</div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Mes abonnements</h2>
          <p className="text-gray-400 mb-6">
            Connectez-vous pour suivre les contenus qui vous intéressent
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const filterButtons = [
    { key: "all", label: "Tous", color: "bg-gray-600" },
    { key: "post", label: "💬 Posts", color: "bg-orange-600" },
    { key: "proposition", label: "💡 Propositions", color: "bg-blue-600" },
    { key: "group", label: "👥 Groupes", color: "bg-teal-600" },
    { key: "mission", label: "🎯 Missions", color: "bg-red-600" },
    { key: "user", label: "👤 Utilisateurs", color: "bg-purple-600" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-50 flex items-center gap-3">
                🔔 Mes abonnements
                {unreadCount > 0 && (
                  <span className="px-2 py-1 text-sm bg-red-600 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-gray-400 mt-1">
                {subscriptions.length} abonnement{subscriptions.length !== 1 ? "s" : ""} actif
                {subscriptions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === "feed"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              📰 Flux d'activité
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === "manage"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              ⚙️ Gérer
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {filterButtons.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                filter === key
                  ? `${color} text-white`
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activities.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 mb-4">
              {filter === "all"
                ? "Vous n'êtes abonné à aucun contenu"
                : `Aucun abonnement de type "${CONTENT_TYPE_CONFIG[filter]?.label}"`}
            </p>
            <Link
              to="/social"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Explorer les contenus
            </Link>
          </div>
        ) : activeTab === "feed" ? (
          /* Feed View */
          <div className="space-y-3">
            {activities.map((sub) => {
              const config = CONTENT_TYPE_CONFIG[sub.content_type] || {
                icon: "📌",
                label: sub.content_type,
                color: "bg-gray-500/20 text-gray-300",
                route: () => "#",
              };
              const unread = parseInt(sub.metadata?.unread_count) || 0;
              const lastActivity = sub.metadata?.last_activity;

              return (
                <div
                  key={sub.id}
                  className={`p-4 border rounded transition-colors ${
                    unread > 0
                      ? "border-blue-500/50 bg-blue-900/10"
                      : "border-gray-700 bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">
                            {unread} nouveau{unread > 1 ? "x" : ""}
                          </span>
                        )}
                      </div>

                      <Link
                        to={config.route(sub.content_id)}
                        className="text-lg font-medium text-gray-100 hover:text-blue-400 line-clamp-1"
                        onClick={() => unread > 0 && handleMarkRead(sub)}
                      >
                        {sub.title}
                      </Link>

                      {lastActivity && (
                        <p className="text-sm text-gray-400 mt-1">
                          {lastActivity.actor && (
                            <span className="font-medium">{lastActivity.actor}</span>
                          )}
                          {lastActivity.type === "comment" && " a commenté"}
                          {lastActivity.type === "update" && " a mis à jour"}
                          {lastActivity.preview && `: "${lastActivity.preview}..."`}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-1">
                        Dernière activité :{" "}
                        {new Date(sub.last_activity_at || sub.created_at).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>

                    <Link
                      to={config.route(sub.content_id)}
                      className="px-3 py-1 text-sm bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
                      onClick={() => unread > 0 && handleMarkRead(sub)}
                    >
                      Voir →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Manage View */
          <div className="space-y-2">
            {activities.map((sub) => {
              const config = CONTENT_TYPE_CONFIG[sub.content_type] || {
                icon: "📌",
                label: sub.content_type,
                color: "bg-gray-500/20 text-gray-300",
                route: () => "#",
              };

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 border border-gray-700 rounded bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${config.color}`}>
                      {config.icon}
                    </span>
                    <Link
                      to={config.route(sub.content_id)}
                      className="text-gray-200 hover:text-blue-400"
                    >
                      {sub.title}
                    </Link>
                  </div>

                  <button
                    onClick={() => handleUnsubscribe(sub.content_type, sub.content_id)}
                    className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                  >
                    Se désabonner
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
