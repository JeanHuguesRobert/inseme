import React, { useRef, useEffect } from "react";

/**
 * Controls
 * Props:
 * - input: string
 * - setInput: fn
 * - onSend: async fn
 * - onAbort: fn
 * - isLoading: bool
 * - isMobile: bool
 */
export default function Controls({
  input,
  setInput,
  onSend,
  onAbort,
  isLoading = false,
  isMobile = false,
  placeholder = "Posez votre question...",
  onClearHistory = null,
  onPublish = null,
  hasConversation = false,
  messagesLength = 0,
  exampleQuestions = [],
  onExampleClick = null,
  onOpenModelModal = null,
  elapsedMs = 0,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    // auto-resize textarea height to content
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(44, el.scrollHeight)}px`;
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) onSend();
    }
  };

  return (
    <div className={`chat-controls-area ${isMobile ? "mobile" : ""}`}>
      <div className="input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label="Message"
        />

        <div className="controls-actions">
          <div className="controls-group">
            {onOpenModelModal && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onOpenModelModal()}
                title="Changer de modèle/fournisseur"
                aria-label="Changer de modèle et fournisseur"
              >
                <span aria-hidden>🛠️</span>
                <span className="btn-label">Modèle</span>
              </button>
            )}
            {onClearHistory && messagesLength > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClearHistory}
                title="Effacer l'historique"
              >
                <span aria-hidden>🧹</span>
                <span className="btn-label">Effacer</span>
              </button>
            )}

            {hasConversation && onPublish && messagesLength > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onPublish}
                title="Publier la conversation"
              >
                <span aria-hidden>📄</span>
                <span className="btn-label">Publier</span>
              </button>
            )}
          </div>

          <div className="controls-group">
            <button
              type="button"
              className="send-btn"
              onClick={onSend}
              disabled={isLoading || !input.trim()}
              title={isLoading ? "Envoi en cours" : "Envoyer"}
              aria-label="Envoyer le message"
            >
              <span aria-hidden>{isLoading ? "⏳" : "➤"}</span>
              <span className="btn-label">{isLoading ? "Envoi..." : "Envoyer"}</span>
            </button>

            {isLoading && (
              <>
                <span
                  style={{ fontSize: "14px", color: "#666", minWidth: "30px", textAlign: "center" }}
                >
                  {Math.floor(elapsedMs / 1000)}s
                </span>
                <button
                  type="button"
                  className="send-btn send-btn-abort"
                  onClick={onAbort}
                  title="Annuler la requête"
                >
                  <span aria-hidden>✖</span>
                  <span className="btn-label">Annuler</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
