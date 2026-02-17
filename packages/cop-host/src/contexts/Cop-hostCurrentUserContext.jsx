import React, { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "../client/supabase.js";
import { useDataLoader } from "../lib/useStatusOperations.js";
import { CurrentUserContext } from "./CurrentUserContext.js";
import { getUserRole } from "../lib/permissions.js";

export function CurrentUserProvider({ children }) {
  // Helper to check if user is barman (localStorage only - Cyrnea local flag)
  const isUserBarman = useCallback((user) => {
    if (!user || typeof window === "undefined") return false;

    // Only check local Cyrnea flag (no leak)
    return localStorage.getItem("cyrnea_is_barman") === "true";
  }, []);

  // Helper to create permissions object based on user role (simplified: Client vs Barman)
  const createPermissions = useCallback(
    (user) => {
      if (!user) return {};

      const isBarman = isUserBarman(user);

      // Simple logic: Barman has all permissions, Client has none
      return {
        moderate: isBarman,
        speak: isBarman,
        configure: isBarman,
        moderate_vibe: isBarman,
      };
    },
    [isUserBarman]
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStatus, setUserStatus] = useState("signed_out");
  const loadUserProfile = useDataLoader();
  const lastFetchedUserIdRef = useRef(null);
  const isSigningInRef = useRef(false);
  const hasProfileRef = useRef(false);

  // Helper to get stored session from localStorage
  function getSessionViaLocalStorage() {
    console.log("[CurrentUserContext] getSessionViaLocalStorage called");
    try {
      // Dans le cadre de cop-host, on ne peut pas facilement deviner le projectRef
      // On va essayer de le trouver dans localStorage si possible ou utiliser auth.getSession()
      // Mais pour le SSR/Hydration, localStorage est utile.

      // On va parcourir les clés de localStorage pour trouver sb-*-auth-token
      if (typeof window === "undefined") return null;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const session = JSON.parse(stored);
            if (session && session.access_token && session.user) {
              const expiresAt = session.expires_at;
              if (expiresAt && Date.now() / 1000 < expiresAt) {
                console.log(
                  "[CurrentUserContext] Found valid session for userId:",
                  session.user.id
                );
                return session;
              }
            }
          }
        }
      }
      return null;
    } catch (err) {
      console.error("[CurrentUserContext] Error getting stored session:", err);
      return null;
    }
  }

  /**
   * Crée un profil utilisateur depuis les métadonnées OAuth
   * Gère Facebook, GitHub et Google
   */
  const createProfileFromOAuth = useCallback(async (authUser) => {
    if (!authUser?.id) return null;

    const metadata = authUser.user_metadata || {};
    const provider = metadata.provider || "unknown";

    // Extraire l'avatar selon le provider
    let avatarUrl = metadata.avatar_url || metadata.picture;

    // Extraire le nom d'affichage
    let displayName = metadata.full_name || metadata.name;
    if (!displayName && authUser.email) {
      displayName = authUser.email.split("@")[0];
    }

    const profileData = {
      id: authUser.id,
      email: authUser.email,
      display_name: displayName,
      metadata: {
        avatarUrl: avatarUrl,
        provider: provider,
        schemaVersion: 1,
        oauth_metadata: metadata, // Conserver pour référence
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await getSupabase()
        .from("users")
        .upsert(profileData, { onConflict: ["id"] })
        .select()
        .single();

      if (error) {
        console.error("[CurrentUserContext] Error creating profile from OAuth:", error);
        return null;
      }

      console.log("[CurrentUserContext] Profile created from OAuth:", data);
      return data;
    } catch (err) {
      console.error("[CurrentUserContext] Exception creating profile:", err);
      return null;
    }
  }, []);

  // Centralized profile fetch logic
  const handleProfileFetch = useCallback(
    async (authUser) => {
      console.log("[CurrentUserContext] handleProfileFetch called with:", authUser);
      if (!authUser || !authUser.id) {
        console.log("[CurrentUserContext] No authUser or missing id");
        setError("Impossible de charger le profil utilisateur (id manquant)");
        setCurrentUser(null);
        setUserStatus("signed_out");
        setLoading(false);
        isSigningInRef.current = false;
        hasProfileRef.current = false;
        return;
      }
      if (lastFetchedUserIdRef.current === authUser.id && hasProfileRef.current) {
        console.log("[CurrentUserContext] Profile already loaded for userId:", authUser.id);
        setLoading(false);
        setUserStatus("signed_in");
        isSigningInRef.current = false;
        return;
      }
      if (isSigningInRef.current && lastFetchedUserIdRef.current === authUser.id) {
        console.log("[CurrentUserContext] Already signing in for userId:", authUser.id);
        return;
      }
      setLoading(true);
      setUserStatus("signing_in");
      isSigningInRef.current = true;
      lastFetchedUserIdRef.current = authUser.id;
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        if (isSigningInRef.current) {
          timedOut = true;
          isSigningInRef.current = false;
          setUserStatus("signed_out");
          setLoading(false);
          // alert is browser only
          if (typeof window !== "undefined") {
            alert("Désolé, la connexion a pris trop de temps. Veuillez réessayer plus tard.");
          }
          console.log("[CurrentUserContext] Profile fetch timed out for userId:", authUser.id);
        }
      }, 10000);
      // Fetch profile
      let profile = null,
        fetchError = null;

      // Skip profile fetch for anonymous users
      if (authUser.id && authUser.id.startsWith("anon_")) {
        console.log("[CurrentUserContext] Skipping profile fetch for anonymous user:", authUser.id);
      } else {
        try {
          console.log(
            "[CurrentUserContext] Fetching profile from users table for userId:",
            authUser.id
          );
          const promise = getSupabase()
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();
          const { data, error } = await promise;
          if (error) throw error;
          profile = data;
          console.log("[CurrentUserContext] Profile fetch result:", profile);
        } catch (err) {
          fetchError = err.message || String(err);
          console.error("[CurrentUserContext] Error fetching profile:", fetchError);
        }
      }
      isSigningInRef.current = false;
      clearTimeout(timeoutId);
      if (profile) {
        const userWithEmail = { ...authUser, ...profile };
        // Ensure critical auth fields are not overwritten by potentially stale/empty profile data
        if (authUser.email) userWithEmail.email = authUser.email;
        if (authUser.id) userWithEmail.id = authUser.id;
        // Add permissions based on role
        userWithEmail.can = createPermissions(userWithEmail);
        setCurrentUser(userWithEmail);
        setUserStatus("signed_in");
        setError(null);
        setLoading(false);
        hasProfileRef.current = true;
        console.log("[CurrentUserContext] User signed in and profile set:", userWithEmail);
      } else if (!timedOut) {
        // No profile found - check if this is an OAuth login
        const metadata = authUser.user_metadata || {};
        const isOAuthLogin =
          metadata.provider && (metadata.avatar_url || metadata.picture || metadata.name);

        if (isOAuthLogin) {
          console.log("[CurrentUserContext] OAuth login detected, creating profile");
          const newProfile = await createProfileFromOAuth(authUser);
          if (newProfile) {
            const userWithProfile = { ...authUser, ...newProfile };
            if (authUser.email) userWithProfile.email = authUser.email;
            if (authUser.id) userWithProfile.id = authUser.id;
            // Add permissions based on role
            userWithProfile.can = createPermissions(userWithProfile);
            setCurrentUser(userWithProfile);
            setUserStatus("signed_in");
            setError(null);
            setLoading(false);
            hasProfileRef.current = true;
            console.log("[CurrentUserContext] Profile created, user signed in");
          } else {
            const userWithPermissions = { ...authUser };
            userWithPermissions.can = createPermissions(userWithPermissions);
            setCurrentUser(userWithPermissions);
            setUserStatus("signed_in");
            setError(null);
            setLoading(false);
            hasProfileRef.current = false;
          }
        } else {
          console.log("[CurrentUserContext] No profile found, using authUser only");
          const userWithPermissions = { ...authUser };
          userWithPermissions.can = createPermissions(userWithPermissions);
          setCurrentUser(userWithPermissions);
          setUserStatus("signed_in");
          setError(fetchError);
          setLoading(false);
          hasProfileRef.current = false;
        }
      }
    },
    [createProfileFromOAuth, createPermissions]
  );

  // Listen for localStorage changes (barman flag)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e) => {
      if (e.key === "cyrnea_is_barman") {
        // Barman status changed, recalculate permissions
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const updatedUser = { ...prev };
          updatedUser.can = createPermissions(updatedUser);
          return updatedUser;
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [createPermissions]);

  // Auth state management
  useEffect(() => {
    console.log("[CurrentUserContext] useEffect initializing");
    if (!getSupabase()) {
      console.log("[CurrentUserContext] Supabase client not initialized");
      setError("Supabase client not initialized");
      setLoading(false);
      setUserStatus("signed_out");
      return;
    }
    // Check for stored session
    const storedSession = getSessionViaLocalStorage();
    if (storedSession) {
      console.log("[CurrentUserContext] Found stored session, fetching profile...");
      setSession(storedSession);
      handleProfileFetch(storedSession.user);
    } else {
      console.log("[CurrentUserContext] No stored session, setting user to null");
      setCurrentUser(null);
      setUserStatus("signed_out");
      setLoading(false);
    }
    // Listen to auth changes
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange(async (event, newSession) => {
      console.log("[CurrentUserContext] Auth event:", event, "user:", newSession?.user?.id);
      setSession(newSession);
      if (newSession?.user) {
        const newUserId = newSession.user.id;
        const shouldFetch = event === "SIGNED_IN" || lastFetchedUserIdRef.current !== newUserId;
        if (shouldFetch) {
          console.log(
            "[CurrentUserContext] Auth event requires profile fetch for userId:",
            newUserId
          );
          await handleProfileFetch(newSession.user);
        } else {
          setLoading(false);
          setUserStatus("signed_in");
          console.log("[CurrentUserContext] User already signed in, no fetch needed");
        }
      } else {
        setCurrentUser(null);
        setUserStatus("signed_out");
        setLoading(false);
        hasProfileRef.current = false;
        console.log("[CurrentUserContext] Signed out, user cleared");
      }
    });
    return () => {
      console.log("[CurrentUserContext] Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, [handleProfileFetch]);

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      if (!currentUser?.id) {
        return { success: false, error: "No user logged in" };
      }
      setLoading(true);

      // Filter safe updates
      const safeUpdates = {};
      if (updates.display_name !== undefined) safeUpdates.display_name = updates.display_name;
      if (updates.neighborhood !== undefined) safeUpdates.neighborhood = updates.neighborhood;
      if (updates.interests !== undefined) safeUpdates.interests = updates.interests;
      if (updates.metadata !== undefined) safeUpdates.metadata = updates.metadata;

      const { data, error } = await getSupabase()
        .from("users")
        .upsert(
          {
            id: currentUser.id,
            ...safeUpdates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ["id"] }
        )
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        return {
          success: false,
          error: "Aucune donnée modifiée, profil non mis à jour.",
        };
      }
      // Merge updated profile into currentUser, preserving session info and recalculating permissions
      setCurrentUser((prev) => {
        const updatedUser = prev ? { ...prev, ...data } : data;
        // Recalculate permissions after role change
        updatedUser.can = createPermissions(updatedUser);
        return updatedUser;
      });
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async (user) => {
    console.log("[CurrentUserContext] Manual refresh requested");
    let targetUser = user;
    if (!targetUser) {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      targetUser = session?.user;
    }
    if (targetUser) {
      await handleProfileFetch(targetUser);
    }
  };

  const contextValue = {
    currentUser,
    session,
    loading,
    error,
    userStatus,
    updateProfile,
    refreshUser,
    isUserBarman, // Export centralized barman detection
  };

  return <CurrentUserContext.Provider value={contextValue}>{children}</CurrentUserContext.Provider>;
}
