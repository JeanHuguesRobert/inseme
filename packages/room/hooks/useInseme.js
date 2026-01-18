// src/package/inseme/hooks/useInseme.js

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder.js";

import { performWebSearch } from "@inseme/ophelia";
import { safeEval } from "../utils/SafeEval.proxy.js";

import {
  getConfig,
  loadInstanceConfig,
  useGroup,
  useGroupMembers,
  storage,
} from "@inseme/cop-host";
import { GOVERNANCE_MODELS, getGovernanceModel, calculateResults } from "@inseme/kudocracy";

export const OPHELIA_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Applique une anonymisation comportementale aux messages d'une salle éphémère.
 * Remplace les pseudos par des identités floues basées sur l'activité observée.
 */
export function applyBehavioralAnonymization(messages, baseName = "Participant") {
  const userMap = {};
  const uniqueNames = [
    ...new Set(
      messages.filter((m) => m.name && !m.metadata?.is_ai && m.type !== "report").map((m) => m.name)
    ),
  ];

  uniqueNames.forEach((name, index) => {
    const userMsgs = messages.filter((m) => m.name === name);
    const msgCount = userMsgs.length;
    const totalLen = userMsgs.reduce((acc, m) => acc + (m.message?.length || 0), 0);
    const questionCount = userMsgs.filter((m) => m.message?.includes("?")).length;

    let traits = [];
    if (msgCount > 10) traits.push("très présent");
    else if (msgCount > 3) traits.push("actif");
    else traits.push("discret");

    if (totalLen / msgCount > 100) traits.push("éloquent");
    if (questionCount > msgCount / 2) traits.push("curieux");

    // On génère une identité "floue" mais descriptive (ex: Noctambule, Client, Participant)
    userMap[name] = `Un ${baseName} ${traits.join(", ")} (#${index + 1})`;
  });

  return messages.map((m) => {
    const anonymizedName = m.metadata?.is_ai ? m.name : userMap[m.name] || "Un participant anonyme";

    // On anonymise le contenu du message (qu'il vienne d'un humain ou d'une IA)
    let anonymizedContent = m.message;
    if (typeof anonymizedContent === "string") {
      Object.keys(userMap).forEach((realName) => {
        // On remplace le nom réel par le nom anonyme dans le texte du message
        // Utilisation d'une regex avec frontières de mots pour éviter les remplacements partiels
        const escapedName = realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedName}\\b`, "g");
        anonymizedContent = anonymizedContent.replace(regex, userMap[realName]);
      });
    }

    return {
      ...m,
      name: anonymizedName,
      message: anonymizedContent,
      // On anonymise aussi les métadonnées si elles contiennent le nom
      metadata: m.metadata
        ? {
            ...m.metadata,
            name: m.metadata.name ? userMap[m.metadata.name] || m.metadata.name : m.metadata.name,
            user_name: m.metadata.user_name
              ? userMap[m.metadata.user_name] || m.metadata.user_name
              : m.metadata.user_name,
          }
        : m.metadata,
    };
  });
}

import { MediaManager, MockAdapter } from "../index"; // Import SmartAudio components
import { BRIQUES, CONSOLIDATED_PROMPTS } from "../generated/brique-registry.js";

export function useInseme(roomName, user, supabase, config = {}, isSpectator = false) {
  // 0. Stabilize Configuration
  const effectiveConfig = useMemo(() => {
    const vaultConfig = {
      opheliaUrl: getConfig("OPHELIA_URL"),
      ophelia: getConfig("OPHELIA_SETTINGS") || {},
    };

    return {
      ...vaultConfig,
      ...config,
      ophelia: {
        ...vaultConfig.ophelia,
        ...config.ophelia,
      },
      profileTable: config.profileTable || "users",
    };
  }, [config]);

  const PROFILE_TABLE = effectiveConfig.profileTable;

  const [messages, setMessages] = useState([]);
  const [roomData, setRoomData] = useState({
    proposition: "Pas de proposition active.",
    results: {},
    votes: {},
    media: null,
    speechQueue: [],
    moderators: [],
    sessionStatus: effectiveConfig.defaultSessionStatus || "closed", // 'open' | 'closed'
    connectedUsers: [],
    agenda: [],
    userPowers: {}, // { userId: { totalPower: number, declarations: [{ reason, multiplier }] } }
  });
  const [presenceState, setPresenceState] = useState({});
  const [presenceMetadata, setPresenceMetadata] = useState({});
  const [ephemeralThoughts, setEphemeralThoughts] = useState([]);
  const [isOphéliaThinking, setIsOphéliaThinking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vocalState, setVocalState] = useState("idle");
  const [microMode, setMicroMode] = useState("OFF");
  const [vocalError, setVocalError] = useState(null);
  const [semanticWindow, setSemanticWindow] = useState(null);
  const [isHandsFree, setIsHandsFree] = useState(() => {
    // Default to closed for privacy and browser compatibility
    // but allow persistence if the user explicitly enabled it
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_hands_free") === "true";
    }
    return false;
  });
  const [nativeLang, setNativeLang] = useState(localStorage.getItem("inseme_native_lang") || "fr");
  const [isSilent, setIsSilent] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_silent") === "true";
    }
    return false;
  });
  const [gabrielConfig, setGabrielConfig] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("inseme_gabriel_config");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse gabriel config", e);
        }
      }
    }
    return {
      enabled: false,
      url: "",
      key: "",
      provider: "openai", // fallback to ophelia if not configured
    };
  });
  const [governanceMode, setGovernanceMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_governance") === "true";
    }
    return false;
  });
  const [systemPrompt, setSystemPrompt] = useState("");
  const [roomMetadata, setRoomMetadata] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // 0.2 Group & Voting Rights
  const groupId = roomMetadata?.settings?.group_id;
  const { isMember, loading: groupLoading } = useGroup(groupId, user?.id);
  const { members: groupMembers, loading: membersLoading } = useGroupMembers(groupId);

  const memberIdsSet = useMemo(() => {
    if (!groupMembers) return new Set();
    return new Set(groupMembers.map((m) => m.user_id));
  }, [groupMembers]);

  const roomType = roomMetadata?.settings?.type || "democratie_directe";
  const templateId = useMemo(() => {
    if (roomMetadata?.settings?.template) return roomMetadata.settings.template;
    if (roomName?.includes("-after-")) return "after";
    if (roomName?.toLowerCase().includes("bar")) return "bar";
    return roomType;
  }, [roomMetadata, roomName, roomType]);

  const template = useMemo(
    () => getGovernanceModel(templateId) || getGovernanceModel("democratie_directe"),
    [templateId]
  );

  // Hiérarchie des rôles : spectator < guest < represented < authenticated < member
  const userRole = useMemo(() => {
    if (isSpectator) return "spectator";
    if (!user) return "guest";

    // Si l'utilisateur a explicitement le rôle 'represented' dans son profil
    if (user.role === "represented") return "represented";

    if (groupId) {
      if (isMember) return "member";
      return "authenticated";
    }
    return "member"; // Si pas de groupe, tout user authentifié est considéré comme membre de la session
  }, [isSpectator, user, groupId, isMember]);

  const isAfter = useMemo(() => {
    return templateId === "after" || roomName?.includes("-after-");
  }, [templateId, roomName]);

  const isBar = useMemo(() => {
    return (
      templateId === "bar" ||
      roomName?.toLowerCase().includes("bar") ||
      roomMetadata?.settings?.type === "bar"
    );
  }, [templateId, roomName, roomMetadata]);

  const isEphemeral = useMemo(() => {
    return template?.rules?.is_ephemeral || isAfter || isBar;
  }, [template, isAfter, isBar]);

  const terminology = useMemo(() => {
    // Fusionner la terminologie du modèle avec d'éventuels labels personnalisés
    return {
      ...template?.terminology,
      ...roomMetadata?.settings?.labels,
    };
  }, [template, roomMetadata]);

  const baseAnonymPseudo = useMemo(() => {
    if (isAfter) return "Noctambule";
    if (isBar) return "Client";
    return terminology.member || "Participant";
  }, [isAfter, isBar, terminology.member]);

  // Nouveau modèle unifié "currentUser"
  const currentUser = useMemo(() => {
    const isGuest = userRole === "guest" || isAfter;
    const isSpectatorRole = userRole === "spectator";
    const isRepresented = userRole === "represented";
    const isAgent = user?.id === OPHELIA_ID || user?.is_ai;

    let type = "INDIVIDUAL";
    if (isSpectatorRole) type = "SPECTATOR";
    else if (isAgent) type = "AGENT";
    else if (userProfile?.type === "collective" || user?.metadata?.type === "COLLECTIVE")
      type = "COLLECTIVE";

    return {
      id: user?.id || "guest-" + Math.random().toString(36).substr(2, 9),
      type,
      role: isAfter ? "guest" : userRole,
      pseudo: isEphemeral
        ? userProfile?.display_name ||
          userProfile?.pseudo ||
          (isAfter ? "Noctambule" : "Participant")
        : userProfile?.display_name ||
          userProfile?.pseudo ||
          user?.email ||
          (isGuest ? "Invité" : "Anonyme"),
      avatar: userProfile?.avatar_url || user?.avatar_url,
      is_ai: isAgent,
      is_collective: type === "COLLECTIVE",
      is_guest: isGuest,
      is_spectator: isSpectatorRole,
      is_after: isAfter,
      can: {
        vote:
          !isSpectatorRole &&
          !isRepresented &&
          (isAfter ||
            userRole === "member" ||
            (userRole === "guest" && template?.rules?.can_guests_vote) ||
            (userRole === "authenticated" && (template?.rules?.can_authenticated_vote ?? true))),
        speak:
          !isSpectatorRole &&
          !isRepresented &&
          (isAfter ||
            userRole === "member" ||
            (userRole === "guest" && template?.rules?.can_guests_interact !== false) ||
            (userRole === "authenticated" &&
              !(
                template?.rules?.can_authenticated_vote === false &&
                !template?.rules?.can_guests_interact
              ))),
        moderate:
          (isAfter || userRole === "member") &&
          (userProfile?.is_admin || userProfile?.role === "barman"),
        configure:
          (isAfter || userRole === "member") &&
          (userProfile?.is_admin || userProfile?.role === "barman"),
      },
      metadata: {
        ...user?.metadata,
        ...userProfile,
        is_after: isAfter,
      },
      summary: isAfter
        ? "MODE AFTER | COOL & INFORMEL"
        : `${type} | ${userRole.toUpperCase()} | ${
            isAgent ? "Agent IA" : isGuest ? "Invité" : isSpectatorRole ? "Spectateur" : "Citoyen"
          }`,
    };
  }, [user, userRole, userProfile, template, OPHELIA_ID, isAfter]);

  // canVote depends on:
  // 1. Template rules
  // 2. Being at least 'member' (or 'guest'/'authenticated' if allowed by template)
  const canVote = currentUser.can.vote;

  // canInteract (chat, parole) depends on:
  // 1. Template rules
  // 2. Being at least 'guest' or 'authenticated'
  const canInteract = currentUser.can.speak;
  const isEnterprise = roomType === "enterprise";

  const [functionLibrary, setFunctionLibrary] = useState({});
  const functionLibraryRef = useRef({});

  const [transcriptionStatus, setTranscriptionStatus] = useState({
    isActive: false,
    mode: "idle", // 'local', 'distributed', 'idle'
    nodes: [], // list of active transcription nodes
    lastTranscript: "",
  });
  const [deviceCapability, setDeviceCapability] = useState({
    isMobile: false,
    canRunWhisper: false, // PC with enough RAM/CPU
  });

  // 0.1 Device Capability Detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const canRunWhisper = !isMobile && navigator.deviceMemory >= 8; // Example heuristic
    setDeviceCapability({ isMobile, canRunWhisper });
  }, []);
  useEffect(() => {
    functionLibraryRef.current = functionLibrary;
  }, [functionLibrary]);

  const augmentedSystemPrompt = useMemo(() => {
    if (!systemPrompt) return "";

    const libContent = Object.entries(functionLibrary)
      .map(([name, func]) => `- \`${name}(${func.args || "input"})\`: ${func.description}`)
      .join("\n");

    const codeToolDesc = `

---
[CAPABILITIES (TOOLS & FUNCTIONS)]
Ophélia, tu disposes d'un ensemble de capacités unifiées (Tools & Functions).

TYPES DE CAPACITÉS :
1. **Capacités Pures** : Ne modifient pas l'état du monde (ex: \`web_search\`, \`search_memory\`, calculs mathématiques). Elles renvoient une information sans laisser de trace permanente en dehors du journal de bord.
2. **Capacités Impures (Effets de Bord)** : Modifient l'état de l'assemblée (ex: \`send_message\`, \`set_proposition\`, \`update_agenda\`).
   - **Règle d'Or** : Tout effet de bord DOIT être tracé par un message dans l'historique (automatique via les tools natifs).
   - **Propagation de l'Impureté** : Une fonction qui appelle une capacité impure devient elle-même impure.

OUTILS NATIFS :
- \`send_message(text: string)\` : [IMPUR] Envoyer un message au chat.
- \`set_proposition(text: string)\` : [IMPUR] Mettre à jour la proposition active.
- \`search_memory(query: string)\` : [PURE] Rechercher dans la mémoire à long terme.
- \`web_search(query: string)\` : [PURE] Rechercher sur le web.
- \`save_function(name: string, code: string, args: string, description: string)\` : [IMPUR] Créer une nouvelle capacité (tool personnalisé).

CAPACITÉS PERSONNALISÉES (BIBLIOTHÈQUE) :
${libContent || "Aucune capacité personnalisée pour l'instant."}

RÈGLES D'EXÉCUTION :
- Pour exécuter du code complexe ou appeler une capacité personnalisée, utilise \`execute_code(code: string, input: object, options: object)\`.
- Options disponibles :
  - \`debug: boolean\` (défaut: false) : Affiche les traces de debug (\`log\`) dans le chat.
  - \`silent: boolean\` (défaut: false) : Exécution éphémère. Le résultat n'est pas publié dans le chat (mais reste accessible pour ton prochain tour).
- Dans tes fonctions JS, appelle les tools natifs via \`Inseme.call("tool_name", { args })\`.
- Utilise la Programmation par Contrat (\`require\`, \`ensure\`) pour garantir la fiabilité.
- Pour le debug, utilise \`log(message)\` pour ajouter des traces visibles dans le rapport d'exécution.
`;
    return systemPrompt + codeToolDesc;
  }, [systemPrompt, functionLibrary]);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const currentSessionIdRef = useRef(null);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);
  const timersRef = useRef({});
  const recognitionRef = useRef(null);
  const localStreamRef = useRef(null);
  const messageCountRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);
  const keepAliveTimeoutRef = useRef(null);
  const channelRef = useRef(null);
  const sendMessageRef = useRef();
  const triggerOphéliaRef = useRef();
  const setPropositionRef = useRef();
  const generateReportRef = useRef();
  const cleanupEphemeralLogsRef = useRef();
  const promoteToPlenaryRef = useRef();
  const searchMemoryRef = useRef();
  const castVoteRef = useRef();

  // Smart Audio Manager
  const mediaManagerRef = useRef(null);

  useEffect(() => {
    // Initialize Media Manager with MockAdapter for now (or choose based on config)
    // In production this might be WebRTCAdapter
    const adapter = new MockAdapter();
    const manager = new MediaManager(adapter);

    // Initialize HostIO with VAD options
    manager.initHostIO({
      vadThreshold: 0.01,
      silenceTimeout: 1000,
      enableSemantic: config.enableSemantic || false,
      roomId: roomName,
      userId: user?.id,
    });

    manager.on("onSemanticState", (state) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "semantic_state",
          payload: state,
        });
      }

      // Also push to the Edge Function for semantic fusion
      const opheliaUrl = effectiveConfig.opheliaUrl || "/api/ophelia";
      fetch(`${opheliaUrl}/api/semantic/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          roomId: roomName,
          timestamp: Date.now(),
        }),
      }).catch((err) => console.warn("Failed to push semantic state:", err));
    });

    manager.on("onPlaybackStart", () => {
      if (typeof config.onPlaybackStart === "function") {
        config.onPlaybackStart();
      }
    });

    manager.on("onPlaybackEnd", () => {
      if (typeof config.onPlaybackEnd === "function") {
        config.onPlaybackEnd();
      }
    });

    mediaManagerRef.current = manager;

    return () => {
      manager.stopSession();
    };
  }, []);

  useEffect(() => {
    if (typeof config.onVocalStateChange === "function") {
      config.onVocalStateChange(vocalState);
    }
  }, [vocalState, config.onVocalStateChange]);

  useEffect(() => {
    if (!effectiveConfig.enableSemantic || !roomName) return;

    const fetchWindow = async () => {
      try {
        const opheliaUrl = effectiveConfig.opheliaUrl || "/api/ophelia";
        const response = await fetch(`${opheliaUrl}/api/semantic/window?room_id=${roomName}`);
        if (response.ok) {
          const data = await response.json();
          setSemanticWindow(data);
        }
      } catch (e) {
        console.warn("[useInseme] Failed to fetch semantic window:", e);
      }
    };

    fetchWindow();
    const interval = setInterval(fetchWindow, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [roomName, effectiveConfig.enableSemantic, effectiveConfig.opheliaUrl]);

  const stopVocal = useCallback(() => {
    mediaManagerRef.current?.AudioQueue.clear();
    setVocalState("idle");
  }, []);

  const changeMicroMode = useCallback(
    (nextMode) => {
      setMicroMode((prev) => {
        if (prev === nextMode) return prev;
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "mic_mode",
            payload: {
              user_id: user?.id || null,
              room_id: roomMetadata?.id || roomName,
              mode: nextMode,
              ts: Date.now(),
            },
          });
        }
        return nextMode;
      });
    },
    [roomName, roomMetadata?.id, user?.id]
  );

  const playVocal = async (payload) => {
    if (isSilent || !payload) return;

    // Stop current vocal if any (barge-in support)
    // stopVocal(); // SmartQueue handles this better, maybe we don't clear?
    // Actually user said "Stop Ophelia when user speaks". Barge-in is handled by VAD -> Stop Playback

    try {
      let arrayBuffer;
      if (payload.startsWith("http")) {
        const resp = await fetch(payload);
        arrayBuffer = await resp.arrayBuffer();
      } else {
        // Base64 to ArrayBuffer
        const binaryString = window.atob(payload);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      }

      if (mediaManagerRef.current) {
        setVocalState("speaking");
        // We enqueue. Note: SmartAudio.playChunk is async.
        // We don't easily know when it ends in this fire-and-forget flow without keeping track of the promise queue.
        // For now, assume "speaking" state is managed by the queue's isPlaying flag if we exposed it,
        // or we just trust the audio system.
        mediaManagerRef.current.AudioQueue.enqueue(arrayBuffer);
      }
    } catch (e) {
      console.error("Audio Playback Error:", e);
      setVocalState("idle");
    }
  };

  const updateStateWithMsg = useCallback(
    (state, msg) => {
      const text = msg.message.trim();

      // Auto-play vocal if present and not already handled by real-time broadcast
      if (msg.metadata?.vocal_url && msg.user_id !== user?.id) {
        playVocal(msg.metadata.vocal_url);
      }

      if (msg.metadata?.vocal_payload) {
        playVocal(msg.metadata.vocal_payload);
      }

      // Handle typed messages first
      if (msg.type === "agenda_update") {
        state.agenda = msg.metadata?.agenda || [];
        return;
      }

      if (msg.type === "ostracism_event") {
        if (!state.ostracized) state.ostracized = {};
        const { user_id, status, duration, reason, by } = msg.metadata;
        if (status === "ostracized") {
          state.ostracized[user_id] = {
            since: msg.created_at,
            duration,
            reason,
            by,
          };
        } else {
          delete state.ostracized[user_id];
        }
        return;
      }

      if (!text.toLowerCase().startsWith("inseme")) return;

      const parts = text.split(/\s+/);
      const command = parts[1]?.toLowerCase();
      const payload = parts.slice(2).join(" ");
      const userId = msg.user_id || msg.name;

      // Lifecycle Commands
      if (command === "open") {
        state.sessionStatus = "open";
      } else if (command === "close") {
        state.sessionStatus = "closed";
        state.proposition = "Session close.";
        state.votes = {};
        state.speechQueue = [];
      } else if (command === "?") {
        state.proposition = payload || "Proposition vide.";
        state.votes = {};
      } else if (command === "!") {
        state.votes = {};
        state.results = {};
        state.proposition = "Pas de proposition active.";
      } else if (["live", "image", "pad", "wiki", "twitter", "facebook"].includes(command)) {
        if (!payload || payload === "off" || payload === "-") {
          state.media = null;
        } else {
          state.media = { type: command, url: payload };
        }
      } else if (command === "agenda") {
        try {
          if (payload.startsWith("[")) {
            state.agenda = JSON.parse(payload);
          }
        } catch (e) {
          console.warn("Failed to parse agenda command:", e);
        }
      } else if (command === "power") {
        const powerParts = payload.split(/\s+/);
        const multiplier = parseInt(powerParts[0]);
        const reason = powerParts.slice(1).join(" ");

        if (!isNaN(multiplier) && multiplier >= 1) {
          if (!state.userPowers[userId]) {
            state.userPowers[userId] = { declarations: [] };
          }
          const declaration = {
            multiplier,
            reason: reason || "Déclaration de pouvoir",
            timestamp: msg.created_at,
          };
          state.userPowers[userId].declarations.push(declaration);

          if (state.votes[userId]) {
            const baseWeight = state.votes[userId].baseWeight || 1;
            state.votes[userId].weight = baseWeight * multiplier;
            state.votes[userId].declaration = declaration;
          }
        }
      } else if (command === "template") {
        const tid = payload.trim();
        const model = getGovernanceModel(tid);
        if (model) {
          state.template = model;
        }
      } else if (command === "bye") {
        state.votes[userId] = {
          type: "delegate",
          target: payload,
          name: msg.name,
        };
      } else if (command === "parole" || command === "technical") {
        if (!state.speechQueue.find((s) => s.userId === userId)) {
          // Priorité de parole : les membres passent devant si le template le demande
          const isUserMember = memberIdsSet.has(userId);
          const speechRequest = {
            userId,
            name: msg.name,
            type: command,
            isMember: isUserMember,
          };

          if (template?.rules?.speech_priority_by_role && isUserMember) {
            // Insérer avant le premier non-membre
            const firstNonMemberIndex = state.speechQueue.findIndex((s) => !s.isMember);
            if (firstNonMemberIndex !== -1) {
              state.speechQueue.splice(firstNonMemberIndex, 0, speechRequest);
            } else {
              state.speechQueue.push(speechRequest);
            }
          } else {
            state.speechQueue.push(speechRequest);
          }
        }
      } else {
        const voteType = command || "quiet";
        if (voteType === "quiet" || voteType === "off") {
          delete state.votes[userId];
        } else {
          const baseWeight = msg.metadata?.voting_power || 1;
          const dynamicMultiplier =
            (state.userPowers[userId]?.declarations || []).slice(-1)[0]?.multiplier || 1;

          state.votes[userId] = {
            type: voteType,
            name: msg.name,
            timestamp: msg.created_at,
            baseWeight: baseWeight,
            weight: baseWeight * dynamicMultiplier,
            role: memberIdsSet.has(userId) ? "member" : "other",
            declaration: (state.userPowers[userId]?.declarations || []).slice(-1)[0],
          };
        }
      }

      const currentModelId =
        state.template?.id ||
        roomMetadata?.settings?.template ||
        roomMetadata?.settings?.governance_model ||
        "democratie_directe";

      const currentModel = getGovernanceModel(currentModelId);
      const userRoles = Object.fromEntries(
        Object.entries(state.votes).map(([uid, v]) => [uid, v.role])
      );

      state.results = calculateResults(state.votes, currentModelId, {
        ostracized: state.ostracized,
        userRoles,
        groupByRole: currentModel?.rules?.show_results_by_college,
      });
    },
    [user?.id, memberIdsSet, template, roomMetadata?.settings]
  );

  // Derived state
  const pivotLang = roomMetadata?.settings?.pivot_lang || "fr";

  // 1. Fetch Room Metadata & System Prompt
  useEffect(() => {
    if (!roomName || !supabase) return;

    const loadConfig = async () => {
      // Try to find SaaS room metadata
      const { data: fetchedRoom, error } = await supabase
        .from("inseme_rooms")
        .select("*")
        .eq("slug", roomName)
        .maybeSingle();

      let room = fetchedRoom;

      if (!room && !error) {
        // Auto-create room if it doesn't exist
        console.log(`[Inseme] Room "${roomName}" not found. Auto-creating...`);
        const isBarName =
          roomName.toLowerCase().includes("bar") || roomName.toLowerCase().includes("cyrnea");
        const { data: newRoom, error: createError } = await supabase
          .from("inseme_rooms")
          .insert([
            {
              slug: roomName,
              name: roomName.charAt(0).toUpperCase() + roomName.slice(1),
              settings: {
                template: isBarName ? "cyrnea" : config.template || "democratie_directe",
                type: isBarName ? "bar" : undefined,
                ophelia: {
                  voice: "nova",
                },
              },
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error("[Inseme] Failed to auto-create room:", createError);
        } else {
          room = newRoom;
        }
      }

      if (room) {
        setRoomMetadata(room);

        // Resolve prompt strategy:
        // 1. config.promptUrl (prop)
        // 2. getConfig("OPHELIA_PROMPT_URL") (env/vault)
        // 3. DEFAULT: "__default__" (consolidated)
        const promptUrl = config.promptUrl || getConfig("OPHELIA_PROMPT_URL");

        // Try to find in consolidated registry
        let basePrompt =
          (promptUrl ? CONSOLIDATED_PROMPTS?.[promptUrl] || null : null) ||
          CONSOLIDATED_PROMPTS?.__default__;

        // Fallback for brique:key format
        if (!basePrompt && promptUrl?.includes(":")) {
          const [bId, pKey] = promptUrl.split(":");
          const brique = BRIQUES.find((b) => b.id === bId);
          if (brique?.prompts?.[pKey]) {
            basePrompt = brique.prompts[pKey];
          }
        }

        if (basePrompt) {
          const customPrompt = room.settings?.ophelia?.prompt || "";
          if (customPrompt) {
            setSystemPrompt(
              `${basePrompt}\n\n### CONSIGNES COMPLÉMENTAIRES (LOCALES)\n${customPrompt}`
            );
          } else {
            setSystemPrompt(basePrompt);
          }
        } else if (promptUrl && (promptUrl.startsWith("http") || promptUrl.includes("/"))) {
          // Only fallback to fetch if an explicit URL was provided and it's not in the registry
          fetch(promptUrl)
            .then(async (res) => {
              if (!res.ok) throw new Error("Prompt not found");
              const contentType = res.headers.get("content-type") || "";
              if (contentType.includes("text/html")) {
                console.warn(
                  `[Inseme] Le prompt ${promptUrl} a renvoyé du HTML au lieu de Markdown.`
                );
                throw new Error("Invalid prompt format (HTML)");
              }
              const text = await res.text();
              if (text.trim().startsWith("<!doctype html>")) {
                console.warn(`[Inseme] Le prompt ${promptUrl} contient du HTML (fallback SPA).`);
                throw new Error("Invalid prompt content (HTML fallback)");
              }
              return text;
            })
            .then((text) => {
              const customPrompt = room.settings?.ophelia?.prompt || "";
              if (customPrompt) {
                setSystemPrompt(
                  `${text}\n\n### CONSIGNES COMPLÉMENTAIRES (LOCALES)\n${customPrompt}`
                );
              } else {
                setSystemPrompt(text);
              }
            })
            .catch((err) => {
              console.error("Failed to load base prompt:", err);
              if (room.settings?.ophelia?.prompt) {
                setSystemPrompt(room.settings.ophelia.prompt);
              }
            });
        }
      } else {
        // Fallback to static prompt file
        const promptUrl = config.promptUrl || getConfig("OPHELIA_PROMPT_URL");
        let basePrompt =
          (promptUrl ? CONSOLIDATED_PROMPTS?.[promptUrl] || null : null) ||
          CONSOLIDATED_PROMPTS?.__default__;

        if (!basePrompt && promptUrl?.includes(":")) {
          const [bId, pKey] = promptUrl.split(":");
          const brique = BRIQUES.find((b) => b.id === bId);
          if (brique?.prompts?.[pKey]) {
            basePrompt = brique.prompts[pKey];
          }
        }

        if (basePrompt) {
          setSystemPrompt(basePrompt);
        } else if (promptUrl && (promptUrl.startsWith("http") || promptUrl.includes("/"))) {
          fetch(promptUrl)
            .then(async (res) => {
              if (!res.ok) throw new Error("Prompt not found");
              const contentType = res.headers.get("content-type") || "";
              if (contentType.includes("text/html")) {
                console.warn(`[Inseme] Le prompt statique ${promptUrl} a renvoyé du HTML.`);
                throw new Error("Invalid prompt format (HTML)");
              }
              const text = await res.text();
              if (text.trim().startsWith("<!doctype html>")) {
                console.warn(`[Inseme] Le prompt statique ${promptUrl} contient du HTML.`);
                throw new Error("Invalid prompt content (HTML fallback)");
              }
              return text;
            })
            .then(setSystemPrompt)
            .catch((err) => console.error("Erreur de chargement du prompt Ophélia:", err));
        }
      }

      // Add sessions discovery
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomName }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Erreur API sessions (${res.status}):`, errorText);
        } else {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            if (data.sessions) setSessions(data.sessions);
          }
        }
      } catch (err) {
        console.error("Erreur découverte sessions:", err);
      }

      // Fetch Ophélia's identity from the configured profile table
      try {
        const { data: opheliaProfile } = await supabase
          .from(PROFILE_TABLE)
          .select("display_name, avatar_url")
          .eq("id", OPHELIA_ID)
          .maybeSingle();

        if (opheliaProfile) {
          console.log("Identity: Ophélia found in", PROFILE_TABLE);
          // We could store this in state if we want dynamic names/avatars
        }
      } catch (err) {
        console.warn(`Could not fetch Ophélia from ${PROFILE_TABLE}. Using default.`);
      }
    };

    loadConfig();
  }, [roomName, supabase, config.promptUrl]);

  const processMessages = useCallback(
    (msgs) => {
      const state = {
        proposition: "Pas de proposition active.",
        results: {},
        votes: {},
        media: null,
        speechQueue: [],
        moderators: [],
        userPowers: {},
      };
      msgs.forEach((msg) => updateStateWithMsg(state, msg));

      // Extract function library from messages
      const lib = {};
      msgs.forEach((msg) => {
        if (msg.type === "function_definition" && msg.metadata?.name) {
          lib[msg.metadata.name] = {
            code: msg.metadata.code,
            args: msg.metadata.args,
            description: msg.metadata.description,
          };
        }
      });
      setFunctionLibrary(lib);

      setRoomData((prev) => ({
        ...prev,
        ...state,
      }));
    },
    [updateStateWithMsg]
  );

  const fetchMessages = useCallback(
    async (dateFrom = null, dateTo = null) => {
      if (!roomName || !supabase) return;

      // Use UUID if available, fallback to slug
      const targetRoomId = roomMetadata?.id || roomName;

      let dbQuery = supabase
        .from("inseme_messages")
        .select("*")
        .eq("room_id", targetRoomId)
        .order("created_at", { ascending: true });

      if (dateFrom) dbQuery = dbQuery.gte("created_at", dateFrom);
      if (dateTo) dbQuery = dbQuery.lte("created_at", dateTo);
      else dbQuery = dbQuery.limit(200);

      const { data, error } = await dbQuery;

      if (!error) {
        let processedData = data;
        // Anonymisation en temps différé (si on consulte une session passée)
        if (isEphemeral && dateFrom) {
          processedData = applyBehavioralAnonymization(data, baseAnonymPseudo);
        }
        setMessages(processedData);
        processMessages(processedData);
        messageCountRef.current = processedData.length;
      }
    },
    [roomName, supabase, roomMetadata?.id, isEphemeral, isAfter, baseAnonymPseudo, processMessages]
  );

  const selectSession = (session) => {
    if (!session) {
      setCurrentSessionId(null);
      fetchMessages();
      return;
    }
    setCurrentSessionId(session.id);
    fetchMessages(session.start, session.end);
  };

  // 2. Main Subscription & Initial Fetch
  useEffect(() => {
    if (!roomName || !supabase) return;

    const targetRoomId = roomMetadata?.id || roomName;

    // PRESENCE LOGGING (JOIN)
    const logJoin = async () => {
      if (!user) return;
      const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme";
      await supabase.from("inseme_messages").insert([
        {
          room_id: targetRoomId,
          user_id: user?.id,
          name: userName,
          message: "JOINED",
          type: "presence_log",
          metadata: { status: "join", ua: navigator.userAgent },
        },
      ]);
    };

    if (roomMetadata?.id) {
      logJoin();
    }

    fetchMessages();

    // REALTIME SUBSCRIPTION
    const channel = supabase.channel(`room:${roomName}`, {
      config: {
        presence: {
          key: user?.id || "spectator-" + Math.random().toString(36).substr(2, 9),
        },
      },
    });
    channelRef.current = channel;

    // Handle ephemeral vocal broadcasts
    channel.on("broadcast", { event: "vocal" }, ({ payload }) => {
      if (!isSilent) playVocal(payload.vocal_payload);
    });

    channel.on("broadcast", { event: "ephemeral_reasoning" }, ({ payload }) => {
      setEphemeralThoughts((prev) => [
        ...prev,
        {
          id: "ephemeral-" + Date.now(),
          ...payload,
          is_ephemeral: true,
        },
      ]);
    });

    channel.on("broadcast", { event: "keep_alive" }, ({ payload }) => {
      lastActivityRef.current = Date.now();
      if (keepAliveTimeoutRef.current) {
        clearTimeout(keepAliveTimeoutRef.current);
        keepAliveTimeoutRef.current = null;
      }
    });

    channel.on("broadcast", { event: "ai_thinking" }, ({ payload }) => {
      setIsOphéliaThinking(payload.status);
    });

    channel.on("broadcast", { event: "celebrate" }, ({ payload }) => {
      window.dispatchEvent(new CustomEvent("inseme:celebrate", { detail: payload }));
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "inseme_messages",
        filter: `room_id=eq.${targetRoomId}`,
      },
      (payload) => {
        const newMsg = payload.new;
        // N'ajouter les messages en direct que si on n'est pas en train de consulter une session passée
        if (!currentSessionIdRef.current) {
          setMessages((prev) => [...prev, newMsg]);
        }
        processMessage(newMsg);

        // 3. Proactive Trigger: Wake up Ophélia every 15 messages (more subtle)
        messageCountRef.current++;
        if (messageCountRef.current % 15 === 0 && newMsg.name !== "Ophélia") {
          triggerOphélia(
            "[SYSTÈME] : Tu interviens de manière proactive après une série d'échanges pour apporter un éclairage ou une synthèse."
          );
        }
      }
    );

    if (roomMetadata?.id) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inseme_rooms",
          filter: `id=eq.${roomMetadata.id}`,
        },
        (payload) => {
          console.log("[Inseme] Room metadata updated via realtime:", payload.new);
          setRoomMetadata(payload.new);
        }
      );
    }

    if (user) {
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          setPresenceState(state);

          const connected = Object.values(state)
            .flat()
            .map((p) => ({
              id: p.user_id,
              name: p.name,
              status: p.status || "online",
              ...p, // Spread all presence properties (zone, etc.)
            }));
          setRoomData((prev) => ({ ...prev, connectedUsers: connected }));
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          newPresences.forEach((p) => {
            if (p.user_id !== OPHELIA_ID && p.user_id !== user?.id) {
              sendMessage(`[SYSTÈME] : ${p.name} a rejoint la salle.`, {
                type: "presence_event",
                status: "join",
                user_id: p.user_id,
                name: p.name,
              });
            }
          });
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          leftPresences.forEach((p) => {
            if (p.user_id !== OPHELIA_ID && p.user_id !== user?.id) {
              sendMessage(`[SYSTÈME] : ${p.name} a quitté la salle.`, {
                type: "presence_event",
                status: "leave",
                user_id: p.user_id,
                name: p.name,
              });
            }
          });
        });
    }

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user) {
        const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme";
        await channel.track({
          user_id: user?.id,
          name: userName,
          status: "online",
          joined_at: new Date().toISOString(),
          ...presenceMetadata,
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [roomName, supabase, fetchMessages, roomMetadata?.id, user]);

  // Sync presence metadata updates
  useEffect(() => {
    if (channelRef.current && user) {
      const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme";
      channelRef.current.track({
        user_id: user?.id,
        name: userName,
        status: "online",
        joined_at: new Date().toISOString(),
        ...presenceMetadata,
      });
    }
  }, [presenceMetadata, user]);

  // 3. Proactive & Inactivity Trigger
  useEffect(() => {
    if (!roomName || !supabase || isSpectator) return;

    const checkInactivity = () => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const connectedCount = roomData.connectedUsers?.length || 0;

      // Logic:
      // - If addressed directly or small talk, response is handled by sendMessage
      // - If silence:
      //    - 1 person: respond after 8s (very interactive in 1:1)
      //    - group: respond after 30-45s (mediation)
      const threshold = connectedCount <= 1 ? 8000 : 45000;

      if (
        idleTime >= threshold &&
        messages.length > 0 &&
        !keepAliveTimeoutRef.current &&
        !isOphéliaThinking
      ) {
        // Only trigger if the last message was NOT from Ophélia
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.name !== "Ophélia") {
          // Randomized delay between 1s and 4s to simulate "thinking" or "waiting for a white"
          const randomDelay = Math.floor(Math.random() * 3000) + 1000;
          keepAliveTimeoutRef.current = setTimeout(() => {
            if (Date.now() - lastActivityRef.current >= threshold) {
              triggerOphélia(
                "[SYSTÈME] : Il y a un silence dans la conversation. Interviens de manière naturelle pour relancer, synthétiser ou proposer la suite."
              );
            }
            keepAliveTimeoutRef.current = null;
          }, randomDelay);
        }
      }
    };

    inactivityTimerRef.current = setInterval(checkInactivity, 5000);

    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      if (keepAliveTimeoutRef.current) clearTimeout(keepAliveTimeoutRef.current);
    };
  }, [
    messages,
    roomData.connectedUsers,
    isOphéliaThinking,
    roomName,
    supabase,
    isSpectator,
    user, // Added user to dependencies for sendMessage
  ]);

  const processMessage = useCallback(
    (msg) => {
      lastActivityRef.current = Date.now();
      if (keepAliveTimeoutRef.current) {
        clearTimeout(keepAliveTimeoutRef.current);
        keepAliveTimeoutRef.current = null;
      }

      if (msg.type === "function_definition" && msg.metadata?.name) {
        setFunctionLibrary((prev) => ({
          ...prev,
          [msg.metadata.name]: {
            code: msg.metadata.code,
            args: msg.metadata.args,
            description: msg.metadata.description,
          },
        }));
      }

      setRoomData((prev) => {
        const newState = { ...prev };
        updateStateWithMsg(newState, msg);
        return newState;
      });
    },
    [updateStateWithMsg]
  );

  // --- TRANSCRIPTION LOGIC ---

  const stopLocalTranscription = useCallback(() => {
    mediaManagerRef.current?.stopSession();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setTranscriptionStatus((prev) => ({
      ...prev,
      isActive: false,
      mode: "idle",
    }));
  }, []);

  const startLocalTranscription = useCallback(() => {
    if (typeof window === "undefined") return;

    // Use MediaManager (Smart Audio)
    if (mediaManagerRef.current) {
      mediaManagerRef.current
        .startSession(
          () => {
            // onSpeechStart
            setVocalState("listening");
            console.log("[SmartAudio] Speech Started");
          },
          () => {
            // onSpeechEnd (Silence Detected)
            setVocalState("idle");
            console.log("[SmartAudio] Silence Detected");
            // Here we could trigger "EndOfSpeech" logic or "Send Buffer"
          }
        )
        .catch((err) => console.error("SmartAudio Start Error:", err));

      setTranscriptionStatus((prev) => ({
        ...prev,
        isActive: true,
        mode: "local", // or 'smart'
      }));
    }

    // Legacy SpeechRecognition logic (kept for fallback/reference, disabled by default if SmartAudio is active)
    // To enable parallel run, uncomment or use a config flag.
    /*
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Transcription non supportée par ce navigateur.");
      return;
    }

    if (recognitionRef.current) stopLocalTranscription();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = nativeLang === "fr" ? "fr-FR" : "en-US";
    // ... rest of legacy logic ...
    recognition.start();
    */
  }, [
    nativeLang,
    stopLocalTranscription,
    userRole,
    user?.id,
    roomMetadata?.id,
    roomName,
    supabase,
    governanceMode,
  ]);

  // Handle Floor Holder Auto-Transcription
  useEffect(() => {
    window._lastSpeechQueue = roomData.speechQueue;
    const isFloorHolder = roomData.speechQueue?.[0]?.userId === user?.id;

    // Only auto-start transcription if Hands-Free is enabled
    // This prevents the microphone from activating automatically on launch
    if (isFloorHolder && isHandsFree && !transcriptionStatus.isActive) {
      console.log("Vous avez la parole (Mains-libres) : Démarrage de la transcription locale.");
      startLocalTranscription();
    } else if (
      (!isFloorHolder || !isHandsFree) &&
      transcriptionStatus.isActive &&
      transcriptionStatus.mode === "local"
    ) {
      stopLocalTranscription();
    }
  }, [
    roomData.speechQueue,
    user?.id,
    transcriptionStatus.isActive,
    transcriptionStatus.mode,
    isHandsFree,
  ]);

  const searchMemory = useCallback(
    async (query) => {
      try {
        const res = await fetch("/api/vector-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            text: query,
            room_id: roomMetadata?.id || roomName,
          }),
        });
        const { documents } = await res.json();
        if (!documents || documents.length === 0) return "Aucun résultat pertinent trouvé.";

        return documents
          .map(
            (d) =>
              `- [${new Date(d.metadata?.created_at || Date.now()).toLocaleDateString()}] ${d.message.substring(0, 150)}...`
          )
          .join("\n");
      } catch (error) {
        console.error("Search Error:", error);
        return "Erreur lors de la recherche mémoire.";
      }
    },
    [roomMetadata?.id, roomName]
  );

  const sendMessage = useCallback(
    async (text, metadata = {}, image = null) => {
      if (image) {
        try {
          const roomId = roomMetadata?.id || roomName;
          let url;
          if (metadata.type === "proof") {
            url = await storage.uploadProof(roomId, image);
          } else {
            url = await storage.uploadEphemeral(roomId, image);
          }

          metadata = {
            ...metadata,
            image_url: url,
            image_type: metadata.image_type || "visual_signal",
            type: metadata.type || "visual_signal",
          };
          if (!text) text = "📸 Signal Visuel";
        } catch (err) {
          console.error("Image Upload Failed:", err);
        }
      }
      if (!metadata.is_ai && !canInteract) return; // Seuls les rôles avec canInteract peuvent envoyer des messages
      if (!text?.trim() && !metadata.type) return;
      if (!supabase) return;

      // Command Parsing for Hands-free Control
      if (text.startsWith("inseme handsfree ")) {
        const parts = text.split(/\s+/);
        const mode = parts[2];
        if (mode === "on" || mode === "off") {
          const enabled = mode === "on";
          setIsHandsFree(enabled);
          localStorage.setItem("inseme_hands_free", enabled ? "true" : "false");
          sendMessageRef.current?.(`Mode mains-libres ${enabled ? "activé" : "désactivé"}.`, {
            is_ai: true,
            type: "system_summary",
          });
          return;
        }
      }

      // Command Parsing for Language Control
      if (text.startsWith("inseme vocal ")) {
        const parts = text.split(/\s+/);
        const mode = parts[2];
        if (mode === "on" || mode === "off") {
          const silent = mode === "off";
          setIsSilent(silent);
          localStorage.setItem("inseme_silent", silent ? "true" : "false");
          if (silent) {
            sendMessageRef.current?.(`Mode vocal désactivé (Texte seul).`, {
              is_ai: true,
              type: "system_summary",
            });
          } else {
            sendMessageRef.current?.(`Mode vocal activé (Texte + Vocal).`, {
              is_ai: true,
              type: "system_summary",
            });
          }
          return;
        }
      }

      if (text.startsWith("inseme ostracize ")) {
        const parts = text.split(/\s+/);
        const targetId = parts[2];
        const duration = parseInt(parts[3]) || 60; // default 60min
        const reason = parts.slice(4).join(" ") || "Non spécifiée";

        if (targetId) {
          // Update room settings for persistence
          const newOstracized = {
            ...(roomMetadata.settings?.ostracized || {}),
            [targetId]: {
              since: new Date().toISOString(),
              duration,
              reason,
              by: user?.id,
            },
          };
          const newSettings = {
            ...roomMetadata.settings,
            ostracized: newOstracized,
          };
          await supabase
            .from("inseme_rooms")
            .update({ settings: newSettings })
            .eq("id", roomMetadata.id);

          await supabase.from("inseme_messages").insert([
            {
              room_id: roomMetadata?.id || roomName,
              user_id: user?.id,
              name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme",
              message: `[DÉCLARATION] : ${targetId} est ostracisé pour ${duration} minutes. Raison : ${reason}`,
              type: "ostracism_event",
              metadata: {
                status: "ostracized",
                user_id: targetId,
                duration,
                reason,
                by: user?.id,
              },
            },
          ]);
          return;
        }
      }

      if (text.startsWith("inseme restore ")) {
        const parts = text.split(/\s+/);
        const targetId = parts[2];

        if (targetId) {
          // Update room settings for persistence
          const newOstracized = {
            ...(roomMetadata.settings?.ostracized || {}),
          };
          delete newOstracized[targetId];
          const newSettings = {
            ...roomMetadata.settings,
            ostracized: newOstracized,
          };
          await supabase
            .from("inseme_rooms")
            .update({ settings: newSettings })
            .eq("id", roomMetadata.id);

          await supabase.from("inseme_messages").insert([
            {
              room_id: roomMetadata?.id || roomName,
              user_id: user?.id,
              name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme",
              message: `[DÉCLARATION] : Les droits de ${targetId} sont rétablis.`,
              type: "ostracism_event",
              metadata: {
                status: "restored",
                user_id: targetId,
                by: user?.id,
              },
            },
          ]);
          return;
        }
      }

      if (text.startsWith("inseme lang ")) {
        const lang = text.split(" ")[2];
        if (lang) {
          setNativeLang(lang);
          localStorage.setItem("inseme_native_lang", lang);
          // Use optimistic UI or a local system message (not stored in DB)
          // For now, we just return to avoid sending the command to DB
          return;
        }
      }

      if (text.startsWith("inseme pivot ")) {
        const lang = text.split(" ")[2];
        if (lang && roomMetadata) {
          // Update room settings in DB
          const newSettings = { ...roomMetadata.settings, pivot_lang: lang };
          await supabase
            .from("inseme_rooms")
            .update({ settings: newSettings })
            .eq("id", roomMetadata.id);
          // Optimistic update
          setRoomMetadata({ ...roomMetadata, settings: newSettings });
          return;
        }
      }

      // Strip large binary data from metadata before DB insertion
      const dbMetadata = {
        zone: presenceMetadata?.zone,
        ...metadata,
        role: metadata.is_ai ? "system" : userRole,
      };
      const localVocalPayload = dbMetadata.vocal_payload;
      delete dbMetadata.vocal_payload;

      let contentObj = {
        room_id: roomMetadata?.id || roomName,
        user_id: metadata.is_ai || isEphemeral ? null : user?.id || null, // Anonymisation des logs pour Bars/Afters
        name: metadata.is_ai ? "Ophélia" : metadata.pseudonym || currentUser.pseudo || "Anonyme",
        message: text,
        type: metadata.type || "chat",
        metadata: dbMetadata,
      };

      // Translation Logic (Translate-on-Write)
      if (!metadata.is_ai && nativeLang !== pivotLang && !text.toLowerCase().startsWith("inseme")) {
        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target_lang: pivotLang }),
          });

          if (response.ok) {
            const responseText = await response.text();
            if (responseText) {
              try {
                const data = JSON.parse(responseText);
                if (data?.translated_text) {
                  contentObj.message = data.translated_text;
                  contentObj.metadata = {
                    ...contentObj.metadata,
                    original: text,
                    lang: nativeLang,
                  };
                }
              } catch (e) {
                console.error("Translation JSON parse error:", e);
              }
            }
          }
        } catch (err) {
          console.error("Translation failed, sending original:", err);
        }
      }

      const { data, error } = await supabase
        .from("inseme_messages")
        .insert([contentObj])
        .select()
        .single();

      if (error) {
        console.error("Erreur lors de l'envoi du message:", error);
      }

      // Emit local event for components to listen (trust-based system)
      // This allows barmen to track their own session "memory" via localStorage
      if (metadata.type === "tip" || metadata.type === "funding") {
        window.dispatchEvent(
          new CustomEvent("inseme:event", {
            detail: { type: "tip", message: text, metadata: metadata },
          })
        );
      }

      // Broadcast vocal payload separately (it's too large for Postgres changes payload)
      if (localVocalPayload && !error) {
        if (!isSilent) playVocal(localVocalPayload);

        channelRef.current?.send({
          type: "broadcast",
          event: "vocal",
          payload: {
            message_id: data.id,
            vocal_payload: localVocalPayload,
          },
        });
      }

      // Trigger AI if addressed or in 1:1 conversation
      const lowerText = text.toLowerCase();
      const opheliaNames = ["ophélia", "ophelia", "ophé", "ophe"];
      const greetings = ["hello", "bonjour", "salut", "coucou", "dis-moi"];
      const connectedCount = roomData.connectedUsers?.length || 0;
      const isOneOnOne = connectedCount <= 1;

      const isAddressed = opheliaNames.some((name) => lowerText.includes(name));
      const isGreeting = greetings.some((greet) => lowerText.includes(greet));

      if (isAddressed || (messages.length < 5 && isGreeting) || isOneOnOne) {
        // Direct address, greeting at start, or 1:1 conversation triggers immediate response
        triggerOphéliaRef.current?.(text);
      }

      if (text.startsWith("inseme parole") || text.startsWith("inseme technical")) {
        const userId = user?.id || "Anonyme";
        if (timersRef.current[userId]) clearTimeout(timersRef.current[userId]);
        timersRef.current[userId] = setTimeout(() => {
          castVoteRef.current?.("quiet");
        }, 30000);
      }

      return { error };
    },
    [
      user,
      isSpectator,
      supabase,
      roomMetadata,
      roomName,
      nativeLang,
      pivotLang,
      isSilent,
      setNativeLang,
      setRoomMetadata,
    ]
  );

  const setTemplate = useCallback(
    async (id) => {
      const model = getGovernanceModel(id);
      if (!model || !roomMetadata) return;
      const newSettings = { ...roomMetadata.settings, template: id };
      await supabase
        .from("inseme_rooms")
        .update({ settings: newSettings })
        .eq("id", roomMetadata.id);

      // Traçabilité de l'acte de changement de template
      await sendMessageRef.current?.(`inseme template ${id}`, {
        type: "template_change",
        metadata: {
          template_id: id,
          template_label: model.name,
        },
      });

      // Optimistic update
      setRoomMetadata({ ...roomMetadata, settings: newSettings });
    },
    [roomMetadata, supabase]
  );

  const updateAssemblyType = useCallback(
    async (modelId) => {
      if (!roomMetadata) return;
      const model = getGovernanceModel(modelId);
      const newSettings = {
        ...roomMetadata.settings,
        governance_model: modelId,
        // On peut optionnellement vider les labels personnalisés pour revenir au standard du modèle
        labels: {},
      };

      await supabase
        .from("inseme_rooms")
        .update({ settings: newSettings })
        .eq("id", roomMetadata.id);

      // Notification de changement
      await sendMessageRef.current?.(
        `L'Assemblée a adopté le modèle **${model.name}**. La terminologie est désormais adaptée (ex: les membres sont des **${model.terminology.members}**).`,
        {
          is_ai: true,
          type: "system_summary",
          metadata: { new_model: modelId },
        }
      );

      // Optimistic update
      setRoomMetadata({ ...roomMetadata, settings: newSettings });
    },
    [supabase, roomMetadata]
  );

  const setProposition = useCallback(async (text, isAi = false) => {
    return sendMessageRef.current?.(`inseme ? ${text}`, { is_ai: isAi });
  }, []);

  const generateReport = useCallback(async () => {
    setIsOphéliaThinking(true);
    try {
      await sendMessageRef.current?.("**Édition du Procès-Verbal en cours...**", {
        is_ai: true,
      });

      // --- ANONYMISATION COMPORTEMENTALE POUR LES SALLES ÉPHÉMÈRES ---
      let messagesForReport = messages;
      if (isEphemeral) {
        messagesForReport = applyBehavioralAnonymization(messages, baseAnonymPseudo);
      }
      // -----------------------------------------------------------

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForReport,
          room_settings: roomMetadata?.settings,
          is_ephemeral: isEphemeral,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report API Error (${response.status}): ${errorText || "Unknown error"}`);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON from report API: ${responseText.substring(0, 100)}`);
      }
      const { report, error } = data || {};

      if (error) throw new Error(error);

      if (report) {
        const { data, error: insertError } = await supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: roomMetadata?.id || roomName, // UUID
              user_id: null,
              name: "Ophélia",
              message: report,
              type: "report", // Type spécifique pour préservation
              metadata: { type: "report", generated: true },
            },
          ])
          .select();

        if (insertError) throw new Error(insertError.message);

        if (data && data[0]) {
          // AUTO-EMBED
          await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "embed",
              text: report,
              id: data[0].id,
            }),
          });

          // Checkpoint Update (Optional: could notify room settings)
        }

        await sendMessageRef.current?.("📜 Le Procès-Verbal a été généré et archivé.", {
          is_ai: true,
        });
      }
    } catch (error) {
      console.error("Erreur Report:", error);
      await sendMessageRef.current?.("[Erreur] Génération du rapport échouée.", {
        is_ai: true,
      });
    } finally {
      setIsOphéliaThinking(false);
    }
  }, [messages, roomMetadata, roomName, supabase]);

  const promoteToPlenary = useCallback(
    async (content) => {
      const parentSlug = roomMetadata?.settings?.parent_slug;
      if (!parentSlug) {
        await sendMessageRef.current?.(
          "[Erreur] Impossible de remonter à la plénière : aucune salle parente configurée.",
          { is_ai: true }
        );
        return;
      }

      setIsOphéliaThinking(true);
      try {
        await sendMessageRef.current?.(`**Transmission à la Plénière (${parentSlug})...**`, {
          is_ai: true,
        });

        // In a real SaaS, we would use the Edge Function to securely post to another room.
        // For this implementation, we will simulate it or use a direct Supabase call if we have permissions.
        // Since we rely on RLS, writing to another room might be restricted unless we are also an owner/member.
        // Let's assume for now we use a server-side function or the user has rights.

        // NOTE: Ideally, we should create a dedicated Edge Function /api/promote to handle cross-room writes securely.
        // For now, let's try to write directly using the client if possible, flagging it as a "proposition".

        // To properly resolve the slug to a UUID, we need a lookup.
        // Since we don't have the parent's UUID easily here without a lookup, we'll implement a simple lookup via Supabase.
        const { data: parentRoom } = await supabase
          .from("inseme_rooms")
          .select("id")
          .eq("slug", parentSlug)
          .single();

        if (parentRoom) {
          const { data: msgData, error: insertError } = await supabase
            .from("inseme_messages")
            .insert([
              {
                room_id: parentRoom.id, // Using the resolved UUID
                user_id: user?.id,
                name: `Commission (${roomMetadata.name})`,
                message: `**Proposition de la Commission :**\n\n${content}`,
                type: "proposition",
                metadata: {
                  source_room: roomMetadata?.id || roomName,
                  promoted: true,
                },
              },
            ])
            .select();

          if (insertError) throw new Error(insertError.message);

          if (msgData && msgData[0]) {
            // AUTO-EMBED in Parent Room
            await fetch("/api/vector-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "embed",
                text: content,
                id: msgData[0].id,
              }),
            });
          }

          await sendMessageRef.current?.(`✅ Transmis avec succès à la plénière.`, {
            is_ai: true,
          });
        } else {
          throw new Error("Salle parente introuvable.");
        }
      } catch (error) {
        console.error("Erreur Promotion:", error);
        await sendMessageRef.current?.(`[Erreur] Échec de la transmission : ${error.message}`, {
          is_ai: true,
        });
      } finally {
        setIsOphéliaThinking(false);
      }
    },
    [roomMetadata, user?.id, roomName, supabase]
  );

  const archiveReport = useCallback(
    async (reportText) => {
      if (!roomMetadata?.id) return;
      try {
        const sessionId = currentSessionId || `manual-${Date.now()}`;
        const fileName = `reports/${roomName}/${sessionId}.md`;
        const blob = new Blob([reportText], { type: "text/markdown" });

        const { url } = await storage.upload("public-documents", fileName, blob);

        await sendMessageRef.current?.(
          `📄 **PV Archivé dans le Cloud**\nLien : [Consulter le document](${url})`,
          {
            is_ai: true,
            type: "system_summary",
            metadata: {
              type: "archive_link",
              url,
            },
          }
        );
        return url;
      } catch (err) {
        console.error("Erreur d'archivage:", err);
        throw err;
      }
    },
    [roomMetadata?.id, currentSessionId, roomName]
  );

  const cleanupEphemeralLogs = useCallback(
    async (days = 3) => {
      if (!isEphemeral || !supabase || !roomMetadata) return;

      const roomId = roomMetadata.id || roomName;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);

      console.log(`[CLEANUP] Tentative de nettoyage pour ${roomName} (seuil: ${days} jours)`);

      const { error } = await supabase
        .from("inseme_messages")
        .delete()
        .eq("room_id", roomId)
        .lt("created_at", thresholdDate.toISOString())
        .neq("type", "report"); // On préserve les résumés (PV)

      if (error) {
        console.error("[CLEANUP] Erreur:", error);
      } else {
        console.log(`[CLEANUP] Nettoyage réussi pour ${roomName}`);
      }
    },
    [isEphemeral, supabase, roomMetadata, roomName]
  );

  // Trigger automatique de nettoyage pour les salles éphémères (1 fois par chargement si besoin)
  useEffect(() => {
    if (isEphemeral && roomMetadata) {
      // On attend un peu après le chargement pour ne pas surcharger
      const timer = setTimeout(() => {
        cleanupEphemeralLogs(3); // Garde 3 jours par défaut
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isEphemeral, roomMetadata, cleanupEphemeralLogs]);

  const uploadVocal = useCallback(
    async (blob, customFileName = null) => {
      if (!roomMetadata?.id) return null;
      return storage.uploadVocal(roomMetadata.id, blob, customFileName);
    },
    [roomMetadata?.id]
  );

  // --- WHISPER TRANSCRIPTION LOGIC (useVoiceRecorder) ---

  const {
    isRecording,
    duration,
    timeLeft,
    transcriptionPreview,
    startRecording: rawStartRecording,
    stopRecording,
    cancelRecording,
    addTime,
  } = useVoiceRecorder((blob, finalDuration) => handleTranscription(blob, finalDuration), {
    autoStopDelay: 2000,
    lang: nativeLang === "fr" ? "fr-FR" : "en-US",
    onSilence: () => {
      if (isHandsFree) {
        stopRecording();
      }
    },
  });

  const startRecording = useCallback(async () => {
    setVocalError(null);
    try {
      await rawStartRecording();
    } catch (err) {
      console.error("[useInseme] Failed to start recording:", err);
      setVocalError(err.message || "Impossible d'accéder au microphone");

      // Log l'erreur de permission/micro en base
      sendMessage(`[MIC ERROR] : ${err.message || "Permission denied"}`, {
        type: "mic_error",
        error_details: err.message,
      });
    }
  }, [rawStartRecording, sendMessage]);

  const handleTranscription = useCallback(
    async (blob, finalDuration) => {
      console.log("[useInseme] handleTranscription called", {
        blobSize: blob.size,
        blobType: blob.type,
        finalDuration,
      });
      setIsTranscribing(true);
      setVocalState("thinking");
      setVocalError(null);
      try {
        const rawRoomName = roomMetadata?.id || roomName || "unknown";
        const safeRoomName = String(rawRoomName).replace(/[^a-z0-9]/gi, "_");
        const fileName = `temp/${safeRoomName}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;

        console.log("[useInseme] Uploading vocal to storage...");
        const vocalUrl = await uploadVocal(blob, fileName);
        console.log("[useInseme] Vocal uploaded:", vocalUrl);

        const formData = new FormData();
        formData.append("file", blob, "audio.webm");

        const opheliaUrl = effectiveConfig.opheliaUrl || "/api/ophelia";
        let transcribeUrl = "/api/transcribe";

        if (opheliaUrl.startsWith("http")) {
          try {
            const url = new URL(opheliaUrl);
            transcribeUrl = `${url.origin}/api/transcribe`;
          } catch (e) {
            console.warn("Failed to parse opheliaUrl for transcription:", e);
          }
        }

        console.log("[useInseme] Calling transcription API:", transcribeUrl);
        const response = await fetch(transcribeUrl, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[useInseme] Transcription API error:", {
            status: response.status,
            errorText,
          });
          throw new Error(`Transcription API error (${response.status}): ${errorText}`);
        }

        const text = await response.text();
        console.log("[useInseme] Transcription raw response:", text);

        if (!text || text.trim() === "") {
          console.warn("Transcription API returned an empty response.");
          return;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[useInseme] Failed to parse transcription JSON:", text);
          throw new Error(`Invalid JSON from transcription API: ${text.substring(0, 100)}`);
        }

        if (data.text) {
          const trimmed = String(data.text).trim();
          if (!trimmed) {
            console.warn("[useInseme] Transcription text is empty after trim:", data);
            return;
          }
          if (finalDuration && finalDuration > 3 && trimmed.length < 10) {
            console.warn("[useInseme] Transcription too short for duration:", {
              finalDuration,
              length: trimmed.length,
              text: trimmed,
            });
            return;
          }
          console.log("[useInseme] Transcription success:", trimmed);
          await sendMessage(trimmed, {
            type: "transcription",
            vocal_url: vocalUrl,
            vocal_transcription: true,
            voice_duration: finalDuration,
          });
        } else {
          console.warn("[useInseme] No text in transcription data:", data);
        }
      } catch (err) {
        console.error("Erreur de transcription:", err);
        setVocalError(err.message);

        // Log l'erreur en base de données pour debug
        sendMessage(`[TRANSCRIPTION ERROR] : ${err.message}`, {
          type: "transcription_error",
          error_details: err.message,
          blob_size: blob.size,
          final_duration: finalDuration,
        });
      } finally {
        setIsTranscribing(false);
        if (!isHandsFree) {
          setVocalState("idle");
        }
      }
    },
    [roomMetadata?.id, roomName, isHandsFree, uploadVocal, sendMessage, effectiveConfig.opheliaUrl]
  );

  // Hands-free Logic: Auto-start recording when idle or transitionally listening
  useEffect(() => {
    if (
      isHandsFree &&
      !isRecording &&
      !isTranscribing &&
      !isOphéliaThinking &&
      (vocalState === "idle" || vocalState === "listening")
    ) {
      const timer = setTimeout(() => {
        startRecording();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isHandsFree, vocalState, isRecording, isTranscribing, isOphéliaThinking, startRecording]);

  // Barge-in Logic: Stop Ophélia if user starts speaking
  useEffect(() => {
    if (isRecording && vocalState === "speaking") {
      stopVocal();
    }
  }, [isRecording, vocalState, stopVocal]);

  // Sync vocalState with recording
  useEffect(() => {
    if (isRecording) {
      setVocalState("listening");
    } else if (vocalState === "listening") {
      // If hands-free is on, we wait a bit before going to idle to avoid flickering
      // The auto-restart logic will pick it up after 300ms
      const timeout = isHandsFree ? 400 : 0;
      const timer = setTimeout(() => {
        setVocalState("idle");
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [isRecording, isHandsFree, vocalState]);

  // Sync vocalState with Ophélia thinking
  useEffect(() => {
    if (isOphéliaThinking) {
      setVocalState("thinking");
    } else if (vocalState === "thinking" && !isTranscribing) {
      const timeout = isHandsFree ? 400 : 0;
      const timer = setTimeout(() => {
        setVocalState("idle");
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [isOphéliaThinking, isTranscribing, isHandsFree, vocalState]);

  const castVote = useCallback(
    async (option) => {
      if (!user || !canVote) return;
      const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme";
      const votingPower = user?.user_metadata?.voting_power || 1;

      // 1. Send as a system message to trigger real-time updates via subscription
      await sendMessageRef.current?.(`inseme vote ${option}`, {
        type: "vote",
        metadata: {
          option,
          user_name: userName,
          voting_power: votingPower,
          is_flash_poll: true,
        },
      });
    },
    [user, canVote]
  );

  const declarePower = useCallback(
    async (multiplier, reason) => {
      if (!user) return;
      await sendMessageRef.current?.(`inseme power ${multiplier} ${reason}`, {
        type: "power_declaration",
        metadata: {
          multiplier,
          reason,
        },
      });
    },
    [user]
  );

  const startSession = () => {
    const sessionName = terminology.session || "Session";
    sendMessageRef.current?.(`inseme open\n*La ${sessionName} commence.*`, {
      type: "system_summary",
    });
  };

  const endSession = useCallback(async () => {
    const sessionName = terminology.session || "Session";
    sendMessageRef.current?.(`inseme close\n*La ${sessionName} est désormais close.*`, {
      type: "system_summary",
    });

    if (generateReportRef.current) {
      await generateReportRef.current();
    }

    if (isEphemeral && cleanupEphemeralLogsRef.current) {
      // Pour les salles éphémères, on nettoie les logs anciens (plus de 3 jours) à la clôture
      await cleanupEphemeralLogsRef.current(3);
    }
  }, [isEphemeral, terminology.session]);
  const updateAgenda = (newAgenda) => {
    const agendaString = Array.isArray(newAgenda)
      ? newAgenda.map((item, i) => `${i + 1}. ${item.title || item}`).join("\n")
      : String(newAgenda);

    sendMessageRef.current?.(`inseme agenda\n${agendaString}`, {
      type: "agenda_update",
      agenda: newAgenda,
    });
  };
  const onParole = () => {
    if (!canVote) return;
    sendMessageRef.current?.("inseme parole");
  };
  const onDelegate = (target) => {
    if (!canVote) return;
    sendMessageRef.current?.(`inseme bye ${target}`);
  };

  const updateRoomSettings = useCallback(
    async (newSettings) => {
      if (!roomMetadata?.id || !supabase) return;
      const { error } = await supabase
        .from("inseme_rooms")
        .update({ settings: { ...roomMetadata.settings, ...newSettings } })
        .eq("id", roomMetadata.id);

      if (error) {
        console.error("Update Room Settings Error:", error);
      } else {
        setRoomMetadata((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...newSettings },
        }));
      }
    },
    [roomMetadata, supabase]
  );

  useEffect(() => {
    if (!user?.id || !supabase) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from(PROFILE_TABLE)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setUserProfile(data);
    };

    fetchProfile();
  }, [user?.id, supabase, PROFILE_TABLE]);

  const triggerGabriel = useCallback(
    async (userIntent = null, toolResults = []) => {
      if (isOphéliaThinking && !toolResults.length) return; // Gabriel shares thinking state for UI simplicity or we could add isGabrielThinking
      if (!roomName || !supabase || isSpectator) return;

      // If Gabriel is not properly configured, fallback to Ophélia but with "Gabriel" persona and personal data
      const isConfigured = gabrielConfig.enabled && gabrielConfig.url && gabrielConfig.key;

      if (!isConfigured) {
        // Fallback: trigger Ophélia but with a hint that she should act as Gabriel (Personal Assistant)
        // and include personal data context if available.
        const personalContext = currentUser.metadata
          ? `\n\n[DONNÉES PERSONNELLES UTILISATEUR] : ${JSON.stringify(currentUser.metadata)}`
          : "";
        return triggerOphéliaRef.current(
          userIntent ? `[MODE GABRIEL PERSONNEL] ${userIntent}${personalContext}` : null,
          toolResults,
          "Gabriel"
        );
      }

      // If configured, call the external provider
      setIsOphéliaThinking(true);
      try {
        const history = messages.slice(-20).map((m) => ({
          role: m.name === "Gabriel" ? "assistant" : "user",
          content: `${m.name}: ${m.message}`,
        }));

        if (userIntent) {
          const personalContext = currentUser.metadata
            ? `\n\n[DONNÉES PERSONNELLES UTILISATEUR] : ${JSON.stringify(currentUser.metadata)}`
            : "";
          history.push({
            role: "user",
            content: `${userIntent}${personalContext}`,
          });
        }

        const response = await fetch(gabrielConfig.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gabrielConfig.key}`,
          },
          body: JSON.stringify(
            {
              model: "gpt-4-turbo", // or configurable
              messages: [
                {
                  role: "system",
                  content:
                    BRIQUES.find((b) => b.id === "ophelia")?.prompts?.["task-gabriel"] ||
                    "Tu es Gabriel, l'ange gardien personnel de l'utilisateur. Ton rôle est de protéger ses intérêts et ses valeurs, en bonne entente avec ses voisins, pour gérer paisiblement les conflits de la vie en commun. Tu agis selon le principe de subsidiarité.",
                },
                ...history,
              ],
            },
            toolResults
          ),
        });

        if (!response.ok) throw new Error("Gabriel API Error");

        const data = await response.json();
        const text = data.choices[0].message.content;

        await sendMessageRef.current?.(text, { is_ai: true, name: "Gabriel" });
      } catch (err) {
        console.error("Erreur Gabriel:", err);
        await sendMessageRef.current?.(
          "Désolé, j'ai eu un problème de connexion à mon cerveau Gabriel. Je repasse en mode Ophélia personnelle.",
          { is_ai: true, name: "Gabriel" }
        );
        // Fallback to Ophelia on error
        return triggerOphéliaRef.current(userIntent, toolResults, "Gabriel");
      } finally {
        setIsOphéliaThinking(false);
      }
    },
    [
      gabrielConfig,
      isOphéliaThinking,
      messages,
      roomName,
      supabase,
      isSpectator,
      currentUser,
      userProfile,
    ]
  );

  const updateGabrielConfig = useCallback((newConfig) => {
    setGabrielConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      if (typeof window !== "undefined") {
        localStorage.setItem("inseme_gabriel_config", JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const triggerOphélia = useCallback(
    async (userIntent = null, toolResults = [], aiName = "Ophélia") => {
      if (isOphéliaThinking && !toolResults.length) return;

      if (!roomName || !supabase || isSpectator) return;

      const connectedCount = roomData.connectedUsers?.length || 0;
      const isOneOnOne = connectedCount <= 1;

      // "Petit blanc" : délai naturel si c'est une réponse directe ou une relance
      // BEAUCOUP plus rapide en 1:1 ou si interpellation directe
      if (userIntent || toolResults.length) {
        const baseDelay = isOneOnOne ? 400 : 800;
        const randomExtra = isOneOnOne ? 600 : 2000;
        const delay = Math.floor(Math.random() * randomExtra) + baseDelay;
        await new Promise((r) => setTimeout(r, delay));
      }

      // Broadcast that we are starting to think
      channelRef.current?.send({
        type: "broadcast",
        event: "ai_thinking",
        payload: { status: true },
      });
      // Also broadcast a keep_alive to reset everyone's timers
      channelRef.current?.send({
        type: "broadcast",
        event: "keep_alive",
        payload: { user_id: user?.id },
      });

      setIsOphéliaThinking(true);
      lastActivityRef.current = Date.now();

      try {
        // Calculate speech statistics for Ophélia
        const speechStats = messages.reduce((acc, m) => {
          const duration = m.metadata?.voice_duration || 0;
          if (duration > 0) {
            acc[m.name] = (acc[m.name] || 0) + duration;
          }
          return acc;
        }, {});

        const statsContext =
          Object.entries(speechStats).length > 0
            ? `\n\n[CONTEXTE TEMPS DE PAROLE] : ${Object.entries(speechStats)
                .map(([name, time]) => `${name}: ${time}s`)
                .join(", ")}`
            : "";

        const history = messages.slice(-1000).map((m) => {
          const timestamp = new Date(m.created_at).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          return {
            role: m.name === "Ophélia" ? "assistant" : "user",
            content: `[${timestamp}] ${m.name}: ${m.message}${m.metadata?.voice_duration ? ` (Vocal: ${m.metadata.voice_duration}s)` : ""}`,
          };
        });

        // Si on a des résultats d'outils, on les ajoute à l'historique
        if (toolResults.length > 0) {
          toolResults.forEach((tr) => {
            history.push({
              role: "tool",
              tool_call_id: tr.id,
              content: tr.result,
            });
          });
        }

        if (userIntent) {
          history.push({
            role: "user",
            content: `Message direct à Ophélia: ${userIntent}${statsContext}`,
          });
        } else if (statsContext && !toolResults.length) {
          // If proactive trigger, inject stats in the last message or as a system hint
          const lastMsg = history[history.length - 1];
          if (lastMsg) lastMsg.content += statsContext;
        }

        const opheliaUrl = effectiveConfig.opheliaUrl || "/api/ophelia";
        const payload = {
          action: "chat",
          room_id: roomMetadata?.id || roomName,
          room_slug: roomName,
          content: history,
          agenda: roomData.agenda, // Ajout de l'ordre du jour au contexte
          context: roomData,
          role: roomMetadata?.settings?.ophelia?.role || "mediator",
          system_prompt: augmentedSystemPrompt,
          room_settings: {
            ...roomMetadata?.settings,
            ophelia: {
              ...roomMetadata?.settings?.ophelia,
              ...effectiveConfig.ophelia,
            },
          },
          user_id: user?.id,
          user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme",
          speech_stats: speechStats,
          brique_tools: BRIQUES.flatMap((b) => b.tools || []),
          pivot_lang: pivotLang,
          is_silent: isSilent,
        };

        console.log("[useInseme] Calling Ophélia Edge Function:", opheliaUrl, payload);
        const response = await fetch(opheliaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error (${response.status}): ${errorText || "Unknown error"}`);
        }

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Invalid JSON from Ophélia API: ${responseText.substring(0, 100)}`);
        }
        console.log("[useInseme] Ophélia response:", data);
        const { actions, text } = data || {};

        if (actions && actions.length > 0) {
          const currentToolResults = [];
          for (const action of actions) {
            const { tool, args, vocal_payload, id } = action;

            if (tool === "send_message") {
              await sendMessageRef.current?.(args.text, {
                is_ai: true,
                name: aiName,
                vocal_payload,
              });
              currentToolResults.push({ id, result: "Message envoyé." });
            } else if (tool === "speak") {
              await sendMessageRef.current?.(args.text, {
                is_ai: true,
                name: aiName,
                vocal_payload,
                vocal_only: true,
              });
              currentToolResults.push({ id, result: "Message vocalisé." });
            } else if (tool === "set_proposition") {
              await setPropositionRef.current?.(args.text, true);
              currentToolResults.push({
                id,
                result: "Proposition mise à jour.",
              });
            } else if (tool === "manage_speech_queue") {
              await sendMessageRef.current?.(
                `[Médiation] ${args.action === "invite" ? "Invitons" : "Retirons"} ${args.userId} de la liste.`,
                { is_ai: true, name: aiName }
              );
              currentToolResults.push({
                id,
                result: "File d'attente mise à jour.",
              });
            } else if (tool === "update_assembly_type") {
              await updateAssemblyTypeRef.current?.(args.type);
              currentToolResults.push({
                id,
                result: `Terminologie de l'assemblée mise à jour vers : ${args.type}`,
              });
            } else if (tool === "generate_report") {
              await generateReportRef.current?.();
              currentToolResults.push({
                id,
                result: "Rapport en cours de génération.",
              });
            } else if (tool === "promote_to_plenary") {
              await promoteToPlenaryRef.current?.(args.content);
              currentToolResults.push({
                id,
                result: "Transmis à la plénière.",
              });
            } else if (tool === "search_memory") {
              const results = await searchMemoryRef.current?.(args.query);
              await sendMessageRef.current?.(
                `[Mémoire] Résultats pour "${args.query}" :\n${results}`,
                { is_ai: true, type: "system_summary" }
              );
              currentToolResults.push({ id, result: results });
            } else if (tool === "update_agenda") {
              await updateAgenda(args.new_agenda);
              currentToolResults.push({
                id,
                result: "Ordre du jour mis à jour.",
              });
            } else if (tool === "display_media") {
              const command = `inseme ${args.type} ${args.url}${args.title ? ` [${args.title}]` : ""}`;
              await sendMessageRef.current?.(command, { is_ai: true });
              currentToolResults.push({ id, result: "Média affiché." });
            } else if (tool === "web_search") {
              // On utilise la clé Brave de la salle ou une par défaut (Vault/Config)
              const braveKey =
                roomMetadata?.settings?.brave_search_api_key || getConfig("brave_search_api_key");

              const results = await performWebSearch(args.query, {
                apiKey: braveKey,
                searchLang: pivotLang,
              });
              await sendMessageRef.current?.(
                `[Recherche Web] Résultats pour "${args.query}" :\n${results}`,
                { is_ai: true, type: "system_summary" }
              );
              currentToolResults.push({ id, result: results });
            } else if (tool === "search_wiki") {
              try {
                const searchParams = new URLSearchParams({
                  query: args.query,
                  scope: args.scope || "global",
                  room_slug: roomName,
                });
                const res = await fetch(`/api/wiki-search?${searchParams}`);
                const data = await res.json();

                if (data.results && data.results.length > 0) {
                  const formattedResults = data.results
                    .map(
                      (r) =>
                        `- **${r.title}** (${r.slug}): ${r.summary || r.content?.substring(0, 150) + "..."}`
                    )
                    .join("\n");

                  currentToolResults.push({
                    id,
                    result: `Résultats de recherche dans le Wiki :\n${formattedResults}`,
                  });
                } else {
                  currentToolResults.push({
                    id,
                    result: "Aucun contenu correspondant trouvé dans le Wiki.",
                  });
                }
              } catch (e) {
                currentToolResults.push({
                  id,
                  result: `Erreur lors de la recherche wiki: ${e.message}`,
                });
              }
            } else if (tool === "propose_wiki_page") {
              try {
                // On prépare le slug (room:name ou titre slugifié)
                const baseSlug = args.title
                  .toLowerCase()
                  .trim()
                  .replace(/[^\w\s-]/g, "")
                  .replace(/[\s_-]+/g, "-")
                  .replace(/^-+|-+$/g, "");

                const slug = args.is_room_specific ? `room:${roomName}:${baseSlug}` : baseSlug;

                // On appelle une API de création/mise à jour (à créer ou réutiliser)
                // Pour l'instant on utilise une proposition directe qui nécessite validation
                const res = await fetch("/api/wiki-propose-ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    slug,
                    title: args.title,
                    content: args.content,
                    summary: args.summary,
                    room_id: roomMetadata?.id,
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  currentToolResults.push({
                    id,
                    result: `Proposition de page Wiki créée avec succès : ${args.title}. L'utilisateur doit maintenant la valider.`,
                  });
                } else {
                  currentToolResults.push({
                    id,
                    result: `Échec de la proposition : ${data.error}`,
                  });
                }
              } catch (e) {
                currentToolResults.push({
                  id,
                  result: `Erreur lors de la proposition wiki: ${e.message}`,
                });
              }
            } else if (tool === "execute_code") {
              const { code, input, options = {} } = args;
              const isSilent = options.silent === true;
              const isDebug = options.debug === true;

              try {
                const {
                  result,
                  logs,
                  actions: subActions,
                } = await safeEval(code, input || {}, functionLibraryRef.current);
                const resultStr = JSON.stringify(result, null, 2);
                const logsStr =
                  isDebug && logs && logs.length > 0
                    ? `\n\n**Traces :**\n\`\`\`\n${logs.join("\n")}\n\`\`\``
                    : "";

                if (!isSilent) {
                  await sendMessageRef.current?.(
                    `[Capacité] Exécution réussie :\n\`\`\`json\n${resultStr}\n\`\`\`${logsStr}`,
                    { is_ai: true, type: "system_summary" }
                  );
                }
                currentToolResults.push({ id, result: resultStr, logs });

                // Add side-effects to the current processing loop
                if (subActions && subActions.length > 0) {
                  actions.push(...subActions);
                }
              } catch (error) {
                const errorMsg = error.message;
                const isContractViolation =
                  errorMsg.includes("VIOLATED") || errorMsg.includes("FAILED");

                // Force debug on contract violation or if requested
                const showLogs = isDebug || isContractViolation;

                const logsStr =
                  showLogs && error.logs && error.logs.length > 0
                    ? `\n\n**Traces avant échec :**\n\`\`\`\n${error.logs.join("\n")}\n\`\`\``
                    : "";

                if (!isSilent || isContractViolation) {
                  await sendMessageRef.current?.(
                    `[Capacité] Échec de l'exécution : ${errorMsg}${logsStr}`,
                    { is_ai: true, type: "system_summary" }
                  );
                }
                currentToolResults.push({
                  id,
                  result: `Erreur: ${errorMsg}`,
                  logs: error.logs,
                });

                // Add side-effects even on failure (if any were emitted before crash)
                if (error.actions && error.actions.length > 0) {
                  actions.push(...error.actions);
                }
              }
            } else if (functionLibraryRef.current[tool]) {
              // Unified Routing: if tool is in library, treat as execute_code call
              const func = functionLibraryRef.current[tool];
              try {
                const {
                  result,
                  logs,
                  actions: subActions,
                } = await safeEval(
                  func.code,
                  args || {}, // Tool args become function input
                  functionLibraryRef.current
                );
                currentToolResults.push({ id, result, logs });
                if (subActions && subActions.length > 0) {
                  actions.push(...subActions);
                }
              } catch (error) {
                currentToolResults.push({
                  id,
                  result: `Erreur ${tool}: ${error.message}`,
                  logs: error.logs,
                });
              }
            } else if (tool === "save_function") {
              const { name, code, args: funcArgs, description } = args;
              await sendMessageRef.current?.(
                `[Bibliothèque] Nouvelle fonction enregistrée : **${name}**\n_${description}_`,
                {
                  is_ai: true,
                  type: "function_definition",
                  metadata: { name, code, args: funcArgs, description },
                }
              );
              currentToolResults.push({
                id,
                result: `Fonction ${name} enregistrée dans le registre de l'Eunomia.`,
              });
            }
          }
          // Si on a des résultats d'outils, on relance Ophélia pour la réponse finale
          if (currentToolResults.length > 0) {
            setIsOphéliaThinking(false); // On libère pour permettre la récursion
            return triggerOphélia(null, currentToolResults);
          }
        } else if (text) {
          let opheliaMsg = text;
          let metadata = { is_ai: true };

          // --- Ephemeral Reasoning (Think) Handling ---
          const thinkMatch = opheliaMsg.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch) {
            const reasoning = thinkMatch[1].trim();
            opheliaMsg = opheliaMsg.replace(/<think>[\s\S]*?<\/think>/, "").trim();

            channelRef.current?.send({
              type: "broadcast",
              event: "ephemeral_reasoning",
              payload: {
                reasoning,
                name: "Ophélia",
                timestamp: new Date().toISOString(),
              },
            });
          }

          if (opheliaMsg.includes("FLASH_POLL:")) {
            const pollQuestion = opheliaMsg.split("FLASH_POLL:")[1].trim();
            opheliaMsg = pollQuestion;
            metadata = {
              ...metadata,
              type: "flash_poll",
              is_system: true,
            };
          }

          await sendMessageRef.current?.(opheliaMsg, metadata);
        }
      } catch (err) {
        console.error("Erreur Agent Ophélia:", err);
      } finally {
        setIsOphéliaThinking(false);
        // Broadcast that we finished thinking
        channelRef.current?.send({
          type: "broadcast",
          event: "ai_thinking",
          payload: { status: false },
        });
      }
    },
    [
      isOphéliaThinking,
      messages,
      roomMetadata,
      roomName,
      roomData,
      systemPrompt,
      effectiveConfig,
      user?.id,
    ]
  );

  const updateAssemblyTypeRef = useRef(updateAssemblyType);

  // Keep refs in sync with latest versions to break circular dependencies
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    triggerOphéliaRef.current = triggerOphélia;
    setPropositionRef.current = setProposition;
    generateReportRef.current = generateReport;
    promoteToPlenaryRef.current = promoteToPlenary;
    searchMemoryRef.current = searchMemory;
    castVoteRef.current = castVote;
    updateAssemblyTypeRef.current = updateAssemblyType;
    cleanupEphemeralLogsRef.current = cleanupEphemeralLogs;
  }, [
    sendMessage,
    triggerOphélia,
    setProposition,
    generateReport,
    promoteToPlenary,
    searchMemory,
    castVote,
    updateAssemblyType,
    cleanupEphemeralLogs,
  ]);

  return {
    roomName,
    user,
    currentUser,
    isAfter,
    isBar,
    isEphemeral,
    userRole,
    isSpectator,
    canVote,
    canInteract,
    isMember,
    messages,
    activeSpeakers: roomData.connectedUsers,
    ephemeralThoughts,
    roomData,
    roomMetadata,
    terminology,
    template,
    sendMessage,
    askOphélia: triggerOphélia,
    askGabriel: triggerGabriel,
    gabrielConfig,
    updateGabrielConfig,
    isOphéliaThinking,
    nativeLang,
    setNativeLang,
    isSilent,
    setIsSilent,
    setProposition,
    updateRoomSettings,
    updateAssemblyType,
    generateReport,
    cleanupEphemeralLogs,
    promoteToPlenary,
    archiveReport,
    startSession,
    endSession,
    updateAgenda,
    sendBroadcast: (event, payload) => {
      channelRef.current?.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    setTemplate,
    declarePower,
    castVote,
    onParole,
    onDelegate,
    sessions,
    currentSessionId,
    selectSession,
    presenceState,
    presenceMetadata,
    setPresenceMetadata,
    uploadVocal,
    playVocal,
    stopVocal,
    microMode,
    changeMicroMode,
    isHandsFree,
    setIsHandsFree,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
    duration,
    timeLeft,
    vocalState,
    vocalError,
    transcriptionPreview,
    semanticWindow,
    transcriptionStatus,
    deviceCapability,
    config: effectiveConfig,
  };
}
