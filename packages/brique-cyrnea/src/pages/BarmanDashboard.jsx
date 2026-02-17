/**
 * BarmanDashboard - Administrative Control Panel for Cyrnea Bar Management
 *
 * PURPOSE:
 * This file defines the administrative interface for bar managers and administrators
 * in the Cyrnea bar application. It provides comprehensive tools for overseeing,
 * configuring, and managing all aspects of a virtual bar environment, from user
 * moderation to service control and atmosphere management.
 *
 * ARCHITECTURAL ROLE:
 * - Serves as the primary control panel for bar staff and administrators
 * - Implements role-based access control with different permission levels
 * - Orchestrates multiple management widgets and control interfaces
 * - Integrates with Entity-Service Pattern for data management
 * - Provides real-time monitoring and moderation capabilities
 *
 * KEY FEATURES:
 * - Real-time feed monitoring with moderation tools
 * - Session control (open/close bar management)
 * - Ritual triggering and coffee distribution
 * - WiFi configuration and network settings
 * - Role switching and permission management
 * - QR code generation for client access
 * - Broadcast system for announcements
 * - Zone management and atmosphere control
 * - Music and audio controls
 * - Legend and gazette promotion tools
 *
 * RELATION TO CYRNEA ECOSYSTEM:
 * This component is the administrative counterpart to ClientMiniApp, working in conjunction with:
 * - Bar services for state management and configuration
 * - User management system for role-based permissions
 * - Room metadata for settings and preferences
 * - Message system for feed moderation
 * - Ritual and game systems for entertainment management
 * - Network configuration for local deployment
 *
 * TECHNICAL IMPLEMENTATION:
 * - Uses React hooks for state management and effects
 * - Implements Entity-Service Pattern for data flow
 * - Modular widget architecture for maintainability
 * - Local storage for session persistence
 * - Mobile-responsive design with tab navigation
 * - Real-time updates via Inseme context
 * - Permission-based UI rendering
 *
 * ADMINISTRATIVE FUNCTIONS:
 * - Feed moderation and content promotion
 * - User role management and switching
 * - Bar configuration and settings
 * - Network and WiFi management
 * - Session lifecycle control
 * - Ritual and entertainment coordination
 * - Broadcast and announcement system
 * - Security access via sesame codes
 *
 * UI/UX DESIGN:
 * - Mondrian-inspired layout with grid system
 * - Widget-based modular interface
 * - Color-coded status indicators
 * - Mobile-optimized with tab navigation
 * - Accessibility-focused controls
 * - Real-time status updates
 *
 * === STORAGE ARCHITECTURE ===
 *
 * 📱 USER DATA (Client-Side localStorage):
 * - Barman session state and preferences stored in localStorage
 * - Authentication tokens and session data (sesame validation)
 * - UI preferences and navigation state
 * - Temporary operational data for barman device
 * - NO Supabase auth system used - intentional privacy design
 *
 * 🏠 BAR DATA (Supabase inseme_rooms.metadata):
 * - All bar configuration stored in room metadata column
 * - WiFi settings: ssid, password, network configuration
 * - Service availability: Ophelia, Gabriel, music, games
 * - Zone definitions: indoor, outdoor, terrace layouts
 * - Ritual configurations and game pack selections
 * - Barman permissions and sesame codes for access control
 * - Session state: open/closed status, active rituals
 * - Custom links: Facebook, Instagram, external resources
 *
 * 💬 MESSAGES (Supabase inseme_messages):
 * - All user interactions and administrative actions
 * - Chat messages, visual signals, attachments
 * - Legend promotions and gazette publications
 * - Tip declarations and ritual participations
 * - Game interactions and challenge completions
 * - After-party proposals and event announcements
 * - Administrative broadcasts and system notifications
 * - Linked to room_id with pseudonym identifiers only
 */

// ========================================
// BARMAN DASHBOARD - MAIN ASSEMBLY
// Assemblage principal avec migration Entity-Service Pattern
// ========================================

import React, { useState, useMemo, useCallback } from "react";
import {
  Users,
  Music,
  MessageSquare,
  Trophy,
  Settings,
  QrCode,
  Archive,
  Coffee,
  Radio,
  Camera,
  Image,
  X,
  Send,
  MapPin,
  Wind,
  Home,
  Sparkles,
  Newspaper,
  Moon,
  Volume2,
  Clock,
  Globe,
  Lock,
} from "lucide-react";
import { Button, Badge } from "@inseme/ui";
import { useInsemeContext, TalkButton, MondrianBlock, CameraModal } from "@inseme/room";
import { storage } from "@inseme/cop-host";
import { Icon } from "../components/Icon";
import { formatDate as formatTimestamp } from "@inseme/cop-host";
import ZoneManager from "../components/settings/ZoneManager";
import { TheBar, TheUser } from "../singletons/index.js";
import { getBarRoles } from "../lib/roles.js";
import FundingWidget from "./FundingWidget";
import MusicControl from "../components/MusicControl";
import { getDailyAlibi, BAR_RITUALS } from "../lib/almanac.js";
import { GAME_PACKS } from "../lib/gameManager.js";

