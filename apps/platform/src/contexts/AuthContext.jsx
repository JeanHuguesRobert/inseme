/* apps/platform/src/contexts/AuthContext.jsx */
/**
 * 🛡️ PLATFORM USER STRATEGY: TYPE 3 (AUTHENTICATED) & TYPE 2 (GUEST)
 *
 * This context enforces Supabase Authentication.
 * - Primary Goal: Authenticated Users (Type 3).
 * - Secondary Support: Guest Users (Type 2) via signInAnonymously.
 * - Does NOT support purely local users (Type 1) - users must be known to Supabase.
 *
 * See @inseme/cop-host/src/lib/userUtils.js for full user type definitions.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { User } from "@inseme/cop-host";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    // TODO: should use instance's supabase client, see lib/supabase.js
    return createClient(url, key);
  }, []);

  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ? User.fromSupabase(s.user) : null);
    }
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s?.session ?? null);
      setUser(s?.session?.user ? User.fromSupabase(s.session.user) : null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const isAuthenticated = !!user;
  const isAdmin = !!(
    user &&
    (user.role === "admin" ||
      user.metadata?.role === "admin" ||
      (user.app_metadata?.roles && user.app_metadata.roles.includes("admin")))
  );

  const getAuthHeader = () =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const value = {
    supabase,
    session,
    user,
    isAuthenticated,
    isAdmin,
    getAuthHeader,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
