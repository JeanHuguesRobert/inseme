import { Link } from "react-router-dom";
import { useState } from "react";
import { getSupabase, useCurrentUser, isAdmin } from "@inseme/cop-host";

export default function FilItemCard({ post, rank, currentUserId, onVote }) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);

  const metadata = post.metadata || {};
  const title = metadata.title || metadata.external_url || "Sans titre";
  const score = metadata.fil_score || 0;
  const commentCount = metadata.fil_comment_count || 0;
  const externalUrl = metadata.external_url;

  const [localScore, setLocalScore] = useState(score);
  const [userVote, setUserVote] = useState(post.user_vote || 0);

  // Extract domain from URL
  const getDomain = (url) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return null;
    }
  };

  const domain = getDomain(externalUrl);

  // Time ago helper
  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}j`;
  };

  async function handleVote(value) {
    if (!currentUserId) return alert("Connectez-vous pour voter");
    setLoading(true);
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session expirée");

      const response = await fetch("/api/fil/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          voteValue: userVote === value ? 0 : value, // Toggle
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Vote failed");
      }

      const data = await response.json();
      setLocalScore(data.score);
      setUserVote(userVote === value ? 0 : value);
      if (onVote) onVote(post.id, data);
    } catch (err) {
      console.error("Vote error:", err);
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    row: {
      display: "flex",
      alignItems: "baseline",
      gap: 4,
      padding: "4px 0",
      borderBottom: "1px solid #eee",
      fontSize: "0.85rem",
    },
    rank: {
      minWidth: 24,
      textAlign: "right",
      color: "#999",
      fontSize: "0.75rem",
    },
    voteBtn: (active) => ({
      cursor: "pointer",
      color: active ? "#ff6600" : "#999",
      padding: "0 2px",
      border: "none",
      background: "none",
      fontWeight: active ? "bold" : "normal",
    }),
    title: {
      textDecoration: "none",
      color: "#000",
      fontWeight: "500",
    },
    domain: {
      fontSize: "0.75rem",
      color: "#828282",
      marginLeft: 4,
    },
    meta: {
      fontSize: "0.7rem",
      color: "#828282",
      marginTop: 2,
      display: "flex",
      gap: 4,
      paddingLeft: 28,
    },
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={styles.row}>
        <span style={styles.rank}>{rank}.</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <button
            style={styles.voteBtn(userVote === 1)}
            onClick={() => handleVote(1)}
            disabled={loading}
          >
            ▲
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <Link to={`/fil/${post.id}`} style={styles.title}>
            {title}
          </Link>
          {domain && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.domain}
              onClick={(e) => e.stopPropagation()}
            >
              ({domain})
            </a>
          )}
        </div>
      </div>
      <div style={styles.meta}>
        <span>{localScore} points</span>
        <span>par {post.users?.display_name || "Anonyme"}</span>
        <span>il y a {timeAgo(post.created_at)}</span>
        <span>|</span>
        <Link to={`/fil/${post.id}`} style={{ color: "inherit" }}>
          {commentCount} commentaires
        </Link>
        {isAdmin(currentUser) && (
           <>
             <span>|</span>
             <span style={{ color: "red", cursor: "pointer" }}>modérer</span>
           </>
        )}
      </div>
    </div>
  );
}
