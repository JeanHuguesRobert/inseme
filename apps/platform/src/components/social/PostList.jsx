import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { isDeleted } from "../../../../../packages/cop-host/src/lib/metadata.js";
import { enrichUserMetadata } from "@inseme/cop-host";
import PostCard from "./PostCard";

/**
 * Liste de posts avec filtres
 */
export default function PostList({
  groupId = null,
  linkedType = null,
  linkedId = null,
  postType = null,
  tag = null,
  gazette = null,
  currentUserId = null,
  relatedGazettes = [],
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const shouldIgnoreLinkedFilters = Boolean(gazette);

  useEffect(() => {
    loadPosts();
  }, [
    groupId,
    linkedType,
    linkedId,
    postType,
    tag,
    gazette,
    JSON.stringify(relatedGazettes || []),
  ]);

  async function loadPosts() {
    try {
      setLoading(true);
      setError(null);

      const gazetteList = Array.isArray(relatedGazettes)
        ? relatedGazettes.filter((name) => Boolean(name))
        : [];

      const buildBaseQuery = () => {
        let query = getSupabase().from("posts").select("*, users(id, display_name, metadata)");

        if (!shouldIgnoreLinkedFilters && linkedType) {
          query = query.eq("metadata->>linkedType", linkedType);
        }
        if (!shouldIgnoreLinkedFilters && linkedId) {
          query = query.eq("metadata->>linkedId", linkedId);
        }
        if (postType) {
          query = query.eq("metadata->>postType", postType);
        }
        if (tag) {
          query = query.contains("metadata", { tags: [tag] });
        }

        return query.order("created_at", { ascending: false });
      };

      let fetchedPosts = [];

      const shouldMergeGazettePosts = Boolean(groupId && gazetteList.length > 0 && !gazette);

      if (shouldMergeGazettePosts) {
        const queries = [buildBaseQuery().eq("metadata->>groupId", groupId)];

        gazetteList.forEach((name) => {
          queries.push(buildBaseQuery().eq("metadata->>gazette", name));
        });

        const results = await Promise.all(queries);

        results.forEach((result) => {
          if (result.error) {
            throw result.error;
          }
          fetchedPosts.push(...(result.data || []));
        });
      } else {
        let query = buildBaseQuery();

        if (groupId) {
          query = query.eq("metadata->>groupId", groupId);
        }
        if (gazette) {
          query = query.eq("metadata->>gazette", gazette);
        } else if (!groupId && gazetteList.length > 0) {
          query = query.in("metadata->>gazette", gazetteList);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        fetchedPosts = data || [];
      }

      // Filtre soft delete et enrichit user metadata
      const activePosts = (fetchedPosts || [])
        .filter((p) => !isDeleted(p))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));

      // Tri manuel pour mettre les épinglés en premier
      const sorted = activePosts.sort((a, b) => {
        const aPinned = a.metadata?.isPinned || false;
        const bPinned = b.metadata?.isPinned || false;

        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // Si même statut épinglé, tri par date
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setPosts(sorted);
    } catch (err) {
      console.error("Error loading posts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-card p-6 text-center border-red-500">
        <p className="text-red-500 font-bold">Erreur lors du chargement des posts</p>
        <p className="text-gray-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="theme-card p-12 text-center text-gray-500">
        <p className="text-lg mb-2 font-bold">Aucune publication pour l'instant</p>
        <p className="text-sm">Soyez le premier à publier !</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          gazette={gazette}
          showMarkdown={Boolean(gazette)}
        />
      ))}
    </div>
  );
}
