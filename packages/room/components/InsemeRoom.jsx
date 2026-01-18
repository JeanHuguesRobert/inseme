import React, { useState } from "react";
import { BarChart3, FileText, Vote, Users } from "lucide-react";
import { useInsemeContext } from "../InsemeContext";
import { Chat } from "./Chat";
import { Results } from "./Results";
import { VoteButtons } from "./VoteButtons";
import { ModernMediaLayer } from "./ModernMediaLayer";
import { BRIQUES, BRIQUE_COMPONENTS } from "../generated/brique-registry.js";

// Lazy loading du WikiPage s'il est disponible
const WikiPage = React.lazy(() => {
  const wikiComponent = BRIQUE_COMPONENTS["wiki:/wiki/:slug"];
  return wikiComponent ? wikiComponent() : Promise.resolve({ default: () => null });
});

// Lazy loading du GroupDetail s'il est disponible
const GroupPage = React.lazy(() => {
  const groupComponent = BRIQUE_COMPONENTS["group:/groups/:id"];
  return groupComponent ? groupComponent() : Promise.resolve({ default: () => null });
});

function RoomLayout({ slots = {}, onToggleBoard, isBoardOpen, isSpectator, roomName }) {
  const { terminology, group, roomData } = useInsemeContext();
  const [activeTab, setActiveTab] = useState("participation"); // 'participation', 'wiki' or 'group'

  // Vérifier si les briques sont disponibles dans le registre
  const isWikiAvailable = BRIQUES.some((b) => b.id === "wiki");
  const isGroupAvailable = BRIQUES.some((b) => b.id === "group") && group;

  const ChatComponent = slots.Chat || Chat;
  const ResultsComponent = slots.Results || Results;
  const VoteButtonsComponent = slots.VoteButtons || VoteButtons;
  const MediaLayerComponent = slots.MediaLayer || ModernMediaLayer;

  return (
    <div className="h-full bg-mondrian-black text-white selection:bg-mondrian-blue/30 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto p-2 md:p-6 lg:p-8 flex flex-col h-full">
        {/* Media Layer (Fixed ratio or collapsed) */}
        {roomData?.media && (
          <div className="shrink-0 mb-4 lg:mb-6">
            <MediaLayerComponent media={roomData.media} />
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-8 min-h-0 relative">
          {/* Discussion Column (Primary) */}
          <div
            className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ease-in-out ${isBoardOpen ? "lg:w-2/3" : "lg:w-full"}`}
          >
            <ChatComponent onToggleBoard={onToggleBoard} isBoardOpen={isBoardOpen} />
          </div>

          {/* Interactive Board (Collapsible) */}
          <div
            className={`
                            fixed inset-y-0 right-0 z-40 w-full sm:w-[450px] lg:relative lg:w-[450px] lg:z-0
                            transform transition-all duration-500 ease-in-out bg-mondrian-black/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none
                            ${isBoardOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 lg:hidden"}
                        `}
          >
            <div className="h-full flex flex-col p-6 lg:p-0 space-y-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex bg-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("participation")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      activeTab === "participation"
                        ? "bg-mondrian-blue text-white shadow-lg shadow-mondrian-blue/20"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Vote className="w-4 h-4" />
                    Participation
                  </button>
                  {isWikiAvailable && (
                    <button
                      onClick={() => setActiveTab("wiki")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === "wiki"
                          ? "bg-mondrian-red text-white shadow-lg shadow-mondrian-red/20"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Wiki
                    </button>
                  )}
                  {isGroupAvailable && (
                    <button
                      onClick={() => setActiveTab("group")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === "group"
                          ? "bg-mondrian-yellow text-black shadow-lg shadow-mondrian-yellow/20"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Groupe
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onToggleBoard(false)}
                  className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white lg:hidden"
                >
                  Fermer
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {activeTab === "participation" ? (
                  <div className="space-y-6">
                    <VoteButtonsComponent />
                    <ResultsComponent />
                  </div>
                ) : activeTab === "wiki" ? (
                  <div className="wiki-embedded-container">
                    <React.Suspense
                      fallback={<div className="text-center py-12">Chargement...</div>}
                    >
                      <WikiPage slug={`room:${roomName}`} isEmbedded={true} />
                    </React.Suspense>
                  </div>
                ) : (
                  <div className="group-embedded-container">
                    <React.Suspense
                      fallback={<div className="text-center py-12">Chargement...</div>}
                    >
                      <GroupPage id={group.id} isEmbedded={true} />
                    </React.Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Floating Toggle for Board */}
          {!isBoardOpen && (
            <button
              onClick={() => onToggleBoard(true)}
              className="fixed bottom-24 right-6 z-50 p-4 rounded-full bg-mondrian-yellow shadow-2xl shadow-mondrian-yellow/50 text-black lg:flex hidden items-center gap-2 animate-in fade-in slide-in-from-right-4"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">
                {terminology.dashboard}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * InsemeRoom - The all-in-one assembly room component.
 *
 * @param {string} roomName - The unique ID of the room.
 * @param {object} user - The current Supabase user.
 * @param {object} supabase - The Supabase client instance.
 * @param {object} config - Configuration object (jitsi, ophelia, prompts).
 * @param {object} slots - Custom component overrides { Chat, Results, VoteButtons, MediaLayer }.
 */
export function InsemeRoom({ roomName, user, supabase, isSpectator, onBack, slots = {} }) {
  const [isBoardOpen, setIsBoardOpen] = useState(true);

  return (
    <RoomLayout
      slots={slots}
      onToggleBoard={setIsBoardOpen}
      isBoardOpen={isBoardOpen}
      isSpectator={isSpectator}
      roomName={roomName}
    />
  );
}
