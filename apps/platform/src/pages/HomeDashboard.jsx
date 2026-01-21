import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import FeedReader from "../components/federation/FeedReader";
import FeedManager from "../components/federation/FeedManager";
import { Link } from "react-router-dom";

export default function HomeDashboard() {
  const { user } = useCurrentUser(); // JHR, was: useAuth();
  const [activeTab, setActiveTab] = useState("inbox");
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  async function fetchSubscriptions() {
    setLoading(true);
    const { data } = await getSupabase()
      .from("user_feed_subscriptions")
      .select(
        `
        feed:feeds (id, url, title, category)
      `
      )
      .eq("user_id", user.id);

    if (data) {
      const feeds = data.map((d) => d.feed);
      setSubscriptions(feeds);
    }
    setLoading(false);
  }

  if (!user)
    return (
      <div className="p-8 text-center">
        Veuillez vous connecter pour accéder à votre tableau de bord.
      </div>
    );

  const myPublicFeedUrl = `${window.location.origin}/api/feed/activity/${user.id}`;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Mon Tableau de Bord</h1>
          <p className="text-gray-600 dark:text-gray-400">Gérez votre vie citoyenne centralisée.</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gray-500">Mon flux public :</div>
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded select-all">
            {myPublicFeedUrl}
          </code>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b dark:border-gray-700">
        <TabButton active={activeTab === "inbox"} onClick={() => setActiveTab("inbox")}>
          📬 Inbox Unifiée
        </TabButton>
        <TabButton
          active={activeTab === "subscriptions"}
          onClick={() => setActiveTab("subscriptions")}
        >
          📰 Vos Abonnements
        </TabButton>
        <TabButton active={activeTab === "global"} onClick={() => setActiveTab("global")}>
          🌍 Vue Globale
        </TabButton>
        <TabButton active={activeTab === "manager"} onClick={() => setActiveTab("manager")}>
          ⚙️ Gérer les flux
        </TabButton>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "inbox" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800">
              <h3 className="font-bold text-blue-800 dark:text-blue-200">
                Notifications Centralisées
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                Ici s'afficheront vos notifications (mentions, réponses) provenant de toutes les
                instances auxquelles vous êtes connecté. (Fonctionnalité en cours de déploiement)
              </p>
            </div>
            {/* Placeholder for Inbox Feed */}
            <FeedReader feeds={[]} limit={5} />
          </div>
        )}

        {activeTab === "subscriptions" && <FeedReader feeds={subscriptions} limit={10} />}

        {activeTab === "global" && (
          <FeedReader
            feeds={[
              {
                id: "global",
                url: "/api/feed/all",
                title: "Flux Global Citoyen",
                category: "Internal",
              },
            ]}
            limit={20}
          />
        )}

        {activeTab === "manager" && (
          <FeedManager userId={user.id} onSubscriptionsChanged={fetchSubscriptions} />
        )}
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
