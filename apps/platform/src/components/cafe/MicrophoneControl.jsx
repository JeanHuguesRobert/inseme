import React, { useEffect } from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";
import { useVoiceInterface } from "../../hooks/useVoiceInterface.js";
import { Icon } from "@inseme/cop-host";

const MicrophoneControl = () => {
  const { sendTextMessage } = useCafeSession();
  const {
    isListening,
    transcript,
    lastFinalTranscript,
    startListening,
    stopListening,
    setTranscript,
  } = useVoiceInterface();

  // Send message when final transcript is available
  useEffect(() => {
    if (lastFinalTranscript) {
      sendTextMessage(lastFinalTranscript);
      setTranscript(""); // Clear buffer after sending
    }
  }, [lastFinalTranscript, sendTextMessage, setTranscript]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={toggleListening}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl ${
          isListening
            ? "bg-red-500 text-white animate-pulse shadow-red-500/50"
            : "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-600/30"
        }`}
      >
        {isListening ? (
          <Icon name="square" size={32} fill="currentColor" />
        ) : (
          <Icon name="mic" size={32} fill="currentColor" /> 
        )}
      </button>

      {transcript && (
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-64 bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg border border-purple-100 text-sm text-purple-900 font-medium text-center animate-in fade-in slide-in-from-bottom-2">
          {transcript}
          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-purple-100 rotate-45"></div>
        </div>
      )}

      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {isListening ? "En écoute..." : "Appuyer pour parler"}
      </span>
    </div>
  );
};

export default MicrophoneControl;
