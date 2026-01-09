/* src/lib/useCurrentUser.js */
/* This file provides hooks to access the current user context and fetch user profiles */

import { useContext, useState, useEffect, useCallback } from "react";
import { CurrentUserContext } from "../contexts/Cop-hostCurrentUserContext";
import { getSupabase } from "../client/supabase.js";
import { useDataLoader } from "./useStatusOperations.js";

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/**
 * Hook pour récupérer le profil d'un utilisateur spécifique (pas forcément l'utilisateur connecté)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error, refetch }
 */
export function useUserProfileById(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProfile = useDataLoader();

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setProfile(data);
      setError(null);
    } catch (err) {
      console.error("[useUserProfileById] Error fetching profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}
