import React, { useState, useEffect } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { useInsemeContext } from "../InsemeContext";
import { Captions, Settings } from "lucide-react";

export function ModernMediaLayer({ media }) {
  const { messages, transcriptionStatus, roomMetadata, effectiveConfig } =
    useInsemeContext();
  const [showSubtitles, setShowSubtitles] = useState(true);

  if (!media) return null;

  const { type, url } = media;

  // Jitsi Configuration from Room Metadata or Global Config
  const jitsiConfig =
    roomMetadata?.settings?.jitsi || effectiveConfig?.jitsi || {};
  const jitsiDomain = jitsiConfig.domain || "meet.jit.si";

  // Get the latest transcription chunk from anyone
  const latestGlobalChunk = messages
    ?.filter((m) => m.type === "transcription_chunk")
    .slice(-1)[0];

  const displaySubtitle = transcriptionStatus?.isActive
    ? transcriptionStatus.lastTranscript
    : latestGlobalChunk?.message;

  // Jitsi Integration
  if (
    type === "live" &&
    (url.includes("meet.jit.si") || url.startsWith("jitsi:"))
  ) {
    const roomName = url.split("/").pop();
    return (
      <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-2xl bg-neutral-900 mb-6 relative group">
        <JitsiMeeting
          domain={jitsiDomain}
          roomName={roomName}
          configOverwrite={{
            startWithAudioMuted: true,
            disableModeratorIndicator: true,
            startScreenSharing: false,
            enableEmailInStats: false,
            ...jitsiConfig.configOverwrite,
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            ...jitsiConfig.interfaceConfigOverwrite,
          }}
          userInfo={{
            displayName:
              roomMetadata?.user_display_name || "Inseme Participant",
          }}
          onApiReady={(externalApi) => {
            // Handle Jitsi API
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = "100%";
          }}
        />

        {/* Subtitles Overlay */}
        {showSubtitles && displaySubtitle && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-black/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl max-w-3xl text-center shadow-2xl">
              <p className="text-white text-lg font-medium leading-relaxed tracking-wide">
                {displaySubtitle}
              </p>
              {latestGlobalChunk && !transcriptionStatus?.isActive && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest opacity-60">
                    {latestGlobalChunk.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtitle Controls */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => setShowSubtitles(!showSubtitles)}
            className={`p-2 rounded-lg backdrop-blur-md border transition-all ${showSubtitles ? "bg-indigo-500 text-white border-indigo-400" : "bg-black/50 text-white/60 border-white/10 hover:bg-black/70"}`}
            title={
              showSubtitles
                ? "Désactiver les sous-titres"
                : "Activer les sous-titres"
            }
          >
            <Captions className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Classic YouTube/Embeds
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let videoId = url.split("v=")[1] || url.split("/").pop();
    if (videoId.includes("&")) videoId = videoId.split("&")[0];

    return (
      <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl mb-6">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  // Pads (Framapad, etc.)
  if (type === "pad") {
    return (
      <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-2xl bg-white mb-6">
        <iframe
          className="w-full h-full"
          src={url.startsWith("http") ? url : `https://framapad.org/p/${url}`}
          title="Collaborative Pad"
        ></iframe>
      </div>
    );
  }

  // Images
  if (type === "image") {
    return (
      <div className="w-full center mb-6">
        <img
          src={url}
          alt="Shared content"
          className="max-w-full rounded-xl shadow-xl border-4 border-white"
        />
      </div>
    );
  }

  // Default: Generic iframe or Link
  return (
    <div className="w-full p-4 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm mb-6 text-center">
      <p className="text-white/60 mb-2">Contenu externe : {type}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline font-medium"
      >
        {url}
      </a>
    </div>
  );
}
