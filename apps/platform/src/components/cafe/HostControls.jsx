import React from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";
import { Icon } from "@inseme/cop-host";

const HostControls = () => {
  const { session, participants, controlPhase, grantMic, hostSecret } = useCafeSession();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Key size={20} className="text-purple-400" />
          Console d'Administration
        </h2>
        <div className="px-2 py-1 rounded bg-purple-500/20 border border-purple-500/30 text-[10px] text-purple-300 font-mono uppercase tracking-wider">
          Host Active
        </div>
      </div>

      {/* Phase Control */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => controlPhase("set", "discussion")}
          className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
            session.current_phase === "discussion"
              ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40"
              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
          }`}
        >
          <FastForward size={18} />
          <span className="text-xs font-bold">Lancer Discussion</span>
        </button>
        <button
          onClick={() => controlPhase("set", "conclusions")}
          className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
            session.current_phase === "conclusions"
              ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40"
              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
          }`}
        >
          <CircleStop size={18} />
          <span className="text-xs font-bold">Conclusions</span>
        </button>
      </div>

      {/* Participants & Mic Management */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <Users size={14} />
          Participants ({participants.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-300">
                  {p.display_handle.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-200">{p.display_handle}</span>
              </div>

              <button
                onClick={() => grantMic(p.id)}
                className={`p-2 rounded-lg transition-all ${
                  p.mic_state === "on"
                    ? "bg-green-500 text-white shadow-lg shadow-green-900/40"
                    : "bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10"
                }`}
                title={p.mic_state === "on" ? "Couper le micro" : "Donner la parole"}
              >
                <Mic size={18} fill={p.mic_state === "on" ? "currentColor" : "none"} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostControls;
