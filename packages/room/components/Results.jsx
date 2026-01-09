import React from "react";
import { MarkdownViewer } from "@inseme/ui";
import {
  Users,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  Eye,
  BarChart3,
  Printer,
  Mic,
  Cpu,
  Zap,
  ShieldCheck,
  History,
  FileText,
  Scale,
  Gavel,
  Heart,
  Volume2,
  VolumeX,
} from "lucide-react";
import { TalkButton } from "./TalkButton";
import { useInsemeContext } from "../InsemeContext";

// --- Sub-components ---

const SolidarityBadge = ({ isEnterprise }) => (
  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 backdrop-blur-sm relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
      <Heart className="w-8 h-8 text-indigo-400" />
    </div>
    <div className="flex items-start gap-3 relative z-10">
      <div className="p-2 bg-indigo-500/20 rounded-lg">
        <Heart className="w-4 h-4 text-indigo-400" />
      </div>
      <div>
        <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">
          {isEnterprise ? "Donateur Solidaire" : "Initiative Bénévole"}
        </h5>
        <p className="text-[10px] text-white/60 leading-tight">
          {isEnterprise
            ? "Cette instance bénéficie d'un don qui soutient le développement open source et non-profit de Kudocracy."
            : "Plateforme 100% bénévole et non-profit. Les dons des structures commerciales financent notre indépendance."}
        </p>
      </div>
    </div>
  </div>
);

