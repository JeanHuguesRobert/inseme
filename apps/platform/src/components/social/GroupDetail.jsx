// src/components/social/GroupDetail.jsx

import { useState, useEffect } from "react";
import { MarkdownViewer } from "@inseme/ui";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import { isDeleted, getMetadata, getGroupType } from "@inseme/cop-host";
import { detectGazetteAssignments } from "../../lib/gazetteAssignments.js";
import CommentSection from "../common/CommentSection";
import SiteFooter from "../layout/SiteFooter";
import { getDisplayName, getUserInitials } from "@inseme/cop-host";
import { enrichUserMetadata } from "@inseme/cop-host";
import { isAdmin, isAnonymous, canWrite } from "@inseme/cop-host";
import SubscribeButton from "../common/SubscribeButton";

/**
 * Page détail d'un groupe avec membres et posts
 */
export default function GroupDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [gazetteNames, setGazetteNames] = useState([]);

  useEffect(() => {
    if (id) {
      loadGroupData();
    }
  }, [id, currentUser]);

  async function loadGroupData() {
    try {
      setLoading(true);
      setError(null);

      // Charger le groupe
      const { data: groupData, error: groupError } = await getSupabase()
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      if (isDeleted(groupData)) {
        throw new Error("Ce groupe a été supprimé");
      }

      setGroup(groupData);

      // Charger les membres
      const { data: membersData, error: membersError } = await getSupabase()
        .from("group_members")
        .select("*, users(id, display_name, metadata)")
        .eq("group_id", id);

      if (membersError) throw membersError;

      // Enrich user metadata
      const enrichedMembers = (membersData || []).map((member) => ({
        ...member,
        users: enrichUserMetadata(member.users),
      }));
      setMembers(enrichedMembers);

      // Vérifier si user actuel est membre/admin
      if (currentUser) {
        const membership = membersData?.find((m) => m.user_id === currentUser.id);
        setIsMember(!!membership);
        // Members are admins by default
        setIsGroupAdmin(!!membership);
      }

      const gazetteAssignments = await detectGazetteAssignments(groupData);
      setGazetteNames(gazetteAssignments);

      // Charger les posts du groupe et des gazettes associées
      const postQueries = [
        getSupabase()
          .from("posts")
          .select("*, users(id, display_name, metadata)")
          .eq("metadata->>groupId", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ];

      gazetteAssignments.forEach((gazetteName) => {
        postQueries.push(
          getSupabase()
            .from("posts")
            .select("*, users(id, display_name, metadata)")
            .eq("metadata->>gazette", gazetteName)
            .order("created_at", { ascending: false })
            .limit(20)
        );
      });

      const queryResults = await Promise.all(postQueries);

      const mergedPosts = [];
      queryResults.forEach((result) => {
        if (result.error) throw result.error;
        (result.data || []).forEach((post) => {
          if (!post) return;
          mergedPosts.push(post);
        });
      });

      const uniquePostsMap = new Map();
      mergedPosts.forEach((post) => {
        if (!uniquePostsMap.has(post.id)) {
          uniquePostsMap.set(post.id, post);
        }
      });

      const combinedPosts = Array.from(uniquePostsMap.values())
        .filter((p) => !isDeleted(p))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);

      setPosts(combinedPosts);
    } catch (err) {
      console.error("Error loading group:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup() {
    if (!currentUser || isAnonymous(currentUser)) {
      if (!currentUser) {
        alert("Vous devez être connecté pour rejoindre un groupe");
      } else {
        alert("Bloqué, contactez un administrateur");
      }
      return;
    }
    if (!canWrite(currentUser)) {
      alert("Votre compte ne peut pas publier pour le moment");
      return;
    }

    try {
      setMembershipLoading(true);
      const { error } = await getSupabase()
        .from("group_members")
        .insert({
          group_id: id,
          user_id: currentUser.id,
          metadata: { schemaVersion: 1 },
        });

      if (error) throw error;

      loadGroupData();
    } catch (err) {
      console.error("Error joining group:", err);
      alert("Erreur lors de l'adhésion : " + err.message);
    } finally {
      setMembershipLoading(false);
    }
  }

  async function handleLeaveGroup() {
    if (!currentUser) return;

    try {
      setMembershipLoading(true);
      const { error } = await getSupabase()
        .from("group_members")
        .delete()
        .eq("group_id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      loadGroupData();
    } catch (err) {
      console.error("Error leaving group:", err);
      alert("Erreur : " + err.message);
    } finally {
      setMembershipLoading(false);
    }
  }

  function handleWritePost() {
    navigate(`/posts/new?groupId=${id}`);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 ">{error}</div>
        <button
          onClick={() => navigate("/social")}
          className="mt-4 text-primary-600 hover:underline"
        >
          ← Retour aux groupes
        </button>
      </div>
    );
  }

  if (!group) return null;

  const groupType = getGroupType(group);
  const avatarUrl = getMetadata(group, "avatarUrl");
  const location = getMetadata(group, "location");
  const tags = getMetadata(group, "tags", []);

  const totalMembers = members.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="theme-card p-6 mb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex gap-4 flex-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt={group.name} className="w-24 h-24  object-cover" />
            ) : (
              <div className="w-24 h-24  bg-primary-100 flex items-center justify-center text-4xl">
                {groupType === "neighborhood" && "🏘️"}
                {groupType === "association" && "🤝"}
                {groupType === "community" && "👥"}
                {groupType === "forum" && "💬"}
              </div>
            )}

            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-primary-300 mb-2">Groupe</p>
              <h1 className="text-3xl font-bold text-gray-50 mb-2">{group.name}</h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-3">
                <span className="text-gray-200 font-semibold">
                  {totalMembers} membre{totalMembers !== 1 ? "s" : ""}
                </span>
                {location && (
                  <span className="flex items-center gap-1">
                    📍 <span>{location}</span>
                  </span>
                )}
                {groupType && (
                  <span className="px-2 py-1 text-xs rounded bg-gray-800 uppercase">
                    {groupType}
                  </span>
                )}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {gazetteNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {gazetteNames.map((g) => (
                    <Link
                      key={g}
                      to={g === "global" ? "/gazette" : `/gazette/${g}`}
                      className="inline-block text-xs bg-primary-600 text-bauhaus-white px-3 py-1 rounded hover:opacity-90"
                    >
                      {g === "global" ? "Consulter la Gazette" : `Gazette : ${g}`}
                    </Link>
                  ))}
                </div>
              )}

              <div className="prose prose-sm max-w-none text-gray-300">
                <MarkdownViewer content={group.description || "*Aucune description.*"} />
              </div>

              <Link
                to={`/social?tab=posts&groupId=${id}`}
                className="text-sm text-primary-300 hover:text-primary-200"
              >
                ☕ Discuter ce groupe au Café
              </Link>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[220px]">
            {!isMember ? (
              <button
                onClick={handleJoinGroup}
                disabled={membershipLoading}
                className="btn btn-primary text-sm disabled:opacity-60"
              >
                Rejoindre le groupe
              </button>
            ) : (
              !isGroupAdmin && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={membershipLoading}
                  className="btn btn-ghost text-sm border disabled:opacity-60"
                >
                  Quitter le groupe
                </button>
              )
            )}

            {isMember && currentUser && canWrite(currentUser) && (
              <button onClick={handleWritePost} className="btn btn-success text-sm">
                ✍️ Écrire dans ce groupe
              </button>
            )}

            {isGroupAdmin && (
              <button
                onClick={() => navigate(`/groups/${id}/edit`)}
                className="btn btn-secondary text-sm"
              >
                Gérer le groupe
              </button>
            )}

            <SubscribeButton
              contentType="group"
              contentId={id}
              currentUser={currentUser}
              className="w-full"
            />

            <button onClick={() => navigate("/social")} className="btn btn-ghost text-sm border">
              ← Retour au Café
            </button>
          </div>
        </div>
      </div>

      {/* Tabs: Posts / Membres */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts */}
        <div className="lg:col-span-2">
          <div className="theme-card p-6">
            <h2 className="text-xl font-semibold mb-4">Publications</h2>

            {posts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune publication pour l'instant</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <h3 className="font-semibold text-gray-50 mb-2">
                      {getMetadata(post, "title", "Sans titre")}
                    </h3>
                    <p className="text-gray-300 text-sm line-clamp-2 mb-2">{post.content}</p>
                    <div className="text-xs text-gray-400">
                      Par{" "}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/users/${post.users?.id}`);
                        }}
                        className="font-medium text-gray-200 hover:underline"
                      >
                        {getDisplayName(post.users)}
                      </button>{" "}
                      • {new Date(post.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Membres */}
        <div className="lg:col-span-1">
          <div className="theme-card p-6">
            <h2 className="text-xl font-semibold mb-4">Membres</h2>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    {getUserInitials(member.users)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-50 truncate">
                      <Link to={`/users/${member.users?.id}`} className="hover:underline">
                        {getDisplayName(member.users)}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-400">
                      Depuis {new Date(member.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section de discussion sur le groupe */}
      <div className="mt-6">
        <CommentSection
          linkedType="group"
          linkedId={id}
          currentUser={currentUser}
          defaultExpanded={false}
        />
      </div>

      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}
