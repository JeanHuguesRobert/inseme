// src/package/inseme/components/AgendaPanel.jsx
import React, { useState, useEffect, useRef } from "react";
import { useInsemeContext } from "../InsemeContext";
import { ListChecks, Plus, CheckCircle2, Circle, PlayCircle, Trash2 } from "lucide-react";

const ConfettiEffect = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="absolute animate-bounce"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: "6px",
          height: "6px",
          backgroundColor: [
            "var(--mondrian-yellow)",
            "var(--mondrian-red)",
            "var(--mondrian-blue)",
            "var(--mondrian-black)",
          ][i % 4],
          borderRadius: i % 2 === 0 ? "50%" : "0%",
          animation: `confetti-fall ${1 + Math.random()}s ease-out forwards`,
          opacity: 0.8,
        }}
      />
    ))}
    <style
      dangerouslySetInnerHTML={{
        __html: `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(20px) rotate(360deg); opacity: 0; }
      }
    `,
      }}
    />
  </div>
);

const BellEffect = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center bg-black/10 animate-pulse z-20">
    <div className="text-6xl animate-bounce">🔔</div>
    <div className="absolute inset-0 border-4 border-mondrian-yellow animate-ping" />
    <style
      dangerouslySetInnerHTML={{
        __html: `
      @keyframes bell-shake {
        0% { transform: rotate(0); }
        25% { transform: rotate(15deg); }
        50% { transform: rotate(-15deg); }
        75% { transform: rotate(10deg); }
        100% { transform: rotate(0); }
      }
    `,
      }}
    />
  </div>
);

export function AgendaPanel({ agenda, updateAgenda, variant }) {
  const { sendBroadcast } = useInsemeContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [celebratingId, setCelebratingId] = useState(null);

  const isMinimal = variant === "minimal";

  // Écoute du broadcast global pour l'animation
  useEffect(() => {
    const handleCelebrate = (e) => {
      const { id, level } = e.detail;
      // Pour les pourboires royaux/impériaux, on déclenche une célébration plus forte
      setCelebratingId(id || "broadcast");
      setTimeout(() => setCelebratingId(null), level === "imperial" ? 5000 : 2000);
    };

    const handleBell = () => {
      // Animation visuelle de cloche ou flash?
      setCelebratingId("bell-ring");
      setTimeout(() => setCelebratingId(null), 3000);
    };

    window.addEventListener("inseme:celebrate", handleCelebrate);
    window.addEventListener("inseme:bell_ring", handleBell);
    return () => {
      window.removeEventListener("inseme:celebrate", handleCelebrate);
      window.removeEventListener("inseme:bell_ring", handleBell);
    };
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    const newAgenda = [...(agenda || []), { id: Date.now(), text: newItem, status: "pending" }];
    updateAgenda(newAgenda);
    setNewItem("");
  };

  const handleStatus = (targetId, status) => {
    if (status === "done") {
      sendBroadcast("celebrate", { id: targetId });
    }
    // If setting to active, unset others? Usually yes for "Topic".
    const newAgenda = agenda.map((item) => {
      if (item.id === targetId) return { ...item, status: status };
      if (status === "active" && item.status === "active") return { ...item, status: "pending" };
      return item;
    });
    updateAgenda(newAgenda);
  };

  const handleDelete = (targetId) => {
    const newAgenda = agenda.filter((item) => item.id !== targetId);
    updateAgenda(newAgenda);
  };

  if (!agenda || agenda.length === 0) {
    return null;
  }

  return (
    <div
      className={`relative ${isMinimal ? "bg-white border-b-4 border-black" : "bg-white/5 border-b border-white/10"}`}
    >
      {celebratingId === "bell-ring" && <BellEffect />}
      {celebratingId === "broadcast" && <ConfettiEffect />}
      <div
        className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${isMinimal ? "hover:bg-black/5" : "hover:bg-white/5"}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${isMinimal ? "text-black" : "text-white/50"}`}
        >
          <ListChecks className="w-4 h-4" />
          Ordre du Jour
        </div>
        <span className={`text-xs font-bold ${isMinimal ? "text-black/30" : "text-white/30"}`}>
          {agenda.filter((i) => i.status === "done").length}/{agenda.length}
        </span>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            {agenda.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors group relative ${
                  item.status === "active"
                    ? isMinimal
                      ? "bg-mondrian-yellow border-2 border-black"
                      : "bg-mondrian-blue/10 border border-mondrian-blue/20"
                    : isMinimal
                      ? "hover:bg-black/5"
                      : "hover:bg-white/5"
                }`}
              >
                {celebratingId === item.id && <ConfettiEffect />}
                <div className="flex-shrink-0 relative z-10">
                  {item.status === "done" && (
                    <CheckCircle2
                      className={`w-5 h-5 cursor-pointer ${isMinimal ? "text-black/40" : "text-emerald-500"}`}
                      onClick={() => handleStatus(item.id, "pending")}
                    />
                  )}
                  {item.status === "active" && (
                    <PlayCircle
                      className={`w-5 h-5 cursor-pointer animate-pulse ${isMinimal ? "text-black" : "text-indigo-400"}`}
                      onClick={() => handleStatus(item.id, "done")}
                    />
                  )}
                  {item.status === "pending" && (
                    <Circle
                      className={`w-5 h-5 cursor-pointer hover:scale-110 transition-transform ${isMinimal ? "text-black/20 hover:text-black" : "text-white/20 hover:text-white/50"}`}
                      onClick={() => handleStatus(item.id, "active")}
                    />
                  )}
                </div>
                <span
                  className={`text-sm flex-1 relative z-10 transition-all duration-500 ${
                    item.status === "done"
                      ? isMinimal
                        ? "text-black/30 line-through font-medium"
                        : "text-white/30 line-through scale-95"
                      : item.status === "active"
                        ? isMinimal
                          ? "text-black font-black"
                          : "text-indigo-200 font-bold"
                        : isMinimal
                          ? "text-black/80 font-bold"
                          : "text-white/80"
                  }`}
                >
                  {item.text}
                </span>

                <button
                  onClick={() => handleDelete(item.id)}
                  className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all relative z-10 ${
                    isMinimal
                      ? "hover:bg-red-500/10 text-black/20 hover:text-red-600"
                      : "hover:bg-red-500/20 text-white/10 hover:text-red-400"
                  }`}
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {agenda.length === 0 && (
              <p
                className={`text-xs text-center italic p-2 ${isMinimal ? "text-black/30" : "text-white/20"}`}
              >
                Aucun point à l'ordre du jour.
              </p>
            )}
          </div>

          <form
            onSubmit={handleAdd}
            className={`flex gap-2 pt-2 border-t ${isMinimal ? "border-black/10" : "border-white/5"}`}
          >
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Ajouter un point..."
              className={`text-xs px-3 py-2 rounded-md flex-1 focus:outline-none focus:ring-2 ${
                isMinimal
                  ? "bg-white border-2 border-black text-black placeholder:text-black/30 focus:ring-black/5"
                  : "bg-black/20 text-white focus:ring-indigo-500/50"
              }`}
            />
            <button
              className={`p-2 rounded-md transition-colors ${
                isMinimal
                  ? "bg-black text-white hover:bg-black/80"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