import { CollectiveMoodWidget, GlobalConfigWidget, CityLinksWidget } from "./BarmanDashboard-part2";

import {
  CoffeeDistributorWidget,
  RitualsWidget,
  ZoneSwitcher,
  MusicControlWidget,
  LegendsWidget,
  SessionControlWidget,
} from "./BarmanDashboard-part3";

const MASTER_SESAME = "42";
const OPHELIA_ID = "ophelia";

/* =========================
   BROADCAST OVERLAY
   ========================= */

const BroadcastOverlay = ({ event }) => {
  if (!event) return null;

  const getEventContent = (type) => {
    switch (type) {
      case "url_change":
        return {
          title: "🌐 URL DU BAR CHANGÉE",
          message: "Nouvelle URL de connexion",
          color: "bg-blue-500",
          icon: Globe,
        };
      case "sesame_required":
        return {
          title: "🔐 SÉSAME REQUIS",
          message: "Code d'accès nécessaire pour configurer le bar",
          color: "bg-yellow-500",
          icon: Lock,
        };
      default:
        return {
          title: "📢 INFORMATION",
          message: "Mise à jour du bar",
          color: "bg-gray-500",
          icon: Sparkles,
        };
    }
  };

  const content = getEventContent(event.type);
  const IconComponent = content.icon;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm ${content.color} text-white p-4 rounded-lg shadow-lg border-2 border-black animate-pulse`}
    >
      <div className="flex items-center gap-3">
        <IconComponent className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-black text-sm">{content.title}</h3>
          <p className="text-xs opacity-90">{content.message}</p>
        </div>
      </div>
    </div>
  );
};

/* =========================
   FEED WIDGET
   ========================= */

const FeedWidget = ({ messages, onPromoteToLegend, onPromoteToGazette, currentUser, zones }) => {
  // Accès direct au singleton User
  const hasPermission = (permission) =>
    TheUser.role === "barman" || TheUser.permissions?.includes(permission);
  const canModerate = hasPermission("moderate") || currentUser?.can?.moderate;

  const getZoneLabel = (zoneId) => {
    if (!zoneId) return null;
    if (Array.isArray(zones)) {
      const z = zones.find((z) => z.id === zoneId);
      if (z) return z.label;
    }
    if (zoneId === "indoor") return "Intérieur";
    if (zoneId === "outdoor") return "Terrasse";
    return zoneId;
  };

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col"
    >
      <div className="flex justify-between items-center p-2 border-b-4 border-black bg-slate-50">
        <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
          <MessageSquare className="w-4 h-4" strokeWidth={4} /> Feed
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0 scrollbar-hide bg-white">
        {messages
          .slice(-12)
          .reverse()
          .map((msg, i) => (
            <div
              key={i}
              className={`p-2 border-b border-black text-xs flex flex-col gap-1 text-black group relative ${msg.user_id === "ophelia" ? "bg-mondrian-yellow/10" : "bg-white"}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-end min-w-[60px] max-w-[80px]">
                  <span className="font-black uppercase text-[10px] text-right truncate text-mondrian-blue w-full">
                    {msg.name}
                  </span>
                  {msg.metadata?.zone && (
                    <span className="text-[7px] font-bold uppercase opacity-50 leading-none truncate w-full text-right text-black/60">
                      {getZoneLabel(msg.metadata.zone)}
                    </span>
                  )}
                </div>
                <p className="font-bold leading-tight uppercase flex-1">{msg.message}</p>
                <div className="flex gap-1">
                  {msg.type === "after_proposal" && (
                    <button
                      onClick={() => (window.location.search = `?room=${msg.metadata?.after_slug}`)}
                      className="p-1 bg-mondrian-blue text-white border-2 border-black hover:bg-black hover:text-mondrian-blue transition-all flex items-center gap-1 px-2 animate-pulse"
                      title="Rejoindre l'After"
                    >
                      <Moon className="w-3 h-3" />
                      <span className="text-[8px] font-black">REJOINDRE L'AFTER</span>
                    </button>
                  )}
                  {onPromoteToLegend && canModerate && msg.user_id !== "ophelia" && (
                    <button
                      onClick={() => onPromoteToLegend(msg)}
                      className="p-1 bg-mondrian-yellow border-2 border-black hover:bg-black hover:text-mondrian-yellow transition-all"
                      title="Ajouter aux Légendes"
                    >
                      <Trophy className="w-3 h-3" />
                    </button>
                  )}
                  {onPromoteToGazette && canModerate && msg.user_id !== "ophelia" && (
                    <button
                      onClick={() => onPromoteToGazette(msg)}
                      className="p-1 bg-mondrian-blue text-white border-2 border-black hover:bg-black hover:text-mondrian-blue transition-all"
                      title="Promouvoir en Gazette de la Ville"
                    >
                      <Newspaper className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {msg.metadata?.image_url && (
                <div className="ml-[68px] mt-1 border border-black max-w-[120px]">
                  <img src={msg.metadata.image_url} alt="Signal" className="w-full h-auto" />
                </div>
              )}
            </div>
          ))}
      </div>
    </MondrianBlock>
  );
};

