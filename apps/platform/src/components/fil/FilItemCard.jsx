import { Link } from "react-router-dom";
import { useState } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { getDisplayName } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import { isAdmin } from "@inseme/cop-host";
import FilConvertMenu from "./FilConvertMenu";

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
      borderBottom: "1px solid var(--color-border-light)",
      fontSize: "0.85rem",
    },
    rank: {
      minWidth: 24,
      textAlign: "right",
      color: "var(--color-content-secondary)",
      fontSize: "0.75rem",
    },
    vote: {
      cursor: "pointer",
      color: userVote === 1 ? "var(--color-action-primary)" : "var(--color-content-tertiary)",
      fontSize: "0.7rem",
      padding: 2,
    },
    title: {
      color: "var(--color-content-primary)",
      textDecoration: "none",
      fontFamily: "var(--font-body)",
    },
    domain: {
      fontSize: "0.7rem",
      color: "var(--color-content-secondary)",
      marginLeft: 4,
    },
    meta: {
      fontSize: "0.7rem",
      color: "var(--color-content-secondary)",
      marginLeft: 28,
      paddingBottom: 4,
    },
    metaLink: {
      color: "var(--color-content-secondary)",
      textDecoration: "none",
    },
  };

  return (
    <div>
      {/* Main Row: Rank | Vote | Title (Domain) */}
      <div style={styles.row}>
        <span style={styles.rank}>{rank}.</span>
        <span style={styles.vote} onClick={() => !loading && handleVote(1)} title="Voter pour">
          ▲
        </span>
        {externalUrl ? (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer" style={styles.title}>
            {title}
          </a>
        ) : (
          <Link to={`/posts/${post.id}`} style={styles.title}>
            {title}
          </Link>
        )}
        {domain && <span style={styles.domain}>({domain})</span>}
      </div>

      {/* Meta Row: Score | User | Time | Comments */}
      <div style={styles.meta}>
        {localScore} point{localScore !== 1 ? "s" : ""} | par{" "}
        <Link to={`/users/${post.users?.id}`} style={styles.metaLink}>
          {getDisplayName(post.users)}
        </Link>{" "}
        | {timeAgo(post.created_at)} |{" "}
        <Link to={`/posts/${post.id}`} style={styles.metaLink}>
          {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
        </Link>
        {isAdmin(currentUser) && (
          <>
            {" "}
            |{" "}
            <span
              style={{ color: "var(--color-action-accent)", cursor: "pointer" }}
              title="Admin: Supprimer"
            >
              suppr
            </span>{" "}
            | <FilConvertMenu post={post} />
          </>
        )}
      </div>
    </div>
  );
}
