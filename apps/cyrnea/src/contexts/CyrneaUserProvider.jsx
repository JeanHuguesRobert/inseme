/* apps/cyrnea/src/contexts/CyrneaUserProvider.jsx */
/**
 * 🛡️ CYRNEA USER STRATEGY: TYPE 1 (LOCAL VISITOR)
 *
 * This provider manages users purely in localStorage.
 * - NO connection to Supabase Auth is established for identity.
 * - IDs are generated locally (crypto.randomUUID).
 * - "Barman" and "Duty" status are stored locally or via token.
 *
 * This corresponds to TYPE 1 in @inseme/cop-host/src/lib/userUtils.js
 */
import React, { useState, useEffect, useCallback } from "react";
import { CurrentUserContext } from "@inseme/cop-host";
import { getSupabase, isAnonymousUserId } from "@inseme/cop-host";
import { User, initializeTheUser } from "@inseme/brique-cyrnea";

// Utility to create UUID fallback
// (Removed, using User.createAnonymous internal logic)

export function CyrneaUserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStatus, setUserStatus] = useState("signed_out");

  // Initialize user from localStorage (with migration)
  const initLocalUser = useCallback(() => {
    try {
      if (typeof window === "undefined") return null;

      // Use the centralized factory that handles storage, migration, and rich object creation
      const user = User.createAnonymous();

      // Initialize TheUser singleton for Cyrnea components
      initializeTheUser(user, null);

      setCurrentUser(user);
      setUserStatus("signed_in");
      setLoading(false);
      setError(null);
      return user;
    } catch (e) {
      console.warn("[CyrneaUserProvider] initLocalUser failed:", e);
      setError(String(e));
      setLoading(false);
      setUserStatus("signed_out");
      return null;
    }
  }, []);

  useEffect(() => {
    initLocalUser();
  }, [initLocalUser]);

  // Helpers to persist changes both on TheUser singleton and localStorage
  const setPseudo = useCallback((pseudo) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("inseme_client_pseudo", pseudo);
      }
      setCurrentUser((u) => {
        const nu = { ...(u || {}), pseudo };
        try {
          // If TheUser exists, set via its setter
          if (window.TheUser) window.TheUser.pseudo = pseudo;
        } catch (e) {
          void e;
        }
        return nu;
      });
    } catch (e) {
      console.warn("[CyrneaUserProvider] setPseudo failed:", e);
    }
  }, []);

  const setZone = useCallback((zone) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("inseme_client_zone", zone);
      }
      setCurrentUser((u) => {
        const nu = { ...(u || {}), zone };
        try {
          if (window.TheUser) window.TheUser.zone = zone;
        } catch (e) {
          void e;
        }
        return nu;
      });
    } catch (e) {
      console.warn("[CyrneaUserProvider] setZone failed:", e);
    }
  }, []);

  const setOnDuty = useCallback((flag) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("inseme_on_duty", flag ? "true" : "false");
      }
      setCurrentUser((u) => {
        const nu = { ...(u || {}), isOnDuty: !!flag };
        try {
          if (window.TheUser) window.TheUser.isOnDuty = !!flag;
        } catch (e) {
          void e;
        }
        return nu;
      });
    } catch (e) {
      console.warn("[CyrneaUserProvider] setOnDuty failed:", e);
    }
  }, []);

  const becomeBarman = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("inseme_barman_token", "true");
        localStorage.setItem("cyrnea_is_barman", "true");
      }
      setCurrentUser((u) => {
        const nu = { ...(u || {}), role: "barman" };
        try {
          if (window.TheUser) window.TheUser.role = "barman";
        } catch (e) {
          void e;
        }
        return nu;
      });
    } catch (e) {
      console.warn("[CyrneaUserProvider] becomeBarman failed:", e);
    }
  }, []);

  const signOut = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("inseme_barman_token");
        localStorage.removeItem("cyrnea_is_barman");
        localStorage.setItem("inseme_client_pseudo", "Anonyme");
        localStorage.setItem("inseme_client_zone", "indoor");
        localStorage.setItem("inseme_on_duty", "false");
        // Note: We do NOT remove the ID, so the user stays the same "device"
      }

      const anonUser = User.createAnonymous();
      initializeTheUser(anonUser, null);
      setCurrentUser(anonUser);
      setUserStatus("signed_out");
    } catch (e) {
      console.warn("[CyrneaUserProvider] signOut failed:", e);
    }
  }, [currentUser]);

  // Refresh profile from Supabase if we have a non-anonymous id
  const refreshUser = useCallback(async () => {
    if (!currentUser) return null;
    if (currentUser.isAnonymous || isAnonymousUserId(currentUser.id)) return currentUser;

    setLoading(true);
    try {
      const { data, error: fetchError } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const merged = { ...currentUser, ...data };
      setCurrentUser(merged);
      try {
        if (window.TheUser) initializeTheUser(merged, null);
      } catch (e) {
        void e;
      }
      setError(null);
      setUserStatus("signed_in");
      return merged;
    } catch (e) {
      setError(String(e));
      console.warn("[CyrneaUserProvider] refreshUser failed:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // updateProfile: upsert to Supabase users table for non-anonymous users
  const updateProfile = useCallback(
    async (profileUpdate) => {
      if (!currentUser) throw new Error("No current user");
      if (currentUser.isAnonymous || isAnonymousUserId(currentUser.id))
        throw new Error("Cannot update profile for anonymous user");

      setLoading(true);
      try {
        const { data, error: upsertError } = await getSupabase()
          .from("users")
          .upsert({ id: currentUser.id, ...profileUpdate }, { onConflict: ["id"] })
          .select()
          .single();
        if (upsertError) throw upsertError;
        const merged = { ...currentUser, ...data };
        setCurrentUser(merged);
        try {
          initializeTheUser(merged, null);
        } catch (e) {
          void e;
        }
        setError(null);
        return merged;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  const value = {
    currentUser,
    session: null,
    loading,
    error,
    userStatus,
    setPseudo,
    setZone,
    setOnDuty,
    becomeBarman,
    signOut,
    updateProfile,
    refreshUser,
  };

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}
