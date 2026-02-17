// src/components/FacebookEmbed.jsx

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

async function fetchServerOEmbed(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`/api/facebook-oembed?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!resp.ok) {
      let body;
      try {
        body = await resp.json();
      } catch {
        body = await resp.text().catch(() => null);
      }
      return { embed_available: false, status: resp.status, fb_body: body };
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    clearTimeout(id);
    return { embed_available: false, error: err?.message || String(err) };
  }
}

export default function FacebookEmbed({ url, className = "" }) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(null); // 'iframe' | 'link' | null

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setHtml(null);
    setFallback(null);
    setLoading(true);

    (async () => {
      const data = await fetchServerOEmbed(url);
      if (cancelled) return;
      if (data?.embed_available === false && data?.is_fb_post === true) {
        console.warn("facebook-oembed: embed not available", data);
        // server explicitly indicates no embed — try iframe fallback
        setFallback("iframe");
      } else if (data?.html) {
        setHtml(data.html);
      } else if (typeof data === "string" && data.trim().startsWith("<")) {
        setHtml(data);
      } else if (data?.preview) {
        const htmlPreview = `<div style="border:1px solid #ccc; padding:8px;">Source : <a href="${data.preview.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit;">
          ${data.preview.thumbnail_url ? `<img src="${data.preview.thumbnail_url}" alt="${data.preview.title || "Preview"}" style="max-width:100%; height:auto; display:block; margin-bottom:8px;" />` : ""}
          <strong>${data.preview.title || data.preview.url}</strong>
          <p>${data.preview.description || ""}</p>
        </a>
        </div>`;
        setHtml(htmlPreview);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) return <div className={className}>Chargement du contenu Facebook…</div>;

  if (html)
    return (
      <div
        className={`facebook-embed ${className}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    );

  if (fallback === "iframe")
    return (
      <div className={className}>
        <div style={{ width: "100%", maxWidth: 750, margin: "0 auto" }}>
          <iframe
            title="Facebook post"
            src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`}
            style={{ border: "none", overflow: "hidden", width: "100%", height: 600 }}
            scrolling="no"
            allowFullScreen={true}
            loading="lazy"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {"Voir la source"}
          </a>
        </div>
      </div>
    );

  if (fallback === "link")
    return (
      <div className={className}>
        <div style={{ marginTop: 8 }}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {"Voir la source"}
          </a>
        </div>
      </div>
    );

  return null;
}
