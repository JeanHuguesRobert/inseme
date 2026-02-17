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
import { OPHELIA_ID } from "../constants.js";

import { useSilenceTrigger } from "./useSilenceTrigger.js";
import { useOpheliaAgent } from "./useOpheliaAgent.js";
import { useGovernance } from "./useGovernance.js";
import { useReporting } from "./useReporting.js";
import { useVoiceHandler } from "./useVoiceHandler.js";
import { sendMessage as sendBusMessage } from "../lib/messageBus.js";

const PROFILE_TABLE = "users";

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
import { User } from "@inseme/cop-host";

/**
 * 🛡️ INSEME ROOM STRATEGY: HYBRID (TYPE 1, 2, & 3)
 *
 * This hook manages the complexity of ephemeral rooms where all user types coexist.
 *
 * 1. Starts with TYPE 1 (Local Identity) from localStorage (`inseme_local_identity_${roomName}`).
 * 2. Can upgrade to TYPE 2 (Guest) via `signInAnonymously`.
 * 3. Can be fully TYPE 3 (Authenticated) if the user logs in.
 *
 * The `localIdentity` state preserves the user's chosen pseudo even before they exist in Supabase.
 */
export function useInseme(roomName, user, supabase, config, isSpectator) {
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

      // For Anonymous Users: We use a UUID for local identification (Presence, React keys)
      // but sendMessage will send NULL to the DB user_id column.
      const newIdentity = {
        pseudo: legacyPseudo || "",
        uid:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "00000000-0000-4000-b000-" + Math.random().toString(16).slice(2, 14),
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
  const [sessionStatus, setSessionStatus] = useState("closed"); // "open" | "closed"

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

      if (data) {
        setMessages(data);
        try {
          // Mirror messages into the Bar singleton (recent session messages)
          const { TheBar } = await import("../../models/index.js");
          if (TheBar) {
            data.forEach((m) => {
              try {
                TheBar.addMessage(m);
                TheBar.attachMessageToUser(m);
              } catch (e) {
                /* ignore individual failures */
              }
            });
          }
        } catch (e) {
          // Dynamic import might fail in edge contexts; ignore
        }
      }
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
            // Mirror to TheBar singleton
            try {
              // dynamic import to avoid circular deps
              import("../../models/index.js").then(({ TheBar }) => {
                if (TheBar) {
                  try {
                    TheBar.addMessage(payload.new);
                    TheBar.attachMessageToUser(payload.new);
                  } catch (e) {}
                }
              });
            } catch (e) {
              // ignore
            }
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
    // Informal Mode / Anonymous Fallback: Local Identity > "Visiteur"
    if (
      isEphemeral ||
      !user ||
      (user.isAnonymous && !user.id) || // Handle generic object with isAnonymous
      !user.id ||
      user.id === "null" ||
      (typeof user.id === "string" && user.id.startsWith("anon_"))
    ) {
      const effectiveName = localIdentity.pseudo || "Visiteur";

      // Return Type 1 User
      return new User({
        id: localIdentity.uid || "guest_" + roomName,
        pseudo: effectiveName,
        type: 1,
        metadata: {
          is_anonymous: true,
          avatarUrl: localIdentity.avatar_url,
          color: localIdentity.color || "#000000",
          summary: "Visiteur",
        },
      });
    }

    // Formal Mode: Managed Account
    // Prioritize userProfile (from DB) > Supabase metadata > Email
    const dbPseudo = userProfile?.display_name || userProfile?.pseudo;
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
    const emailName = user.email?.split("@")[0];
    const effectiveName = dbPseudo || metaName || emailName || user.pseudo || "Utilisateur";

    // Return Type 2 or 3 User
    return new User({
      ...user, // Inherit existing properties
      id: user.id,
      pseudo: effectiveName,
      type: user.is_anonymous || user.user_metadata?.is_anonymous ? 2 : 3,
      metadata: {
        ...user.user_metadata,
        avatarUrl: userProfile?.avatar_url || user.user_metadata?.avatar_url || user.avatarUrl,
        color: userProfile?.color || user.color || "#000000",
        summary: userProfile?.summary || user.summary || "Membre",
      },
    });
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
    if (!user?.id || !supabase || !!roomMetadata?.settings?.ephemeral || user?.isAnonymous) return;

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

  // Listen for profile updates from Cyrnea system
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleProfileUpdate = (event) => {
      const { userId, pseudo } = event.detail;
      console.log("[useInseme] Received profile update event:", {
        userId,
        pseudo,
        currentUserId: user?.id,
        currentProfile: userProfile,
      });

      // Only update if this matches the current user
      if (user?.id === userId && userProfile?.display_name !== pseudo) {
        console.log(
          "[useInseme] Updating userProfile from",
          userProfile?.display_name,
          "to",
          pseudo
        );
        setUserProfile((prev) => ({ ...prev, display_name: pseudo }));
        console.log("[useInseme] Profile updated from Cyrnea system:", { userId, pseudo });
      } else {
        console.log("[useInseme] Not updating profile - conditions not met");
      }
    };

    window.addEventListener("inseme-profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("inseme-profile-updated", handleProfileUpdate);
    };
  }, [user?.id, userProfile?.display_name]);

  // Listen for anonymous profile updates from Cyrnea system
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAnonymousProfileUpdate = (event) => {
      const { pseudo } = event.detail;
      console.log("[useInseme] Received anonymous profile update event:", {
        pseudo,
        currentLocalIdentity: localIdentity,
      });

      // Update localIdentity for anonymous users
      setLocalIdentity((prev) => {
        const next = { ...prev, pseudo: pseudo.trim() };
        console.log("[useInseme] Updating localIdentity from", prev.pseudo, "to", pseudo);

        // Also update localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(`inseme_local_identity_${roomName}`, JSON.stringify(next));
        }

        return next;
      });
    };

    window.addEventListener("inseme-anonymous-profile-updated", handleAnonymousProfileUpdate);

    return () => {
      window.removeEventListener("inseme-anonymous-profile-updated", handleAnonymousProfileUpdate);
    };
  }, [roomName]);

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
        const { error } = await supabase.from(PROFILE_TABLE).upsert({
          id: user.id,
          display_name: newPseudo.trim(),
          updated_at: new Date().toISOString(),
        });

        if (!error) {
          setUserProfile((prev) => ({ ...prev, display_name: newPseudo.trim() }));
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
      try {
        const isAnon =
          effectiveUser.isAnonymous ||
          (typeof effectiveUser.id === "string" && effectiveUser.id.startsWith("anon_"));
        const userId = metadata.is_ai || isEphemeral || isAnon ? null : effectiveUser.id;

        await sendBusMessage(supabase, {
          roomId: roomMetadata?.id || roomName,
          userId,
          name: metadata.is_ai ? "Ophélia" : metadata.pseudonym || effectiveUser.name || "Anonyme",
          message: text,
          type: metadata.type || "chat",
          metadata: {
            ...metadata,
            user_name: effectiveUser.name, // Preserve effective name for history
          },
        });
      } catch (error) {
        console.error("Send Error", error);
      }
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

  // Unified system message generator
  const createSystemMessage = useCallback(
    (action, details = {}) => {
      const sessionName = terminology.session || "Session";
      const messages = {
        open: {
          command: "inseme open",
          text: `*La ${sessionName} commence.*`,
          broadcast: `🔔 La ${sessionName} est ouverte !`,
        },
        close: {
          command: "inseme close",
          text: `*La ${sessionName} est désormais close.*`,
          broadcast: `🔔 La ${sessionName} est close.`,
        },
        barman_declared: {
          command: null,
          text: null,
          broadcast: `🔔 ${(details.barmanName || "").toUpperCase()} A PRIS LE SERVICE AU BAR !`,
          type: "role_announcement",
        },
        barman_relieved: {
          command: null,
          text: null,
          broadcast: `🔔 ${(details.barmanName || "").toUpperCase()} A QUITTÉ LE SERVICE AU BAR !`,
          type: "role_announcement",
        },
      };

      const message = messages[action];
      if (!message) return null;

      return {
        command: message.command,
        text: message.text,
        broadcast: message.broadcast,
        type: message.type,
      };
    },
    [terminology]
  );

  const startSession = useCallback(() => {
    setSessionStatus("open");
    const message = createSystemMessage("open");
    if (message) {
      sendMessageRef.current?.(`${message.command}\n${message.text}`, {
        type: message.type,
      });
    }
  }, [createSystemMessage]);

  const endSession = useCallback(async () => {
    setSessionStatus("closed");
    const message = createSystemMessage("close");
    if (message) {
      sendMessageRef.current?.(`${message.command}\n${message.text}`, {
        type: message.type,
      });
    }

    if (generateReportRef.current) {
      await generateReportRef.current();
    }
    if (isEphemeral && cleanupEphemeralLogsRef.current) {
      await cleanupEphemeralLogsRef.current(3);
    }
  }, [createSystemMessage, isEphemeral]);

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
        const rawUsers = [];
        for (const id in state) {
          rawUsers.push(...state[id]);
        }

        // Normalize presence entries to a consistent shape
        const users = rawUsers.map((u) => ({
          id: u.user_id || u.id || u.uid || u.userId || null,
          user_id: u.user_id || u.id || u.userId || u.uid || null,
          name: u.name || u.pseudo || "",
          role: u.role || "client",
          zone: u.zone || u.zone_id || "indoor",
          status: u.status || (u.online ? "online" : "offline"),
          public_links: u.public_links || u.publicLinks || [],
          metadata: u.metadata || {},
        }));

        // Ensure current effectiveUser is included at least locally
        try {
          const currentId = effectiveUser?.id || null;
          if (currentId && !users.find((x) => x.id === currentId)) {
            users.push({
              id: currentId,
              user_id: currentId,
              name: effectiveUser.name || effectiveUser.pseudo || "",
              role: effectiveUser.role || "client",
              zone: effectiveUser.zone || "indoor",
              status: "online",
              metadata: effectiveUser.metadata || {},
            });
          }
        } catch (err) {
          // Ignore if effectiveUser not available
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
  // Enrich with TheBar data (messages/lastMessage) when available
  const presentPeople = useMemo(() => {
    const raw = (roomData.connectedUsers || []).filter((u) => u && u.name && u.status === "online");

    let enriched = raw.map((u) => {
      try {
        // Try to get TheBar data synchronously if available
        if (typeof window !== "undefined" && window.TheBar) {
          const barUser = window.TheBar?.getUser?.(u.id || u.user_id) || null;
          return barUser ? { ...u, ...barUser } : u;
        }
        return u;
      } catch (e) {
        return u;
      }
    });

    // Ensure Ophélia appears as a virtual user when available
    try {
      if (typeof window !== "undefined" && window.TheBar) {
        const oph = window.TheBar?.getUser?.("ophélia");
        if (oph && !enriched.find((x) => x.id === oph.id)) {
          enriched.push(oph);
        }
      }
    } catch (e) {
      // ignore
    }

    return enriched;
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
    sessionStatus,
    createSystemMessage,
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
    playVocal: () => {},
    stopVocal: () => {},
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
