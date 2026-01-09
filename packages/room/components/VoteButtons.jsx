import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  Settings,
  Briefcase,
  Landmark,
  Home,
  Users,
  MessageCircle,
  Gavel,
  BookOpen,
  Cpu,
} from "lucide-react";
import { GOVERNANCE_MODELS } from "@inseme/kudocracy";
import { useInsemeContext } from "../InsemeContext";

const ICON_MAP = {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  Users,
  MessageCircle,
  Home,
  Landmark,
  Briefcase,
  Gavel,
  BookOpen,
  Cpu,
};

export function VoteButtons(props) {
  const context = useInsemeContext();
  const {
    user,
    userRole,
    castVote,
    setMedia,
    setProposition,
    resetVotes,
    template,
    setTemplate,
    declarePower,
    roomData,
    canVote,
    canInteract,
  } = { ...context, ...props };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || (!canVote && !canInteract)) return null; // Spectators or those without rights don't see interaction buttons

  const roleLabels = {
    member: "Membre du groupe",
    guest: "Invité (Droit de vote)",
    authenticated: "Utilisateur authentifié",
  };
  const currentRoleLabel = roleLabels[userRole] || "Participant";

  // Fusionner les options de vote et les actions d'interaction du template
  const voteButtons = (template?.quickVoteOptions || []).map((opt) => ({
    ...opt,
    type: "vote",
    color: `bg-${opt.color}-500/10 text-${opt.color}-400 border-${opt.color}-500/20 hover:bg-${opt.color}-500/20`,
  }));

  const interactionButtons = (template?.interactionActions || []).map(
    (act) => ({
      ...act,
      type: "interaction",
      color: `bg-${act.color}-500/10 text-${act.color}-400 border-${act.color}-500/20 hover:bg-${act.color}-500/20`,
    })
  );

  const mainButtons = [
    ...(canVote ? voteButtons : []),
    ...(canInteract ? interactionButtons : []),
  ];

  // Fallback si le template n'a pas d'options définies
  if (mainButtons.length === 0 && (canVote || canInteract)) {
    if (canVote) {
      mainButtons.push(
        {
          id: "ok",
          label: "D'accord",
          color:
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
          icon: "CheckCircle2",
        },
        {
          id: "no",
          label: "Pas d'accord",
          color:
            "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20",
          icon: "XCircle",
        },
        {
          id: "off",
          label: "Besoin d'air",
          color:
            "bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20",
          icon: "HelpCircle",
        }
      );
    }
    if (canInteract) {
      mainButtons.push(
        {
          id: "parole",
          label: "Demande de parole",
          color:
            "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
          icon: "MessageSquare",
        },
        {
          id: "technical",
          label: "Point technique",
          color:
            "bg-orange-600/10 text-orange-400 border-orange-600/20 hover:bg-orange-600/20",
          icon: "AlertTriangle",
        }
      );
    }
  }

  const votingPower = user?.user_metadata?.voting_power || 1;
  const currentDeclaration =
    roomData?.userPowers?.[user?.id]?.declarations?.slice(-1)[0];
  const effectiveMultiplier = currentDeclaration?.multiplier || 1;
  const effectivePower = votingPower * effectiveMultiplier;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
              Votre Vote
            </h3>
            <span
              className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${userRole === "member" ? "bg-indigo-500/20 text-indigo-400" : "bg-white/10 text-white/40"}`}
            >
              {currentRoleLabel}
            </span>
          </div>
          {currentDeclaration && (
            <span className="text-[8px] text-amber-500/60 font-medium italic truncate max-w-[200px]">
              Multiplié par {effectiveMultiplier} : {currentDeclaration.reason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const m = prompt(
                "Multiplicateur (ex: 2 pour voix double) ?",
                "2"
              );
              const r = prompt("Motif / Procuration ?", "Procuration de...");
              if (m && r) declarePower?.(parseInt(m), r);
            }}
            className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-400 uppercase tracking-widest hover:bg-amber-500/20 transition-all"
          >
            Procuration
          </button>
          {(votingPower > 1 || effectiveMultiplier > 1) && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                {template?.weightLabel || "Poids"} : {effectivePower}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {mainButtons.map((btn) => {
          const Icon = ICON_MAP[btn.icon] || HelpCircle;
          
          // Map template colors to Mondrian palette
          let mondrianColor = "bg-white text-black";
          if (btn.id === "ok" || btn.id === "yes") mondrianColor = "bg-[#0055A4] text-white";
          else if (btn.id === "no" || btn.id === "cancel") mondrianColor = "bg-[#E10600] text-white";
          else if (btn.id === "off" || btn.id === "help" || btn.id === "parole") mondrianColor = "bg-[#FFD500] text-black";

          return (
            <button
              key={btn.id}
              onClick={() => castVote?.(btn.id)}
              className={`flex flex-row items-center justify-center gap-3 p-4 rounded-none border-4 border-black transition-all active:translate-x-1 active:translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group ${mondrianColor}`}
            >
              <Icon className="w-5 h-5" strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {btn.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Admin/Relay Quick Actions (Expandable) */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] hover:text-white/40 transition-colors px-2 py-1"
        >
          <Settings
            className={`w-3 h-3 transition-transform ${isMenuOpen ? "rotate-90" : ""}`}
          />
          Actions Relais
        </button>

        {isMenuOpen && (
          <div className="flex flex-col gap-4 mt-3 p-4 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <h4 className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">
                Changer le Template d'Assemblée
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {GOVERNANCE_MODELS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate?.(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-bold border transition-all ${
                      template?.id === t.id
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {t.id === "democratie_directe" && (
                      <Users className="w-3 h-3" />
                    )}
                    {t.id === "palabre" && (
                      <MessageCircle className="w-3 h-3" />
                    )}
                    {t.id === "copropriete" && <Home className="w-3 h-3" />}
                    {t.id === "conseil_municipal" && (
                      <Landmark className="w-3 h-3" />
                    )}
                    {t.id === "entreprise_sa" && (
                      <Briefcase className="w-3 h-3" />
                    )}
                    {t.id === "tribunal" && <Gavel className="w-3 h-3" />}
                    {t.id === "chapitre" && <BookOpen className="w-3 h-3" />}
                    {t.id === "dao" && <Cpu className="w-3 h-3" />}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5 w-full my-1" />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const p = prompt("Nouvelle proposition ?");
                  if (p) setProposition?.(p);
                }}
                className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-xl text-[10px] font-bold border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
              >
                NOUVELLE PROPOSITION
              </button>
              <button
                onClick={() => {
                  if (confirm("Réinitialiser tous les votes ?")) resetVotes?.();
                }}
                className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-all"
              >
                RESET VOTES
              </button>
              <button
                onClick={() => {
                  const url = prompt("Lien Jitsi ou YouTube ?");
                  if (url) setMedia?.("live", url);
                }}
                className="px-4 py-2 bg-white/5 text-white/60 rounded-xl text-[10px] font-bold border border-white/10 hover:bg-white/10 transition-all"
              >
                MODIFIER LIVE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
