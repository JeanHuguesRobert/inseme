import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { isDeleted } from "../../../../packages/cop-host/src/lib/metadata.js";
import {
  getDisplayName,
  getUserInitials,
  isAnonymousUserId,
  createAnonymousUserObject,
  isValidSupabaseUserId,
} from "@inseme/cop-host";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import SubscribeButton from "../components/common/SubscribeButton";
import SiteFooter from "../components/layout/SiteFooter";
import { useSubscription } from "../lib/useSubscription.js";
import { getConfig } from "../common/config/instanceConfig.client.js";

export default function UserPage() {
  const { id } = useParams();
  const { currentUser } = useCurrentUser();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowingYou, setIsFollowingYou] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");

  const {
    isSubscribed: isYouSubscribedToProfile,
    loading: subscriptionLoading,
    subscribe,
    unsubscribe,
  } = useSubscription("user", id, currentUser);

  useEffect(() => {
    if (id) loadUser();
  }, [id]);

  async function loadUser() {
    setLoading(true);
    try {
      // Handle anonymous users - don't query Supabase
      if (isAnonymousUserId(id)) {
        const anonUser = createAnonymousUserObject(id);
        setUser(anonUser);
        setLoading(false);
        return;
      }

      // Validate that this is a proper Supabase user ID before querying
      if (!isValidSupabaseUserId(id)) {
        throw new Error(`Invalid user ID format: ${id}. Cannot query Supabase users table.`);
      }

      const { data, error } = await getSupabase().from("users").select("*").eq("id", id).single();
      if (error) {
        console.error(`[UserPage] Supabase user query failed for userId: ${id}`, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          userId: id,
          isAnonymous: isAnonymousUserId(id),
          isValidUuid: isValidSupabaseUserId(id),
        });
        throw error;
      }
      setUser(data);

      const { data: postsData, error: postsError } = await getSupabase()
        .from("posts")
        .select("id, content, created_at, metadata")
        .eq("author_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postsError) throw postsError;
      setPosts((postsData || []).filter((p) => !isDeleted(p)));

      // Counts: posts total, followers (content_subscriptions where content_type='user'), following (subscriptions by this user to other users)
      const [{ count: postsCount }, { count: followersCount }, { count: followingCount }] =
        await Promise.all([
          getSupabase()
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("author_id", id),
          getSupabase()
            .from("content_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("content_type", "user")
            .eq("content_id", id),
          getSupabase()
            .from("content_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("content_type", "user")
            .eq("user_id", id),
        ]);

      setCounts({
        posts: postsCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0,
      });
      // Check reciprocity: does the profile follow the current user?
      if (currentUser?.id) {
        const { data: followerEntry } = await getSupabase()
          .from("content_subscriptions")
          .select("id")
          .eq("content_type", "user")
          .eq("content_id", currentUser.id)
          .eq("user_id", id)
          .maybeSingle();

        setIsFollowingYou(!!followerEntry);
      }
    } catch (err) {
      console.error("Error loading user page:", err);
      setUser(null);
      setPosts([]);
      setCounts({ posts: 0, followers: 0, following: 0 });
    } finally {
      setLoading(false);
    }
  }

  const metadata = user?.metadata || {};
  const bio = metadata.bio || user.interests || metadata.about || "";

  // Resolve avatar source from metadata.avatarUrl or fallback to Facebook
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async function resolveAvatar() {
      try {
        if (metadata.avatarUrl) {
          if (
            metadata.avatarUrl.startsWith("http://") ||
            metadata.avatarUrl.startsWith("https://")
          ) {
            if (!cancelled) setAvatarSrc(metadata.avatarUrl);
            return;
          }
          if (metadata.avatarUrl.startsWith("supabase://")) {
            // TODO: construct public Supabase URL if available
            if (!cancelled) setAvatarSrc("");
            return;
          }
        }

        // Fallback: if there's a facebookId, call server endpoint to get picture url
        if (metadata.facebookId) {
          const res = await fetch(
            `/api/facebook-avatar?facebookId=${encodeURIComponent(metadata.facebookId)}`
          );
          if (res.ok) {
            const j = await res.json();
            if (!cancelled && j?.url) setAvatarSrc(j.url);
            return;
          }
        }

        if (!cancelled) setAvatarSrc("");
      } catch (err) {
        console.error("Error resolving avatar:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [metadata?.avatarUrl, metadata?.facebookId]);

  if (loading) return <div className="py-8 text-center">Chargement...</div>;
  if (!user) return <div className="py-8 text-center">Utilisateur introuvable</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="  shadow-sm p-6 mb-6 flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-3xl overflow-hidden">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={getDisplayName(user)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{getUserInitials(user)}</span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{getDisplayName(user)}</h1>
            <SubscribeButton contentType="user" contentId={id} currentUser={currentUser} />
            {/* If this profile is the contact/admin account, show link to Admin landing only to admin viewers */}
            {user?.email &&
              getConfig("contact_email") &&
              currentUser &&
              getUserRole(currentUser) === ROLE_ADMIN &&
              String(user.email).toLowerCase() ===
                String(getConfig("contact_email")).toLowerCase() && (
                <Link
                  to="/admin"
                  className="ml-3 px-3 py-1 border text-sm bg-primary-600 text-bauhaus-white"
                >
                  Admin
                </Link>
              )}
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Membre depuis:{" "}
            {user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "N/A"}
          </p>
          {bio && <p className="mt-3 text-gray-300">{bio}</p>}

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
            <div>
              {counts.posts} publication{counts.posts !== 1 ? "s" : ""}
            </div>
            <div>
              {counts.followers} abonné{counts.followers !== 1 ? "s" : ""}
            </div>
            <div>
              {counts.following} suivant{counts.following !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="  shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Publications récentes</h2>
        {posts.length === 0 ? (
          <p className="text-gray-400">Aucune publication publique.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="border p-3 ">
                <Link to={`/posts/${p.id}`} className="font-medium hover:underline">
                  {p.metadata?.title || (p.content || "(sans titre)").slice(0, 80)}
                </Link>
                <div className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