const RoleSwitcher = ({ currentRole, onRoleChange, currentUser, BAR_ROLES }) => {
  const canConfigure = currentUser?.can?.configure;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex justify-between items-center mb-2 border-b-4 border-black pb-2 px-2 pt-2 bg-black text-white">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-mondrian-yellow" strokeWidth={4} />
          <h2 className="text-lg font-black tracking-tighter">Ambiance</h2>
        </div>
      </div>
      <div className="flex-1 flex flex-col divide-y-2 divide-black overflow-hidden relative">
        {!canConfigure && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center p-4 text-center">
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">
              Réservé aux Administrateurs
            </span>
          </div>
        )}
        {Object.values(BAR_ROLES).map((role) => (
          <button
            key={role.id}
            disabled={!canConfigure}
            onClick={() => onRoleChange(role.id)}
            className={`flex-1 flex flex-col justify-center p-3 text-left transition-colors group ${
              currentRole === role.id ? "bg-mondrian-yellow" : "hover:bg-mondrian-yellow/10"
            } ${!canConfigure ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-xs">{role.name}</span>
              {currentRole === role.id && <Zap className="w-4 h-4 text-black animate-pulse" />}
            </div>
            <span className="text-[9px] font-bold opacity-60 leading-tight">
              {role.description}
            </span>
          </button>
        ))}
      </div>
    </MondrianBlock>
  );
};

/* =========================
   BARMAN DASHBOARD - MAIN
   ========================= */

export default function BarmanDashboard({ roomId }) {
  const context = useInsemeContext();
  const {
    currentUser,
    messages,
    activeSpeakers,
    sendMessage,
    roomData,
    roomMetadata,
    sendBroadcast,
    isAfter,
    cleanupEphemeralLogs,
    endSession,
    startSession,
  } = context;

  const isOpen = context.isOpen ?? false;

  // =========================
  // STATES
  // =========================
  const [mobileTab, setMobileTab] = useState(
    () => localStorage.getItem("inseme_barman_tab") || "overview"
  );
  const [broadcastEvent, setBroadcastEvent] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [hasSesameSession, setHasSesameSession] = useState(() => {
    if (typeof window === "undefined") return false;
    const sesameStorageKey = `inseme_bar_sesame_ok_${TheBar?.slug || roomId || "bar"}`;
    return localStorage.getItem(sesameStorageKey) === "true";
  });

  const fileInputRef = React.useRef(null);
  const galleryInputRef = React.useRef(null);

  // =========================
  // MEMOS
  // =========================
  const clientUrl = useMemo(() => {
    const roomSettings = roomMetadata?.settings;
    if (roomSettings?.tunnel_url) return roomSettings.tunnel_url;
    if (roomSettings?.local_ip && roomSettings.local_ip !== "localhost") {
      return `http://${roomSettings.local_ip}:${window.location.port || 8888}`;
    }
    const origin = window.location.origin;
    if (origin.includes("localhost") && roomSettings?.local_ip) {
      return origin.replace("localhost", roomSettings.local_ip);
    }
    return origin;
  }, [roomMetadata?.settings]);

  const vibeScore = useMemo(() => {
    const base = 70;
    const votes = roomData?.results || {};
    const positive = votes["vibe:up"] || 0;
    const negative = votes["vibe:down"] || 0;
    const score = base + positive * 5 - negative * 5;
    return Math.max(0, Math.min(100, score));
  }, [roomData?.results]);

  // =========================
  // HANDLERS
  // =========================
  const handleSesameValidated = useCallback(() => {
    if (typeof window !== "undefined") {
      const sesameStorageKey = `inseme_bar_sesame_ok_${TheBar?.slug || roomId || "bar"}`;
      localStorage.setItem(sesameStorageKey, "true");
    }
    setHasSesameSession(true);
  }, [roomId]);

  const handleWiFiUpdate = useCallback(async (settings) => {
    // TODO: Implémenter la mise à jour des paramètres WiFi
    console.debug("WiFi settings update:", settings);
  }, []);

  const handlePromoteToLegend = useCallback((msg) => {
    // TODO: Implémenter la promotion vers les légendes
    console.debug("Promote to legend:", msg);
  }, []);

  const handlePromoteToGazette = useCallback((msg) => {
    // TODO: Implémenter la promotion vers la gazette
    console.debug("Promote to gazette:", msg);
  }, []);

  const handleDistributeCoffee = useCallback(() => {
    sendMessage(`[SYSTÈME] : ☕ Un café suspendu vient d'être offert à un client !`, {
      type: "ritual_consumed",
      metadata: { ritual: "suspendu" },
    });
  }, [sendMessage]);

  const handleTriggerRitual = useCallback((ritual) => {
    // TODO: Implémenter le déclenchement de rituel
    console.debug("Trigger ritual:", ritual);
  }, []);

  const handleZoneChange = useCallback((zone) => {
    // TODO: Implémenter le changement de zone
    console.debug("Zone change:", zone);
  }, []);

  const handleMusicToggle = useCallback(() => {
    // TODO: Implémenter le basculement musique
    console.debug("Music toggle");
  }, []);

  const handleVolumeChange = useCallback((volume) => {
    // TODO: Implémenter le changement de volume
    console.debug("Volume change:", volume);
  }, []);

  // =========================
  // EFFECTS
  // =========================
  React.useEffect(() => {
    if (!clientUrl) return;
    const currentOrigin = window.location.origin;
    if (
      clientUrl.includes("ngrok") ||
      clientUrl.includes("cloudflare") ||
      clientUrl.includes("lhr.life")
    ) {
      if (currentOrigin !== clientUrl && !currentOrigin.includes("localhost")) {
        setBroadcastEvent({ type: "url_change", newUrl: clientUrl });
      }
    }
  }, [clientUrl]);

  React.useEffect(() => {
    localStorage.setItem("inseme_barman_tab", mobileTab);
  }, [mobileTab]);

  React.useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent.toLowerCase();
      setIsMobile(/mobile|android|iphone|ipad|tablet/i.test(ua));
    };
    checkMobile();
  }, []);

  // Memos and derived data must be before any return
  const barName = TheBar?.name || "";
  const commune = TheBar?.commune || "";
  const CAN_CONFIGURE = TheUser?.canConfigure || TheUser?.role === "barman";
  const BAR_ROLES = useMemo(() => getBarRoles(barName), [barName]);
  const barSesame = roomMetadata?.settings?.bar_sesame || "";

  // Accès direct aux singletons - avec safety check
  if (!TheBar) {
    return (
      <div className="min-h-screen bg-mondrian-yellow flex items-center justify-center p-8">
        <MondrianBlock
          color="white"
          className="p-8 border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
        >
          <h2 className="text-2xl font-black uppercase mb-4">Initialisation en cours...</h2>
          <p className="font-bold opacity-60">
            Veuillez patienter pendant la connexion au bar {roomId || "..."}
          </p>
        </MondrianBlock>
      </div>
    );
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div className="min-h-screen bg-mondrian-yellow p-4">
      <BroadcastOverlay event={broadcastEvent} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-4 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase">{barName}</h1>
              <p className="text-sm opacity-60">{commune || "Local"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{isOpen ? "Ouvert" : "Fermé"}</Badge>
              <Badge variant="outline">{CAN_CONFIGURE ? "Admin" : "Barman"}</Badge>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feed */}
          <div className="lg:col-span-2">
            <FeedWidget
              messages={messages}
              onPromoteToLegend={handlePromoteToLegend}
              onPromoteToGazette={handlePromoteToGazette}
              currentUser={currentUser}
              zones={roomMetadata?.settings?.zones}
            />
          </div>

          {/* Controls Column */}
          <div className="space-y-4">
            <SessionControlWidget
              isOpen={isOpen}
              onStartSession={startSession}
              onEndSession={endSession}
              currentUser={currentUser}
              isAfter={isAfter}
            />

            <CoffeeDistributorWidget
              onDistribute={handleDistributeCoffee}
              currentUser={currentUser}
            />

            <RitualsWidget onTrigger={handleTriggerRitual} currentUser={currentUser} />

            <RoleSwitcher
              currentRole={currentUser.role}
              onRoleChange={(role) => console.log(role)}
              currentUser={currentUser}
              BAR_ROLES={BAR_ROLES}
            />
          </div>

          {/* Configuration Row */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlobalConfigWidget
              ssid={roomMetadata?.settings?.wifi_ssid}
              password={roomMetadata?.settings?.wifi_password}
              onUpdate={handleWiFiUpdate}
              commune={commune}
              currentUser={currentUser}
              barSesame={barSesame}
              hasSesameSession={hasSesameSession}
            />

            <CityLinksWidget commune={commune} roomData={roomData} />

            <ZoneManager />

            <ZoneSwitcher
              currentZone="indoor" // TODO: Récupérer depuis le contexte
              onZoneChange={handleZoneChange}
              zones={roomMetadata?.settings?.zones}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
