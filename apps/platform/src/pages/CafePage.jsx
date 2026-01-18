import React, { useState, useEffect, useRef } from "react";
import SiteFooter from "../components/layout/SiteFooter";
import { useCurrentUser } from "@inseme/cop-host";
import { useVoiceInterface } from "@inseme/room";
import { getSupabase } from "../lib/supabase.js";

export default function CafePage() {
  const { currentUser } = useCurrentUser();
  const [session, setSession] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [utterances, setUtterances] = useState([]);

  // Voice Hook
  const {
    isListening,
    transcript,
    lastFinalTranscript,
    startListening,
    stopListening,
    speak,
    setTranscript,
  } = useVoiceInterface();

  // Orb State
  const [orbState, setOrbState] = useState("idle"); // idle, listening, processing, speaking

  // 1. Session Setup
  const createSession = async () => {
    const data = await cafeApi.createSession({ title: "Session Café", session_purpose: "Café" });
    setSession(data);
    // Immediately join
    await joinSession(data.id);
  };

  const joinSession = async (sessionId) => {
    const data = await cafeApi.joinSession(
      sessionId,
      currentUser?.id || null,
      currentUser?.display_name || "Invité"
    );
    setParticipant(data);
  };

  // 2. Transmit Utterance
  useEffect(() => {
    if (lastFinalTranscript) {
      handleSendUtterance(lastFinalTranscript);
      setTranscript(""); // Clear buffer
    }
  }, [lastFinalTranscript]);

  const handleSendUtterance = async (text) => {
    setOrbState("processing");

    const data = await cafeApi.sendUtterance(
      session.id,
      participant.id,
      text,
      "participant",
      0,
      "text_message"
    );

    const ev = data?.event || data;

    // Add local utterance for immediate feedback
    setUtterances((prev) => [
      ...prev,
      {
        id: ev.id || Date.now(),
        clean_transcript: ev.payload?.text || ev.payload?.content || text,
        speaker_type: ev.payload?.participant_id ? "participant" : "ophelia",
        participant_id: ev.payload?.participant_id || participant.id,
        created_at: ev.created_at || new Date().toISOString(),
      },
    ]);

    if (ev?.ai_triggered) {
      // AI Response Simulation (fallback local behavior)
      setOrbState("speaking");
      const responseText =
        "Je vous écoute. Vous parlez de " +
        (text.length > 20 ? "politique locale" : "ce sujet") +
        ".";
      speak(responseText);
      setTimeout(() => setOrbState("idle"), 3000);

      setUtterances((prev) => [
        ...prev,
        {
          id: Date.now(),
          clean_transcript: responseText,
          speaker_type: "ophelia",
        },
      ]);
    } else {
      setOrbState(isListening ? "listening" : "idle");
    }
  };

  // 3. Realtime Subscription (Supabase)
  useEffect(() => {
    if (!session) return;
    const channel = getSupabase()
      .channel(`cop-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cop_event",
          filter: `topic_id=eq.${session.id}`,
        },
        (payload) => {
          const ev = payload.new;
          if (!ev) return;
          if (ev.type === "user_message") {
            setUtterances((prev) => [
              ...prev,
              {
                id: ev.id,
                clean_transcript: ev.payload?.content || ev.payload?.text || "",
                speaker_type: "participant",
              },
            ]);
          } else if (ev.type === "assistant_reflex" || ev.type === "assistant_update") {
            setUtterances((prev) => [
              ...prev,
              {
                id: ev.id,
                clean_transcript: ev.payload?.text || ev.payload?.content || "",
                speaker_type: "ophelia",
              },
            ]);
            if (ev.type === "assistant_update")
              speak(ev.payload?.text || ev.payload?.content || "");
          }
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [session, participant]);

  useEffect(() => {
    if (isListening) setOrbState("listening");
    else if (orbState !== "speaking" && orbState !== "processing") setOrbState("idle");
  }, [isListening]);

  // --- UI RENDER ---

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl text-white font-brand mb-8">☕ Café Ophélia</h1>
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
          <p className="text-gray-300 mb-8">Espace de débat vocal et d'intelligence collective.</p>
          <button
            onClick={createSession}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-full text-xl transition-all transform hover:scale-105"
          >
            Ouvrir une Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-white overflow-hidden relative">
      <header className="absolute top-0 w-full p-4 flex justify-between items-center z-10">
        <div className="text-sm font-mono text-gray-400">SESSION: {session.id.slice(0, 8)}</div>
        <div className="flex gap-2">
          <span
            className={`px-2 py-1 rounded text-xs ${isListening ? "bg-red-500 animate-pulse" : "bg-gray-700"}`}
          >
            {isListening ? "MIC ON" : "MIC OFF"}
          </span>
        </div>
      </header>

      {/* THE ORB */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div
          className={`w-48 h-48 rounded-full blur-xl transition-all duration-1000 absolute
                ${orbState === "idle" ? "bg-blue-900/40 scale-100" : ""}
                ${orbState === "listening" ? "bg-blue-500/60 scale-125 animate-pulse" : ""}
                ${orbState === "processing" ? "bg-purple-600/60 scale-110 rotate-180" : ""}
                ${orbState === "speaking" ? "bg-green-500/60 scale-150" : ""}
            `}
        />
        <div
          className={`w-32 h-32 rounded-full border-4 transition-all duration-500 z-10 flex items-center justify-center
                ${orbState === "idle" ? "border-blue-800 bg-gray-900" : ""}
                ${orbState === "listening" ? "border-blue-400 bg-gray-800 shadow-[0_0_50px_rgba(59,130,246,0.5)]" : ""}
                ${orbState === "processing" ? "border-purple-500 bg-purple-900/20" : ""}
                ${orbState === "speaking" ? "border-green-400 bg-green-900/20 shadow-[0_0_50px_rgba(34,197,94,0.5)]" : ""}
            `}
        >
          <span className="text-4xl">
            {orbState === "idle" && "☕"}
            {orbState === "listening" && "👂"}
            {orbState === "processing" && "🧠"}
            {orbState === "speaking" && "🗣️"}
          </span>
        </div>

        {/* Transcript Overlay */}
        <div className="mt-12 h-32 w-full max-w-lg text-center px-4 overflow-hidden relative">
          <div className="text-2xl font-light text-blue-200 transition-all">
            {transcript || (orbState === "idle" ? "Touchez le micro pour parler..." : "...")}
          </div>
        </div>
      </div>

      {/* History (Fading) */}
      <div className="h-1/3 bg-gradient-to-t from-black to-transparent p-6 overflow-y-auto space-y-4 mask-image-linear-to-t">
        {utterances.slice(-5).map((u, i) => (
          <div
            key={i}
            className={`flex ${u.speaker_type === "ophelia" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                u.speaker_type === "ophelia"
                  ? "bg-purple-900/50 text-purple-200 rounded-tl-none border border-purple-700"
                  : "bg-blue-900/50 text-blue-200 rounded-tr-none border border-blue-700"
              }`}
            >
              <div className="text-xs opacity-50 mb-1">
                {u.speaker_type === "ophelia" ? "Ophélia" : "Participant"}
              </div>
              {u.clean_transcript}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="p-6 pb-10 flex justify-center gap-6 z-20">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 active:scale-95 border-2
                ${
                  isListening
                    ? "bg-red-600 border-red-400 text-white shadow-red-900/50"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isListening ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            )}
          </svg>
        </button>

        <button className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:bg-gray-700">
          ✋
        </button>
        <button className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:bg-gray-700">
          📊
        </button>
      </div>
    </div>
  );
}
