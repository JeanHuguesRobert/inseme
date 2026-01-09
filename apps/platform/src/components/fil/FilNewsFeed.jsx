import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";

/**
 * Compact news feed component showing recent Fil items.
 * Designed for embedding on the main page.
 */
export default function FilNewsFeed({ limit = 5 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await getSupabase()
        .from("posts")
        .select("id, metadata, created_at")
        .ilike("metadata->>type", "fil_%")
        .gt("created_at", yesterday)
        .order("metadata->fil_score", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (!error && data) {
        setItems(data);
      }
      setLoading(false);
    }

    fetchItems();
  }, [limit]);

  // Extract domain from URL
  const getDomain = (url) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return null;
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const styles = {
    container: {
      padding: "12px",
      background: "var(--color-surface-secondary)",
      border: "1px solid var(--color-border-medium)",
      marginBottom: "1rem",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "0.9rem",
      color: "var(--color-action-primary)",
    },
    viewAll: {
      fontSize: "0.75rem",
      color: "var(--color-content-secondary)",
      textDecoration: "none",
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    item: {
      fontSize: "0.8rem",
      color: "var(--color-content-primary)",
    },
    link: {
      color: "var(--color-content-primary)",
      textDecoration: "none",
    },
    domain: {
      fontSize: "0.7rem",
      color: "var(--color-content-secondary)",
      marginLeft: 4,
    },
    score: {
      color: "var(--color-content-tertiary)",
      fontSize: "0.7rem",
      marginRight: 4,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>📰 Nouveautés</span>
        <Link to="/fil" style={styles.viewAll}>
          voir tout →
        </Link>
      </div>
      <div style={styles.list}>
        {items.map((item) => {
          const metadata = item.metadata || {};
          const title = metadata.title || metadata.external_url || "Sans titre";
          const url = metadata.external_url;
          const domain = getDomain(url);
          const score = metadata.fil_score || 0;

          return (
            <div key={item.id} style={styles.item}>
              <span style={styles.score}>{score}▲</span>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  {title.length > 60 ? title.substring(0, 60) + "…" : title}
                </a>
              ) : (
                <Link to={`/posts/${item.id}`} style={styles.link}>
                  {title.length > 60 ? title.substring(0, 60) + "…" : title}
                </Link>
              )}
              {domain && <span style={styles.domain}>({domain})</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
