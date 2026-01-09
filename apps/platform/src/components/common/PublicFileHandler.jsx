// src/components/common/PublicFileHandler.jsx
// Handles public file routes (/docs/*, etc.) - renders markdown in-app, others redirect to raw file

import { useLocation, Navigate } from "react-router-dom";
import MarkdownViewer from "../../../../../packages/ui/src/components/MarkdownViewer";

/**
 * Handles public file routes:
 * - .md files → Renders with MarkdownViewer
 * - Other files → Redirects to raw file URL
 */
export default function PublicFileHandler() {
  const location = useLocation();
  const filePath = location.pathname;

  // For markdown files, render with MarkdownViewer
  if (filePath.endsWith(".md")) {
    // Pass the file path as a query param to MarkdownViewer
    return <Navigate to={`/markdown-viewer?file=${encodeURIComponent(filePath)}`} replace />;
  }

  // For other files, redirect to the raw file (served by Vite/Netlify static)
  // This allows the browser to handle PDFs, images, etc. natively
  window.location.href = filePath;
  return null;
}
