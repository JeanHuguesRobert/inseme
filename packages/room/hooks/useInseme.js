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
import {
  GOVERNANCE_MODELS,
  getGovernanceModel,
  calculateResults,
} from "@inseme/kudocracy";

export const OPHELIA_ID = "00000000-0000-0000-0000-000000000001";

export function useInseme(
  roomName,
  user,
  supabase,
  config = {},
  isSpectator = false
) {
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
    sessionStatus: "closed", // 'open' | 'closed'
    connectedUsers: [],
    agenda: [],
    userPowers: {}, // { userId: { totalPower: number, declarations: [{ reason, multiplier }] } }
  });
  const [presenceState, setPresenceState] = useState({});
  const [ephemeralThoughts, setEphemeralThoughts] = useState([]);
  const [isOphéliaThinking, setIsOphéliaThinking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vocalState, setVocalState] = useState("idle"); // idle, listening, thinking, speaking
  const [isHandsFree, setIsHandsFree] = useState(() => {
    // Default to closed for privacy and browser compatibility
    // but allow persistence if the user explicitly enabled it
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_hands_free") === "true";
    }
    return false;
  });
  const [nativeLang, setNativeLang] = useState(
    localStorage.getItem("inseme_native_lang") || "fr"
  );
  const [isSilent, setIsSilent] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_silent") === "true";
    }
    return false;
  });
  const [governanceMode, setGovernanceMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("inseme_governance") === "true";
    }
    return false;
  });
  const [systemPrompt, setSystemPrompt] = useState("");
  const [roomMetadata, setRoomMetadata] = useState(null);

  // 0.2 Group & Voting Rights
  const groupId = roomMetadata?.settings?.group_id;
  const { isMember, loading: groupLoading } = useGroup(groupId, user?.id);
  const { members: groupMembers, loading: membersLoading } =
    useGroupMembers(groupId);

  const memberIdsSet = useMemo(() => {
    if (!groupMembers) return new Set();
    return new Set(groupMembers.map((m) => m.user_id));
  }, [groupMembers]);

  const roomType = roomMetadata?.settings?.type || "democratie_directe"; // 'democratie_directe' (free/community) or 'entreprise_sa' (paid/certified)
  const templateId = roomMetadata?.settings?.template || roomType;
  const template = useMemo(
    () =>
      getGovernanceModel(templateId) ||
      getGovernanceModel("democratie_directe"),
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

  // canVote depends on:
  // 1. Template rules
  // 2. Being at least 'member' (or 'guest'/'authenticated' if allowed by template)
  const canVote = useMemo(() => {
    if (userRole === "spectator" || userRole === "represented") return false; // Les 'represented' ne votent pas eux-mêmes
    if (userRole === "member") return true;

    // Si on n'est pas membre, on vérifie si le template autorise les autres à voter
    if (userRole === "guest") return !!template?.rules?.can_guests_vote;
    if (userRole === "authenticated")
      return template?.rules?.can_authenticated_vote ?? true; // Par défaut on laisse voter les connectés

    return false;
  }, [userRole, template]);

  // canInteract (chat, parole) depends on:
  // 1. Template rules
  // 2. Being at least 'guest' or 'authenticated'
  const canInteract = useMemo(() => {
    if (userRole === "spectator" || userRole === "represented") return false; // Les 'represented' n'interagissent pas eux-mêmes
    if (userRole === "member") return true;

    // Par défaut, guest et au-dessus peuvent interagir (chat)
    // Sauf si la room est restreinte aux membres uniquement pour tout
    const restrictedInteraction =
      roomMetadata?.settings?.restricted_interaction;
    if (restrictedInteraction && userRole !== "member") return false;

    // Vérification spécifique au template pour les invités
    if (userRole === "guest" && template?.rules?.can_guests_interact === false)
      return false;

    // Si on est authentifié mais pas membre, on vérifie si le template autorise
    if (
      userRole === "authenticated" &&
      template?.rules?.can_authenticated_vote === false &&
      !template?.rules?.can_guests_interact
    )
      return false;

    return true;
  }, [userRole, roomMetadata?.settings?.restricted_interaction, template]);
  const isEnterprise = roomType === "enterprise";

  const [functionLibrary, setFunctionLibrary] = useState({});
  const functionLibraryRef = useRef({});

  const terminology = useMemo(() => {
    // Fusionner la terminologie du modèle avec d'éventuels labels personnalisés
    return {
      ...template?.terminology,
      ...roomMetadata?.settings?.labels,
    };
  }, [template, roomMetadata]);

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
      .map(
        ([name, func]) =>
          `- \`${name}(${func.args || "input"})\`: ${func.description}`
      )
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
  const promoteToPlenaryRef = useRef();
  const searchMemoryRef = useRef();
  const castVoteRef = useRef();

  const stopVocal = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setVocalState("idle");
  }, []);

  const playVocal = (payload) => {
    if (isSilent || !payload) return;

    // Stop current vocal if any (barge-in support)
    stopVocal();

    let audio;
    if (payload.startsWith("http")) {
      audio = new Audio(payload);
    } else {
      audio = new Audio(`data:audio/mp3;base64,${payload}`);
    }

    currentAudioRef.current = audio;
    setVocalState("speaking");

    audio.onended = () => {
      setVocalState("idle");
      currentAudioRef.current = null;
    };

    audio.onerror = () => {
      setVocalState("idle");
      currentAudioRef.current = null;
    };

    audio.play().catch((e) => {
      console.warn("Auto-play bloqué par le navigateur:", e);
      setVocalState("idle");
      currentAudioRef.current = null;
    });
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
      } else if (
        ["live", "image", "pad", "wiki", "twitter", "facebook"].includes(
          command
        )
      ) {
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
            const firstNonMemberIndex = state.speechQueue.findIndex(
              (s) => !s.isMember
            );
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
            (state.userPowers[userId]?.declarations || []).slice(-1)[0]
              ?.multiplier || 1;

          state.votes[userId] = {
            type: voteType,
            name: msg.name,
            timestamp: msg.created_at,
            baseWeight: baseWeight,
            weight: baseWeight * dynamicMultiplier,
            role: memberIdsSet.has(userId) ? "member" : "other",
            declaration: (state.userPowers[userId]?.declarations || []).slice(
              -1
            )[0],
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
      const { data: room, error } = await supabase
        .from("inseme_rooms")
        .select("*")
        .eq("slug", roomName)
        .maybeSingle();

      if (room) {
        setRoomMetadata(room);

        // Always load base prompt AND append custom local prompt if present
        const promptUrl = config.promptUrl || "/prompts/inseme.md";
        fetch(promptUrl)
          .then((res) => res.text())
          .then((basePrompt) => {
            const customPrompt = room.settings?.ophelia?.prompt || "";
            if (customPrompt) {
              setSystemPrompt(
                `${basePrompt}\n\n### CONSIGNES COMPLÉMENTAIRES (LOCALES)\n${customPrompt}`
              );
            } else {
              setSystemPrompt(basePrompt);
            }
          })
          .catch((err) => {
            console.error("Failed to load base prompt:", err);
            if (room.settings?.ophelia?.prompt) {
              setSystemPrompt(room.settings.ophelia.prompt);
            }
          });
      } else {
        // Fallback to static prompt file
        const promptUrl = config.promptUrl || "/prompts/inseme.md";
        fetch(promptUrl)
          .then((res) => res.text())
          .then(setSystemPrompt)
          .catch((err) =>
            console.error("Erreur de chargement du prompt Ophélia:", err)
          );
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
        console.warn(
          `Could not fetch Ophélia from ${PROFILE_TABLE}. Using default.`
        );
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
        setMessages(data);
        processMessages(data);
        messageCountRef.current = data.length;
      }
    },
    [roomName, supabase, roomMetadata?.id]
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
      const userName =
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Anonyme";
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
          key:
            user?.id || "spectator-" + Math.random().toString(36).substr(2, 9),
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
        setMessages((prev) => [...prev, newMsg]);
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
        const userName =
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          "Anonyme";
        await channel.track({
          user_id: user?.id,
          name: userName,
          status: "online",
          joined_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [roomName, supabase, fetchMessages, roomMetadata?.id, user]);

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
      if (keepAliveTimeoutRef.current)
        clearTimeout(keepAliveTimeoutRef.current);
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

    recognition.onstart = () => {
      window._transcriptionRetryCount = 0; // Reset retries on success
      setTranscriptionStatus((prev) => ({
        ...prev,
        isActive: true,
        mode: "local",
      }));
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      setTranscriptionStatus((prev) => ({
        ...prev,
        lastTranscript: currentText,
      }));

      // If final, send to refinery (Ophélia)
      if (finalTranscript) {
        // Envoi du chunk de transcription vers la base de données pour Ophélia
        const targetRoomId = roomMetadata?.id || roomName;
        const userName =
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          "Anonyme";

        supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: targetRoomId,
              user_id: user?.id,
              name: userName,
              message: finalTranscript,
              type: "transcription_chunk",
              metadata: {
                mode: "local_speech_api",
                lang: nativeLang,
                is_final: true,
                certified: governanceMode,
                audit_id: governanceMode ? crypto.randomUUID() : null,
                role: userRole,
              },
            },
          ])
          .then(({ error }) => {
            if (error)
              console.error("Erreur envoi transcription chunk:", error);
          });

        console.log("Final Transcription Chunk Sent:", finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      // Don't spam network errors if we are already retrying
      if (event.error === "network") {
        const MAX_RETRIES = 3;
        if (!window._transcriptionRetryCount)
          window._transcriptionRetryCount = 0;

        if (window._transcriptionRetryCount < MAX_RETRIES) {
          window._transcriptionRetryCount++;
          console.warn(
            `[Transcription] Network error, retrying (${window._transcriptionRetryCount}/${MAX_RETRIES})...`
          );

          setTimeout(() => {
            const isFloorHolder =
              window._lastSpeechQueue?.[0]?.userId === user?.id;
            if (isFloorHolder) {
              startLocalTranscription();
            }
          }, 3000); // Increased delay for network recovery
          return;
        }
      }

      console.error("Transcription Error:", event.error);
      stopLocalTranscription();
    };

    recognition.onend = () => {
      setTranscriptionStatus((prev) => ({ ...prev, isActive: false }));
      // Auto-restart if we still have the floor and it wasn't a fatal error
      const isFloorHolder = window._lastSpeechQueue?.[0]?.userId === user?.id;
      if (isFloorHolder && !recognitionRef.current) {
        setTimeout(startLocalTranscription, 1000);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [
    nativeLang,
    stopLocalTranscription,
    userRole,
    // roomData.speechQueue, // REMOVED: cause of infinite loop as speechQueue changes often
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
      console.log(
        "Vous avez la parole (Mains-libres) : Démarrage de la transcription locale."
      );
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
        if (!documents || documents.length === 0)
          return "Aucun résultat pertinent trouvé.";

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
    async (text, metadata = {}) => {
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
          sendMessageRef.current?.(
            `Mode mains-libres ${enabled ? "activé" : "désactivé"}.`,
            {
              is_ai: true,
              type: "system_summary",
            }
          );
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
              name:
                user?.user_metadata?.full_name ||
                user?.email?.split("@")[0] ||
                "Anonyme",
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
              name:
                user?.user_metadata?.full_name ||
                user?.email?.split("@")[0] ||
                "Anonyme",
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
        ...metadata,
        role: metadata.is_ai ? "system" : userRole,
      };
      const localVocalPayload = dbMetadata.vocal_payload;
      delete dbMetadata.vocal_payload;

      let contentObj = {
        room_id: roomMetadata?.id || roomName,
        user_id: metadata.is_ai ? null : user?.id || null, // Fix: Use null for AI to bypass strict RLS (auth.uid() check)
        name: metadata.is_ai
          ? "Ophélia"
          : user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            (userRole === "guest"
              ? "Invité"
              : userRole === "member"
                ? terminology.member || "Membre"
                : "Anonyme"),
        message: text,
        type: metadata.type || "chat",
        metadata: dbMetadata,
      };

      // Translation Logic (Translate-on-Write)
      if (
        !metadata.is_ai &&
        nativeLang !== pivotLang &&
        !text.toLowerCase().startsWith("inseme")
      ) {
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

      if (
        text.startsWith("inseme parole") ||
        text.startsWith("inseme technical")
      ) {
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
      await sendMessageRef.current?.(
        "**Édition du Procès-Verbal en cours...**",
        {
          is_ai: true,
        }
      );

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          room_settings: roomMetadata?.settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Report API Error (${response.status}): ${errorText || "Unknown error"}`
        );
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(
          `Invalid JSON from report API: ${responseText.substring(0, 100)}`
        );
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
              type: "chat", // Should be 'chat' or custom type? 'chat' ensures visibility.
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

        await sendMessageRef.current?.(
          "📜 Le Procès-Verbal a été généré et archivé.",
          {
            is_ai: true,
          }
        );
      }
    } catch (error) {
      console.error("Erreur Report:", error);
      await sendMessageRef.current?.(
        "[Erreur] Génération du rapport échouée.",
        {
          is_ai: true,
        }
      );
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
        await sendMessageRef.current?.(
          `**Transmission à la Plénière (${parentSlug})...**`,
          {
            is_ai: true,
          }
        );

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

          await sendMessageRef.current?.(
            `✅ Transmis avec succès à la plénière.`,
            {
              is_ai: true,
            }
          );
        } else {
          throw new Error("Salle parente introuvable.");
        }
      } catch (error) {
        console.error("Erreur Promotion:", error);
        await sendMessageRef.current?.(
          `[Erreur] Échec de la transmission : ${error.message}`,
          { is_ai: true }
        );
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

        const { url } = await storage.upload(
          "public-documents",
          fileName,
          blob
        );

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
    startRecording,
    stopRecording,
    cancelRecording,
    addTime,
  } = useVoiceRecorder(
    (blob, finalDuration) => handleTranscription(blob, finalDuration),
    {
      autoStopDelay: 2000,
      onSilence: () => {
        if (isHandsFree) {
          stopRecording();
        }
      },
    }
  );

  const handleTranscription = useCallback(
    async (blob, finalDuration) => {
      setIsTranscribing(true);
      setVocalState("thinking");
      try {
        const rawRoomName = roomMetadata?.id || roomName || "unknown";
        const safeRoomName = String(rawRoomName).replace(/[^a-z0-9]/gi, "_");
        const fileName = `temp/${safeRoomName}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const vocalUrl = await uploadVocal(blob, fileName);

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

        const response = await fetch(transcribeUrl, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Transcription API error (${response.status}): ${errorText}`
          );
        }

        const text = await response.text();
        if (!text || text.trim() === "") {
          console.warn("Transcription API returned an empty response.");
          return;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(
            `Invalid JSON from transcription API: ${text.substring(0, 100)}`
          );
        }

        if (data.text) {
          await sendMessage(data.text, {
            type: "transcription",
            vocal_url: vocalUrl,
            vocal_transcription: true,
            voice_duration: finalDuration,
          });
        }
      } catch (err) {
        console.error("Erreur de transcription:", err);
      } finally {
        setIsTranscribing(false);
        if (!isHandsFree) {
          setVocalState("idle");
        }
      }
    },
    [roomMetadata?.id, roomName, isHandsFree, uploadVocal, sendMessage]
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
  }, [
    isHandsFree,
    vocalState,
    isRecording,
    isTranscribing,
    isOphéliaThinking,
    startRecording,
  ]);

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
      const userName =
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Anonyme";
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

  const startSession = () => sendMessageRef.current?.("inseme open");
  const endSession = () => {
    sendMessageRef.current?.("inseme close");
    generateReportRef.current?.();
  };
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

  const triggerOphélia = useCallback(
    async (userIntent = null, toolResults = []) => {
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
          system_prompt: augmentedSystemPrompt,
          room_settings: {
            ...roomMetadata?.settings,
            ophelia: {
              ...roomMetadata?.settings?.ophelia,
              ...effectiveConfig.ophelia,
            },
          },
          user_id: user?.id,
          user_name:
            user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            "Anonyme",
          speech_stats: speechStats,
          brique_tools: BRIQUES.flatMap((b) => b.tools || []),
          pivot_lang: pivotLang,
          is_silent: isSilent,
        };

        console.log(
          "[useInseme] Calling Ophélia Edge Function:",
          opheliaUrl,
          payload
        );
        const response = await fetch(opheliaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API Error (${response.status}): ${errorText || "Unknown error"}`
          );
        }

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(
            `Invalid JSON from Ophélia API: ${responseText.substring(0, 100)}`
          );
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
                vocal_payload,
              });
              currentToolResults.push({ id, result: "Message envoyé." });
            } else if (tool === "speak") {
              await sendMessageRef.current?.(args.text, {
                is_ai: true,
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
                { is_ai: true }
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
                roomMetadata?.settings?.brave_search_api_key ||
                getConfig("brave_search_api_key");

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

                const slug = args.is_room_specific
                  ? `room:${roomName}:${baseSlug}`
                  : baseSlug;

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
                } = await safeEval(
                  code,
                  input || {},
                  functionLibraryRef.current
                );
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
            opheliaMsg = opheliaMsg
              .replace(/<think>[\s\S]*?<\/think>/, "")
              .trim();

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
  }, [
    sendMessage,
    triggerOphélia,
    setProposition,
    generateReport,
    promoteToPlenary,
    searchMemory,
    castVote,
    updateAssemblyType,
  ]);

  return {
    roomName,
    user,
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
    isOphéliaThinking,
    nativeLang,
    setNativeLang,
    isSilent,
    setIsSilent,
    setProposition,
    updateAssemblyType,
    generateReport,
    promoteToPlenary,
    archiveReport,
    startSession,
    endSession,
    updateAgenda,
    setTemplate,
    declarePower,
    castVote,
    onParole,
    onDelegate,
    sessions,
    currentSessionId,
    selectSession,
    presenceState,
    uploadVocal,
    playVocal,
    stopVocal,
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
    transcriptionStatus,
    deviceCapability,
  };
}
