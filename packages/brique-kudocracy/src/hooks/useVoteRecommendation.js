import { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";

/**
 * Hook to find if a user has delegates who have voted on a specific proposition.
 *
 * @param {string} propositionId - The ID of the proposition
 * @param {string} userId - The ID of the current user
 * @param {Array} tags - The tags associated with the proposition (from proposition_tags)
 */
export function useVoteRecommendation(propositionId, userId, tags) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !propositionId || !tags || tags.length === 0) {
      setRecommendation(null);
      return;
    }

    async function checkDelegations() {
      setLoading(true);
      try {
        // 1. Get my delegations for these tags
        const tagIds = tags.map((t) => t.tag.id);
        const { data: delegations, error: delError } = await getSupabase()
          .from("delegations")
          .select("delegate_id, tag_id, tag:tags(name)")
          .eq("delegator_id", userId)
          .in("tag_id", tagIds);

        if (delError || !delegations || delegations.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Check if any delegate has voted on this proposition
        const delegateIds = delegations.map((d) => d.delegate_id);
        const { data: delegateVotes, error: voteError } = await getSupabase()
          .from("votes")
          .select("user_id, vote_value, users(display_name)")
          .eq("proposition_id", propositionId)
          .in("user_id", delegateIds);

        if (voteError || !delegateVotes || delegateVotes.length === 0) {
          setLoading(false);
          return;
        }

        // 3. Formulate recommendation
        // Simple logic: Take the first delegate found.
        // Complex logic (future): Weighted voting or consensus.
        const bestMatch = delegateVotes[0];
        const delegation = delegations.find((d) => d.delegate_id === bestMatch.user_id);

        setRecommendation({
          delegateName: bestMatch.users?.display_name || "Délégué",
          voteValue: bestMatch.vote_value, // true, false, null
          tagName: delegation?.tag?.name || "un sujet",
          delegateId: bestMatch.user_id,
        });
      } catch (err) {
        console.error("Error fetching recommendations:", err);
      } finally {
        setLoading(false);
      }
    }

    checkDelegations();
  }, [propositionId, userId, JSON.stringify(tags)]);

  return { recommendation, loading };
}
