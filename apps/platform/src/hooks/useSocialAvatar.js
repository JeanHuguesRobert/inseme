import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabase.js";

export function useSocialAvatar(provider) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`/api/oauth-start?provider=${provider}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to start OAuth flow");

      const { authUrl } = await response.json();
      // Redirect to provider
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  const completeIfCallback = async (userId) => {
    const path = window.location.pathname;
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const code = params.get("code");

    // Check if we are on the correct callback path for this provider
    // Note: This path check must match the redirectPath in oauthProviders.js
    const expectedPath = `/oauth/${provider}/callback`;

    const state = params.get("state");
    if (path === expectedPath && code && state) {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await getSupabase().auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const response = await fetch("/api/oauth-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ provider, code, state, userId }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to complete OAuth flow");
        }

        const data = await response.json();
        setAvatarUrl(data.avatarUrl);

        // The server persists `metadata.facebookId` and `metadata.avatarUrl` on success.
        // We simply use the returned avatar URL to update local state.

        return data.avatarUrl;
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
        // Optional: Clean up URL
        window.history.replaceState({}, document.title, "/profile"); // Redirect back to profile or wherever
      }
    }
    return null;
  };

  return {
    avatarUrl,
    loading,
    error,
    start,
    completeIfCallback,
  };
}
