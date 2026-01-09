import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase, canWrite } from "@inseme/cop-host";
import { PetitionLinkSimple } from "../common/PetitionLink";
import { useVoteRecommendation } from "../../hooks/useVoteRecommendation.js";

export default function PropositionCard({ proposition, user }) {
  const [votes, setVotes] = useState({
    approve: 0,
    disapprove: 0,
    blank: 0,
    proxyCount: 0,
  });
  const [userVote, setUserVote] = useState(null);

  // Hook for Liquid Democracy Recommendation
  const { recommendation } = useVoteRecommendation(
    proposition.id,
    user?.id,
    proposition.proposition_tags
  );

  useEffect(() => {
    loadVotes();
    if (user) {
      loadUserVote();
    }
  }, [proposition.id, user]);

  const loadVotes = async () => {
    try {
      const response = await fetch(`/api/tally/${proposition.id}`);
      if (response.ok) {
        const data = await response.json();
        setVotes({
          approve: data.approve,
          disapprove: data.disapprove,
          blank: data.blank,
          falseChoice: data.falseChoice,
          proxyCount: data.proxyCount || 0,
        });
      }
    } catch (err) {
      console.error("Error loading tally:", err);
    }
  };

  const loadUserVote = async () => {
    if (!user || !getSupabase()) return;
    const { data, error } = await getSupabase()
      .from("votes")
      .select("*")
      .eq("proposition_id", proposition.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error) {
      setUserVote(data);
    }
  };

  const totalVotes =
    votes.approve + votes.disapprove + votes.blank + (votes.falseChoice || 0);
  const approvePercent =
    totalVotes > 0 ? (votes.approve / totalVotes) * 100 : 0;
  const blankPercent = totalVotes > 0 ? (votes.blank / totalVotes) * 100 : 0;
  const disapprovePercent =
    totalVotes > 0 ? (votes.disapprove / totalVotes) * 100 : 0;
  const falseChoicePercent =
    totalVotes > 0 ? ((votes.falseChoice || 0) / totalVotes) * 100 : 0;

  return (
    <div className="theme-card p-6">
      <div className="flex justify-between items-start mb-4">
        {/* ... Header content unchanged ... */}
        <div className="flex-1">
          <Link to={`/propositions/${proposition.id}`} className="group">
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-primary transition-colors font-brand">
              {proposition.title}
            </h3>
          </Link>
          <p className="text-gray-600 mb-4 line-clamp-3">
            {proposition.description}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {proposition.proposition_tags.map((pt) => (
              <span
                key={pt.tag.id}
                className="filter-chip filter-chip--yellow active cursor-default"
              >
                {pt.tag.name}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-500">
            Par {proposition.author?.display_name || "Anonyme"} •{" "}
            {new Date(proposition.created_at).toLocaleDateString("fr-FR")}
          </p>

          {/* Petition Link */}
          {proposition.metadata?.petition_url && (
            <div className="mt-2">
              <PetitionLinkSimple url={proposition.metadata.petition_url} />
            </div>
          )}

          <Link
            to={`/propositions/${proposition.id}`}
            className="inline-block mt-2 text-sm text-primary font-bold hover:underline  tracking-wide"
          >
            Voir les détails →
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm font-semibold mb-2">
          <span className="text-green-700">
            {votes.approve} Pour ({approvePercent.toFixed(1)}%)
          </span>
          <span className="text-gray-600">
            {votes.blank} Neutre ({blankPercent.toFixed(1)}%)
          </span>
          <span className="text-red-700">
            {votes.disapprove} Contre ({disapprovePercent.toFixed(1)}%)
          </span>
          {(votes.falseChoice || 0) > 0 && (
            <span className="text-purple-700">
              {votes.falseChoice} F.D. ({falseChoicePercent.toFixed(1)}%)
            </span>
          )}
        </div>
        <div className="vote-bar flex h-2 rounded-full overflow-hidden bg-gray-100">
          <div
            className="bg-green-500"
            style={{ width: `${approvePercent}%` }}
            title={`Pour: ${approvePercent.toFixed(1)}%`}
          ></div>
          <div
            className="bg-gray-400"
            style={{ width: `${blankPercent}%` }}
            title={`Neutre: ${blankPercent.toFixed(1)}%`}
          ></div>
          <div
            className="bg-red-500"
            style={{ width: `${disapprovePercent}%` }}
            title={`Contre: ${disapprovePercent.toFixed(1)}%`}
          ></div>
          <div
            className="bg-purple-500"
            style={{ width: `${falseChoicePercent}%` }}
            title={`Faux Dilemme: ${falseChoicePercent.toFixed(1)}%`}
          ></div>
        </div>
        {votes.proxyCount > 0 && (
          <div className="text-right text-xs text-blue-800 dark:text-blue-300 mt-1">
            Dont {votes.proxyCount} votes par procuration
          </div>
        )}
      </div>

      {user && canWrite(user) && (
        <div>
          {userVote ? (
            <div className="vote-status">
              <p>
                Vous avez voté :{" "}
                <strong>
                  {userVote.vote_value === "approve" && "Pour"}
                  {userVote.vote_value === "disapprove" && "Contre"}
                  {userVote.vote_value === "neutral" && "Neutre"}
                  {userVote.vote_value === "false_choice" && "Faux Dilemme"}
                  {/* Fallback for booleans */}
                  {userVote.vote_value === true && "Pour"}
                  {userVote.vote_value === false && "Contre"}
                </strong>
              </p>
            </div>
          ) : recommendation ? (
            <div className="vote-status vote-status--delegated">
              <p>
                Délégué à {recommendation.delegateName} qui a voté :{" "}
                <strong>
                  {recommendation.voteValue === "approve" && "Pour"}
                  {recommendation.voteValue === "disapprove" && "Contre"}
                  {recommendation.voteValue === "neutral" && "Neutre"}
                  {recommendation.voteValue === "false_choice" &&
                    "Faux Dilemme"}
                  {/* Fallback */}
                  {recommendation.voteValue === true && "Pour"}
                  {recommendation.voteValue === false && "Contre"}
                </strong>
              </p>
            </div>
          ) : null}

          <VoteButton
            propositionId={proposition.id}
            userId={user.id}
            currentVote={userVote}
            onVoteChange={() => {
              loadVotes();
              loadUserVote();
            }}
          />
        </div>
      )}

      {(!user || !canWrite(user)) && (
        <div className="vote-status vote-status--info text-center">
          <p>
            {user
              ? "Les utilisateurs anonymes ne peuvent pas voter"
              : "Connectez-vous pour voter"}
          </p>
        </div>
      )}
    </div>
  );
}
