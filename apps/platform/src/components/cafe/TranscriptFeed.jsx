import React, { useEffect, useRef } from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";
import { User } from "lucide-react";

const TranscriptFeed = () => {
  const { utterances, participants } = useCafeSession();
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [utterances]);

  const getParticipantName = (id) => {
    const p = participants.find((x) => x.id === id);
    return p ? p.display_handle : "Participant";
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {utterances.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
            <User size={32} />
          </div>
          <p className="text-gray-400 font-medium italic">Le cercle est ouvert. Qui prend la parole ?</p>
        </div>
      )}

      {utterances.map((u, i) => {
        const isOphelia = u.speaker_type === "ophelia";
        
        return (
          <div 
            key={u.id || i} 
            className={`flex flex-col ${isOphelia ? "items-start" : "items-end"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border ${
              isOphelia 
                ? "bg-white border-purple-100 rounded-tl-none" 
                : "bg-purple-600 border-purple-500 text-white rounded-tr-none"
            }`}>
              <p className="text-sm md:text-base leading-relaxed font-medium">
                {u.clean_transcript}
              </p>
            </div>
            
            <div className={`mt-1 flex items-center gap-2 px-1 ${isOphelia ? "flex-row" : "flex-row-reverse"}`}>
              <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">
                {isOphelia ? "Ophélia" : getParticipantName(u.participant_id)}
              </span>
              <span className="text-[10px] text-gray-300">•</span>
              <span className="text-[10px] text-gray-300">
                {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={scrollRef} />
    </div>
  );
};

export default TranscriptFeed;
