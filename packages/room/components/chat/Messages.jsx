// src/components/bob/v2/Messages.jsx

import React, { useState, useEffect, useRef } from "react";
import { MarkdownViewer } from "@inseme/ui";
import {
  ChevronRight,
  RefreshCw,
  Wrench,
  BarChart,
  Lightbulb,
} from "lucide-react";

// Helper to extract all <Think>...</Think> blocks and regroup consecutive ones
const extractThoughts = (text) => {
  if (!text) return { thoughts: [], content: "" };

  const thoughts = [];

  // Use a regex to find all <Think> blocks, including those that might not be closed yet (streaming)
  // We look for <Think> followed by anything until </Think> or the end of the string
  const thinkRegex = /<Think>([\s\S]*?)(?:<\/Think>|$)/gi;
  let match;
  let lastMatchEnd = 0;

  while ((match = thinkRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) {
      const startIndex = match.index;
      const isComplete = match[0].endsWith("</Think>");

      // Check if this block is consecutive with the previous one (only whitespace in between)
      const gap = text.substring(lastMatchEnd, startIndex);
      const isConsecutive = lastMatchEnd > 0 && gap.trim() === "";

      if (isConsecutive && thoughts.length > 0) {
        // Regroup with previous thought
        const lastThought = thoughts[thoughts.length - 1];
        lastThought.text += "\n\n" + content;
        lastThought.isComplete = isComplete;
      } else {
        // New thought block
        thoughts.push({
          text: content,
          isComplete: isComplete,
        });
      }
    }
    lastMatchEnd = thinkRegex.lastIndex;
  }

  // Remove all <Think> blocks from the content to be rendered as main message
  const content = text.replace(/<Think>[\s\S]*?(?:<\/Think>|$)/gi, "").trim();

  return { thoughts, content };
};

// Component to display a single thought
const ThoughtItem = ({ thought, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef(null);

  if (!thought || !thought.text) return null;

  // Auto-open if it's the active streaming thought
  useEffect(() => {
    if (isStreaming && !thought.isComplete) {
      setIsOpen(true);
    }
  }, [isStreaming, thought.isComplete]);

  // Determine icon and label based on content
  let Icon = Lightbulb;
  let label = "Réflexion";
  let type = "general";

  const lowerText = thought.text.toLowerCase();
  const hasProvider =
    lowerText.includes("selecting provider") ||
    lowerText.includes("fournisseur") ||
    lowerText.includes("llm call");
  const hasTool =
    lowerText.includes("executing tool") ||
    lowerText.includes("outil") ||
    lowerText.includes("tool requested");
  const hasMonitoring =
    lowerText.includes("monitoring") ||
    lowerText.includes("suivi") ||
    lowerText.includes("technique") ||
    lowerText.includes("metrics");

  if (hasProvider && hasTool) {
    Icon = Lightbulb;
    label = "Analyse et exécution";
    type = "general";
  } else if (hasProvider) {
    Icon = RefreshCw;
    label = "Configuration du modèle";
    type = "provider";
  } else if (hasTool) {
    Icon = Wrench;
    label = "Utilisation d'outils";
    type = "tool";
  } else if (hasMonitoring) {
    Icon = BarChart;
    label = "Détails techniques";
    type = "monitoring";
  }

  return (
    <div
      className={`thought-item thought-type-${type} ${!thought.isComplete ? "is-active" : ""}`}
    >
      <div
        className="thought-summary"
        onClick={() => setIsOpen(!isOpen)}
        title="Cliquez pour voir les détails"
      >
        <span className={`thought-toggle-icon ${isOpen ? "open" : ""}`}>
          <ChevronRight size={14} />
        </span>
        <span className="thought-icon">
          <Icon size={16} />
        </span>
        <span className="thought-label">{label}</span>
        {!thought.isComplete && <span className="thought-pulse" />}
      </div>
      <div
        className={`thought-content-wrapper ${isOpen ? "is-open" : ""}`}
        style={{ height: isOpen ? "auto" : 0 }}
      >
        <div className="thought-content">
          <MarkdownViewer content={thought.text} />
        </div>
      </div>
    </div>
  );
};

// Component to display all thoughts
const ThoughtBlock = ({ thoughts, isStreaming }) => {
  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="thought-block">
      {thoughts.map((thought, index) => (
        <ThoughtItem
          key={index}
          thought={thought}
          isStreaming={isStreaming && index === thoughts.length - 1}
        />
      ))}
    </div>
  );
};

