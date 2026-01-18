import React, { useState, useRef, useEffect, useCallback } from "react";
import { MarkdownViewer } from "@inseme/ui";
import {
  Send,
  Bot,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  Globe,
  Printer,
  Cloud,
  Link as LinkIcon,
  Users,
  User,
  Play,
  Square,
  Clock,
  ShieldCheck,
  X,
  BarChart3,
  CheckCircle2,
  Eye,
  Plus,
  Sparkles,
  Hand,
  LogOut,
  ChevronUp,
  Headphones,
  Camera,
  Image,
  Trophy,
  Bell,
  Coffee,
  Briefcase,
} from "lucide-react";
import { useInsemeContext } from "../InsemeContext";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { TalkButton } from "./TalkButton";
import { AgendaPanel } from "./AgendaPanel";
import { MobileControls } from "./MobileControls";
import { CameraModal } from "./CameraModal";

// Sub-composants pour ChatMessage
const MessageHeader = ({
  msg,
  isAI,
  variant,
  isTranscription,
  isReport,
  isTranslated,
  showOriginal,
  setShowOriginal,
  originalLang,
  handleTranslateToNative,
  translatedContent,
  hasAudio,
  playVocal,
  hasPublicProfile,
  onClickName,
}) => (
  <div className="flex items-baseline gap-2 mb-1.5 px-1">
    {hasPublicProfile && onClickName ? (
      <button
        type="button"
        onClick={onClickName}
        className={`text-[10px] font-black tracking-widest underline decoration-dotted underline-offset-2 cursor-pointer ${isAI ? "text-mondrian-blue font-bold" : variant === "minimal" ? "text-black/60 hover:text-black" : "text-white/50 hover:text-white"}`}
      >
        {msg.name}
      </button>
    ) : (
      <span
        className={`text-[10px] font-black tracking-widest ${isAI ? "text-mondrian-blue font-bold" : variant === "minimal" ? "text-black/40" : "text-white/30"}`}
      >
        {msg.name}
      </span>
    )}
    {msg.metadata?.role && msg.metadata.role !== "authenticated" && (
      <span
        className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${msg.metadata.role === "member" ? "bg-mondrian-blue/20 text-mondrian-blue" : "bg-white/10 text-white/40"}`}
      >
        {msg.metadata.role}
      </span>
    )}
    <span
      className={`text-[9px] font-medium ${variant === "minimal" ? "text-black/20" : "text-white/10"}`}
    >
      {new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
    {isTranscription && (
      <span className="text-[8px] bg-mondrian-red/20 text-mondrian-red px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
        Vocal
      </span>
    )}
    {isReport && (
      <span className="text-[8px] bg-mondrian-yellow/20 text-mondrian-yellow px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
        Officiel
      </span>
    )}
    {isTranslated && (
      <button
        onClick={() => setShowOriginal(!showOriginal)}
        className="flex items-center gap-1 text-[8px] bg-mondrian-blue/20 text-mondrian-blue px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter hover:bg-mondrian-blue/30 transition-colors"
      >
        <Globe className="w-2 h-2" />
        {showOriginal ? "Original" : `Traduit de ${originalLang}`}
      </button>
    )}
    {!isTranslated && !isReport && (
      <button
        onClick={handleTranslateToNative}
        className={`opacity-0 group-hover:opacity-100 transition-opacity text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter flex items-center gap-1 ${translatedContent ? "bg-mondrian-blue text-white" : "text-white/20 hover:text-white/60"}`}
        title="Traduire dans ma langue"
      >
        <Globe className="w-2 h-2" />
        {translatedContent ? "Voir Original" : "Traduire"}
      </button>
    )}
    {hasAudio && (
      <button
        onClick={() => playVocal(msg.metadata?.vocal_payload || msg.metadata?.vocal_url)}
        className="p-1 hover:bg-white/10 rounded-full transition-colors group/play"
        title="Réécouter le message vocal"
      >
        <Volume2 className="w-3 h-3 text-mondrian-blue animate-pulse group-hover/play:scale-125 transition-transform" />
      </button>
    )}
  </div>
);

const RitualBlock = () => (
  <div className="flex flex-col items-center gap-2 mb-2">
    <Sparkles className="w-8 h-8 text-black" strokeWidth={3} />
    <span className="text-xs font-black uppercase tracking-widest bg-black text-mondrian-yellow px-3 py-1">
      Rituel de Comptoir
    </span>
  </div>
);

const LegendBlock = () => (
  <div className="flex flex-col items-center gap-2 mb-2">
    <Trophy className="w-8 h-8 text-mondrian-yellow" strokeWidth={3} />
    <span className="text-xs font-black uppercase tracking-widest bg-mondrian-yellow text-black px-3 py-1">
      Légendes
    </span>
  </div>
);

const ReportActions = ({ handleArchive, printReport, downloadReport }) => (
  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
    <span className="text-xs font-bold uppercase tracking-widest text-mondrian-blue flex items-center gap-2">
      <Bot className="w-3 h-3" />
      Procès-Verbal
    </span>
    <div className="flex gap-2">
      <button
        onClick={handleArchive}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
        title="Archiver"
      >
        <Cloud className="w-4 h-4" />
      </button>
      <button
        onClick={printReport}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
        title="Imprimer"
      >
        <Printer className="w-4 h-4" />
      </button>
      <button
        onClick={downloadReport}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
        title="Télécharger"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const VisualSignalContent = ({ imageUrl }) => (
  <div className="mb-3 rounded-lg overflow-hidden bg-black/20">
    <img
      src={imageUrl}
      alt="Signal Visuel"
      className="w-full h-auto max-h-64 object-contain"
      loading="lazy"
    />
  </div>
);

const ThinkingBlock = ({
  msg,
  ephemeralThoughts,
  displayMessage,
  isThinkingOpen,
  setIsThinkingOpen,
}) => {
  const relatedThought = ephemeralThoughts?.find(
    (t) => t.name === msg.name && Math.abs(new Date(t.timestamp) - new Date(msg.created_at)) < 5000
  );

  if (relatedThought) {
    return (
      <div className="space-y-4">
        <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors text-[10px] font-bold text-white/40 uppercase tracking-widest"
          >
            <Bot className={`w-3 h-3 transition-transform ${isThinkingOpen ? "rotate-180" : ""}`} />
            {isThinkingOpen ? "Masquer le raisonnement" : "Voir le raisonnement"}
          </button>
          {isThinkingOpen && (
            <div className="px-3 py-3 border-t border-white/5 text-[11px] text-white/40 italic leading-relaxed bg-white/[0.02]">
              <MarkdownViewer content={relatedThought.reasoning} />
            </div>
          )}
        </div>
        <MarkdownViewer content={displayMessage} />
      </div>
    );
  }

  const thinkMatch = displayMessage.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const thought = thinkMatch[1].trim();
    const actualContent = displayMessage.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    return (
      <div className="space-y-4">
        <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors text-[10px] font-bold text-white/40 uppercase tracking-widest"
          >
            <Bot className={`w-3 h-3 transition-transform ${isThinkingOpen ? "rotate-180" : ""}`} />
            {isThinkingOpen ? "Masquer le raisonnement" : "Voir le raisonnement"}
          </button>
          {isThinkingOpen && (
            <div className="px-3 py-3 border-t border-white/5 text-[11px] text-white/40 italic leading-relaxed bg-white/[0.02]">
              <MarkdownViewer content={thought} />
            </div>
          )}
        </div>
        <MarkdownViewer content={actualContent} />
      </div>
    );
  }
  return <MarkdownViewer content={displayMessage} />;
};

const PollBlock = ({ messages, user, castVote }) => (
  <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
    <div className="flex items-center gap-2 text-mondrian-blue mb-2">
      <BarChart3 className="w-4 h-4" />
      <span className="text-[10px] font-black uppercase tracking-widest">Sondage Express</span>
    </div>
    <div className="space-y-3">
      {["pour", "contre", "abstention"].map((option) => {
        const count = messages.filter(
          (m) => m.type === "vote" && m.metadata?.option === option
        ).length;
        const total = messages.filter((m) => m.type === "vote").length || 1;
        const percentage = Math.round((count / total) * 100);
        const hasVoted = messages.some((m) => m.type === "vote" && m.user_id === user?.id);

        return (
          <div key={option} className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
              <span
                className={
                  option === "pour"
                    ? "text-mondrian-blue"
                    : option === "contre"
                      ? "text-mondrian-red"
                      : "text-white/40"
                }
              >
                {option}
              </span>
              <span className="text-white/20">
                {count} voix ({percentage}%)
              </span>
            </div>
            <button
              disabled={!user || hasVoted}
              onClick={() => castVote(option)}
              className="w-full h-8 rounded-lg bg-white/5 border border-white/5 relative overflow-hidden group/opt hover:border-white/10 transition-all disabled:opacity-50"
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-1000 ${option === "pour" ? "bg-mondrian-blue/20" : option === "contre" ? "bg-mondrian-red/20" : "bg-white/10"}`}
                style={{ width: `${percentage}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {hasVoted &&
                  messages.find((m) => m.type === "vote" && m.user_id === user?.id)?.metadata
                    ?.option === option && <CheckCircle2 className="w-3 h-3 text-mondrian-blue" />}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

function ChatMessage({
  msg,
  i,
  roomName,
  roomMetadata,
  archiveReport,
  ephemeralThoughts,
  messages,
  user,
  castVote,
  sendMessage,
  playVocal,
  vocalState,
  isSilent,
  isHandsFree,
  variant,
  terminology,
  publicProfile,
  onProfileClick,
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);

  if (msg.message.toLowerCase().startsWith("inseme")) return null;
  if (msg.metadata?.vocal_only && !isSilent) return null;
  if (msg.type === "transcription_chunk") return null;

  const isAI = msg.name === "Ophélia";
  const isTranscription =
    msg.metadata?.type === "transcription" || msg.metadata?.type === "vocal_transcription";
  const isLink = msg.metadata?.type === "link";
  const isReport = msg.metadata?.type === "report";
  const isPoll = msg.metadata?.type === "flash_poll";
  const isRitual = msg.metadata?.type === "ritual_trigger";
  const isParticipation = msg.metadata?.type === "ritual_participation";
  const isLegend = msg.metadata?.type === "legend_add";
  const hasAudio = !!msg.metadata?.vocal_payload || !!msg.metadata?.vocal_url;
  const isTranslated = !!msg.metadata?.original;
  const originalLang = msg.metadata?.lang?.toUpperCase();
  const hasPublicProfile =
    !!publicProfile &&
    Array.isArray(publicProfile.public_links) &&
    publicProfile.public_links.length > 0;

  const getTargetInfo = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("@barman"))
      return {
        label: "À l'équipe de service",
        icon: Coffee,
        color: "bg-mondrian-yellow/20 text-mondrian-yellow border-mondrian-yellow/30",
        minimalColor: "bg-mondrian-yellow/5 text-mondrian-yellow border-mondrian-yellow/20",
      };
    if (lowerText.includes("@clients"))
      return {
        label: "À tout le bar",
        icon: Users,
        color: "bg-mondrian-yellow/20 text-mondrian-yellow border-mondrian-yellow/30",
        minimalColor: "bg-mondrian-yellow/5 text-mondrian-yellow border-mondrian-yellow/20",
      };
    if (lowerText.includes("@equipe"))
      return {
        label: "Coordination interne",
        icon: Briefcase,
        color: "bg-mondrian-blue/20 text-mondrian-blue border-mondrian-blue/30",
        minimalColor: "bg-mondrian-blue/5 text-mondrian-blue border-mondrian-blue/20",
      };
    return null;
  };

  const targetInfo = getTargetInfo(msg.message);

  const opheliaAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=Ophelia";

  const handleTranslateToNative = async () => {
    if (translatedContent) {
      setTranslatedContent(null);
      return;
    }
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: msg.message,
          target_lang: localStorage.getItem("inseme_native_lang") || "fr",
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText || "Unknown error"}`);
      }
      const data = await res.json();
      if (data.translated_text) setTranslatedContent(data.translated_text);
    } catch (e) {
      console.error("Translation error", e);
    }
  };

  const displayMessage = showOriginal ? msg.metadata.original : translatedContent || msg.message;

  const downloadReport = () => {
    const blob = new Blob([msg.message], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PV_Seance_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWindow = window.open("", "_blank");
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    printWindow.document.write(`
            <html>
                <head>
                    <title>Procès-Verbal - Inseme</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                        body { font-family: 'Inter', -apple-system, sans-serif; padding: 80px; max-width: 850px; margin: 0 auto; line-height: 1.6; color: #1a1a1a; background: white; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; }
                        .logo { font-weight: 900; letter-spacing: -1px; font-size: 24px; color: #000; text-transform: uppercase; }
                        .date { font-size: 12px; color: #444; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
                        h1 { font-size: 28px; font-weight: 900; margin-bottom: 10px; color: #000; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; }
                        .subtitle { color: #666; margin-bottom: 40px; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; text-align: center; font-weight: 700; }
                        .content { font-size: 15px; color: #333; }
                        .content h1, .content h2, .content h3 { color: #000; margin-top: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.5em; }
                        .footer { margin-top: 100px; padding-top: 40px; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
                        .stamp { border: 3px double #1a1a1a; padding: 10px 20px; font-weight: 900; text-transform: uppercase; transform: rotate(-3deg); display: inline-block; margin-top: 20px; }
                        @media print { body { padding: 0; } button { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">INSEME</div>
                        <div class="date">${dateStr}</div>
                    </div>
                    <h1>Procès-Verbal de ${terminology.session}</h1>
                    <div class="subtitle">Espace : ${roomName}</div>
                    <div class="content">
                        ${msg.message
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/### (.*?)\n/g, "<h3>$1</h3>")
                          .replace(/## (.*?)\n/g, "<h2>$1</h2>")
                          .replace(/- (.*?)\n/g, "<li>$1</li>")
                          .replace(/\n/g, "<br/>")}
                    </div>
                    <div class="signature">
                        <div class="stamp">CERTIFIÉ PAR OPHÉLIA</div>
                    </div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `);
    printWindow.document.close();
  };

  const handleArchive = async () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = await archiveReport(msg.message, dateStr);
      alert(`Archivé avec succès !\nURL: ${url}`);
    } catch (e) {
      alert(`Erreur d'archivage : ${e.message}`);
    }
  };

  return (
    <div
      className={`flex flex-col group ${isAI ? "items-start" : "items-start"} ${isRitual ? "w-full items-center my-6" : ""}`}
    >
      {!isRitual && (
        <MessageHeader
          msg={msg}
          isAI={isAI}
          variant={variant}
          isTranscription={isTranscription}
          isReport={isReport}
          isTranslated={isTranslated}
          showOriginal={showOriginal}
          setShowOriginal={setShowOriginal}
          originalLang={originalLang}
          handleTranslateToNative={handleTranslateToNative}
          translatedContent={translatedContent}
          hasAudio={hasAudio}
          playVocal={playVocal}
          hasPublicProfile={hasPublicProfile}
          onClickName={
            hasPublicProfile && onProfileClick ? () => onProfileClick(publicProfile) : undefined
          }
        />
      )}

      <div
        className={`px-4 py-3 rounded-2xl transition-all shadow-sm ${
          isRitual
            ? "bg-mondrian-yellow border-4 border-black text-black w-full max-w-md transform -rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center animate-in zoom-in duration-500"
            : isLegend
              ? "bg-black border-4 border-mondrian-yellow text-mondrian-yellow w-full max-w-md transform rotate-1 shadow-[8px_8px_0px_0px_var(--mondrian-yellow)] text-center animate-in slide-in-from-right duration-700"
              : isAI
                ? variant === "minimal"
                  ? "bg-mondrian-blue/5 border-2 border-mondrian-blue/20 text-mondrian-blue text-sm leading-relaxed max-w-[92%]"
                  : "bg-mondrian-blue/10 border border-mondrian-blue/20 text-mondrian-blue text-sm leading-relaxed max-w-[92%]"
                : targetInfo
                  ? variant === "minimal"
                    ? `${targetInfo.minimalColor} border-2 text-sm leading-relaxed max-w-[92%] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`
                    : `${targetInfo.color} border text-sm leading-relaxed max-w-[92%] shadow-[0_0_15px_-5px_rgba(0,0,0,0.3)]`
                  : variant === "minimal"
                    ? "bg-white border-2 border-black text-black text-sm leading-relaxed max-w-[92%]"
                    : "bg-white/5 text-white/80 border border-white/5 text-sm leading-relaxed group-hover:bg-white/[0.07] max-w-[92%]"
        } ${isReport ? "border-mondrian-blue/30 bg-mondrian-blue/10" : ""}`}
      >
        {targetInfo && (
          <div
            className={`flex items-center gap-1.5 mb-2 py-1 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest border ${variant === "minimal" ? "bg-white/50 border-current" : "bg-black/20 border-white/10"}`}
          >
            <targetInfo.icon className="w-3 h-3" />
            {targetInfo.label}
          </div>
        )}
        {isRitual && <RitualBlock />}
        {isLegend && <LegendBlock />}
        {isReport && (
          <ReportActions
            handleArchive={handleArchive}
            printReport={printReport}
            downloadReport={downloadReport}
          />
        )}

        {msg.metadata?.image_url && <VisualSignalContent imageUrl={msg.metadata.image_url} />}

        <div className="prose prose-invert prose-sm max-w-none prose-p:my-0 prose-headings:text-mondrian-yellow prose-a:text-mondrian-blue">
          <ThinkingBlock
            msg={msg}
            ephemeralThoughts={ephemeralThoughts}
            displayMessage={displayMessage}
            isThinkingOpen={isThinkingOpen}
            setIsThinkingOpen={setIsThinkingOpen}
          />
        </div>

        {isPoll && <PollBlock messages={messages} user={user} castVote={castVote} />}
        {isLink && msg.metadata?.urls && (
          <div className="mt-3 space-y-2">
            {msg.metadata.urls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-mondrian-blue truncate"
              >
                🔗 {url.replace(/^https?:\/\//, "")}
              </a>
            ))}
          </div>
        )}

        {isRitual && (
          <button
            onClick={() => {
              const ritualName = msg.metadata?.name || "Rituel";
              sendMessage(
                `[PARTICIPATION] : Je participe au rituel ${ritualName.toUpperCase()} ! 🍻✨`,
                {
                  type: "ritual_participation",
                  metadata: { ritual: msg.metadata?.ritual, name: ritualName },
                }
              );
            }}
            className="mt-4 w-full bg-black text-mondrian-yellow font-black py-3 px-6 border-4 border-black hover:bg-white hover:text-black transition-all uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
          >
            Participer au Rituel
          </button>
        )}
      </div>
    </div>
  );
}

