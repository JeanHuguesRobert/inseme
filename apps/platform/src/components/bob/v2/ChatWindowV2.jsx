import React, { useRef, useEffect, useMemo } from "react";
import "./chat-v2.css";
import Header from "./Header";
import Messages from "./Messages";
import Controls from "../../../../../../packages/room/components/chat/Controls";
import PropositionForm from "../../../../../../packages/room/components/chat/PropositionForm";
import ModelSelectionModal from "../../../../../../packages/room/components/chat/ModelSelectionModal";
import ModelBadge from "../../../../../../packages/room/components/chat/ModelBadge";
import useChatLogic from "./useChatLogic.js";
import AuthModal from "../../common/AuthModal";
import { useGlobalStatus as useOpStatus } from "@inseme/cop-host";
import SiteFooter from "../../layout/SiteFooter";
import { getSupabase } from "../../../lib/supabase.js";
import QUESTION_POOL from "../../../../../../packages/room/data/questionPool.js";

/**
 * ChatWindowV2
 * Composed v2 chat UI: uses `useChatLogic` and small v2 modules
 * (Header, Messages, Controls, ProviderBadges, PropositionForm).
 * Intended for incremental migration and feature-parity testing.
 */
export default function ChatWindowV2({ useV2 = true, ...props }) {
  // If enabled, render the v2 composed layout wired to the hook.
  const logic = useChatLogic({ user: props.user, chatId: props.chatId });
  const messagesEndRef = useRef(null);
  const { operations } = useOpStatus();

  const displayedQuestions = useMemo(() => {
    return [...QUESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
  }, []);

  const handleProviderStatusSelect = (providerName, mode) => {
    if (!providerName) return;
    logic.selectProvider?.(providerName, mode);
  };

  const [isMobileState, setIsMobileState] = React.useState(props.isMobile || false);

  useEffect(() => {
    if (props.isMobile !== undefined) {
      setIsMobileState(props.isMobile);
      return;
    }
    const checkMobile = () => setIsMobileState(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [props.isMobile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logic.messages]);

  return (
    <div className="chat-interface">
      <Header
        botName={props.botName}
        welcomeMessage={props.welcomeMessage}
        isMobile={isMobileState}
        user={props.user}
        onSignIn={() => logic.openAuthModal()}
        onSignOut={async () => {
          try {
            await getSupabase().auth.signOut();
          } catch (_) {}
        }}
      />
      {/* Inline operation indicator (simple) */}
      {operations && operations.size > 0 && (
        <div className="op-operations">
          {Array.from(operations.values()).map((op) => (
            <div key={op.id}>{op.description || op.type}</div>
          ))}
        </div>
      )}
      {/* Provider badges are shown inside the model modal now (merged UI) */}
      <div className="chat-scrollable-area">
        <Messages
          messages={logic.messages}
          messagesEndRef={messagesEndRef}
          onFeedback={logic.handleFeedback}
          onNotUsefulClick={logic.handleNotUsefulClick}
          handlePublishWiki={logic.handlePublishWiki}
          chatbotSettings={{ enable_proposition_creation: true }}
          relatedPropositions={logic.relatedPropositions}
          ModelMetricsBadge={ModelBadge}
          providersStatus={logic.providersStatus}
          exampleQuestions={displayedQuestions}
          onExampleClick={(q) => logic.setInput(q)}
          onCreateProposition={(msg) => {
            const lastUser = [...logic.messages]
              .slice()
              .reverse()
              .find((m) => m.sender === "user");
            const question = logic.input || (lastUser ? lastUser.text : "");
            const title = `Discussion: ${String(question).slice(0, 60)}`;
            const description = `**Question originale:** ${question}\n\n**Réponse initiale du chatbot:**\n${msg.text}\n\n---\nCette proposition a été créée automatiquement à partir d'une discussion avec l'assistant citoyen.`;
            logic.openPropositionForm({ title, description });
          }}
        />
      </div>

      <Controls
        input={logic.input}
        setInput={logic.setInput}
        onSend={() => logic.sendMessage()}
        onAbort={logic.abort}
        isLoading={logic.isLoading}
        onClearHistory={logic.handleClearHistory}
        onPublish={logic.handlePublishWiki}
        hasConversation={logic.hasConversation}
        isMobile={isMobileState}
        messagesLength={logic.messages.length}
        exampleQuestions={displayedQuestions}
        onExampleClick={(q) => logic.setInput(q)}
        onOpenModelModal={() => logic.openModelModal()}
        elapsedMs={logic.elapsedMs}
      />

      {/* Per-operation status bar (footer) */}
      {operations && operations.size > 0 && (
        <div className="chat-op-status-bar" aria-live="polite">
          {Array.from(operations.values()).map((op) => (
            <div key={op.id} className="op-item">
              {op.description || op.type}{" "}
              {op.state === "ERROR" || op.state === "error"
                ? "⚠️"
                : op.state === "RUNNING" || op.state === "running"
                  ? "⏳"
                  : ""}
            </div>
          ))}
        </div>
      )}

      <PropositionForm
        show={logic.showPropositionForm}
        onClose={() => logic.setShowPropositionForm(false)}
        title={logic.newPropositionTitle}
        description={logic.newPropositionDescription}
        setTitle={logic.setNewPropositionTitle}
        setDescription={logic.setNewPropositionDescription}
        onCreate={logic.createProposition}
        suggestedTags={logic.suggestedTags}
        selectedTags={logic.selectedTags}
        setSelectedTags={logic.setSelectedTags}
      />

      {logic.showAuthModal && (
        <AuthModal
          onClose={() => logic.setShowAuthModal(false)}
          onSuccess={() => logic.setShowAuthModal(false)}
        />
      )}

      {/* Model Selection Modal */}
      {logic.modelModalOpen && (
        <ModelSelectionModal
          logic={logic}
          onClose={() => logic.setModelModalOpen(false)}
          onSelect={(selection) => {
            logic.handleModelSelection?.(selection);
          }}
        />
      )}
      <SiteFooter />
    </div>
  );
}

// Re-export small modules for incremental adoption.
export { Header, Messages, Controls, PropositionForm, ModelBadge, useChatLogic };
