/**
 * ARCHITECTURE RATIONALE: useInseme
 *
 * useInseme serves as the hub-and-spoke orchestrator for the Inseme/Cyrnea room environment.
 * The primary goal of this hook is to manage the lifecycle of a "Room" by coordinating
 * specialized domains (AI, Governance, Voice, Reporting) while keeping the main UI
 * components decoupled from the underlying Supabase/Realtime complexity.
 *
 * CORE CONCEPTS:
 *
 * 1. FORMAL vs INFORMAL IDENTITY:
 *    - FORMAL (Inseme App): Users are authenticated via Supabase. Their identity is stable,
 *      fetched from `inseme_profiles`, and linked to their account.
 *    - INFORMAL (Cyrnea/Bar): Users are anonymous by default. Identity is volatile and
 *      managed via `localStorage` (localIdentity) to prioritize speed and privacy in a bar setting.
 *    - useInseme bridges these by computing an `effectiveUser` used by all sub-hooks.
 *
 * 2. MODULARITY:
 *    - Logic is extracted into domain-specific hooks (useOpheliaAgent, useGovernance, etc.)
 *      to avoid a monolithic 3000-line file. useInseme provides the "glue" (Refs, Shared state).
 *
 * 3. REALTIME SYCHRONIZATION:
 *    - Uses Supabase Realtime (Presence & Broadcast) to maintain a "living" state across
 *      distributed clients. This ensures everyone in the room has a consistent view
 *      of the user list, agenda, and AI thinking state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder.js";

import {
  getConfig,
  loadInstanceConfig,
  useGroup,
  useGroupMembers,
  storage,
} from "@inseme/cop-host";
import { GOVERNANCE_MODELS, getGovernanceModel, calculateResults } from "@inseme/kudocracy";
import { OPHELIA_ID } from "../constants";

import { useSilenceTrigger } from "./useSilenceTrigger";
import { useOpheliaAgent } from "./useOpheliaAgent";
import { useGovernance } from "./useGovernance";
import { useReporting } from "./useReporting";
import { useVoiceHandler } from "./useVoiceHandler";

const PROFILE_TABLE = "inseme_profiles";

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
        const escapedName = realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedName}\\b`, "g");
        anonymizedContent = anonymizedContent.replace(regex, userMap[realName]);
      });
    }

    return {
      ...m,
      name: anonymizedName,
      message: anonymizedContent,
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

import { BRIQUES, CONSOLIDATED_PROMPTS } from "../generated/brique-registry.js";

export function useInseme(roomName, user, supabase, config = {}, isSpectator = false) {
  // --- RATIONALE ---
  // useInseme is the central hub for room-based interaction.
  // It orchestrates specialized hooks (Governance, Reporting, Voice, Agent)
  // to maintain a clean separation of concerns while providing a unified API to the UI.
  // It handles two distinct identity modes: Formal (authenticated) and Informal (anonymous/local).

  // 0. Configuration Management
  // Stabilizes the configuration object to avoid unnecessary re-renders in sub-hooks.
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
    };
  }, [config]);

  // 1. Core State
  const [messages, setMessages] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [localIdentity, setLocalIdentity] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`inseme_local_identity_${roomName}`);
      if (saved) return JSON.parse(saved);

      // Migration from legacy keys if available
      const legacyPseudo =
        localStorage.getItem("inseme_client_pseudo") || localStorage.getItem("inseme_guest_pseudo");

      // Generate a unique UID for this anonymous user to avoid presence collision
      const newIdentity = {
        pseudo: legacyPseudo || "",
        uid: "anon_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now(),
      };
      localStorage.setItem(`inseme_local_identity_${roomName}`, JSON.stringify(newIdentity));
      return newIdentity;
    }
    return { pseudo: "", uid: "guest" };
  });
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);

  // Room Data
  const [roomData, setRoomData] = useState({
    connectedUsers: [],
    agenda: [],
    speechQueue: [],
  });
  const [roomMetadata, setRoomMetadata] = useState(null); // Settings, governance model...

  // UI State
  const [nativeLang, setNativeLang] = useState("fr"); // Default UI language
  const [isSilent, setIsSilent] = useState(false); // Vocal output toggle
  const [isHandsFree, setIsHandsFree] = useState(false); // Vocal input toggle
  const [presenceMetadata, setPresenceMetadata] = useState({});
  const [currentSessionId, selectSession] = useState(null);

  // Audio State managed by useVoiceHandler hook

  // Refs
  const sendMessageRef = useRef(null); // Stable ref for sendMessage
  const channelRef = useRef(null); // Realtime channel
  const currentSessionIdRef = useRef(null);
  const timersRef = useRef({}); // For speech timeouts

  // --- INITIALIZATION ---

  // 1. Fetch Room Metadata
  useEffect(() => {
    if (!supabase || !roomName) return;

    const fetchMetadata = async () => {
      const { data, error } = await supabase
        .from("inseme_rooms")
        .select("*")
        .eq("slug", roomName)
        .maybeSingle();

      if (data) {
        setRoomMetadata(data);
      }
    };

    fetchMetadata();
  }, [supabase, roomName]);

  // 2. Fetch Initial Messages & Subscribe
  useEffect(() => {
    if (!supabase || !roomMetadata?.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("inseme_messages")
        .select("*")
        .eq("room_id", roomMetadata.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) setMessages(data);
    };

    fetchMessages();

    const msgChannel = supabase
      .channel(`room_messages_${roomMetadata.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inseme_messages",
          filter: `room_id=eq.${roomMetadata.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [supabase, roomMetadata?.id]);

  // Compute effective user
  const effectiveUser = useMemo(() => {
    const isEphemeral = !!roomMetadata?.settings?.ephemeral;

    // Informal Mode / Anonymous Fallback: Local Identity > "Visiteur"
    if (isEphemeral || !user) {
      return {
        id: localIdentity.uid || "guest_" + roomName,
        name: localIdentity.pseudo || "Visiteur",
        pseudo: localIdentity.pseudo || "",
        summary: "Visiteur",
        avatar_url: localIdentity.avatar_url,
        color: localIdentity.color || "#000000",
        isAnonymous: true,
        metadata: {},
      };
    }

    // Formal Mode: Managed Account
    // Prioritize userProfile (from DB) > Supabase metadata > Email
    const dbPseudo = userProfile?.pseudo;
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
    const emailName = user.email?.split("@")[0];

    return {
      ...user,
      id: user.id,
      name: dbPseudo || metaName || emailName || "Utilisateur",
      pseudo: dbPseudo || metaName || emailName || "Utilisateur",
      summary: userProfile?.summary || "Membre",
      avatar_url: userProfile?.avatar_url || user.user_metadata?.avatar_url,
      color: userProfile?.color || "#000000",
      isAnonymous: false,
    };
  }, [user, userProfile, localIdentity, roomMetadata, roomName]);

  // 2. Computed Identity & Roles
  // This logic manages the "Formal vs Informal" distinction.
  // In bars (informal), anonymity and persistence via localStorage are prioritized.
  // In assemblies (formal), the Supabase authenticated profile is the source of truth.
  const {
    isBar,
    isAfter,
    isEphemeral,
    userRole,
    canVote,
    canInteract,
    isMember,
    terminology,
    template,
    pivotLang,
    sessions,
  } = useMemo(() => {
    const settings = roomMetadata?.settings || {};
    const type = settings.type || "standard";
    const userRole = settings.roles?.[effectiveUser.id] || "guest";

    return {
      isBar: type === "bar",
      isAfter: type === "after",
      isEphemeral: !!settings.ephemeral,
      userRole,
      canVote: !isSpectator,
      canInteract: !isSpectator,
      isMember: true,
      terminology: calculateTerminology(settings.governance_model),
      template: settings.template,
      pivotLang: settings.pivot_lang || "fr",
      sessions: [],
    };

    function calculateTerminology(modelId) {
      const model = getGovernanceModel(modelId);
      // Terminology adapts the UI to the local culture (e.g., "Le Bar" vs "L'Assemblée")
      return model
        ? model.terminology
        : { session: "Séance", members: "Membres", agenda: "Ordre du jour" };
    }
  }, [roomMetadata, effectiveUser, isSpectator]);

  // --- IDENTITY LOGIC ---

  // Fetch formal profile if user is authenticated
  useEffect(() => {
    if (!user?.id || !supabase || !!roomMetadata?.settings?.ephemeral) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) setUserProfile(data);
    };

    fetchProfile();
  }, [user?.id, supabase, roomMetadata?.settings?.ephemeral]);

  const updateAnonymousIdentity = useCallback(
    async (newPseudo) => {
      if (!newPseudo?.trim()) return;
      const isEphemeral = !!roomMetadata?.settings?.ephemeral;

      // 1. Always update local state for immediate feedback and local persistence
      setLocalIdentity((prev) => {
        const next = { ...prev, pseudo: newPseudo.trim() };
        if (typeof window !== "undefined") {
          localStorage.setItem(`inseme_local_identity_${roomName}`, JSON.stringify(next));
        }
        return next;
      });

      // 2. If formal mode (authenticated and not ephemeral), also update the DB profile
      if (!isEphemeral && user?.id && supabase) {
        const { error } = await supabase
          .from(PROFILE_TABLE)
          .upsert({ id: user.id, pseudo: newPseudo.trim() });

        if (!error) {
          setUserProfile((prev) => ({ ...prev, pseudo: newPseudo.trim() }));
        }
      }
    },
    [roomName, roomMetadata, user, supabase]
  );

  // 4. Message Orchestration
  // sendMessage is the main entry point for user input.
  // It handles image uploads, command parsing, and database persistence.
  const sendMessage = useCallback(
    async (text, metadata = {}, image = null) => {
      // 4.1 Image Handling
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

      const trimmedText = text?.trim();
      if (!metadata.is_ai && !canInteract) return;
      if (!trimmedText && !metadata.type) return;
      if (!supabase) return;

      // 4.2 Command Parsing (Intercepts local instructions)
      if (trimmedText?.toLowerCase().startsWith("inseme ")) {
        const cmd = trimmedText.split(" ");
        const action = cmd[1]?.toLowerCase();

        if (action === "handsfree") {
          setIsHandsFree((prev) => !prev);
          return;
        }
        if (action === "silent") {
          setIsSilent((prev) => !prev);
          return;
        }
        if (action === "lang" && cmd[2]) {
          setNativeLang(cmd[2]);
          return;
        }
        // ... Other commands like 'parole' or 'vote' flow to the database for AI/Logic processing
      }

      // 4.3 Persistence
      let contentObj = {
        room_id: roomMetadata?.id || roomName,
        user_id:
          metadata.is_ai || isEphemeral
            ? null
            : effectiveUser.isAnonymous
              ? null
              : effectiveUser.id,
        name: metadata.is_ai ? "Ophélia" : metadata.pseudonym || effectiveUser.name || "Anonyme",
        message: text,
        type: metadata.type || "chat",
        metadata: {
          ...metadata,
          user_name: effectiveUser.name, // Preserve effective name for history
        },
      };

      const { data, error } = await supabase
        .from("inseme_messages")
        .insert([contentObj])
        .select()
        .single();

      if (error) console.error("Send Error", error);
    },
    [supabase, roomMetadata, roomName, effectiveUser, canInteract, isEphemeral]
  );

  // --- HOOKS INTEGRATION ---

  // 1. Governance Tools
  const {
    castVote,
    declarePower,
    updateAssemblyType,
    setProposition,
    promoteToPlenary,
    updateAgenda,
    setTemplate, // Added missing export
  } = useGovernance({
    roomMetadata,
    effectiveUser,
    canVote: true, // simplified
    supabase,
    roomName,
    sendMessageRef,
    setRoomMetadata: null, // Let useInseme manage state via subscription ideally, but passing setter works too
  });

  // 2. Reporting Tools
  const { generateReport, archiveReport, cleanupEphemeralLogs, searchMemory } = useReporting({
    roomMetadata,
    messages,
    roomName,
    isEphemeral: roomMetadata?.settings?.ephemeral,
    supabase,
    sendMessageRef,
    setIsOphéliaThinking: (val) => (isOphéliaThinkingRef.current = val), // Hack: Refs used in internal hooks
    currentSessionId,
    applyBehavioralAnonymization,
  });

  const isOphéliaThinkingRef = useRef(false); // Local ref for sync

  // 3. Ophelia Agent
  const governanceTools = useMemo(
    () => ({
      setProposition,
      updateAssemblyType,
      promoteToPlenary,
      updateAgenda,
      generateReport,
      searchMemory,
      castVote,
      cleanupEphemeralLogs,
      setTemplate,
    }),
    [
      setProposition,
      updateAssemblyType,
      promoteToPlenary,
      updateAgenda,
      generateReport,
      searchMemory,
      castVote,
      cleanupEphemeralLogs,
      setTemplate,
    ]
  );

  // 5. Agent Orchestration
  // This is where Ophélia's brain is configured.
  // The system prompt is generated dynamically to give her the correct "vibe" and role knowledge.
  const augmentedSystemPrompt = useMemo(() => {
    const settings = roomMetadata?.settings || {};
    const type = settings.type || "standard";
    const modelId = settings.governance_model || "standard";

    const base = CONSOLIDATED_PROMPTS?.ophelia?.base || "Tu es Ophélia, une IA médiatrice.";

    let modeInstructions = "";
    if (type === "bar") {
      modeInstructions =
        "\nTu es dans un Bar. Priorise la convivialité, l'humour, et l'ambiance locale.";
    } else if (type === "after") {
      modeInstructions =
        "\nMode After-hours : Sois plus décontractée, parle de musique et de détente.";
    }

    const roleContext =
      userRole === "barman"
        ? "\nL'utilisateur actuel est un BARMAN. Sois son assistante proactive."
        : "";

    return `${base}${modeInstructions}\n\n[INSTRUCTIONS GOUVERNANCE] : Utilise le modèle ${modelId}. ${roleContext}`;
  }, [roomMetadata, userRole]);

  const {
    isOphéliaThinking,
    setIsOphéliaThinking,
    triggerOphélia,
    triggerOphéliaRef,
    triggerGabriel,
    gabrielConfig,
    updateGabrielConfig,
  } = useOpheliaAgent({
    messages,
    roomData,
    roomMetadata,
    roomName,
    supabase,
    config: effectiveConfig,
    sendMessageRef,
    channelRef,
    isSpectator,
    effectiveUser,
    currentUser: user,
    userProfile,
    isSilent: isSilent,
    systemPrompt: augmentedSystemPrompt,
    tools: governanceTools,
    pivotLang: nativeLang,
  });

  // Sync Thinking State
  useEffect(() => {
    isOphéliaThinkingRef.current = isOphéliaThinking;
  }, [isOphéliaThinking]);

  // 4. Silence Trigger
  const { lastAiResponse, forceTriggerOphelia, inactivityTimerRef } = useSilenceTrigger({
    roomData,
    connectedUsers: roomData.connectedUsers,
    effectiveUser,
    messages,
    isOphéliaThinking,
    triggerOphéliaRef,
    isManuallyDisconnected,
    roomName,
    supabase,
    isSpectator,
    roomMetadata,
  });

  // 5. Voice Handler
  const {
    isRecording,
    isTranscribing,
    vocalState,
    vocalError,
    startRecording,
    stopRecording,
    cancelRecording,
    duration,
    timeLeft,
    uploadVocal,
    transcriptionPreview,
  } = useVoiceHandler({
    roomMetadata,
    roomName,
    config: effectiveConfig,
    sendMessageRef,
    setIsOphéliaThinking: (val) => setIsOphéliaThinking(val),
    nativeLang,
    isHandsFree,
    isOphéliaThinking,
  });

  // Refs Sync (Legacy/Global compatibility)
  const updateAssemblyTypeRef = useRef(updateAssemblyType);
  const setPropositionRef = useRef(setProposition);
  const generateReportRef = useRef(generateReport);
  const promoteToPlenaryRef = useRef(promoteToPlenary);
  const searchMemoryRef = useRef(searchMemory);
  const castVoteRef = useRef(castVote);
  const cleanupEphemeralLogsRef = useRef(cleanupEphemeralLogs);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    updateAssemblyTypeRef.current = updateAssemblyType;
    setPropositionRef.current = setProposition;
    generateReportRef.current = generateReport;
    promoteToPlenaryRef.current = promoteToPlenary;
    searchMemoryRef.current = searchMemory;
    castVoteRef.current = castVote;
    cleanupEphemeralLogsRef.current = cleanupEphemeralLogs;
  }, [
    sendMessage,
    updateAssemblyType,
    setProposition,
    generateReport,
    promoteToPlenary,
    searchMemory,
    castVote,
    cleanupEphemeralLogs,
  ]);

  // Helper Wrappers
  const onParole = useCallback(() => {
    if (!canVote) return;
    sendMessageRef.current?.("inseme parole");
  }, [canVote]);

  const onDelegate = useCallback(
    (target) => {
      if (!canVote) return;
      sendMessageRef.current?.(`inseme bye ${target}`);
    },
    [canVote]
  );

  const startSession = useCallback(() => {
    const sessionName = terminology.session || "Session";
    sendMessageRef.current?.(`inseme open\n*La ${sessionName} commence.*`, {
      type: "system_summary",
    });
  }, [terminology]);

  const endSession = useCallback(async () => {
    const sessionName = terminology.session || "Session";
    sendMessageRef.current?.(`inseme close\n*La ${sessionName} est désormais close.*`, {
      type: "system_summary",
    });

    if (generateReportRef.current) {
      await generateReportRef.current();
    }
    if (isEphemeral && cleanupEphemeralLogsRef.current) {
      await cleanupEphemeralLogsRef.current(3);
    }
  }, [terminology, isEphemeral]);

  const updateRoomSettings = useCallback(
    async (newSettings) => {
      // Direct supabase update...
      if (!roomMetadata?.id || !supabase) return;
      await supabase
        .from("inseme_rooms")
        .update({ settings: { ...roomMetadata.settings, ...newSettings } })
        .eq("id", roomMetadata.id);
    },
    [roomMetadata, supabase]
  );

  // --- REALTIME PRESENCE & BROADCAST ---

  useEffect(() => {
    if (!supabase || !roomName) return;

    const channel = supabase.channel(`room_${roomName}`, {
      config: {
        presence: {
          key: effectiveUser.id,
        },
      },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = [];
        for (const id in state) {
          users.push(...state[id]);
        }
        setRoomData((prev) => ({ ...prev, connectedUsers: users }));
      })
      .on("broadcast", { event: "agenda_update" }, ({ payload }) => {
        if (payload?.agenda) {
          setRoomData((prev) => ({ ...prev, agenda: payload.agenda }));
        }
      })
      .on("broadcast", { event: "speech_queue_update" }, ({ payload }) => {
        if (payload?.queue) {
          setRoomData((prev) => ({ ...prev, speechQueue: payload.queue }));
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Initial tracking if not disconnected
          if (!isManuallyDisconnected) {
            await channel.track({
              user_id: effectiveUser.id,
              name: effectiveUser.name,
              is_ai: false,
              status: "online",
              ...effectiveUser.metadata,
              ...presenceMetadata,
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, roomName]); // Removed effectiveUser/presenceMetadata dependencies to avoid reconnects

  // Separate effect for tracking updates to avoid channel reconnects
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !supabase) return;

    const updatePresence = async () => {
      if (isManuallyDisconnected) {
        await channel.untrack();
      } else {
        // Ensure channel is subscribed (it usually is if ref is set, but track retries if needed)
        await channel.track({
          user_id: effectiveUser.id,
          name: effectiveUser.name,
          is_ai: false,
          status: "online",
          ...effectiveUser.metadata,
          ...presenceMetadata,
        });
      }
    };

    updatePresence();
  }, [isManuallyDisconnected, presenceMetadata, effectiveUser]);

  // --- DERIVED STATE ---
  // presentPeople is the refined list of real participants (excluding AI and spectators)
  const presentPeople = useMemo(() => {
    return (roomData.connectedUsers || []).filter(
      (u) => u.name && u.name !== "Ophélia" && !u.is_ai && u.status === "online"
    );
  }, [roomData.connectedUsers]);

  const toggleManualDisconnect = useCallback(async () => {
    setIsManuallyDisconnected((prev) => {
      const newState = !prev;
      const msg = newState
        ? `*${effectiveUser.name} est parti(e).*`
        : `*${effectiveUser.name} est arrivé(e).*`;

      if (sendMessage) {
        sendMessage(msg, {
          type: "system_notification",
          subtype: newState ? "exit" : "entrance",
        });
      }
      return newState;
    });
  }, [effectiveUser, sendMessage]);

  // Simplified Return Object
  return {
    roomName,
    user,
    currentUser: effectiveUser,
    isAfter,
    isBar,
    isEphemeral,
    userRole,
    isSpectator,
    canVote,
    canInteract,
    isMember,
    messages,
    roomData,
    presentPeople,
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
    // Vocal stuff managed by hook
    uploadVocal,
    playVocal: null,
    stopVocal: null,
    microMode: "default",
    changeMicroMode: () => {},
    isHandsFree, // toggled locally
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
    semanticWindow: [],
    transcriptionStatus: {},
    deviceCapability: {},
    config: effectiveConfig,
    isManuallyDisconnected,
    toggleManualDisconnect,
    lastAiResponse,
    forceTriggerOphelia,
    updateAnonymousIdentity,
    presenceMetadata,
    setPresenceMetadata,
    currentSessionId,
    selectSession,
    sessions,
  };
}