export function Chat(props) {
  const context = useInsemeContext();

  const {
    roomName,
    user,
    userRole,
    isSpectator,
    messages,
    ephemeralThoughts,
    sendMessage,
    askOphélia,
    isOphéliaThinking,
    terminology,
    isSilent,
    setIsSilent,
    roomMetadata,
    archiveReport,
    roomData,
    startSession,
    endSession,
    updateAgenda,
    castVote,
    onParole,
    onDelegate,
    sessions,
    currentSessionId,
    selectSession,
    uploadVocal,
    playVocal,
    stopVocal,
    isHandsFree,
    setIsHandsFree,
    microMode,
    changeMicroMode,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
    addTime,
    duration,
    timeLeft,
    vocalState,
    vocalError,
    transcriptionPreview,
    systemPrompt,
    onToggleBoard,
    isBoardOpen,
    isMember,
    canVote,
    canInteract,
    variant,
    config,
  } = { ...context, ...props };

  const showLifecycleOverlay = props.showLifecycleOverlay ?? config?.showLifecycleOverlay ?? true;
  const lifecycleClosedMessage =
    props.lifecycleClosedMessage ?? config?.lifecycleClosedMessage ?? "La séance est close";

  const [newMessage, setNewMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showConstitution, setShowConstitution] = useState(false);
  const [showActionHub, setShowActionHub] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent.toLowerCase();
      setIsMobile(/mobile|android|iphone|ipad|tablet/i.test(ua));
    };
    checkMobile();
  }, []);

  const [copied, setCopied] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file, previewUrl }
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAttachment({ file, previewUrl });
    }
  };

  const handleCameraCapture = (file) => {
    const previewUrl = URL.createObjectURL(file);
    setAttachment({ file, previewUrl });
  };

  const clearAttachment = () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publicProfilesByUserId = useMemo(() => {
    if (!roomData?.connectedUsers) return {};
    const map = {};
    roomData.connectedUsers.forEach((u) => {
      const rawLinks = Array.isArray(u.public_links) ? u.public_links : [];
      const links = rawLinks.filter(
        (link) =>
          link &&
          typeof link.label === "string" &&
          typeof link.url === "string" &&
          link.label.trim() &&
          link.url.trim()
      );
      if (links.length > 0) {
        map[u.id] = { ...u, public_links: links };
      }
    });
    return map;
  }, [roomData?.connectedUsers]);

  // Sync vocalState with Ophélia thinking
  // (Logic moved to useInseme hook)

  // Audio Cues
  const playCue = useCallback(
    (type) => {
      if (isSilent) return;
      // In hands-free mode, we don't want any cue to avoid periodic beeps
      if (isHandsFree) return;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "start_listening") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "stop_listening") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }

      // Close context to avoid memory leaks and browser limits
      setTimeout(() => {
        if (ctx.state !== "closed") {
          ctx.close();
        }
      }, 500);
    },
    [isSilent, isHandsFree]
  );

  const prevVocalStateRef = useRef(vocalState);

  useEffect(() => {
    if (vocalState === "listening") playCue("start_listening");
    if (vocalState === "idle" && isRecording === false && prevVocalStateRef.current === "listening")
      playCue("stop_listening");

    prevVocalStateRef.current = vocalState;
  }, [vocalState, isRecording, playCue]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = newMessage.match(urlRegex);

    await sendMessage(newMessage, urls ? { type: "link", urls } : {}, attachment?.file);

    setNewMessage("");
    clearAttachment();
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
      {/* {terminology.session} Selector Dropdown */}
      {showSessions && (
        <div className="absolute top-16 left-6 z-50 w-64 bg-mondrian-black border border-white/10 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              {terminology.session}s Découvertes
            </h3>
            <button
              onClick={() => selectSession(null)}
              className="text-[10px] text-mondrian-blue font-bold hover:underline"
            >
              RETOUR AU DIRECT
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {sessions.length === 0 && (
              <p className="text-[10px] text-white/20 text-center py-4">
                Aucune {terminology.session} archivée
              </p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  selectSession(s);
                  setShowSessions(false);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${currentSessionId === s.id ? "bg-mondrian-blue/20 border-mondrian-blue/30" : "bg-white/5 border-white/5 hover:border-white/10"}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`text-[10px] font-black uppercase tracking-tighter ${currentSessionId === s.id ? "text-mondrian-blue" : "text-white/40"}`}
                  >
                    {new Date(s.start).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="text-[9px] text-white/20 font-mono">{s.count} msgs</span>
                </div>
                <p className="text-[11px] font-bold text-white/80 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                  {s.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Constitution Modal */}
      {showConstitution && (
        <div className="absolute inset-0 z-[100] bg-mondrian-black/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-mondrian-blue/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-mondrian-blue/20">
                <ShieldCheck className="w-5 h-5 text-mondrian-blue" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  Constitution d'Ophélia
                </h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">
                  Règles de médiation & éthique de l'IA
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowConstitution(false)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              <div className="prose prose-invert prose-sm prose-p:text-white/70 prose-headings:text-mondrian-yellow prose-strong:text-mondrian-red bg-white/5 p-8 rounded-3xl border border-white/10 shadow-inner">
                <MarkdownViewer
                  content={
                    systemPrompt || "# Chargement...\nLa constitution n'est pas encore disponible."
                  }
                />
              </div>
              <div className="mt-8 p-6 rounded-2xl bg-mondrian-blue/10 border border-mondrian-blue/20 flex gap-4 items-start">
                <Bot className="w-5 h-5 text-mondrian-blue mt-1 shrink-0" />
                <p className="text-xs text-mondrian-blue/80 leading-relaxed italic">
                  "Cette constitution définit mes règles d'engagement. Je ne peux pas être
                  influencée pour favoriser un participant au détriment d'un autre. Ma mission est
                  la recherche du consensus et la clarté du débat."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {isOphéliaThinking && (
        <div className="absolute inset-x-0 top-16 z-20 bg-mondrian-blue/10 border-b border-mondrian-blue/20 backdrop-blur-sm px-6 py-2 flex items-center gap-3 animate-pulse">
          <Loader2 className="w-4 h-4 text-mondrian-blue animate-spin" />
          <span className="text-[10px] font-bold text-mondrian-blue uppercase tracking-widest">
            Ophélia analyse les débats en temps réel...
          </span>
        </div>
      )}

      {/* Chat Header */}
      {variant !== "minimal" && (
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {roomMetadata?.name || roomName || "Discussion"}
              <div className="flex items-center gap-1.5">
                {roomMetadata?.settings?.parent_slug && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold tracking-widest border border-amber-500/30">
                    Commission
                  </span>
                )}
                {userRole === "spectator" ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-[10px] uppercase font-bold tracking-widest border border-white/10 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Spectateur
                  </span>
                ) : userRole === "guest" ? (
                  <span className="px-2 py-0.5 rounded-full bg-mondrian-blue/20 text-mondrian-blue text-[10px] uppercase font-bold tracking-widest border border-mondrian-blue/30 flex items-center gap-1">
                    <User className="w-3 h-3" /> Invité
                  </span>
                ) : userRole === "authenticated" ? (
                  <span
                    className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold tracking-widest border border-amber-500/30 flex items-center gap-1"
                    title="Vous n'êtes pas membre du groupe rattaché à cette séance"
                  >
                    <Eye className="w-3 h-3" /> Observateur (non-membre)
                  </span>
                ) : userRole === "member" ? (
                  <span className="px-2 py-0.5 rounded-full bg-mondrian-blue/20 text-mondrian-blue text-[10px] uppercase font-bold tracking-widest border border-mondrian-blue/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {terminology.member}
                  </span>
                ) : null}
              </div>
            </h2>
            <p className="text-[10px] text-white/30 uppercase tracking-tighter">
              {roomMetadata?.settings?.parent_slug
                ? `Sous-groupe de ${roomMetadata.settings.parent_slug}`
                : roomMetadata?.description || `Échanges & ${terminology.dashboard}`}
            </p>
          </div>

          {/* {terminology.session} Status & Presence */}
          <div className="flex items-center gap-4 mr-auto ml-4 hidden lg:flex">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] uppercase font-black tracking-widest border transition-all ${currentSessionId ? "bg-mondrian-blue/20 text-mondrian-blue border-mondrian-blue/30" : "bg-white/5 text-white/40 border-white/10"}`}
              title={`Historique des ${terminology.session}s`}
            >
              <Clock className="w-3 h-3" />
              {currentSessionId ? "Replay" : "Direct"}
            </button>

            <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-white/40 bg-white/5 px-2 py-1 rounded-full">
              <Users className="w-3 h-3" />
              {roomData?.connectedUsers?.length || 1}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className={`p-2 rounded-lg transition-all border flex items-center gap-2 ${copied ? "bg-mondrian-blue/20 text-mondrian-blue border-mondrian-blue/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white"}`}
              title={`Partager le lien de l'${terminology.assembly}`}
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              {copied && (
                <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">
                  Lien copié
                </span>
              )}
            </button>

            <button
              onClick={onToggleBoard}
              className={`p-2 rounded-lg transition-all border ${isBoardOpen ? "bg-mondrian-blue/20 text-mondrian-blue border-mondrian-blue/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white"}`}
              title={
                isBoardOpen
                  ? `Masquer la ${terminology.dashboard}`
                  : `Afficher la ${terminology.dashboard}`
              }
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowConstitution(true)}
              className="p-2 rounded-lg transition-all bg-white/5 text-white/40 hover:text-mondrian-blue group relative hidden sm:flex"
              title="Voir la Constitution d'Ophélia"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-[9px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 uppercase tracking-widest">
                Constitution
              </span>
            </button>
            <button
              onClick={() => {
                const nextSilent = !isSilent;
                setIsSilent(nextSilent);
                localStorage.setItem("inseme_silent", nextSilent ? "true" : "false");
              }}
              className={`p-2 rounded-lg transition-all ${isSilent ? "bg-mondrian-red/20 text-mondrian-red" : "bg-white/5 text-white/40 hover:text-white/60"}`}
              title={isSilent ? "Activer l'audio" : "Mode Silencieux"}
            >
              {isSilent ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                const nextHF = !isHandsFree;
                setIsHandsFree(nextHF);
                localStorage.setItem("inseme_hands_free", nextHF ? "true" : "false");
                if (!nextHF) {
                  // If turning off, make sure to stop any active recording
                  stopRecording();
                }
              }}
              className={`p-2 rounded-lg transition-all ${isHandsFree ? "bg-mondrian-yellow/20 text-mondrian-yellow border-mondrian-yellow/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white"}`}
              title={
                isHandsFree ? "Désactiver le mode mains-libres" : "Activer le mode mains-libres"
              }
            >
              <Headphones className="w-4 h-4" />
            </button>
            <button
              onClick={() => askOphélia()}
              disabled={isOphéliaThinking || isSpectator}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mondrian-blue/20 hover:bg-mondrian-blue/30 text-mondrian-blue text-xs font-bold transition-all border border-mondrian-blue/30 disabled:opacity-50 group"
            >
              <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline">DEMANDER À OPHÉLIA</span>
            </button>
          </div>
        </div>
      )}

      <AgendaPanel agenda={roomData?.agenda || []} updateAgenda={updateAgenda} variant={variant} />

      {showHistory && (
        <div className="absolute inset-0 z-30 bg-neutral-900/95 backdrop-blur-xl p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Clock className="w-5 h-5 text-mondrian-blue" />
              Historique des {terminology.session}s
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-white/40 hover:text-white uppercase text-[10px] font-bold tracking-widest"
            >
              Fermer
            </button>
          </div>
          <div className="space-y-4">
            {messages
              .filter((m) => m.metadata?.type === "report")
              .reverse()
              .map((report, i) => (
                <div
                  key={report.id || i}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-mondrian-blue/30 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-mondrian-blue font-bold text-sm">
                        {terminology.session} du {new Date(report.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-white/20 text-xs">
                        Clôture à {new Date(report.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-mondrian-blue/20 text-mondrian-blue text-xs font-bold hover:bg-mondrian-blue/30">
                      Voir le PV
                    </button>
                  </div>
                  <div className="text-white/40 text-xs line-clamp-3 font-mono">
                    {report.message.substring(0, 200)}...
                  </div>
                </div>
              ))}
            {messages.filter((m) => m.metadata?.type === "report").length === 0 && (
              <div className="text-center text-white/20 italic py-10">
                Aucun procès-verbal archivé pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
            <Bot className="w-12 h-12 opacity-10" />
            <div className="text-center">
              <p>Aucun message pour le moment.</p>
              <p className="text-xs">Ophélia écoute et attend le début du débat.</p>
            </div>
          </div>
        ) : (
          messages?.map((msg, i) => (
            <ChatMessage
              key={msg.id || i}
              msg={msg}
              i={i}
              roomName={roomName}
              roomMetadata={roomMetadata}
              archiveReport={archiveReport}
              ephemeralThoughts={ephemeralThoughts}
              messages={messages}
              user={user}
              castVote={castVote}
              sendMessage={sendMessage}
              playVocal={playVocal}
              vocalState={vocalState}
              isSilent={isSilent}
              isHandsFree={isHandsFree}
              variant={variant}
              terminology={terminology}
            />
          ))
        )}
      </div>

      <div className="relative z-20">
        {variant !== "minimal" && canInteract && (
          <div
            className={`absolute bottom-full right-4 mb-4 flex flex-col items-end gap-3 transition-all duration-300 origin-bottom ${showActionHub ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
          >
            <div className="flex flex-col gap-2 items-end">
              {canVote && (
                <button
                  onClick={() => {
                    onParole();
                    setShowActionHub(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 bg-mondrian-black border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-all shadow-xl"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Demander la parole
                  </span>
                  <div className="p-1.5 bg-white/5 rounded-full">
                    <Hand className="w-3.5 h-3.5" />
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  askOphélia();
                  setShowActionHub(false);
                }}
                className="flex items-center gap-3 px-4 py-2.5 bg-mondrian-blue/10 border border-mondrian-blue/20 rounded-full text-mondrian-blue hover:text-mondrian-blue hover:bg-mondrian-blue/20 transition-all shadow-xl"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Interroger Ophélia
                </span>
                <div className="p-1.5 bg-mondrian-blue/20 rounded-full">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </button>
              {canVote && (
                <button
                  onClick={() => {
                    castVote("blank");
                    setShowActionHub(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-xl"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Vote Blanc
                  </span>
                  <div className="p-1.5 bg-white/5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {variant !== "minimal" &&
          (canInteract ? (
            <form
              onSubmit={handleSend}
              className="p-4 bg-neutral-900/50 backdrop-blur-xl border-t border-white/10 flex flex-col gap-3 relative z-10"
            >
              {isRecording && (
                <div className="flex items-center justify-between px-2 py-1 bg-mondrian-red/10 border border-mondrian-red/20 rounded-lg animate-in fade-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-mondrian-red animate-pulse" />
                      <span className="text-[8px] font-bold text-mondrian-red uppercase tracking-tight">
                        Enregistrement
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 text-[9px] font-mono">
                      <span className="text-white/80">{formatTime(duration)}</span>

                      {timeLeft <= 10 && (
                        <div className="flex items-center gap-1 ml-1">
                          <span className="text-white/40 uppercase text-[7px]">Envoi</span>
                          <span
                            className={`font-bold ${timeLeft <= 5 ? "text-mondrian-red animate-pulse" : "text-white/60"}`}
                          >
                            {timeLeft}s
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={addTime}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 transition-all cursor-pointer"
                      title="+30s"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-1.5 rounded-md bg-mondrian-red/20 hover:bg-mondrian-red/30 text-mondrian-red transition-all cursor-pointer"
                      title="Annuler"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {attachment && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/20 group/preview">
                  <img
                    src={attachment.previewUrl}
                    alt="Attachment"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowActionHub(!showActionHub)}
                  className={`aspect-square flex items-center justify-center rounded-xl transition-all px-4 ${showActionHub ? "bg-white/10 text-white rotate-180" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                >
                  <Plus className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) {
                      fileInputRef.current?.click();
                    } else {
                      setIsCameraOpen(true);
                    }
                  }}
                  className="aspect-square flex items-center justify-center rounded-xl transition-all px-4 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  title={isMobile ? "Prendre une photo" : "Prendre une photo (Webcam)"}
                >
                  <Camera className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square flex items-center justify-center rounded-xl transition-all px-4 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  title="Joindre une image"
                >
                  <Image className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                />

                <div className="relative flex-1 group">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      userRole === "guest"
                        ? "Participez en tant qu'invité..."
                        : "Participez au débat..."
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-mondrian-blue/50 transition-all group-hover:border-white/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newSilent = !isSilent;
                        setIsSilent(newSilent);
                        localStorage.setItem("inseme_silent", newSilent ? "true" : "false");
                      }}
                      className={`p-2 rounded-lg transition-all ${isSilent ? "bg-white/5 text-white/20 hover:text-white/40" : "bg-mondrian-blue/10 text-mondrian-blue hover:bg-mondrian-blue/20"}`}
                      title={isSilent ? "Activer le son" : "Couper le son"}
                    >
                      {isSilent ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <TalkButton
                      vocalState={vocalState}
                      isRecording={isRecording}
                      isTranscribing={isTranscribing}
                      vocalError={vocalError}
                      transcriptionPreview={transcriptionPreview}
                      duration={duration}
                      startRecording={startRecording}
                      stopRecording={stopRecording}
                      isHandsFree={isHandsFree}
                      microMode={microMode}
                      onMicroModeChange={changeMicroMode}
                      size="sm"
                      showLabel={false}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="aspect-square flex items-center justify-center bg-mondrian-blue hover:bg-mondrian-blue/80 text-white rounded-xl transition-all shadow-lg shadow-mondrian-blue/20 px-4"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 bg-neutral-900/50 backdrop-blur-xl border-t border-white/10 text-center relative z-10 flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-[10px] font-black text-mondrian-blue uppercase tracking-[0.2em]">
                  <Eye className="w-3 h-3" />
                  Mode Spectateur
                </div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  Connectez-vous pour participer au débat
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    if (user) {
                      window.dispatchEvent(new CustomEvent("inseme-stop-spectating"));
                    } else {
                      window.dispatchEvent(
                        new CustomEvent("inseme-open-auth", {
                          detail: { mode: "anonymous" },
                        })
                      );
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-mondrian-blue hover:bg-mondrian-blue/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-mondrian-blue/20"
                >
                  {user ? "Participer" : "Accès Invité"}
                </button>
                {!user && (
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("inseme-open-auth", {
                          detail: { mode: "signin" },
                        })
                      )
                    }
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all active:scale-95"
                  >
                    Connexion
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {variant !== "minimal" && canInteract && (
        <MobileControls
          onParole={onParole}
          onVote={castVote}
          onDelegate={onDelegate}
          onToggleMic={isRecording ? stopRecording : startRecording}
          isRecording={isRecording}
          sessionStatus={roomData?.sessionStatus}
          vocalState={vocalState}
          isTranscribing={isTranscribing}
          vocalError={vocalError}
          transcriptionPreview={transcriptionPreview}
          duration={duration}
          startRecording={startRecording}
          stopRecording={stopRecording}
          isHandsFree={isHandsFree}
          setIsHandsFree={setIsHandsFree}
          isSilent={isSilent}
          setIsSilent={setIsSilent}
          canVote={canVote}
          showLifecycleOverlay={showLifecycleOverlay}
          lifecycleClosedMessage={lifecycleClosedMessage}
          barName={roomMetadata?.name || roomName || "Le Bar"}
          commune={roomMetadata?.settings?.commune || ""}
        />
      )}

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
