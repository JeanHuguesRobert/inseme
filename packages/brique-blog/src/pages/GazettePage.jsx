import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import GazetteLayout from "../components/gazette/BlogGazetteLayout";
import GazettePost from "../components/gazette/BlogGazettePost";

export default function GazettePage() {
  const { name } = useParams();
  const gazetteName = name || "global";
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGazette() {
      const { data } = await getSupabase()
        .from("posts")
        .select("*")
        .ilike("metadata->>gazette", gazetteName)
        .order("created_at", { ascending: false })
        .limit(20);
      
      setPosts(data || []);
      setLoading(false);
    }
    loadGazette();
  }, [gazetteName]);

  return (
    <GazetteLayout 
      title={gazetteName === "global" ? "LA GAZETTE" : `GAZETTE ${gazetteName.toUpperCase()}`}
      subtitle="Journal Politique et Littéraire"
    >
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8">Aucun article publié pour cette gazette.</div>
      ) : (
        posts.map(post => (
          <GazettePost key={post.id} post={post} gazetteName={gazetteName} />
        ))
      )}
    </GazetteLayout>
  );
}
