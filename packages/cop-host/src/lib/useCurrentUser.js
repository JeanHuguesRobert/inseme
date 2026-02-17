/* src/lib/useCurrentUser.js */
/* This file provides hooks to access the current user context and fetch user profiles */

import { useContext, useState, useEffect, useCallback } from "react";
import { CurrentUserContext } from "../contexts/CurrentUserContext.js";
import { getSupabase } from "../client/supabase.js";
import {
  isAnonymousUserId,
  createAnonymousUserObject,
  isValidSupabaseUserId,
} from "./userUtils.js";

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

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      // Handle anonymous users - don't query Supabase
      if (isAnonymousUserId(userId)) {
        const anonUser = createAnonymousUserObject(userId);
        setProfile(anonUser);
        setError(null);
        return;
      }

      // Validate that this is a proper Supabase user ID before querying
      if (!isValidSupabaseUserId(userId)) {
        throw new Error(`Invalid user ID format: ${userId}. Cannot query Supabase users table.`);
      }

      const { data, error: fetchError } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[useUserProfileById] Supabase query failed for userId: ${userId}`, {
          error: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code,
          userId: userId,
          isAnonymous: isAnonymousUserId(userId),
          isValidUuid: isValidSupabaseUserId(userId),
        });
        throw fetchError;
      }
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
