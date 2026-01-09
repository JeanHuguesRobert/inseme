import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Music,
  MessageSquare,
  Trophy,
  Play,
  SkipForward,
  CheckCircle,
  Zap,
  Coffee,
  Radio,
  Volume2,
  Mic,
} from "lucide-react";
import { Card, Button, Badge, Progress, Avatar, Tooltip } from "@inseme/ui";
import { useInsemeContext, TalkButton, OPHELIA_ID } from "@inseme/room";

/**
 * BarmanDashboard - Mode "Henry & Jean-Marie"
 * Refactorisé pour intégrer le coeur Inseme (Chat/Vocal)
 */
const MondrianBlock = ({ color = "white", children, className = "", onClick }) => {
  const colorMap = {
    red: "bg-[#E10600] text-white",
    blue: "bg-[#0055A4] text-white",
    yellow: "bg-[#FFD500] text-black",
    black: "bg-black text-white",
    white: "bg-white text-black",
    gray: "bg-slate-100 text-black",
  };

  return (
    <div
      onClick={onClick}
      className={`
        border-4 border-black p-4 flex flex-col justify-between transition-all
        ${colorMap[color] || colorMap.white}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default function BarmanDashboard() {
  const {
    messages,
    activeSpeakers,
    sendMessage,
    vocalState,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    isHandsFree,
    duration,
    roomData,
    castVote,
  } = useInsemeContext();

  // Calcul du Vibe Score basé sur les résultats des votes "vibe"
  // On simule une valeur de base de 70 + l'impact des votes récents
  const vibeScore = useMemo(() => {
    const base = 70;
    const votes = roomData?.results || {};
    const positive = votes["vibe:up"] || 0;
    const negative = votes["vibe:down"] || 0;
    const score = base + positive * 5 - negative * 5;
    return Math.max(0, Math.min(100, score));
  }, [roomData?.results]);

  const handleStartChallenge = (gameName, target) => {
    sendMessage(`[SYSTÈME] : Nouveau défi ${gameName} lancé pour ${target} !`, {
      type: "challenge_start",
      metadata: { game: gameName, target, status: "active" },
    });
  };

  const handleVibeCheck = () => {
    sendMessage("inseme vote vibe", {
      type: "vibe_check",
      metadata: { is_flash_poll: true },
    });
  };

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-mono">
      {/* Header Mondrian Style */}
      <header className="flex flex-col md:flex-row justify-between items-stretch mb-8 border-4 border-black bg-white">
        <div className="bg-[#E10600] text-white p-6 flex-1 border-b-4 md:border-b-0 md:border-r-4 border-black">
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">
            Cyrnea Dashboard
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">
            Mode Barman — Henry & Jean-Marie
          </p>
        </div>
        
        <div className="flex flex-row md:flex-col lg:flex-row divide-x-4 md:divide-x-0 lg:divide-x-4 divide-black bg-white">
          <div className="flex-1 p-6 flex flex-col justify-center items-center bg-[#FFD500]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Users className="w-6 h-6 text-black" />
                {activeSpeakers?.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse border-2 border-black" />
                )}
              </div>
              <span className="text-xl font-black uppercase">
                {activeSpeakers?.length || 0} Actifs
              </span>
            </div>
          </div>
          <div className="p-6 flex items-center justify-center bg-black text-white">
            <Badge
              variant="outline"
              className="text-white border-white rounded-none border-2 font-black uppercase tracking-widest animate-pulse"
            >
              ● Live
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne Gauche: Ambiance & Musique */}
        <div className="space-y-8">
          {/* Vibe Score Block */}
          <MondrianBlock color="white">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Zap className="w-6 h-6 text-[#E10600]" strokeWidth={3} />
                Ambiance
              </h2>
              <div className="bg-black text-white px-3 py-1 text-2xl font-black">
                {vibeScore}%
              </div>
            </div>
            
            <div className="border-4 border-black h-8 bg-slate-100 mb-6 overflow-hidden">
              <div 
                className="h-full bg-[#0055A4] transition-all duration-500" 
                style={{ width: `${vibeScore}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 border-4 border-black rounded-none bg-[#E10600] text-white hover:bg-[#E10600]/90 font-black uppercase transition-all"
                onClick={() => castVote("vibe:up")}
              >
                <Zap className="w-5 h-5 mr-2" strokeWidth={3} />
                Booster
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 border-4 border-black rounded-none bg-[#0055A4] text-white hover:bg-[#0055A4]/90 font-black uppercase transition-all"
                onClick={() => castVote("vibe:down")}
              >
                <Volume2 className="w-5 h-5 mr-2" strokeWidth={3} />
                Calmer
              </Button>
            </div>
          </MondrianBlock>

          {/* Playlist Block */}
          <MondrianBlock color="blue">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Music className="w-6 h-6" strokeWidth={3} />
              Playlist
            </h2>
            <div className="bg-white text-black border-4 border-black p-4 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                En cours
              </p>
              <p className="text-lg font-black uppercase leading-tight">I Muvrini - Terra</p>
            </div>
            <Button className="w-full bg-black text-white rounded-none border-4 border-black hover:bg-slate-900 h-auto py-3 font-black uppercase tracking-widest transition-all">
              <SkipForward className="w-5 h-5 mr-2" /> Suivant
            </Button>
          </MondrianBlock>

          {/* Antenne Barman Block */}
          <MondrianBlock color="yellow">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Radio className="w-6 h-6" strokeWidth={3} />
              Antenne Directe
            </h2>
            <div className="bg-white border-4 border-black p-4 flex items-center gap-4">
              <TalkButton
                vocalState={vocalState}
                isRecording={isRecording}
                isTranscribing={isTranscribing}
                duration={duration}
                startRecording={startRecording}
                stopRecording={stopRecording}
                isHandsFree={isHandsFree}
                size="md"
                className="scale-110"
              />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  Henry & Jean-Marie
                </p>
                <p className="text-[9px] font-bold uppercase opacity-60 italic text-black">
                  Diffuser au salon
                </p>
              </div>
            </div>
          </MondrianBlock>
        </div>

        {/* Colonne Droite: Live Feed & Défis */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Défis Flash */}
            <MondrianBlock color="white">
              <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[#FFD500]" strokeWidth={3} />
                Défis Flash
              </h2>
              <div className="space-y-4">
                {[
                  { name: "Cartes", target: "Table 5", color: "red" },
                  { name: "Macagna", target: "Général", color: "blue" }
                ].map((challenge) => (
                  <div key={challenge.name} className="flex items-center justify-between border-4 border-black bg-white p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 border-4 border-black flex items-center justify-center ${challenge.color === 'red' ? 'bg-[#E10600]' : 'bg-[#0055A4]'} text-white`}>
                        {challenge.color === 'red' ? <Zap className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase leading-none mb-1">
                          {challenge.name}
                        </p>
                        <p className="text-[10px] font-bold uppercase opacity-60">{challenge.target}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border-4 border-black rounded-none font-black uppercase hover:bg-[#FFD500] px-4 transition-all"
                      onClick={() => handleStartChallenge(challenge.name, challenge.target)}
                    >
                      Lancer
                    </Button>
                  </div>
                ))}
              </div>
            </MondrianBlock>

            {/* Commandes Web */}
            <MondrianBlock color="white" className="border-t-[#E10600] border-t-[12px]">
              <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Coffee className="w-6 h-6 text-black" strokeWidth={3} />
                Commandes
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 border-4 border-black bg-[#FFD500] font-black uppercase text-xs">
                  <span>Table 4 — 2 Pastis</span>
                  <span className="bg-black text-white px-2 py-0.5 animate-pulse">NEW</span>
                </div>
                <div className="flex justify-center p-8 border-4 border-black border-dashed opacity-40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">
                    Fin de liste
                  </p>
                </div>
              </div>
            </MondrianBlock>
          </div>

          {/* Live Macagna Chat */}
          <MondrianBlock color="white" className="h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-[#0055A4]" strokeWidth={3} />
                Live Macagna
              </h2>
              <div className="bg-black text-white px-4 py-1 text-xs font-black uppercase tracking-widest">
                Direct Salon
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 border-4 border-black bg-slate-50 p-4 mb-4 custom-scrollbar">
              {messages?.slice(-20).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 p-3 border-4 border-black bg-white ${
                    msg.user_id === OPHELIA_ID ? "border-[#E10600]" : ""
                  }`}
                >
                  <div className={`w-10 h-10 border-4 border-black flex-shrink-0 flex items-center justify-center text-sm font-black uppercase ${
                    msg.user_id === OPHELIA_ID ? "bg-[#E10600] text-white" : "bg-black text-white"
                  }`}>
                    {msg.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase tracking-tight">
                        {msg.name}
                      </span>
                      <span className="text-[9px] font-bold uppercase opacity-40">
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString()
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-black/80 leading-tight">
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <input
                className="flex-1 bg-white border-4 border-black px-4 py-3 text-sm font-bold uppercase tracking-tight focus:bg-[#FFD500] transition-colors outline-none"
                placeholder="Message staff..."
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    sendMessage(e.target.value);
                    e.target.value = "";
                  }
                }}
              />
              <Button className="bg-black text-white rounded-none border-4 border-black hover:bg-[#E10600] h-auto px-8 font-black uppercase transition-all">
                Envoyer
              </Button>
            </div>
          </MondrianBlock>
        </div>
      </div>
    </div>
  );
}
