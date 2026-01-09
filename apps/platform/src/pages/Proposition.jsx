import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MarkdownViewer } from "@inseme/ui";
import CommentSection from "../components/common/CommentSection";
import { FacebookShareButton, useCurrentUser, ShareMenu } from "@inseme/cop-host";
import { PetitionLinkCard } from "../components/common/PetitionLink";
import { getSupabase } from "../lib/supabase.js";
import SiteFooter from "../components/layout/SiteFooter";
import { getLatestModifier } from "../../../../packages/cop-host/src/lib/socialMetadata.js";
import { useVoteRecommendation } from "../hooks/useVoteRecommendation.js";

export default function Proposition() {
  // const { supabase } = useSupabase();
  const { id } = useParams();
  const [proposition, setProposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useCurrentUser(); // Hook pour l'utilisateur connecté
  const [votes, setVotes] = useState({ approve: 0, disapprove: 0, blank: 0 });
  const [userVote, setUserVote] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Vote Recommendation Hook
  const { recommendation } = useVoteRecommendation(
    id,
    currentUser?.id,
    proposition?.proposition_tags
  );

  useEffect(() => {
    if (!getSupabase() || !id) return;
    const loadProposition = async () => {
      console.log("Loading proposition with id:", id);
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await getSupabase()
          .from("propositions")
          .select(
            `
            *,
            author:users!propositions_author_id_fkey(display_name),
            proposition_tags(tag:tags(*))
          `
          )
          .eq("id", id)
          .maybeSingle();
        console.log("Proposition query result:", { data, error });
        if (error) {
          console.error("Error loading proposition:", error);
          setError("Impossible de charger la proposition: " + error.message);
        } else if (!data) {
          setError("Proposition non trouvée");
        } else {
          setProposition(data);
        }
      } catch (err) {
        console.error("Exception loading proposition:", err);
        setError("Erreur lors du chargement: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProposition();
    loadVotes();
    if (currentUser) {
      loadUserVote();
    }
  }, [id, currentUser]);

  const loadVotes = async () => {
    try {
      const res = await fetch(`/api/tally/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVotes(data);
      }
    } catch (e) {
      console.error("Failed to load votes", e);
    }
  };

  const handleAnalyzeConsensus = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisData(null);
    setShowAnalysis(true);

    try {
      // Fetch comments for context
      const { data: comments } = await getSupabase()
        .from("comments")
        .select("content")
        .eq("proposition_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      const commentTexts = comments?.map((c) => c.content) || [];

      const payload = {
        title: proposition.title,
        description: proposition.description,
        refusalReasons: votes.refusalReasons,
        comments: commentTexts,
      };

      const res = await fetch("/api/analyze-consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erreur API");
      const result = await res.json();
      setAnalysisData(result);
    } catch (e) {
      console.error(e);
      setAnalysisData({ error: "Impossible de générer l'analyse." });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadUserVote = async () => {
    if (!currentUser || !getSupabase()) return;
    const { data, error } = await getSupabase()
      .from("votes")
      .select("*")
      .eq("proposition_id", id)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (!error) {
      setUserVote(data);
    }
  };

  const handleVoteChange = () => {
    loadVotes();
    loadUserVote();
  };

  const renderLink = ({ href = "", children }) => {
    const url = String(href);
    const isExternal = url.startsWith("http") || url.startsWith("//");
    // Supporte [label](wiki/adresse) ou [label](/wiki/adresse) ou [label](wiki:adresse)
    const wikiMatch = url.match(/^\/?wiki(?:\/:|\/)?(.+)$/i);
    if (!isExternal && wikiMatch) {
      const slug = wikiMatch[1].replace(/^\//, "");
      return (
        <Link to={`/wiki/${slug}`} className="text-blue-600 hover:underline">
          {children}
        </Link>
      );
    }
    // Liens internes absolus (ex: /propositions/123) -> Link
    if (!isExternal && url.startsWith("/")) {
      return (
        <Link to={url} className="text-blue-600 hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {children}
      </a>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-300">Chargement...</p>
      </div>
    );
  }

  if (error || !proposition) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-4">{error || "Proposition introuvable"}</p>
        <Link to="/kudocracy" className="text-blue-900 hover:underline">
          Retour aux propositions
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="   shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-50 mb-2">{proposition.title}</h1>
            <p className="text-sm text-gray-400">
              Par {proposition.author?.display_name || "Anonyme"} •{" "}
              {new Date(proposition.created_at).toLocaleDateString("fr-FR")}
              {(() => {
                const latestModifier = getLatestModifier(proposition.metadata, proposition);
                const showModifier = latestModifier && latestModifier.id !== proposition.author_id;
                if (showModifier) {
                  return (
                    <>
                      {" • "}
                      <span className="text-gray-500">
                        Modifié par{" "}
                        <Link to={`/users/${latestModifier.id}`} className="hover:underline">
                          {latestModifier.displayName || "Utilisateur"}
                        </Link>
                      </span>
                    </>
                  );
                }
                return null;
              })()}
            </p>
          </div>
          <ShareMenu
            entityType="proposition"
            entityId={proposition.id}
            title={proposition.title}
            description={proposition.description?.slice(0, 200)}
            currentUserId={currentUser?.id}
          />
        </div>

        <div className="markdown-content mb-6">
          {proposition.description && typeof proposition.description === "string" ? (
            <MarkdownViewer
              content={proposition.description}
              components={{ a: renderLink }}
              breaks={true}
            />
          ) : (
            <p className="text-gray-300">Aucune description fournie.</p>
          )}
        </div>

        {proposition.proposition_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            {proposition.proposition_tags.map((pt) => (
              <span
                key={pt.tag.id}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
              >
                {pt.tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Vote Recommendation - Liquid Democracy */}
        {currentUser && recommendation && !userVote && (
          <div className="mb-4 p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg flex items-start gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                🗳️ Recommandation de votre délégué
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Votre délégué <strong>{recommendation.delegateName}</strong> (pour le sujet{" "}
                <em>#{recommendation.tagName}</em>) a voté :
              </p>
              <div className="mt-2 font-bold text-lg">
                {recommendation.voteValue === "approve" && (
                  <span className="text-green-600">POUR</span>
                )}
                {recommendation.voteValue === "disapprove" && (
                  <span className="text-red-600">CONTRE</span>
                )}
                {recommendation.voteValue === "neutral" && (
                  <span className="text-gray-500">NEUTRE</span>
                )}
                {recommendation.voteValue === "false_choice" && (
                  <span className="text-purple-600">FAUX DILEMME</span>
                )}
                {recommendation.voteValue === true && <span className="text-green-600">POUR</span>}
                {recommendation.voteValue === false && <span className="text-red-600">CONTRE</span>}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                Si vous ne votez pas, ce vote sera comptabilisé automatiquement à la fin de la
                période (Auto-Voting).
              </p>
            </div>
          </div>
        )}

        <div className="mb-4">
          <SubscribeButton contentType="proposition" contentId={id} currentUser={currentUser} />
        </div>

        {/* Boutons de vote */}
        {currentUser ? (
          <VoteButton
            propositionId={id}
            userId={currentUser.id}
            currentVote={userVote}
            onVoteChange={handleVoteChange}
          />
        ) : (
          <div className=" border border-gray-200 p-3 text-center">
            <p className="text-sm text-gray-300">
              <Link to="/kudocracy" className="text-blue-900 hover:underline">
                Connectez-vous pour voter
              </Link>
            </p>
          </div>
        )}

        <div className="mt-6">
          <Link to="/kudocracy" className="text-blue-900 hover:underline">
            ← Retour à la liste
          </Link>
        </div>
      </div>

      {/* Section de commentaires */}
      <CommentSection
        linkedType="proposition"
        linkedId={proposition.id}
        currentUser={currentUser}
        defaultExpanded={false}
      />

      <SiteFooter />
    </div>
  );
}
