import React, { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase.js"; // Correct path
import cafeApi from "../services/cafe-api.js";

const CafeSessionContext = createContext();

export const useCafeSession = () => useContext(CafeSessionContext);

export const CafeSessionProvider = ({ children, initialSessionId }) => {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [utterances, setUtterances] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // The participant record for this device
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);

  // Mic State for UI
  const micState = currentUser?.mic_state || "off";

  // Host logic: check for user ownership OR local secret key
  const [hostSecret, setHostSecret] = useState(null);

  // Note: We intentionally avoid persisting the host_secret in localStorage for security reasons.
  // Hosts should store the one-time secret externally and can paste it into the UI when needed.

  const isHost = (session && userId && session.created_by === userId) || !!hostSecret;

  // Load initial data
  useEffect(() => {
    if (!sessionId) return;

    const fetchData = async () => {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (user) setUserId(user.id);

      // Load session data from COP (cop_topic)
      const { data: s } = await getSupabase()
        .from("cop_topic")
        .select("*")
        .eq("id", sessionId)
        .single();
      setSession(s);

      // Load participants from cop_participants
      const { data: p } = await getSupabase()
        .from("cop_participants")
        .select("*")
        .eq("topic_id", sessionId);
      setParticipants(p || []);

      // Load existing messages from COP (cop_event) and map to utterances
      try {
        const { data: u } = await getSupabase()
          .from("cop_event")
          .select("*")
          .eq("topic_id", sessionId)
          .order("created_at", { ascending: true });
        setUtterances(
          (u || [])
            .map((ev) => {
              if (!ev) return null;
              if (ev.type === "user_message") {
                return {
                  id: ev.id,
                  speaker_type: "participant",
                  participant_id: ev.payload?.participant_id || null,
                  raw_transcript: ev.payload?.text || ev.payload?.content || "",
                  clean_transcript: ev.payload?.text || ev.payload?.content || "",
                  created_at: ev.created_at,
                };
              } else if (ev.type === "assistant_reflex" || ev.type === "assistant_update") {
                return {
                  id: ev.id,
                  speaker_type: "ophelia",
                  participant_id: null,
                  raw_transcript: ev.payload?.text || ev.payload?.content || "",
                  clean_transcript: ev.payload?.text || ev.payload?.content || "",
                  created_at: ev.created_at,
                };
              }
              return null;
            })
            .filter(Boolean)
        );
      } catch (e) {
        console.warn("Unable to load cop_event messages", e?.message);
        // empty fallback
        setUtterances([]);
      }

      // Identify current user and guest id if present
      if (p) {
        if (user) {
          const me = p.find((x) => x.user_id === user.id);
          if (me) setCurrentUser(me);
        } else {
          // Check Guest ID
          const guestId = localStorage.getItem(`cop_guest_id_${sessionId}`);
          if (guestId) {
            const me = p.find((x) => x.id === guestId);
            if (me) setCurrentUser(me);
          }
        }
      }
    };

    fetchData();

    // Subscribe to Realtime
    // Subscribe to COP events (cop_event) for this conversation/topic
    const channel = getSupabase()
      .channel(`cop_topic:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cop_topic", filter: `id=eq.${sessionId}` },
        (payload) => {
          setSession(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cop_participants",
          filter: `topic_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setParticipants((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setParticipants((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
            if (currentUser && payload.new.id === currentUser.id) setCurrentUser(payload.new);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cop_event",
          filter: `topic_id=eq.${sessionId}`,
        },
        (payload) => {
          const ev = payload.new;
          if (!ev) return;
          if (ev.type === "user_message") {
            const m = {
              id: ev.id,
              speaker_type: "participant",
              participant_id: ev.payload?.participant_id || null,
              raw_transcript: ev.payload?.content || ev.payload?.text || "",
              created_at: ev.created_at,
            };
            setUtterances((prev) => [...prev, m]);
          } else if (ev.type === "assistant_reflex" || ev.type === "assistant_update") {
            const m = {
              id: ev.id,
              speaker_type: "ophelia",
              participant_id: null,
              raw_transcript: ev.payload?.text || ev.payload?.content || "",
              created_at: ev.created_at,
            };
            setUtterances((prev) => [...prev, m]);
          } else if (ev.type === "artifact_created") {
            // optional: handle artifact created updates (store metadata, link to utterances)
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [sessionId]);

  // Ophélia salue l'utilisateur si seul participant et aucune utterance
  useEffect(() => {
    if (!sessionId || !currentUser) return;
    if (participants.length === 1 && utterances.length === 0) {
      (async () => {
        // Déterminer bonjour/bonsoir
        const h = new Date().getHours();
        const salutation = h < 18 ? "Bonjour" : "Bonsoir";
        const prenom = currentUser.display_handle || "";
        const botName = session?.bot_name || "Ophélia";
        const msg = `${salutation} ${prenom} ! Je suis ${botName}. N’hésitez pas à poser une question ou à lancer la discussion.`;
        // Envoyer une utterance du bot via COP
        try {
          await cafeApi.sendUtterance(sessionId, null, msg, "ophelia", 0, "text_message");
        } catch (e) {
          console.warn("error sending welcome message", e.message);
        }
      })();
    }
  }, [participants, utterances, currentUser, sessionId, session]);

  const joinSession = async (display_name, role) => {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();
    const guestId = localStorage.getItem(`cop_guest_id_${sessionId}`);
    try {
      const p = await cafeApi.joinSession(
        sessionId,
        user?.id || null,
        display_name || user?.display_name || "Invité"
      );
      if (!p) throw new Error("Failed to join session");
      setCurrentUser(p);
      if (!user && p.id) localStorage.setItem(`cop_guest_id_${sessionId}`, p.id);
      if (!participants.find((existing) => existing.id === p.id))
        setParticipants((prev) => [...prev, p]);
    } catch (e) {
      console.error("joinSession error", e.message);
    }
  };

  const requestMic = async () => {
    if (!currentUser) return;
    await cafeApi.controlMic(currentUser.id, "request");
  };

  const releaseMic = async () => {
    if (!currentUser) return;
    await cafeApi.controlMic(currentUser.id, "release");
  };

  const sendReaction = async (type) => {
    if (!currentUser) return;
    await cafeApi.sendReaction(
      sessionId,
      currentUser.id,
      type,
      utterances[utterances.length - 1]?.id
    );
  };

  const controlPhase = async (action, phase) => {
    if (!isHost) return;
    await cafeApi.controlPhase(sessionId, action, phase, hostSecret);
  };

  const grantMic = async (participantId) => {
    if (!isHost) return;
    await cafeApi.controlMic(participantId, "grant", hostSecret);
  };

  // Publish messages to COP endpoint (mcp COP router)
  const sendTextMessage = async (text) => {
    if (!currentUser) return;
    try {
      const msg = await cafeApi.sendUtterance(
        sessionId,
        currentUser.id,
        text,
        "participant",
        0,
        "text_message"
      );
      // local optimistic update (cafe-api returns { event: eventRow } in edge function)
      const ev = msg?.event || msg;
      setUtterances((prev) => [
        ...prev,
        {
          id: ev.id || Date.now(),
          participant_id: ev.payload?.participant_id || currentUser.id,
          speaker_type: ev.payload?.participant_id ? "participant" : "ophelia",
          raw_transcript: ev.payload?.text || ev.payload?.content || text,
          clean_transcript: ev.payload?.text || ev.payload?.content || text,
          created_at: ev.created_at || new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.error("sendTextMessage error", e.message);
    }
  };

  return (
    <CafeSessionContext.Provider
      value={{
        sessionId,
        setSessionId,
        session,
        participants,
        utterances,
        currentUser,
        joinSession,
        requestMic,
        releaseMic,
        sendReaction,
        sendTextMessage,
        micState,
        isConnected,
        isHost,
        controlPhase,
        grantMic,
        hostSecret,
        setHostSecret,
      }}
    >
      {children}
    </CafeSessionContext.Provider>
  );
};
