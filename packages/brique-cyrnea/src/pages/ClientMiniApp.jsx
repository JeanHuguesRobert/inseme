/**
 * ClientMiniApp - Main Client Interface for Cyrnea Bar Application
 *
 * PURPOSE:
 * This file defines the primary client-side interface for the Cyrnea bar application,
 * serving as the central hub for all user interactions within a virtual bar environment.
 * It implements a comprehensive social platform that combines real-time communication,
 * gaming, rituals, and community features in a Mondrian-inspired UI design.
 *
 * ARCHITECTURAL ROLE:
 * - Acts as the main entry point for client users joining a bar room
 * - Orchestrates multiple screen components (Fil, Legends, City, Games, Profile)
 * - Manages global application state through AppProvider context
 * - Integrates with Inseme room system for real-time collaboration
 * - Handles user authentication, presence, and service management
 *
 * KEY FEATURES:
 * - Real-time chat with AI assistants (Ophelia/Gabriel)
 * - Vibe scoring and atmosphere management
 * - Ritual participation (suspended coffee, tips)
 * - Game integration and voting systems
 * - User profiles and barman declaration
 * - Invitation system and after-party creation
 * - Broadcast overlays and visual signals
 * - Mobile-responsive design with touch interactions
 *
 * RELATION TO CYRNEA ECOSYSTEM:
 * This component is the client-side counterpart to the bar management system,
 * working in conjunction with:
 * - Bar services for room management and state
 * - Presence system for user tracking
 * - Authentication hooks for user identity
 * - Screen components for specialized functionality
 * - Modal system for overlays and interactions
 *
 * TECHNICAL IMPLEMENTATION:
 * - Uses React hooks for state management
 * - Implements Entity-Service Pattern for data flow
 * - Integrates with WebRTC for real-time features
 * - Supports file attachments and camera capture
 * - Handles network tunneling for local deployments
 *
 * UI/UX DESIGN:
 * - Mondrian-inspired color scheme and layout
 * - Responsive grid system
 * - Touch-friendly navigation
 * - Accessibility-focused interactions
 * - Animated transitions and micro-interactions
 *
 * === STORAGE ARCHITECTURE ===
 *
 * USER DATA (Client-Side localStorage):
 * - User pseudonym and preferences are stored in localStorage ONLY
 * - This is intentional: NO Supabase auth system is used
 * - Privacy-first design: no personal data in centralized databases
 * - User device is the source of truth for personal data
 *
 * BAR DATA (Supabase inseme_rooms.metadata):
 * - Bar configuration, settings, and state stored in room metadata
 * - Includes WiFi settings, service availability, zone definitions
 * - Ritual configurations and game pack selections
 * - Session state and barman permissions
 *
 * MESSAGES (Supabase inseme_messages):
 * - All user interactions stored in messages table
 * - Chat, legends, tips, rituals, games, after-parties
 * - Linked to room_id with pseudonym identifiers
 * - No personal data, only pseudonyms and content
 */

// packages/brique-cyrnea/pages/ClientMiniApp.jsx

import React, { useState, useRef, useMemo } from "react";
import { TheBar, TheUser } from "../singletons/index.js";
import { useInsemeContext } from "@inseme/room";
import { CurrentUserContext } from "@inseme/cop-host";
import { Icon } from "../components/Icon";
import { LinksManager } from "../components/LinksManager";
import UserDisplay from "../components/UserDisplay";
import UserProfile from "../components/UserProfile";
import { useHybridPresence } from "../hooks/useHybridPresence.js";

// Import des nouveaux composants découpés
import LegendsScreen from "../screens/LegendsScreen";
import CityScreen from "../screens/CityScreen";
import GamesScreen from "../screens/GamesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import GameInterface from "../components/GameInterface";
import BarmanModal from "../components/BarmanModal";
import BroadcastOverlay from "../components/BroadcastOverlay";
import { normalizePublicLink, MondrianTabTrigger, MondrianBlock } from "../utils/uiUtils";

// Import Ophelia components
import OpheliaScreen from "../components/OpheliaScreen";
import TipModal from "../components/TipModal";
import InviteModal from "../components/InviteModal";
import { ErrorModal } from "../components/ErrorModal";
import { CameraModal } from "../components/CameraModal";

