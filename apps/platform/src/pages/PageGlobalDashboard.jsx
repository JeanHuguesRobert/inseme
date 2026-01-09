import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import SiteFooter from "../components/layout/SiteFooter";

// Define StatCard component for key metrics
const StatCard = ({ title, value, color, textColor = "text-bauhaus-white" }) => (
  <div
    className={`${color} border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6 flex flex-col items-center justify-center`}
  >
    <p
      className="text-sm font-medium  mb-1"
      style={{ color: textColor === "text-bauhaus-black" ? "#121212" : "#F0F0F0" }}
    >
      {title}
    </p>
    <p className={`text-4xl font-bold ${textColor}`}>{value || 0}</p>
  </div>
);

const COLORS = ["#0A3F73", "#F54928", "#66BB6A", "#FFA726", "#42A5F5"]; // Original colors, might need adjustment for dark theme

export default function GlobalDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState({
    votes: [],
    propositions: [],
    wikiEdits: [],
  }); // State for recent activity

  useEffect(() => {
    loadGlobalStats();
  }, []);

  const loadGlobalStats = async () => {
    try {
      setLoading(true);

      // Get total users
      const { count: totalUsers } = await getSupabase()
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get total propositions
      const { count: totalPropositions } = await getSupabase()
        .from("propositions")
        .select("*", { count: "exact", head: true });

      // Get total votes
      const { count: totalVotes } = await getSupabase()
        .from("votes")
        .select("*", { count: "exact", head: true });

      // Get total delegations
      const { count: totalDelegations } = await getSupabase()
        .from("delegations")
        .select("*", { count: "exact", head: true });

      // Get total wiki pages
      const { count: totalWikiPages } = await getSupabase()
        .from("wiki_pages")
        .select("*", { count: "exact", head: true });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentPropositions } = await getSupabase()
        .from("propositions")
        .select("id, title, created_at, author:profiles(display_name)")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: recentVotes } = await getSupabase()
        .from("votes")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      const { data: recentWikiEdits } = await getSupabase()
        .from("wiki_revisions")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Calculate activity over time (last 7 days)
      const activityData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Note: This is an approximation as we only fetched recent items.
        // For accurate daily counts, we'd need to query the DB for each day or fetch all recent items.
        // Assuming we fetched enough recent items above (we didn't limit votes/wiki edits, but limited props).
        // Actually, we should probably fetch counts for the graph separately or fetch more data.
        // For now, let's use what we have, acknowledging it might be incomplete if volume is high.

        // Re-fetching full recent lists for accurate graph
        const { count: dayPropositionsCount } = await getSupabase()
          .from("propositions")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString());

        const { count: dayVotesCount } = await getSupabase()
          .from("votes")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString());

        const { count: dayWikiEditsCount } = await getSupabase()
          .from("wiki_revisions")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString());

        activityData.push({
          date: date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
          propositions: dayPropositionsCount || 0,
          votes: dayVotesCount || 0,
          wikiEdits: dayWikiEditsCount || 0,
        });
      }

      // Get proposition status distribution
      const { data: propositionStatuses } = await getSupabase()
        .from("propositions")
        .select("status");

      const statusCounts = {};
      propositionStatuses?.forEach((p) => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts).map(([status, count]) => ({
        name:
          status === "active"
            ? "Actives"
            : status === "accepted"
              ? "Acceptées"
              : status === "rejected"
                ? "Rejetées"
                : status === "draft"
                  ? "Brouillons"
                  : status,
        value: count,
      }));

      // Get most active users (top 10 by proposition count)
      const { data: userActivity } = await getSupabase()
        .from("propositions")
        .select(
          `
          author_id,
          profiles!inner(display_name)
        `
        )
        .then(({ data }) => {
          const userCounts = {};
          data?.forEach((p) => {
            const userId = p.author_id;
            const userName = p.profiles?.display_name || "Anonyme";
            userCounts[userId] = {
              name: userName,
              count: (userCounts[userId]?.count || 0) + 1,
            };
          });
          return Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        });

      // Fetch recent votes for the new section
      const { data: latestVotes, error: votesError } = await getSupabase()
        .from("votes")
        .select(
          `
          id,
          vote_value,
          created_at,
          propositions (id, title),
          user:profiles (display_name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (votesError) {
        console.error("Error fetching latest votes:", votesError);
      }

      setStats({
        totalUsers,
        totalPropositions,
        totalVotes,
        totalDelegations,
        totalWikiPages,
        activityTimeline: activityData,
        statusData,
        topUsers: userActivity || [],
      });

      setRecentActivity({
        votes: latestVotes || [],
        propositions: recentPropositions || [],
        wikiEdits: recentWikiEdits || [],
      });
    } catch (error) {
      console.error("Error loading global stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bauhaus-blue"></div>
          <p className="text-bauhaus-white mt-4">Chargement des statistiques globales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bauhaus-black text-bauhaus-white">
      <header className="bg-bauhaus-black shadow-[0px_4px_0px_0px_#F0F0F0] border-b-3 border-bauhaus-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-bauhaus-white font-bauhaus uppercase">
                Tableau de bord global
              </h1>
              <p className="text-bauhaus-white text-opacity-75">
                Statistiques générales de la plateforme Kudocracy
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/user-dashboard"
                className="px-4 py-2 bg-bauhaus-green text-bauhaus-black font-bold  border-2 border-bauhaus-black hover:bg-green-500 shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Votre tableau de bord
              </Link>
              <Link
                to="/wiki/dashboard"
                className="px-4 py-2 bg-bauhaus-yellow text-bauhaus-black font-bold  border-2 border-bauhaus-black hover:bg-yellow-500 shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Vos contributions Wiki
              </Link>
              <Link
                to="/social-dashboard"
                className="px-4 py-2 bg-bauhaus-red text-bauhaus-black font-bold  border-2 border-bauhaus-black hover:bg-red-500 shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Vos contributions sociales
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard title="Utilisateurs" value={stats.totalUsers} color="bg-bauhaus-blue" />
          <StatCard title="Propositions" value={stats.totalPropositions} color="bg-bauhaus-green" />
          <StatCard
            title="Votes"
            value={stats.totalVotes}
            color="bg-bauhaus-yellow"
            textColor="text-bauhaus-black"
          />
          <StatCard title="Délégations" value={stats.totalDelegations} color="bg-bauhaus-red" />
          <StatCard title="Pages Wiki" value={stats.totalWikiPages} color="bg-gray-800" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h3 className="text-xl font-bold text-bauhaus-white mb-6 uppercase">
              Activité récente (7 derniers jours)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.activityTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#F0F0F0" />
                  <YAxis stroke="#F0F0F0" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#121212",
                      border: "2px solid #F0F0F0",
                      color: "#F0F0F0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="#2D58B8"
                    strokeWidth={2}
                    name="Votes"
                  />
                  <Line
                    type="monotone"
                    dataKey="propositions"
                    stroke="#F2C94C"
                    strokeWidth={2}
                    name="Propositions"
                  />
                  <Line
                    type="monotone"
                    dataKey="wikiEdits"
                    stroke="#66BB6A"
                    strokeWidth={2}
                    name="Éditions Wiki"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h3 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">Derniers votes</h3>
            {recentActivity.votes.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.votes.map((vote) => (
                  <div key={vote.id} className="border-2 border-bauhaus-white p-3 bg-bauhaus-black">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          to={`/propositions/${vote.propositions?.id}`}
                          className="text-bauhaus-blue hover:text-bauhaus-white font-bold  block mb-1"
                        >
                          {vote.propositions?.title}
                        </Link>
                        <p className="text-sm text-gray-400">
                          Par {vote.user?.display_name || "Anonyme"}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-bold  border-2 border-black ${
                          vote.vote_value === true
                            ? "bg-bauhaus-green text-black"
                            : vote.vote_value === false
                              ? "bg-bauhaus-red text-bauhaus-white"
                              : "bg-gray-200 text-black"
                        }`}
                      >
                        {vote.vote_value === true
                          ? "POUR"
                          : vote.vote_value === false
                            ? "CONTRE"
                            : "BLANC"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">Aucun vote récent</p>
            )}
          </div>
        </div>

        {/* Proposition Status and Top Contributors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Statut des propositions
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stats?.statusData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(stats?.statusData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#121212",
                    border: "2px solid #F0F0F0",
                    color: "#F0F0F0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Contributeurs les plus actifs
            </h2>
            <div className="space-y-3">
              {stats?.topUsers?.map((user, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-bauhaus-blue rounded-full flex items-center justify-center text-bauhaus-black font-semibold text-sm mr-3">
                      {index + 1}
                    </div>
                    <span className="font-medium text-bauhaus-white">{user.name}</span>
                  </div>
                  <span className="text-gray-400">
                    {user.count} proposition{user.count > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