const PerspectiveSwitcher = ({ perspective, setPerspective, perspectives }) => (
  <div className="flex justify-center">
    <div className="inline-flex p-1.5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
      {perspectives.map((p) => (
        <button
          key={p.id}
          onClick={() => setPerspective(p.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            perspective === p.id
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
              : "text-white/40 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          <p.icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{p.label}</span>
        </button>
      ))}
    </div>
  </div>
);

const VocalMonitor = ({
  vocalState,
  isHandsFree,
  transcriptionStatus,
  isRecording,
  isTranscribing,
  startRecording,
  stopRecording,
  isSilent,
  setIsSilent,
}) => (
  <div className="flex flex-col items-center gap-6 py-4">
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => {
          const newSilent = !isSilent;
          setIsSilent(newSilent);
          localStorage.setItem("inseme_silent", newSilent ? "true" : "false");
        }}
        className={`p-3 rounded-xl transition-all border ${isSilent ? "bg-white/5 text-white/20 border-white/10" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-lg shadow-indigo-500/10"}`}
        title={isSilent ? "Activer le son" : "Couper le son"}
      >
        {isSilent ? (
          <VolumeX className="w-6 h-6" />
        ) : (
          <Volume2 className="w-6 h-6" />
        )}
      </button>
      <TalkButton
        vocalState={vocalState}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        startRecording={startRecording}
        stopRecording={stopRecording}
        isHandsFree={isHandsFree}
        size="lg"
      />
    </div>
    {transcriptionStatus?.isActive && (
      <div className="w-full max-w-2xl bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-4 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Transcription Locale Active (Micro-Capteur)
          </span>
        </div>
        <p className="text-sm text-white/80 font-medium leading-relaxed italic">
          "{transcriptionStatus.lastTranscript || "En attente de parole..."}"
        </p>
      </div>
    )}
  </div>
);

const MobileView = ({ proposition, voteChoices }) => (
  <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h2 className="text-black text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
        <Info size={14} strokeWidth={3} />
        Sujet en cours
      </h2>
      <div className="text-xl font-black text-black leading-tight">
        {proposition}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {voteChoices.slice(0, 4).map((choice, idx) => {
        const colors = [
          "bg-[#0055A4] text-white", // Blue
          "bg-[#E10600] text-white", // Red
          "bg-[#FFD500] text-black", // Yellow
          "bg-white text-black",     // White
        ];
        return (
          <button
            key={choice.id}
            className={`aspect-square rounded-none flex flex-row items-center justify-center gap-3 transition-all active:translate-x-1 active:translate-y-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${colors[idx % colors.length]}`}
          >
            <choice.icon className="w-8 h-8" strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">
              {choice.label}
            </span>
          </button>
        );
      })}
    </div>
    <button className="w-full py-6 rounded-none bg-[#FFD500] border-4 border-black text-black font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 transition-all">
      <MessageSquare className="w-8 h-8" strokeWidth={3} />
      Demander la parole
    </button>
  </div>
);

const ScribeView = ({
  messages,
  speechQueue,
  actsLog,
  deviceCapability,
  governanceMode,
  transcriptionStatus,
  template,
  votes,
  isEnterprise,
  terminology,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-right-4 duration-700">
    <div className="lg:col-span-8 space-y-6">
      <div className="bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            <Printer className="w-6 h-6 text-indigo-400" />
            Bloc-Notes du Scribe
          </h3>
          <div className="flex items-center gap-2">
            {deviceCapability?.canRunWhisper && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                <Cpu className="w-3 h-3" />
                Nœud de Transcription Actif
              </div>
            )}
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
              En direct
            </span>
          </div>
        </div>
        <textarea
          className="w-full h-48 bg-black/20 border border-white/5 rounded-2xl p-4 text-white placeholder:text-white/10 focus:border-indigo-500/50 outline-none transition-all resize-none"
          placeholder="Prenez des notes rapides ici... Elles seront indexées avec le timestamp actuel."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {["#Consensus", "#Désaccord", "#Action", "#PointClé", "#Émotion"].map(
            (tag) => (
              <button
                key={tag}
                className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-white/40 hover:bg-indigo-500 hover:text-white transition-all"
              >
                {tag}
              </button>
            )
          )}
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/5 p-6 h-64 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
          <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500" />
            Flux de Transcription{" "}
            {governanceMode ? "(Audit-Trail Certifié)" : "(Distributed CPU)"}
          </h4>
        </div>
        <div className="mt-8 space-y-4 overflow-y-auto h-full pr-2 custom-scrollbar">
          {messages
            ?.filter((m) => m.type === "transcription_chunk")
            .slice(-10)
            .map((m, idx) => (
              <div
                key={m.id || idx}
                className={`p-3 rounded-xl border transition-all ${idx === 9 ? "bg-white/10 border-white/10" : "bg-white/5 border-white/5 opacity-60"} ${m.metadata?.certified ? "border-l-4 border-l-emerald-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                      {m.name}
                    </span>
                    {m.metadata?.role === "member" && (
                      <span className="text-[7px] font-black text-indigo-400/60 uppercase tracking-widest">
                        • {terminology.member || "Membre"}
                      </span>
                    )}
                    {m.metadata?.certified && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[6px] font-black uppercase tracking-widest border border-emerald-500/30">
                        Certifié
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] text-white/20">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {m.message}
                </p>
              </div>
            ))}
          {transcriptionStatus?.isActive && (
            <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 animate-pulse">
              <p className="text-xs text-white leading-relaxed italic">
                "{transcriptionStatus.lastTranscript || "Écoute en cours..."}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="lg:col-span-4 space-y-6">
      <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl">
        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">
          Orateur Actuel
        </h4>
        {speechQueue?.[0] ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xl text-white">
              {speechQueue[0].name[0]}
            </div>
            <div>
              <p className="font-bold text-white">{speechQueue[0].name}</p>
              <button className="text-[10px] font-black text-indigo-400 uppercase hover:underline">
                Annoter son intervention
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/20 italic">Aucun orateur en cours</p>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
          <History className="w-3 h-3 text-indigo-400" />
          Journal de {terminology.assembly || "Traçabilité"}
        </h4>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {actsLog?.map((act, i) => (
            <div
              key={act.id || i}
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-[9px]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-indigo-400 uppercase">
                  {act.name}
                </span>
                <span className="text-white/20">
                  {new Date(act.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-white/60 leading-tight">
                {act.type === "template_change" &&
                  `A changé le mode en : ${act.metadata?.template_label}`}
                {act.type === "power_declaration" &&
                  `A déclaré une délégation/pouvoir x${act.metadata?.multiplier} : ${act.metadata?.reason}`}
                {act.type === "vote" &&
                  `A voté "${act.metadata?.option}" (${template?.weightLabel || "Poids"}: ${votes?.[act.user_id]?.weight || 1})`}
                {act.type === "flash_poll" &&
                  `A lancé un(e) nouveau/nouvelle ${terminology.proposition?.toLowerCase() || template?.terminology?.proposition?.toLowerCase() || "proposition"}.`}
                {act.type === "agenda_update" &&
                  `A mis à jour l'ordre du jour.`}
              </p>
            </div>
          ))}
        </div>
      </div>
      <SolidarityBadge isEnterprise={isEnterprise} />
    </div>
  </div>
);

const StandardView = ({
  perspective,
  proposition,
  results,
  template,
  voteChoices,
  speechQueue,
  specialMessages,
  votes,
  terminology,
  actsLog,
  isEnterprise,
}) => {
  const isGrouped = results?.total !== undefined;
  const effectiveResults = isGrouped ? results.total : results;
  const byCollege = isGrouped ? results.byCollege : null;

  return (
    <div className="space-y-8">
      {/* Proposition Card */}
      <div
        className={`bg-neutral-900/40 backdrop-blur-3xl rounded-3xl border border-white/[0.08] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group transition-all ${perspective === "focus" ? "scale-95 opacity-50 grayscale" : ""}`}
      >
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-blue-600"></div>
        <div className="flex items-start gap-6">
          <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:scale-105 transition-transform">
            <Info className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em]">
                {terminology.proposition ||
                  template?.terminology?.proposition ||
                  "Proposition Active"}
              </span>
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                <Users className="w-3 h-3 text-white/40" />
                <span className="text-[10px] font-bold text-white/60">
                  {Object.keys(votes || {}).length}{" "}
                  {Object.keys(votes || {}).length > 1
                    ? terminology.members || `${terminology.member}s`
                    : terminology.member || "Participant"}
                </span>
              </div>
            </div>
            <div className="text-2xl text-white/95 font-semibold prose prose-invert prose-p:leading-relaxed max-w-none">
              <MarkdownViewer content={proposition} />
            </div>
          </div>
        </div>

        {perspective !== "focus" &&
          effectiveResults &&
          Object.keys(effectiveResults).length > 0 && (
            <div className="mt-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {voteChoices.map((choice) => {
                  const weightSum = effectiveResults[choice.id] || 0;
                  const totalWeight = Object.values(effectiveResults).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percentage =
                    Math.round((weightSum / totalWeight) * 100) || 0;

                  // Détails par collège
                  const memberWeight = byCollege?.member?.[choice.id] || 0;
                  const otherWeight = byCollege?.other?.[choice.id] || 0;

                  return (
                    <div
                      key={choice.id}
                      className={`flex flex-col gap-1 p-3 rounded-2xl bg-white/5 border border-white/5 ${weightSum > 0 ? "opacity-100" : "opacity-20"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <choice.icon className={`w-3 h-3 ${choice.text}`} />
                        <span className="text-xs font-black text-white">
                          {weightSum}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden flex">
                        {isGrouped ? (
                          <>
                            <div
                              className={`h-full ${choice.color} opacity-100`}
                              style={{
                                width: `${(memberWeight / totalWeight) * 100}%`,
                              }}
                              title={`${terminology.member || "Membre"}: ${memberWeight}`}
                            ></div>
                            <div
                              className={`h-full ${choice.color} opacity-40`}
                              style={{
                                width: `${(otherWeight / totalWeight) * 100}%`,
                              }}
                              title={`Invité / Observateur: ${otherWeight}`}
                            ></div>
                          </>
                        ) : (
                          <div
                            className={`h-full ${choice.color}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        )}
                      </div>
                      <div className="flex flex-col mt-1">
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">
                          {choice.label} ({percentage}%)
                        </span>
                        {isGrouped && weightSum > 0 && (
                          <span className="text-[7px] font-medium text-white/20 uppercase">
                            M: {memberWeight} | I: {otherWeight}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Speech Queue */}
        <div
          className={`${perspective === "regie" ? "lg:col-span-12 order-first" : "lg:col-span-12"}`}
        >
          {speechQueue?.length > 0 ? (
            <div
              className={`bg-amber-500/10 backdrop-blur-2xl rounded-3xl border border-amber-500/20 p-8 border-l-8 border-l-amber-500 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <MessageSquare className="w-6 h-6 text-amber-500" />
                  <h3 className="text-xl font-black text-amber-500 uppercase tracking-widest">
                    File d'Intervention
                  </h3>
                </div>
                <span className="bg-amber-500 text-black px-4 py-1.5 rounded-full font-black text-xs">
                  {speechQueue.length} EN ATTENTE
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {speechQueue.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-4 rounded-2xl border ${i === 0 ? "bg-amber-500/20 border-amber-500/40" : "bg-white/5 border-white/5"}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{s.name}</span>
                      {s.isMember && (
                        <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                          {terminology.member || "Membre"}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2 py-1 rounded font-black uppercase ${s.type === "technical" ? "bg-orange-600 text-white" : "bg-amber-500/20 text-amber-500"}`}
                    >
                      {s.type === "parole" ? "PAROLE" : "TECHNIQUE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] rounded-3xl border border-white/[0.05] p-6 flex items-center justify-center gap-4 text-white/20">
              <MessageSquare className="w-5 h-5 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Aucune demande de parole en attente
              </span>
            </div>
          )}
        </div>

        {/* Special Messages */}
        {specialMessages && specialMessages.length > 0 && (
          <div
            className={`lg:col-span-12 space-y-4 ${perspective === "focus" ? "order-first" : ""}`}
          >
            <div className="flex items-center gap-4 mb-2">
              <Info className="w-5 h-5 text-indigo-400" />
              <h3 className="text-xl font-bold text-white tracking-tight">
                Analyses & Recommandations
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {specialMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`p-6 rounded-3xl border backdrop-blur-xl ${msg.type === "vote_recommendation" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-indigo-500/10 border-indigo-500/20"}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                      {msg.type}
                    </span>
                    <span className="text-[10px] text-white/20 font-bold">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed space-y-4">
                    <MarkdownViewer content={msg.message} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AssemblyStatus = ({ votes, voteChoices }) => (
  <div className="lg:col-span-12">
    <div className="bg-neutral-900/20 backdrop-blur-xl rounded-3xl border border-white/[0.05] p-8 shadow-xl">
      <div className="flex items-center gap-4 mb-8">
        <Users className="w-5 h-5 text-white/40" />
        <h3 className="text-xl font-bold text-white tracking-tight">
          États de l'Assemblée
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {!votes || Object.entries(votes).length === 0 ? (
          <p className="text-white/10 text-sm italic col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl font-medium">
            En attente des premiers votes...
          </p>
        ) : (
          Object.entries(votes).map(([id, v]) => {
            const choice = voteChoices.find((c) => c.id === v.type) || {
              label: v.type,
              text: "text-white/40",
            };
            return (
              <div
                key={id}
                className="flex flex-col p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
              >
                <span className="text-xs font-bold text-white/90 truncate mb-1">
                  {v.name}
                </span>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                  <span
                    className={`text-[9px] font-black uppercase tracking-tighter ${choice.text}`}
                  >
                    {choice.label}
                  </span>
                  <Clock className="w-3 h-3 text-white/10" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
);

// --- Main Component ---

const ICON_MAP = {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  Users,
  Cpu,
  Zap,
};

export function Results(props) {
  const context = useInsemeContext();
  const [perspective, setPerspective] = React.useState("agora");

  const {
    roomData,
    messages,
    vocalState,
    isSilent,
    setIsSilent,
    isHandsFree,
    transcriptionStatus,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    deviceCapability,
    governanceMode,
    isEnterprise,
    template,
    terminology,
    canInteract,
  } = { ...context, ...props };

  const { proposition, results, votes, speechQueue } = roomData || {
    proposition: "",
    results: {},
    votes: {},
    speechQueue: [],
  };

  const perspectives = [
    { id: "agora", label: "Agora", icon: Users },
    { id: "focus", label: "Immersion", icon: Eye },
    { id: "regie", label: "Régie", icon: BarChart3 },
    { id: "scribe", label: "Scribe", icon: Printer },
    { id: "mobile", label: "Sur Place", icon: Mic },
  ];

  const voteChoices = React.useMemo(() => {
    return [
      ...(template?.quickVoteOptions || []).map((opt) => ({
        ...opt,
        icon: ICON_MAP[opt.icon] || HelpCircle,
        text: `text-${opt.color}-400`,
        color: `bg-${opt.color}-500`,
      })),
      ...(template?.interactionActions || []).map((act) => ({
        ...act,
        icon: ICON_MAP[act.icon] || HelpCircle,
        text: `text-${act.color}-400`,
        color: `bg-${act.color}-500`,
      })),
    ];
  }, [template]);

  // Fallback if no choices defined in template
  const effectiveVoteChoices =
    voteChoices.length > 0
      ? voteChoices
      : [
          {
            id: "ok",
            label: "D'accord",
            color: "bg-emerald-500",
            icon: CheckCircle2,
            text: "text-emerald-400",
          },
          {
            id: "no",
            label: "Pas d'accord",
            color: "bg-rose-500",
            icon: XCircle,
            text: "text-rose-400",
          },
          {
            id: "off",
            label: "Besoin d'air",
            color: "bg-sky-500",
            icon: HelpCircle,
            text: "text-sky-400",
          },
          {
            id: "parole",
            label: "Demande de parole",
            color: "bg-amber-500",
            icon: MessageSquare,
            text: "text-amber-400",
          },
          {
            id: "technical",
            label: "Point technique",
            color: "bg-orange-600",
            icon: AlertTriangle,
            text: "text-orange-400",
          },
        ];

  const specialMessages = messages
    ?.filter((m) =>
      [
        "vote_recommendation",
        "debate_map",
        "synthesis",
        "moderation_log",
        "trust_leaderboard",
        "moderation_mode_change",
        "speech_management",
      ].includes(m.type)
    )
    .slice(-5)
    .reverse();

  const actsLog = messages
    ?.filter((m) =>
      [
        "template_change",
        "power_declaration",
        "vote",
        "flash_poll",
        "agenda_update",
      ].includes(m.type)
    )
    .slice(-20)
    .reverse();

  return (
    <div className="space-y-8">
      <PerspectiveSwitcher
        perspective={perspective}
        setPerspective={setPerspective}
        perspectives={perspectives}
      />

      {canInteract && (
        <VocalMonitor
          vocalState={vocalState}
          isHandsFree={isHandsFree}
          transcriptionStatus={transcriptionStatus}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          startRecording={startRecording}
          stopRecording={stopRecording}
          isSilent={isSilent}
          setIsSilent={setIsSilent}
        />
      )}

      {perspective === "mobile" ? (
        <MobileView
          proposition={proposition}
          voteChoices={effectiveVoteChoices}
        />
      ) : perspective === "scribe" ? (
        <ScribeView
          messages={messages}
          speechQueue={speechQueue}
          actsLog={actsLog}
          deviceCapability={deviceCapability}
          governanceMode={governanceMode}
          transcriptionStatus={transcriptionStatus}
          template={template}
          votes={votes}
          isEnterprise={isEnterprise}
          terminology={terminology}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Main Views */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
            <StandardView
              perspective={perspective}
              proposition={proposition}
              results={results}
              template={template}
              voteChoices={effectiveVoteChoices}
              speechQueue={speechQueue}
              specialMessages={specialMessages}
              votes={votes}
              terminology={terminology}
            />
          </div>

          {/* Assembly Summary */}
          <AssemblyStatus votes={votes} voteChoices={effectiveVoteChoices} />
        </div>
      )}
    </div>
  );
}
