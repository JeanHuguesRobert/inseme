// packages/cop-host/src/lib/useUserProfile.js
import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "../client/supabase.js";
import {
  isAnonymousUserId,
  createAnonymousUserObject,
  isValidSupabaseUserId,
} from "./userUtils.js";

/**
 * Hook pour récupérer et gérer le profil utilisateur complet
 * Partagé entre Inseme et la Plateforme.
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error, updateProfile, refetch }
 */
export function useUserProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [userId, fetchProfile]);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      // Handle anonymous users - don't query Supabase
      if (isAnonymousUserId(userId)) {
        const anonUser = createAnonymousUserObject(userId);
        setProfile(anonUser);
        return;
      }

      // Validate that this is a proper Supabase user ID before querying
      if (!isValidSupabaseUserId(userId)) {
        throw new Error(`Invalid user ID format: ${userId}. Cannot query Supabase users table.`);
      }

      const { data, error } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error(`[useUserProfile] Supabase query failed for userId: ${userId}`, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          userId: userId,
          isAnonymous: isAnonymousUserId(userId),
          isValidUuid: isValidSupabaseUserId(userId),
        });
        throw error;
      }
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateProfile = async (updates) => {
    try {
      setLoading(true);

      // Anonymous users cannot update profiles in Supabase
      if (isAnonymousUserId(userId)) {
        throw new Error("Anonymous users cannot update database profiles");
      }

      // Validate that this is a proper Supabase user ID before updating
      if (!isValidSupabaseUserId(userId)) {
        throw new Error(`Invalid user ID format: ${userId}. Cannot update Supabase users table.`);
      }

      const { data, error } = await getSupabase()
        .from("users")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return { success: true, data };
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, error, updateProfile, refetch: fetchProfile };
}
