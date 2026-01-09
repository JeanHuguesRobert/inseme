import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";

/**
 * Reusable checkbox for publishing content to Le Fil.
 * Hides itself if the content URL is already in recent Fil items.
 *
 * @param {Object} props
 * @param {string} props.url - URL of the content to potentially publish
 * @param {string} props.title - Title for the Fil post
 * @param {string} props.description - Optional description
 * @param {boolean} props.checked - Controlled checkbox state
 * @param {function} props.onChange - Callback for checkbox change
 */
export default function PublishToFilCheckbox({ url, title, description, checked, onChange }) {
  const [isAlreadyInFil, setIsAlreadyInFil] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkIfInFil() {
      if (!url) {
        setLoading(false);
        return;
      }

      // Check if URL was posted to Fil in last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await getSupabase()
        .from("posts")
        .select("id")
        .ilike("metadata->>type", "fil_%")
        .eq("metadata->>external_url", url)
        .gte("created_at", weekAgo)
        .limit(1);

      setIsAlreadyInFil(data && data.length > 0);
      setLoading(false);
    }

    checkIfInFil();
  }, [url]);

  // Don't show if already in Fil or loading
  if (loading || isAlreadyInFil) return null;

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "var(--color-surface-secondary)",
        border: "1px solid var(--color-border-medium)",
        cursor: "pointer",
        fontSize: "0.85rem",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      <span>
        <strong style={{ color: "var(--color-action-primary)" }}>Publier sur Le Fil</strong>
        <span style={{ color: "var(--color-content-secondary)", marginLeft: 4 }}>
          (visible dans les nouveautés)
        </span>
      </span>
    </label>
  );
}

/**
 * Helper function to create a Fil post from other content.
 * Call this after successfully creating/updating content.
 */
export async function publishToFil({ url, title, description, token, federated = false }) {
  if (!token) {
    console.warn("publishToFil: No token provided");
    return null;
  }

  try {
    const response = await fetch("/api/fil/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: title || null,
        content: description || null,
        type: "fil_link",
        source_type: url?.includes(window.location.hostname) ? "internal" : "external",
        external_url: url,
        federated: federated,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to publish to Fil");
    }

    return await response.json();
  } catch (err) {
    console.error("publishToFil error:", err);
    return null;
  }
}
