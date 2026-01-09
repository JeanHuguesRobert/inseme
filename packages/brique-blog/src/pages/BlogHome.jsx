import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function BlogHome() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      // Fetch posts of type 'blog'
      // Note: In Platform, gazette posts are just posts with metadata.
      // We filter by metadata->>postType = 'blog' OR metadata->>gazette is not null
      const { data, error } = await getSupabase()
        .from("posts")
        .select("id, created_at, content, metadata, author:users(display_name)")
        .or("metadata->>postType.eq.blog,metadata->>gazette.neq.null")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-800 dark:text-gray-100">
          Interventions & Tribunes
        </h1>
        <Link
          to="/blog/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Nouvelle publication
        </Link>
      </div>

      <div className="grid gap-8">
        {posts.map((post) => {
           const title = post.metadata?.title || "Sans titre";
           const subtitle = post.metadata?.subtitle;
           const authorName = post.author?.display_name || "Anonyme";
           
           return (
             <article key={post.id} className="border-b border-gray-200 dark:border-gray-800 pb-8">
               <h2 className="text-2xl font-bold mb-2 font-serif hover:text-indigo-600">
                 <Link to={`/blog/${post.id}`}>{title}</Link>
               </h2>
               {subtitle && <h3 className="text-lg text-gray-600 dark:text-gray-400 italic mb-2">{subtitle}</h3>}
               <div className="text-sm text-gray-500 mb-4">
                 Par <strong>{authorName}</strong> · {format(new Date(post.created_at), "d MMMM yyyy", { locale: fr })}
               </div>
               <div className="prose dark:prose-invert max-w-none line-clamp-3">
                 {/* Simple strip of markdown for preview */}
                  {post.content.replace(/[#*`]/g, "")}
               </div>
               <Link to={`/blog/${post.id}`} className="inline-block mt-4 text-indigo-600 hover:underline">
                 Lire la suite →
               </Link>
             </article>
           );
        })}
        {posts.length === 0 && (
          <p className="text-center text-gray-500 italic">Aucune publication pour le moment.</p>
        )}
      </div>
    </div>
  );
}