// Import new context and hooks
import { AppProvider, useAppContext } from "../contexts/AppContext";
import { useAuth } from "../hooks/useAuth.js";
import { usePresence } from "../hooks/usePresence.js";
import { useBarman } from "../hooks/useBarman.js";
import PersistentCamera from "../components/camera/PersistentCamera";

/* =========================
   MAIN APP
   ========================= */

function ClientMiniAppContent() {
  const context = useInsemeContext();
  const { toggleService } = React.useContext(CurrentUserContext);
  const { castVote, roomMetadata, messages, sendMessage, sendBroadcast, isAfter, currentUser } =
    context;

  // Hook hybride pour gérer les données de présence
  const { presenceHistory } = useHybridPresence(
    roomMetadata?.id,
    TheUser.id || currentUser?.user_id
  );

  // Use custom hooks for state management
  const { state: appState, actions } = useAppContext();
  const auth = useAuth(currentUser, roomMetadata);
  const presence = usePresence(currentUser, roomMetadata);
  const barman = useBarman();
  const cameraRef = useRef(null);

  // Accès direct aux singletons - plus de hooks legacy
  const connectedUsers = TheBar.connectedUsers;
  const vibeScore = TheBar.vibeScore || 0;

  // Calcul direct depuis les messages
  const activeGames = useMemo(
    () => messages?.filter((m) => m.type === "game_start") || [],
    [messages]
  );
  const activeRituals = useMemo(
    () => messages?.filter((m) => m.type === "ritual_start") || [],
    [messages]
  );
  const legendMessages = useMemo(
    () => messages?.filter((m) => m.type === "legend") || [],
    [messages]
  );

  // Ophelia state
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [isOpheliaThinking, setIsOpheliaThinking] = useState(false);

  // Additional state for chat functionality
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Derived: Active barmans from presence
  const barmans = useMemo(() => {
    if (!connectedUsers) return [];
    return connectedUsers.filter((u) => u.role === "barman");
  }, [connectedUsers]);

  // Client URL for invitations
  const clientUrl = useMemo(() => {
    const barSettings = TheBar.settings;

    // Priorité 1: Tunnel URL (ngrok/cloudflare) - Requis par l'utilisateur
    if (barSettings?.tunnel_url) return barSettings.tunnel_url;

    // Priorité 2: URL de développement (localhost)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.origin;
    }

    // Priorité 3: URL de production
    const origin = window.location.origin;
    const isSecure = origin.startsWith("https://");
    const isWww = origin.includes("www.");

    // En production, préférer l'URL sans www et sécurisée
    if (isSecure && !isWww) return origin;
    if (isSecure && isWww) return origin.replace("www.", "");
    if (!isSecure && !isWww) return origin.replace("http://", "https://");
    if (!isSecure && isWww) return origin.replace("http://www.", "https://");

    return origin;
  }, [TheBar.settings]);

  // Normalisation des liens publics
  const normalizedPublicLinks = useMemo(() => {
    if (!presence?.publicLinks || !Array.isArray(presence.publicLinks)) {
      return [];
    }
    return presence.publicLinks.map(normalizePublicLink);
  }, [presence?.publicLinks]);

  // Fonctions utilitaires
  const handleEditPseudo = () => {
    auth.setIsEditingPseudo(true);
  };

  const handleSavePseudo = () => {
    auth.handleSavePseudo();
  };

  const handleCancelEditPseudo = () => {
    auth.handleCancelEditPseudo();
  };

  const handleOpenBarmanModal = () => {
    barman.setBarmanModalOpen(true);
  };

  const handleCloseBarmanModal = () => {
    barman.setBarmanModalOpen(false);
  };

  const handleDeclareBarman = (data) => {
    barman.handleDeclareBarman(data, TheUser.pseudo || auth.pseudo, sendMessage);
  };

  const handleZoneChange = (newZone) => {
    presence.setZone(newZone);
  };

  const handlePublicLinksChange = (newLinks) => {
    presence.setPublicLinks(newLinks);
  };

  const handleToggleGabriel = () => {
    auth.setIsGabrielMode(!auth.isGabrielMode);
  };

  const handleToggleService = () => {
    try {
      TheUser.toggleService();
      // On force la mise à jour via le trigger barman
      barman.incrementBarmanUpdateTrigger();
      console.debug("[ClientMiniApp] Duty toggled:", TheUser.isOnDuty);
    } catch (err) {
      actions.showError("Erreur", err.message);
    }
  };

  // Ophelia handlers
  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleAttachCamera = () => {
    setIsCameraOpen(true);
  };

  const handleAttachGallery = () => {
    document.getElementById("client-gallery-input")?.click();
  };

  const handleClearAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  };

  // Cleanup preview URL when attachment changes or component unmounts
  React.useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  const handleSendMessage = async () => {
    if (!text.trim() && !attachment) return;

    try {
      const currentMsg = text;
      setText("");

      await sendMessage(
        currentMsg || "📸 Signal Visuel",
        {
          type: "visual_signal",
          pseudonym: TheUser.pseudo || currentUser.pseudo || undefined,
        },
        attachment?.file
      );
    } catch (err) {
      console.error("Send failed", err);
    }
  };

  // Set a short status for the current user (broadcast as user_status message)
  const handleSetStatus = async (statusText) => {
    if (!statusText || !statusText.trim()) return;
    try {
      await sendMessage(statusText.trim(), { type: "user_status", status_text: statusText.trim() });
    } catch (err) {
      console.error("Set status failed", err);
    }
  };

  // Trigger AI response if in the right screen
  if (appState.screen === "fil") {
    // TODO: Implémenter les fonctions AI si nécessaire
    // if (auth.isGabrielMode) {
    //   askGabriel(currentMsg);
    // } else {
    //   askOphélia(currentMsg);
    // }
  }

  const handleTip = () => {
    actions.setTippingModalOpen(true);
  };

  const handleTipSubmit = async ({
    barman,
    amount,
    message,
    privacy,
    attachment,
    method = "manual",
  }) => {
    try {
      // Mode EXCLUSIVEMENT MANUEL
      // On broadcast juste l'intention/ambiance
      if (method === "manual") {
        const level = amount >= 50 ? "imperial" : amount >= 20 ? "royal" : "classic";

        if (sendBroadcast) {
          sendBroadcast("celebrate", {
            level,
            from: privacy === "all" ? auth.pseudo : privacy === "anon" ? "Anonyme" : "Un client",
            to: barman.name,
            amount: null, // On cache toujours le montant pour le manuel (discrétion)
            message: privacy === "all" ? message : null,
            privacy,
            realFrom: auth.pseudo,
            attachment: privacy === "all" ? attachment : null,
            method,
          });
        }

        // Message public dans le chat si pas anonyme
        if (privacy === "all") {
          await sendMessage(`[POURBOIRE] 🍻 Un geste a été fait pour ${barman.name} !`, {
            type: "tip_declaration",
            metadata: {
              from: auth.pseudo,
              to: barman.name,
              message,
            },
          });
        }

        // Overlay local immédiat pour le donneur
        actions.setTipSuccessData({
          amount: "Don Manuel",
          barman: barman.name,
          message,
          privacy,
          method,
        });
        actions.setTipSuccess(true);
        setTimeout(() => {
          actions.setTipSuccess(false);
          actions.setTipSuccessData(null);
        }, 5000);

        return;
      }
    } catch (err) {
      console.error("Tipping failed:", err);
      alert("Erreur: " + err.message);
    }
  };

  const handleSuspendu = async () => {
    await sendMessage(
      `❤️ ${TheUser.pseudo.toUpperCase() || "UN CLIENT"} offre un CAFÉ SUSPENDU ! Quelle générosité ! ✨`,
      {
        type: "ritual_participation",
        metadata: { ritual: "suspendu", name: "Café Suspendu" },
        pseudonym: TheUser.pseudo || undefined,
      }
    );
  };

  const handleInvite = () => {
    actions.setInviteModalOpen(true);
  };

  const handleAfter = () => {
    if (isAfter) {
      alert("Vous êtes déjà dans un After !");
      return;
    }

    const confirmAfter = confirm(
      "Voulez-vous proposer un After ? Cela créera une salle éphémère et préviendra les autres participants."
    );

    if (confirmAfter) {
      const parentSlug = TheBar.slug;
      if (!parentSlug) {
        alert("Impossible de créer un After : endroit introuvable.");
        return;
      }

      const afterSlug = `${parentSlug}-after-${Math.random().toString(36).substring(2, 7)}`;
      const clientUrl = window.location.origin;

      // Envoyer un message pour prévenir les autres avec un ton plus cool
      sendMessage({
        message: `🌙 L'After commence ! On se retrouve de l'autre côté pour finir la soirée tranquillement... 🥂\n\nRejoindre l'after : ${clientUrl}/app?room=${afterSlug}`,
        type: "after_proposal",
        metadata: {
          parent_slug: parentSlug,
          after_slug: afterSlug,
          proposed_by: TheUser.pseudo || "Un noctambule",
          is_cool: true,
        },
      });

      // Rediriger vers le nouvel After
      setTimeout(() => {
        window.location.search = `?room=${afterSlug}`;
      }, 1000);
    }
  };

  // Vibe score calculation - Utiliser le hook de présence
  const barVibeScore = vibeScore;

  const vibeColor = useMemo(() => {
    if (vibeScore > 80) return "var(--mondrian-red)"; // Red - Hot
    if (vibeScore > 50) return "var(--mondrian-yellow)"; // Yellow - Good
    return "var(--mondrian-blue)"; // Blue - Chill
  }, [vibeScore]);

  // Vibe handlers
  const handleVibeUp = () => {
    castVote("vibe:up");
  };

  const handleVibeDown = () => {
    castVote("vibe:down");
  };

  // Active games - Utiliser le hook de présence
  const barActiveGames = activeGames;

  // Active rituals - Utiliser le hook de présence
  const barActiveRituals = activeRituals;

  // Rendu principal
  return (
    <div className="h-full flex flex-col bg-white text-slate-900 antialiased">
      {/* HEADER */}
      <header
        className="grid grid-cols-12 gap-0 border-b-8 border-black transition-all duration-1000 relative overflow-hidden shrink-0"
        style={{ backgroundColor: vibeColor }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        </div>

        {/* Left Section - Bar Info */}
        <div className="col-span-8 relative z-10 p-4 md:p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <h1
              className={`text-3xl md:text-5xl font-black italic tracking-tighter transition-colors duration-1000 ${vibeColor === "var(--mondrian-yellow)" ? "text-black" : "text-white"}`}
            >
              {TheBar.name}
            </h1>
          </div>
        </div>

        {/* Right Section - Vibe Controls & User Profile */}
        <div className="col-span-4 relative z-10 flex">
          <button
            className="flex-1 bg-black text-white hover:bg-white hover:text-black transition-colors border-r-4 border-black flex items-center justify-center"
            onClick={handleVibeUp}
          >
            <Icon name="thumbsUp" className="w-6 h-6" strokeWidth={3} />
          </button>
          <button
            className="flex-1 bg-black text-white hover:bg-white hover:text-black transition-colors border-r-4 border-black flex items-center justify-center"
            onClick={handleVibeDown}
          >
            <Icon name="thumbsDown" className="w-6 h-6" strokeWidth={3} />
          </button>
          <button
            className="flex-1 bg-black text-white hover:bg-white hover:text-black transition-colors flex items-center justify-center p-2"
            onClick={() => actions.setScreen("profile")}
            title="Profil"
          >
            <Icon name="user" className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT - SCROLLABLE */}
      <main className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] overflow-y-auto">
        {barActiveRituals?.length > 0 && (
          <div
            className="bg-mondrian-yellow border-b-8 border-black p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500 cursor-pointer hover:bg-black hover:text-mondrian-yellow transition-colors group"
            onClick={() => actions.setScreen("fil")}
          >
            <div className="flex items-center gap-3">
              <Icon
                name="sparkles"
                className="w-8 h-8 group-hover:rotate-12 transition-transform"
              />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                  Rituel Actif
                </p>
                <h3 className="text-xl font-black italic tracking-tighter leading-none">
                  {barActiveRituals[barActiveRituals.length - 1].metadata?.name}
                </h3>
              </div>
            </div>
            <div className="bg-black text-mondrian-yellow px-4 py-2 border-4 border-black group-hover:bg-mondrian-yellow group-hover:text-black transition-colors font-black text-xs uppercase">
              PARTICIPER
            </div>
          </div>
        )}

        {/* CONTENEUR POUR LES SCREENS - CHAQUE SCREEN GÈRE SON PROPRE SCROLL */}
        <div className="h-full">
          {appState.screen === "fil" && (
            <OpheliaScreen
              context={context}
              isMobile={false} // Removed mobile detection
              attachment={attachment}
              text={text}
              onTextChange={setText}
              onSend={handleSendMessage}
              onAttach={handleAttach}
              onAttachCamera={handleAttachCamera}
              onAttachGallery={handleAttachGallery}
              onClearAttachment={handleClearAttachment}
              onTip={handleTip}
              onSuspendu={handleSuspendu}
              onInvite={handleInvite}
              onAfter={handleAfter}
              isAfter={isAfter}
              isThinking={isOpheliaThinking}
              onThinkingChange={setIsOpheliaThinking}
            />
          )}
          {appState.screen === "legends" && (
            <LegendsScreen legends={legendMessages} currentUser={currentUser} />
          )}
          {appState.screen === "city" && (
            <CityScreen
              context={{
                ...roomMetadata,
                presentPeople: presenceHistory,
              }}
              currentUser={currentUser}
            />
          )}
          {appState.screen === "games" && (
            <GamesScreen
              activeGames={barActiveGames}
              castVote={castVote}
              sendMessage={sendMessage}
              currentUser={currentUser}
            />
          )}
          {appState.screen === "profile" && (
            <ProfileScreen
              context={context}
              currentUser={currentUser}
              zone={presence.zone}
              isBarman={barman.isBarman}
              roomMetadata={roomMetadata}
              onEditPseudo={handleEditPseudo}
              onOpenBarmanModal={handleOpenBarmanModal}
              onZoneChange={handleZoneChange}
              publicLinks={normalizedPublicLinks}
              onPublicLinksChange={handlePublicLinksChange}
              isGabrielMode={auth.isGabrielMode}
              onToggleGabriel={handleToggleGabriel}
              toggleService={handleToggleService}
              isOnDuty={TheUser.isOnDuty}
              onSetStatus={handleSetStatus}
            />
          )}
        </div>

        {/* Modals */}
        {barman.isBarmanModalOpen && (
          <BarmanModal
            isOpen={barman.isBarmanModalOpen}
            onClose={handleCloseBarmanModal}
            onDeclare={handleDeclareBarman}
            toggleService={handleToggleService}
            isOnDuty={TheUser.isOnDuty}
          />
        )}

        {/* Tip Modal */}
        {appState.isTippingModalOpen && (
          <TipModal
            isOpen={appState.isTippingModalOpen}
            onClose={() => actions.setTippingModalOpen(false)}
            barmans={barmans}
            onTip={handleTipSubmit}
            currentUser={currentUser}
            context={context}
            userZone={presence.zone}
          />
        )}

        {/* Invite Modal */}
        {appState.isInviteModalOpen && (
          <InviteModal
            isOpen={appState.isInviteModalOpen}
            onClose={() => actions.setInviteModalOpen(false)}
            currentUser={currentUser}
            roomMetadata={roomMetadata}
            clientUrl={clientUrl}
          />
        )}

        {/* Broadcast Overlay */}
        {presence.broadcastEvent && <BroadcastOverlay event={presence.broadcastEvent} />}

        {/* Tip Success Overlay */}
        {appState.showTipSuccess && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 pointer-events-none">
            <div className="bg-mondrian-yellow border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300 pointer-events-auto">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-4 leading-none">
                  Pourboire Enregistré !
                </h2>
                <p className="font-bold uppercase text-sm mb-6 leading-relaxed">
                  {appState.tipSuccessData?.barman} a bien reçu votre geste
                </p>
                {appState.tipSuccessData?.message && (
                  <div className="bg-white border-4 border-black p-4 mb-4">
                    <p className="text-sm italic">"{appState.tipSuccessData.message}"</p>
                  </div>
                )}
                <div className="text-xs font-black uppercase opacity-60">
                  {appState.tipSuccessData?.amount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Camera Stream */}
        <PersistentCamera ref={cameraRef} active={isCameraOpen} />

        {/* Camera Modal Overlay/Controller */}
        {isCameraOpen && (
          <CameraModal
            isOpen={isCameraOpen}
            cameraRef={cameraRef}
            onClose={() => setIsCameraOpen(false)}
            onCapture={(data) => {
              setAttachment(data);
              setIsCameraOpen(false);
            }}
          />
        )}

        {/* Edit Pseudo Modal */}
        {auth.isEditingPseudo && (
          <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
            <MondrianBlock
              color="yellow"
              className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative p-8"
            >
              <button
                onClick={handleCancelEditPseudo}
                className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
              >
                <Icon name="x" className="w-6 h-6" strokeWidth={4} />
              </button>
              <div className="flex flex-col gap-6">
                <header className="text-center">
                  <Icon name="user" className="w-12 h-12 mx-auto mb-4 text-mondrian-blue" />
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                    Votre Pseudo
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
                    Comment vous appelez-vous ?
                  </p>
                </header>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={auth.draftPseudo}
                    onChange={(e) => auth.setDraftPseudo(e.target.value)}
                    placeholder="Entrez votre pseudo..."
                    className="w-full border-4 border-black p-3 font-black uppercase text-sm focus:outline-none focus:bg-mondrian-yellow transition-colors"
                    maxLength={20}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEditPseudo}
                    className="flex-1 bg-white text-mondrian-red py-3 border-4 border-mondrian-red font-black uppercase text-sm hover:bg-red-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSavePseudo}
                    disabled={!auth.draftPseudo.trim()}
                    className="flex-1 bg-mondrian-blue text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-black transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            </MondrianBlock>
          </div>
        )}

        {/* Hidden file inputs for attachments */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              setAttachment({
                file,
                previewUrl: URL.createObjectURL(file),
              });
            }
          }}
        />

        <input
          type="file"
          id="client-gallery-input"
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const previewUrl = URL.createObjectURL(file);
              setAttachment({ file, previewUrl });
            }
          }}
        />

        {/* Error Modal */}
        <ErrorModal
          isOpen={appState.isErrorModalOpen}
          onClose={() => actions.setErrorModalOpen(false)}
          title={appState.errorModalData?.title}
          message={appState.errorModalData?.message}
          onRetry={appState.errorModalData?.onRetry}
        />
      </main>

      {/* NAVIGATION BAS */}
      <nav className="h-24 bg-white border-t-8 border-black shrink-0 relative z-50">
        <div className="grid grid-cols-5 h-full gap-0">
          {/* Navigation */}
          <MondrianTabTrigger
            isActive={appState.screen === "fil"}
            onClick={() => actions.setScreen("fil")}
            color="blue"
            icon={() => <Icon name="home" />}
            label="Fil"
          />
          <MondrianTabTrigger
            isActive={appState.screen === "legends"}
            onClick={() => actions.setScreen("legends")}
            color="yellow"
            icon={() => <Icon name="trophy" />}
            label="Légendes"
          />
          <MondrianTabTrigger
            isActive={appState.screen === "city"}
            onClick={() => actions.setScreen("city")}
            color="blue"
            icon={() => <Icon name="map" />}
            label="Chez vous"
          />
          <MondrianTabTrigger
            isActive={appState.screen === "games"}
            onClick={() => actions.setScreen("games")}
            color="yellow"
            icon={() => <Icon name="gamepad2" />}
            label="Jeux"
          />
          <MondrianTabTrigger
            label="Vocal"
            icon={() => <Icon name="mic" />}
            isActive={false}
            onClick={() => (window.location.href = `/vocal/${TheBar.slug}`)}
            color="white"
          />
        </div>
      </nav>
    </div>
  );
}

// Wrapper component with AppProvider
export default function ClientMiniApp() {
  return (
    <AppProvider>
      <ClientMiniAppContent />
    </AppProvider>
  );
}
