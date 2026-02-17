import React from "react";
import { Headphones, Activity } from "lucide-react";
import OpheliaInputBar from "./OpheliaInputBar";
import OpheliaActionButtons from "./OpheliaActionButtons";

const OpheliaInputArea = ({
  text,
  onTextChange,
  onSend,
  attachment,
  context,
  isMobile,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  onTip,
  onSuspendu,
  onInvite,
  onAfter,
  isAfter,
}) => {
  return (
    <div
      className={`${isAfter ? "bg-black/80 backdrop-blur-md border-mondrian-blue/50 shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.5)]" : "bg-mondrian-yellow border-black"} border-t-8 p-4 flex flex-col items-center justify-center gap-4 relative shrink-0 transition-all duration-1000`}
    >
      {isAfter && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-mondrian-blue rounded-full blur-xl animate-pulse"
              style={{
                width: `${Math.random() * 100 + 50}px`,
                height: `${Math.random() * 100 + 50}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase z-10 flex items-center gap-2">
        {context.isHandsFree && (
          <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
            <Headphones className="w-3 h-3 text-mondrian-yellow" />
            <span className="text-[8px]">MAINS LIBRES</span>
          </div>
        )}
        {context.isRecording && (
          <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="text-[8px]">VAD ACTIVE</span>
          </div>
        )}
      </div>

      <OpheliaInputBar
        text={text}
        onTextChange={onTextChange}
        onSend={onSend}
        attachment={attachment}
        context={context}
      />

      <OpheliaActionButtons
        context={context}
        isMobile={isMobile}
        attachment={attachment}
        onAttach={onAttach}
        onAttachCamera={onAttachCamera}
        onAttachGallery={onAttachGallery}
        onTip={onTip}
        onSuspendu={onSuspendu}
        onInvite={onInvite}
        onAfter={onAfter}
        isAfter={isAfter}
      />
    </div>
  );
};

export default OpheliaInputArea;
