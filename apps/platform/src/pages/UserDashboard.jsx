import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { getTaskTitleFromPost, TASK_STATUS_LABELS } from "@inseme/brique-tasks";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import SiteFooter from "../components/layout/SiteFooter";

const COLORS = ["#0A3F73", "#F54928", "#66BB6A", "#FFA726", "#42A5F5"];

export default function UserDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({});
  const [dashboardError, setDashboardError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missionInvolvement, setMissionInvolvement] = useState([]);
  const [taskAssignments, setTaskAssignments] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();
    if (user) {
      setCurrentUser(user);
      loadDashboardData(user);
    } else {
      window.location.href = "/kudocracy";
    }
  };

  const loadDashboardData = async (user) => {
    setLoading(true);

    try {
      const results = await Promise.allSettled([
        getSupabase().from("propositions").select("id").eq("author_id", user.id),
        getSupabase().from("votes").select("id, vote_value, created_at").eq("user_id", user.id),
        getSupabase().from("delegations").select("id").eq("delegator_id", user.id),
        getSupabase().from("posts").select("id").eq("author_id", user.id),
        getSupabase().from("comments").select("id").eq("author_id", user.id),
        getSupabase().from("wiki_pages").select("id").eq("author_id", user.id),
        getSupabase().from("content_subscriptions").select("id").eq("user_id", user.id),
        getSupabase().rpc("count_user_subscribers", { target_user_id: user.id }),
        getSupabase().from("group_members").select("group_id").eq("user_id", user.id),
        getSupabase()
          .from("posts")
          .select("id, content, metadata, updated_at")
          .eq("metadata->>type", "task")
          .contains("metadata->task_details->assignees", [user.id])
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      const [
        propositionsRes,
        votesRes,
        delegationsGivenRes,
        postsRes,
        commentsRes,
        wikiPagesRes,
        subscriptionsRes,
        subscribersRes,
        missionMembershipRes,
        tasksAssignedListRes,
      ] = results;

      // Log errors but don't block the dashboard
      results.forEach((res, index) => {
        if (res.status === "rejected") {
          console.error(`Request ${index} failed:`, res.reason);
        } else if (res.value.error) {
          console.error(`Request ${index} returned error:`, res.value.error);
        }
      });

      // Helper to safely get data
      const getData = (res) =>
        res.status === "fulfilled" && !res.value.error ? res.value.data : [];
      const getCount = (res) =>
        res.status === "fulfilled" && !res.value.error ? res.value.data : 0;

      const propositionsData = getData(propositionsRes);
      const votesData = getData(votesRes);

      const propositionsCreated = propositionsData?.length || 0;
      const votesCast = votesData?.length || 0;
      const delegationsGiven = getData(delegationsGivenRes)?.length || 0;
      const postsCreated = getData(postsRes)?.length || 0;
      const commentsMade = getData(commentsRes)?.length || 0;
      const wikiPages = getData(wikiPagesRes)?.length || 0;
      const subscriptionsCount = getData(subscriptionsRes)?.length || 0;
      const subscribersCount = getCount(subscribersRes);
      const missionMemberships = getData(missionMembershipRes) || [];
      const assignedTasks = getData(tasksAssignedListRes) || [];

      // Activity timeline (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentVotes = votesData?.filter((v) => new Date(v.created_at) >= thirtyDaysAgo) || [];
      const activityData = {};
      recentVotes.forEach((vote) => {
        const date = new Date(vote.created_at).toISOString().split("T")[0];
        activityData[date] = (activityData[date] || 0) + 1;
      });
      const activityTimeline = Object.entries(activityData)
        .map(([date, count]) => ({ date, votes: count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Vote distribution
      const userVotes = votesData || [];
      const approveVotes = userVotes.filter((v) => v.vote_value === true).length;
      const disapproveVotes = userVotes.filter((v) => v.vote_value === false).length;
      const blankVotes = userVotes.filter((v) => v.vote_value === null).length;

      setStats({
        propositionsCreated,
        votesCast,
        delegationsGiven,
        postsCreated,
        commentsMade,
        wikiPages,
        subscriptionsCount,
        subscribersCount,
        voteDistribution: [
          { name: "Pour", value: approveVotes },
          { name: "Contre", value: disapproveVotes },
          { name: "Blanc", value: blankVotes },
        ],
        activityTimeline,
      });

      await loadMissionAndTaskInvolvement(missionMemberships, assignedTasks);
      setDashboardError(null);
    } catch (error) {
      setDashboardError("Erreur critique lors du chargement des données.");
      setStats({});
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMissionAndTaskInvolvement = async (missionMemberships, assignedTasks) => {
    try {
      let missionDetails = [];
      if (missionMemberships.length > 0) {
        const groupIds = missionMemberships.map((row) => row.group_id);
        const { data: missionGroups, error: missionGroupsError } = await getSupabase()
          .from("groups")
          .select("id, name, metadata")
          .in("id", groupIds);

        if (missionGroupsError) {
          console.error("Mission fetch error", missionGroupsError);
        } else {
          missionDetails = (missionGroups || [])
            .filter((group) => group?.metadata?.type === "mission")
            .map((mission) => ({
              id: mission.id,
              name: mission.name,
              status: mission.metadata?.mission_details?.status || "",
              location: mission.metadata?.mission_details?.location || "",
            }));
        }
      }
      setMissionInvolvement(missionDetails);

      if (assignedTasks.length === 0) {
        setTaskAssignments([]);
        return;
      }

      const projectIds = Array.from(
        new Set(
          assignedTasks
            .map((task) => task.metadata?.group_id)
            .filter((projectId) => Boolean(projectId))
        )
      );

      let projectMap = {};
      if (projectIds.length > 0) {
        const { data: taskProjects, error: taskProjectsError } = await getSupabase()
          .from("groups")
          .select("id, name")
          .in("id", projectIds);

        if (taskProjectsError) {
          console.error("Task project fetch error", taskProjectsError);
        } else {
          (taskProjects || []).forEach((project) => {
            projectMap[project.id] = project.name;
          });
        }
      }

      setTaskAssignments(
        assignedTasks.map((task) => ({
          id: task.id,
          projectId: task.metadata?.group_id,
          projectName: projectMap[task.metadata?.group_id] || "Projet",
          title: getTaskTitleFromPost(task),
          status: task.metadata?.task_details?.status || "todo",
        }))
      );
    } catch (error) {
      console.error("Error loading mission/task involvement", error);
      setMissionInvolvement([]);
      setTaskAssignments([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="text-gray-300 mt-4">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="   shadow-md p-12 text-center">
          <p className="text-gray-300">Vous devez être connecté pour accéder à cette page</p>
          <Link
            to="/kudocracy"
            className="mt-4 inline-block px-6 py-3 bg-blue-900 text-light hover:bg-blue-800"
          >
            Aller à Kudocracy
          </Link>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="  shadow-md p-12 text-center">
          <p className="text-red-500 font-bold mb-4">{dashboardError}</p>
          <Link
            to="/profile"
            className="mt-4 inline-block px-6 py-3 bg-orange-600 text-light hover:bg-orange-700"
          >
            Vérifier ou compléter votre profil
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-dark">
      <header className=" shadow-sm border-b-4 border-primary">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-50">Votre tableau de bord</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/voting-dashboard"
                className="px-4 py-2 bg-blue-600 text-light hover:bg-blue-700"
              >
                Activité votes
              </Link>
              <Link
                to="/social-dashboard"
                className="px-4 py-2 bg-orange-600 text-light hover:bg-orange-700"
              >
                Activité sociale
              </Link>
              <Link
                to="/wiki/dashboard"
                className="px-4 py-2 bg-green-600 text-light hover:bg-green-700"
              >
                Activité Wiki
              </Link>
              <Link
                to="/subscriptions"
                className="px-4 py-2 bg-indigo-600 text-light hover:bg-indigo-700"
              >
                🔔 Abonnements
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8" style={{ background: "var(--color-bg-app)" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="  shadow-md p-6" style={{ background: "var(--color-bg-app)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-50">Vos missions</h2>
              <Link to="/missions" className="text-sm text-orange-400 hover:text-orange-300">
                Voir toutes
              </Link>
            </div>
            {missionInvolvement.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Vous n'êtes associé à aucune mission pour le moment. Découvrez les initiatives ou
                créez-en une nouvelle.
              </p>
            ) : (
              <ul className="space-y-3">
                {missionInvolvement.slice(0, 4).map((mission) => (
                  <li key={mission.id}>
                    <Link
                      to={`/missions/${mission.id}`}
                      className="flex flex-col gap-1 border border-gray-800 hover:border-orange-500 transition-colors p-3"
                    >
                      <span className="text-gray-50 font-medium">{mission.name}</span>
                      {mission.location && (
                        <span className="text-sm text-gray-400">{mission.location}</span>
                      )}
                      {mission.status && (
                        <span className="text-xs uppercase tracking-wide text-gray-200 bg-gray-800 px-2 py-1 inline-flex w-fit">
                          {mission.status}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="  shadow-md p-6" style={{ background: "var(--color-bg-app)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-50">Vos tâches Kanban</h2>
              <Link to="/tasks" className="text-sm text-orange-400 hover:text-orange-300">
                Ouvrir le tableau
              </Link>
            </div>
            {taskAssignments.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Aucune tâche assignée pour l'instant. Consultez les projets Kanban pour contribuer.
              </p>
            ) : (
              <ul className="space-y-3">
                {taskAssignments.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={task.projectId ? `/tasks/${task.projectId}/task/${task.id}` : "/tasks"}
                      className="flex items-center justify-between border border-gray-800 hover:border-indigo-500 transition-colors p-3"
                    >
                      <div>
                        <p className="text-gray-50 font-medium">
                          {task.title || "Tâche sans titre"}
                        </p>
                        <p className="text-sm text-gray-400">{task.projectName}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-gray-200 bg-gray-800 px-2 py-1">
                        {TASK_STATUS_LABELS[task.status] || task.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Personal Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Propositions créées"
            value={stats.propositionsCreated || 0}
            color="bg-blue-900"
          />
          <StatCard title="Votes exprimés" value={stats.votesCast || 0} color="bg-green-600" />
          <StatCard
            title="Délégations données"
            value={stats.delegationsGiven || 0}
            color="bg-yellow-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Articles publiés"
            value={stats.postsCreated || 0}
            color="bg-orange-600"
          />
          <StatCard title="Commentaires" value={stats.commentsMade || 0} color="bg-purple-600" />
          <StatCard title="Pages Wiki créées" value={stats.wikiPages || 0} color="bg-teal-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link to="/subscriptions">
            <StatCard
              title="Vos abonnements"
              value={stats.subscriptionsCount || 0}
              color="bg-indigo-600"
            />
          </Link>
          <StatCard
            title="Abonnés à vos contenus"
            value={stats.subscribersCount || 0}
            color="bg-pink-600"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div style={{ background: "var(--color-bg-app)" }} className="  shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-50 mb-4">Distribution de vos votes</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.voteDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.voteDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "var(--color-bg-app)" }} className="  shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-50 mb-4">
              Activité récente (30 derniers jours)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="votes" stroke="#0A3F73" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: "var(--color-bg-app)" }} className="  shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-50 mb-4">Actions rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              to="/kudocracy?tab=create"
              className="bg-blue-900 text-light p-4 hover:bg-blue-800 transition-colors text-center"
            >
              <div className="text-2xl mb-2">💡</div>
              <div className="font-semibold">Formuler une proposition</div>
            </Link>
            <Link
              to="/kudocracy?tab=delegations"
              className="bg-green-600 text-light p-4 hover:bg-green-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">🤝</div>
              <div className="font-semibold">Gérer les délégations</div>
            </Link>
            <Link
              to="/social"
              className="bg-orange-600 text-light p-4 hover:bg-orange-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">💬</div>
              <div className="font-semibold">Publier un article</div>
            </Link>
            <Link
              to="/wiki/new"
              className="bg-teal-600 text-light p-4 hover:bg-teal-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-semibold">Créer une page Wiki</div>
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div
      className={`${color} text-light   shadow-md p-6`}
      style={{ background: "var(--color-bg-app)" }}
    >
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}
