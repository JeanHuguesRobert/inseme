import React, { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Pause, Download, Trash2 } from "lucide-react";

export function VocalMessage({
  message,
  isSilent = false,
  onPlayVocal,
  onDeleteMessage,
  showControls = true,
  className = "",
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(null);
  const audioRef = useRef(null);

  const vocalPayload = message.metadata?.vocal_payload;
  const hasAudio = !!vocalPayload?.url;
  const hasText = !!message.message && message.message !== "[Message vocal sans transcription]";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => {
      console.error("Audio error:", e);
      setAudioError("Impossible de lire l'audio");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [hasAudio]);

  const handlePlayPause = async () => {
    if (!hasAudio || !audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Stop any other playing audio
        const allAudios = document.querySelectorAll("audio");
        allAudios.forEach((a) => {
          if (a !== audioRef.current) {
            a.pause();
          }
        });

        await audioRef.current.play();
        setIsPlaying(true);

        if (onPlayVocal) {
          onPlayVocal(vocalPayload);
        }
      }
    } catch (error) {
      console.error("Play/pause error:", error);
      setAudioError("Erreur de lecture");
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    if (!vocalPayload?.url) return;

    const link = document.createElement("a");
    link.href = vocalPayload.url;
    link.download = `vocal_${message.id}.webm`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (onDeleteMessage && window.confirm("Supprimer ce message vocal ?")) {
      await onDeleteMessage(message.id);
    }
  };

  const getDisplayContent = () => {
    if (isSilent) {
      // Mode silencieux : montrer uniquement le texte
      return (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <VolumeX className="w-4 h-4 text-gray-500" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-gray-800 leading-relaxed">{message.message}</p>
            {hasAudio && (
              <div className="mt-2 text-xs text-gray-500 italic">
                📻 Message vocal disponible (mode silencieux)
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Mode sonore : montrer les contrôles audio
      return (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-mondrian-red/10 rounded-full flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-mondrian-red" />
            </div>
          </div>
          <div className="flex-1">
            {/* Text content */}
            {hasText && <p className="text-gray-800 leading-relaxed mb-3">{message.message}</p>}

            {/* Audio controls */}
            {hasAudio && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                {/* Audio element (hidden) */}
                <audio
                  ref={audioRef}
                  src={vocalPayload.url}
                  preload="metadata"
                  className="hidden"
                />

                {/* Custom controls */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause button */}
                  <button
                    onClick={handlePlayPause}
                    disabled={!!audioError}
                    className="w-10 h-10 bg-mondrian-red text-white rounded-full flex items-center justify-center hover:bg-mondrian-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

                  {/* Time display */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{formatTime(currentTime)}</span>
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-mondrian-red transition-all duration-100"
                          style={{
                            width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                          }}
                        />
                      </div>
                      <span>{formatTime(duration || vocalPayload?.duration || 0)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {showControls && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDownload}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                        title="Télécharger l'audio"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteMessage && (
                        <button
                          onClick={handleDelete}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer le message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Error display */}
                {audioError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    ⚠️ {audioError}
                  </div>
                )}

                {/* Audio info */}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>🎤 Message vocal</span>
                  {vocalPayload?.duration && (
                    <span>Durée: {formatTime(vocalPayload.duration)}</span>
                  )}
                  {vocalPayload?.size && (
                    <span>Taille: {(vocalPayload.size / 1024 / 1024).toFixed(1)}MB</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return <div className={`vocal-message ${className}`}>{getDisplayContent()}</div>;
}