export default function Messages({
  messages = [],
  onFeedback = () => {},
  onNotUsefulClick = () => {},
  handlePublishWiki = () => {},
  chatbotSettings = {},
  relatedPropositions = [],
  ModelMetricsBadge = null,
  providersStatus = null,
  exampleQuestions = [],
  onExampleClick = null,
  messagesEndRef = null,
  onCreateProposition = null,
}) {
  const containerRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (messagesEndRef?.current) {
      const behavior = messages.some((m) => m.isStreaming) ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [messages]);

  return (
    <div className="messages-container" ref={containerRef}>
      {messages.length === 0 ? (
        <div className="welcome-message">
          <p>Je peux vous aider avec :</p>
          <ul className="example-questions">
            {exampleQuestions.map((q, i) => {
              const isObj = q && typeof q === "object" && q.text;
              const label = isObj
                ? `${q.emoji || ""} ${q.label || ""}`.trim()
                : q;
              const text = isObj ? q.text : q;
              return (
                <li
                  key={i}
                  onClick={() => (onExampleClick ? onExampleClick(text) : null)}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`message ${msg.sender} ${msg.error ? "error" : ""} ${msg.isNotification ? "notification" : ""}`}
            >
              {msg.sender !== "system" && (
                <div className="message-avatar">
                  {msg.sender === "user" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                  )}
                </div>
              )}

              <div className="message-content">
                {msg.isNotification ? (
                  <div className="notification-message">
                    {msg.link ? (
                      <a href={msg.link} className="notification-link">
                        {msg.text}
                      </a>
                    ) : (
                      <p>{msg.text}</p>
                    )}
                  </div>
                ) : (
                  <>
                    {(() => {
                      const { thoughts, content } = extractThoughts(msg.text);
                      return (
                        <>
                          {thoughts.length > 0 && (
                            <ThoughtBlock
                              thoughts={thoughts}
                              isStreaming={msg.isStreaming}
                            />
                          )}
                          <div className="message-text">
                            <MarkdownViewer content={String(content || "")} />
                          </div>
                        </>
                      );
                    })()}
                    {msg.isStreaming && (
                      <div className="streaming-indicator">
                        <span className="typing-dots">
                          <span>.</span>
                          <span>.</span>
                          <span>.</span>
                        </span>
                      </div>
                    )}

                    {msg.sources?.length > 0 && (
                      <div className="message-sources">
                        <h5>Sources :</h5>
                        <div className="sources-list">
                          {msg.sources.map((source, j) => (
                            <div key={j} className="source-item">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                {source.type === "wiki_page" && (
                                  <span className="source-icon">📖</span>
                                )}
                                {source.type === "proposition" && (
                                  <span className="source-icon">🗳️</span>
                                )}
                                {source.type === "pdf" && (
                                  <span className="source-icon">📄</span>
                                )}
                                {source.type === "wiki_page" &&
                                  "Wiki communautaire"}
                                {source.type === "proposition" &&
                                  "Proposition citoyenne"}
                                {source.type === "pdf" && "Document officiel"}
                              </a>
                              <p className="source-preview">{source.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.sender === "bot" && !msg.isStreaming && (
                      <div className="message-actions">
                        <div className="feedback-buttons">
                          <button
                            onClick={() => onFeedback(msg.id, "useful")}
                            className={`feedback-btn useful ${msg.feedback === "useful" ? "active" : ""}`}
                            disabled={msg.feedback === "useful"}
                          >
                            {msg.feedback === "useful"
                              ? "Merci pour votre avis !"
                              : "Utile"}
                          </button>
                          <button
                            onClick={() => onNotUsefulClick(msg)}
                            className={`feedback-btn ${msg.feedback === "not_useful" ? "active" : ""}`}
                          >
                            {msg.feedback === "not_useful"
                              ? "Merci ! (Réessayer ?)"
                              : "Pas assez"}
                          </button>
                        </div>
                        {chatbotSettings.enable_proposition_creation && (
                          <button
                            onClick={() =>
                              onCreateProposition && onCreateProposition(msg)
                            }
                            className="btn btn-secondary"
                          >
                            💡 Formuler une proposition
                          </button>
                        )}
                        <button
                          onClick={handlePublishWiki}
                          className="btn btn-primary btn-publish-wiki"
                          title="Publier cette conversation comme page Wiki"
                        >
                          📖 Publier Wiki
                        </button>
                      </div>
                    )}

                    <div className="message-meta">
                      {msg.provider && msg.model && ModelMetricsBadge && (
                        <ModelMetricsBadge
                          provider={msg.provider}
                          mode={msg.model}
                          providersStatus={providersStatus}
                        />
                      )}
                      {msg.cached && (
                        <span
                          className="cached-badge"
                          title={
                            msg.cacheKey
                              ? `Cache key: ${msg.cacheKey}`
                              : "Réponse en cache"
                          }
                        >
                          🗄️ En cache
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Related propositions after last user message */}
              {i === messages.length - 1 &&
                msg.sender === "user" &&
                relatedPropositions.length > 0 && (
                  <div className="related-propositions">
                    <h5>Discussions similaires :</h5>
                    <ul>
                      {relatedPropositions.map((prop, index) => (
                        <li key={index}>
                          <a
                            href={`/propositions/${prop.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {prop.title}
                          </a>
                          <div className="prop-meta">
                            <span>🗳️ {prop.votes?.length || 0} votes</span>
                            <span>
                              💬 {prop.comments?.length || 0} commentaires
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          ))}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}
