import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import { getMetadata } from "@inseme/cop-host";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import SiteFooter from "../components/layout/SiteFooter";

export default function SocialDashboard() {
  const { currentUser, userStatus } = useCurrentUser();
  const [stats, setStats] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentComments, setRecentComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userStatus === "signed_in" && currentUser) {
      loadSocialStats();
    } else if (userStatus === "signed_out") {
      setLoading(false);
    }
  }, [currentUser, userStatus]);

  const loadSocialStats = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get posts created by user
      const { data: userPosts, error: postsError } = await getSupabase()
        .from("posts")
        .select("*")
        .eq("author_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Get comments by user
      const { data: userComments, error: commentsError } = await getSupabase()
        .from("comments")
        .select(
          `
          *,
          posts!inner(title)
        `
        )
        .eq("author_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Get likes received on user's posts
      const { data: postLikes, error: likesError } = await getSupabase()
        .from("post_likes")
        .select("post_id")
        .in(
          "post_id",
          (userPosts || []).map((p) => p.id)
        );

      if (likesError) throw likesError;

      // Calculate statistics
      const totalPosts = userPosts?.length || 0;
      const totalComments = userComments?.length || 0;
      const totalLikesReceived = postLikes?.length || 0;

      // Get unique posts commented on
      const uniquePostsCommented = new Set(userComments?.map((c) => c.post_id)).size;

      // Activity by month (last 6 months)
      const activityData = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthPosts =
          userPosts?.filter((p) => {
            const postDate = new Date(p.created_at);
            return postDate >= monthStart && postDate <= monthEnd;
          }).length || 0;

        const monthComments =
          userComments?.filter((c) => {
            const commentDate = new Date(c.created_at);
            return commentDate >= monthStart && commentDate <= monthEnd;
          }).length || 0;

        const monthName = monthStart.toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        });

        activityData.push({
          month: monthName,
          posts: monthPosts,
          comments: monthComments,
        });
      }

      // Helper to enrich post data for consistent rendering
      const formatPost = (post) => {
        const title = getMetadata(post, "title", post.title || "Publication sans titre");
        const summary = getMetadata(post, "summary", post.content || "");
        const gazette = getMetadata(post, "gazette");
        const groupName = getMetadata(post, "groupName");
        return {
          ...post,
          displayTitle: title,
          summary,
          gazette,
          groupName,
        };
      };

      // Most liked posts
      const likesByPost = {};
      postLikes?.forEach((like) => {
        likesByPost[like.post_id] = (likesByPost[like.post_id] || 0) + 1;
      });

      const mostLikedPosts = (userPosts || [])
        .map((post) => ({
          ...formatPost(post),
          likes: likesByPost[post.id] || 0,
        }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 5);

      // Get subscriber count
      const { count: subscribersCount, error: subscribersError } = await getSupabase()
        .from("content_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", currentUser.id);

      if (subscribersError) console.error("Error fetching subscribers:", subscribersError);

      const decoratedPosts = (userPosts || []).map((post) => ({
        ...formatPost(post),
        likes: likesByPost[post.id] || 0,
      }));

      setStats({
        totalPosts,
        totalComments,
        totalLikesReceived,
        uniquePostsCommented,
        activityData,
        mostLikedPosts,
        subscribersCount: subscribersCount || 0,
      });

      setRecentPosts(decoratedPosts.slice(0, 5));
      setRecentComments((userComments || []).slice(0, 10));
    } catch (error) {
      console.error("Error loading social stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (userStatus === "signing_in" || (loading && userStatus === "signed_in")) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bauhaus-blue"></div>
          <p className="text-bauhaus-white mt-4">Chargement de vos contributions sociales...</p>
        </div>
      </div>
    );
  }

  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-12 text-center">
          <p className="text-bauhaus-white">Vous devez être connecté pour accéder à cette page</p>
          <Link
            to="/social"
            className="mt-4 inline-block px-6 py-3 bg-bauhaus-blue text-bauhaus-white font-bold  border-2 border-bauhaus-white hover:bg-blue-800 shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Aller au réseau social
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bauhaus-black text-bauhaus-white">
      <div className="bg-bauhaus-black shadow-[0px_4px_0px_0px_#F0F0F0] border-b-3 border-bauhaus-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-bauhaus-white font-bauhaus uppercase">
                Activité Sociale
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/user-dashboard"
                className="px-4 py-2 bg-bauhaus-green text-bauhaus-black font-bold  border-2 border-bauhaus-black hover:bg-green-500 shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Votre tableau de bord
              </Link>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Articles publiés"
            value={stats?.totalPosts || 0}
            color="bg-bauhaus-blue"
          />
          <StatCard
            title="Commentaires"
            value={stats?.totalComments || 0}
            color="bg-bauhaus-green"
          />
          <StatCard
            title="Likes reçus"
            value={stats?.totalLikesReceived || 0}
            color="bg-bauhaus-red"
          />
          <StatCard
            title="Articles commentés"
            value={stats?.uniquePostsCommented || 0}
            color="bg-bauhaus-yellow"
            textColor="text-bauhaus-black"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Activité des 6 derniers mois
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.activityData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#F0F0F0" />
                <YAxis stroke="#F0F0F0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#121212",
                    border: "2px solid #F0F0F0",
                    color: "#F0F0F0",
                  }}
                />
                <Bar dataKey="posts" fill="#2D58B8" name="Posts" />
                <Bar dataKey="comments" fill="#F2C94C" name="Commentaires" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Articles les plus appréciés
            </h2>
            {stats?.mostLikedPosts?.length > 0 ? (
              <div className="space-y-3">
                {stats.mostLikedPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="flex justify-between items-center py-2 border-b border-bauhaus-white last:border-b-0"
                  >
                    <div className="flex-1">
                      <Link
                        to={`/posts/${post.id}`}
                        className="font-bold text-bauhaus-blue hover:text-bauhaus-white"
                      >
                        {post.displayTitle}
                      </Link>
                      <p className="text-sm text-gray-400">
                        {new Date(post.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center text-bauhaus-red font-bold">
                      <span className="mr-1">{post.likes}</span>
                      <span>❤️</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Aucun like reçu pour le moment.</p>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Vos articles récents
            </h2>
            {recentPosts.length > 0 ? (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="border-2 border-bauhaus-white p-4">
                    <Link
                      to={`/posts/${post.id}`}
                      className="font-bold text-bauhaus-blue hover:text-bauhaus-white"
                    >
                      {post.displayTitle}
                    </Link>
                    {(post.gazette || post.groupName) && (
                      <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">
                        {post.gazette ? `Gazette ${post.gazette}` : post.groupName}
                      </p>
                    )}
                    <p className="text-sm text-gray-400 mt-2 line-clamp-3">{post.summary}</p>
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                      <span>{new Date(post.created_at).toLocaleDateString("fr-FR")}</span>
                      <span>{post.likes || 0} ❤️</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Vous n'avez pas encore publié d'article.
                <br />
                <Link to="/social" className="text-bauhaus-blue hover:underline">
                  Créer votre premier article
                </Link>
              </p>
            )}
          </div>
          <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6">
            <h2 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">
              Vos commentaires récents
            </h2>
            {recentComments.length > 0 ? (
              <div className="space-y-4">
                {recentComments.map((comment) => (
                  <div key={comment.id} className="border-2 border-bauhaus-white p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <Link
                          to={`/posts/${comment.post_id}`}
                          className="font-bold text-bauhaus-blue hover:text-bauhaus-white"
                        >
                          Sur: {comment.posts?.title}
                        </Link>
                        <p className="text-sm text-gray-400 mt-2">{comment.content}</p>
                      </div>
                      <span className="text-xs text-gray-400 ml-4">
                        {new Date(comment.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Aucun commentaire publié pour le moment.
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-bauhaus-black border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6 mt-8">
          <h3 className="text-xl font-bold text-bauhaus-white mb-4 uppercase">Actions rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/social?tab=posts"
              className="bg-bauhaus-blue text-bauhaus-white p-4 border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-center font-bold uppercase"
            >
              <div className="text-2xl mb-2">📝</div>
              <div>Créer un article</div>
            </Link>
            <Link
              to="/social?tab=comments"
              className="bg-bauhaus-green text-bauhaus-black p-4 border-2 border-bauhaus-black shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-center font-bold uppercase"
            >
              <div className="text-2xl mb-2">💬</div>
              <div>Commenter</div>
            </Link>
            <Link
              to="/profile"
              className="bg-bauhaus-yellow text-bauhaus-black p-4 border-2 border-bauhaus-black shadow-[4px_4px_0px_0px_#121212] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-center font-bold uppercase"
            >
              <div className="text-2xl mb-2">👤</div>
              <div>Modifier le profil</div>
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function StatCard({ title, value, color, textColor = "text-bauhaus-white" }) {
  return (
    <div
      className={`${color} ${textColor} border-2 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] p-6`}
    >
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}
