import { MarkdownViewer } from "@inseme/ui";
import SiteFooter from "../layout/SiteFooter";
import FilHeader from "./FilHeader";
import { useMarkdownDoc } from "../../hooks/useMarkdownDoc.js";

export default function FilGuidelines() {
  const { content, loading, error } = useMarkdownDoc("fil-guidelines.md");

  const styles = {
    container: {
      maxWidth: 800,
      margin: "0 auto",
      background: "var(--color-bg-app)",
      minHeight: "100vh",
    },
    content: {
      padding: "16px",
      fontFamily: "var(--font-body)",
      lineHeight: 1.6,
    },
  };

  return (
    <>
      <div style={styles.container}>
        <FilHeader activePage="guidelines" />
        <div style={styles.content}>
          {loading && <p>Chargement...</p>}
          {error && <p>Erreur: {error}</p>}
          {!loading && !error && <MarkdownViewer content={content} />}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
