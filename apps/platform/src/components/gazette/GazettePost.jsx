import React from "react";
import { MarkdownViewer } from "@inseme/ui";
import { Link } from "react-router-dom";
import FacebookEmbed from "../FacebookEmbed";
import { getSupabase } from "../../lib/supabase.js";
import { getPostTitle, getPostSubtitle } from "../../../../../packages/cop-host/src/lib/socialMetadata.js";
import {
  isFacebookPost,
  getPostSourceUrl,
  getPostGazette,
  getPostEvent,
  getAuthor,
  isShare,
} from "../../lib/postPredicates.js";
import { getDisplayName } from "@inseme/cop-host";
import { markShareDeleted } from "../../lib/sharePost.js";

export default function GazettePost({ post, isEditor = false, gazetteName = null }) {
  const { id, content, created_at } = post;
  const title = getPostTitle(post);
  const subtitle = getPostSubtitle(post);
  const author = getAuthor(post);
  const authorName = getDisplayName(author) || "Anonyme";
  const sourceUrl = getPostSourceUrl(post);
  const isFacebook = isFacebookPost(post);
  const event = getPostEvent(post);
  const cafeHref = `/social?tab=posts&linkedType=post&linkedId=${id}${
    getPostGazette(post) || gazetteName
      ? "&gazette=" + encodeURIComponent(getPostGazette(post) || gazetteName)
      : ""
  }`;
  // normalize problematic non-breaking spaces Supabase AI may insert
  const sanitizedContent = content ? content.replace(/\u202F|\u00A0/g, " ") : content;

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet article de la Gazette ?")) return;
    try {
      const { error } = await getSupabase()
        .from("posts")
        .update({
          metadata: {
            ...post.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: "gazette-editor",
          },
        })
        .eq("id", id);
      if (error) throw error;

      // Update tracking if this is a share
      if (isShare(post)) {
        await markShareDeleted(post);
      }

      window.location.reload();
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Erreur : " + err.message);
    }
  }

  return (
    <article className="mb-8 border-b border-[#d4c49c] pb-6 last:border-0">
      <h2
        style={{ color: "#2c241b" }}
        className="font-['Playfair_Display'] font-bold text-2xl mb-2 leading-tight"
      >
        {title}
      </h2>

      {subtitle && (
        <h3 style={{ color: "#4b3c2f" }} className="font-['EB_Garamond'] text-lg italic mb-3">
          {subtitle}
        </h3>
      )}

      {/* Event info */}
      {event && (
        <div className="mb-3 text-sm text-gray-700">
          {event.date && (
            <div>
              📅 <strong>Date:</strong>{" "}
              {new Date(event.date).toLocaleString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          {event.location && (
            <div>
              📍 <strong>Lieu:</strong> {event.location}
            </div>
          )}
          {event.duration && (
            <div>
              ⏱️ <strong>Durée:</strong> {event.duration}
            </div>
          )}
        </div>
      )}

      <div className="font-['EB_Garamond'] text-sm italic mb-4 text-gray-700 flex justify-between items-center">
        <span>Par {authorName}</span>
        <div className="flex items-center gap-3">
          <Link className="text-sm text-[#2c241b] hover:underline" to={cafeHref}>
            ☕ Discuter au Café
          </Link>
          {isEditor && (
            <div className="flex gap-2 text-xs font-sans not-italic">
              <Link to={`/posts/${id}/edit`} className="text-blue-800 hover:underline">
                [Modifier]
              </Link>
              <button onClick={handleDelete} className="text-red-800 hover:underline">
                [Supprimer]
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="font-['EB_Garamond'] text-lg leading-snug text-justify gazette-article-content">
        <style>{`
          .gazette-article-content,
          .gazette-article-content h1,
          .gazette-article-content h2,
          .gazette-article-content h3,
          .gazette-article-content h4,
          .gazette-article-content h5,
          .gazette-article-content h6,
          .gazette-article-content p,
          .gazette-article-content strong,
          .gazette-article-content em,
          .gazette-article-content a {
            color: #2c241b !important;
          }
          /* keep headings readable: don't apply newspaper justification/indent */
          .gazette-article-content h1,
          .gazette-article-content h2,
          .gazette-article-content h3,
          .gazette-article-content h4,
          .gazette-article-content h5,
          .gazette-article-content h6 {
            text-align: left !important;
            text-indent: 0 !important;
            margin-top: 0.6em !important;
            margin-bottom: 0.4em !important;
            padding: 0 !important;
            display: block !important;
          }
          /* ensure inline semantics for emphasis/strong tags (prevent large gaps) */
          .gazette-article-content strong,
          .gazette-article-content em {
            display: inline !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: normal !important;
          }
          .gazette-article-content a {
            color: #1e40af !important;
            text-decoration: underline;
          }
          .gazette-article-content p {
            margin-bottom: 1em;
            text-indent: 1.5em;
          }
          .gazette-article-content p:first-of-type::first-letter {
            float: left;
            font-family: 'Cinzel', serif;
            font-size: 3.5rem;
            line-height: 0.8;
            padding-right: 0.1em;
            padding-top: 0.1em;
            font-weight: bold;
          }
        `}</style>
        <MarkdownViewer content={sanitizedContent} />
      </div>
      {isFacebook && (
        <div className="mt-6 mb-4 flex justify-center">
          <FacebookEmbed url={sourceUrl} className="w-full max-w-2xl" />
        </div>
      )}
    </article>
  );
}
