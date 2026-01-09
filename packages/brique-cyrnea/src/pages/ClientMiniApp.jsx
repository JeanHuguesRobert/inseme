// packages/brique-cyrnea/pages/ClientMiniApp.jsx

import React, { useState } from "react";
import {
  Music,
  Gamepad2,
  Mic,
  Heart,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
} from "@inseme/ui";
import { useInsemeContext, TalkButton, Chat } from "@inseme/room";

/* =========================
   BLOC CYRNEA (bar vivant)
   ========================= */
const CyrneaBlock = ({ color = "white", children, className = "", onClick }) => {
  const colorMap = {
    red: "bg-[#E10600] text-white",
    blue: "bg-[#0055A4] text-white",
    yellow: "bg-[#FFD500] text-black",
    black: "bg-black text-white",
    white: "bg-white text-black",
  };

  return (
    <div
      onClick={onClick}
      className={`
        border-4 border-black p-4 flex flex-col justify-between
        transition-all active:translate-x-1 active:translate-y-1
        ${colorMap[color]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/* =========================
   APP CLIENT BAR
   ========================= */
export default function ClientMiniApp({ roomId = "cyrnea-general" }) {
  const [activeTab, setActiveTab] = useState("music");

  const {
    castVote,
    roomData,
    messages,
    vocalState,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    duration,
  } = useInsemeContext();

  const activeChallenges = messages?.filter(
    (msg) => msg.type === "challenge_start" && msg.metadata?.status === "active"
  );

  return (
    <div className="min-h-screen bg-white text-black flex flex-col overflow-hidden">

      {/* HEADER : IDENTITÉ BAR */}
      <header className="p-4 border-b-4 border-black bg-[#E10600] text-white flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl uppercase italic tracking-tighter">
            Cyrnea Bar
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            À Corte · Ici, l’ambiance se construit ensemble
          </p>
        </div>

        <div className="flex border-4 border-black bg-white">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none border-r-2 border-black hover:bg-[#FFD500]"
            onClick={() => castVote("vibe:up")}
          >
            <ThumbsUp className="w-4 h-4 text-black" strokeWidth={3} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none hover:bg-black hover:text-white"
            onClick={() => castVote("vibe:down")}
          >
            <ThumbsDown className="w-4 h-4" strokeWidth={3} />
          </Button>
        </div>
      </header>

      {/* CONTENU */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs
          defaultValue="music"
          className="flex-1 flex flex-col"
          onValueChange={setActiveTab}
        >
          <TabsList className="grid grid-cols-3 bg-black border-b-4 border-black">
            <TabsTrigger value="music" className="font-black uppercase">
              <Music className="w-4 h-4 mr-2" /> Musique
            </TabsTrigger>
            <TabsTrigger value="games" className="font-black uppercase">
              <Gamepad2 className="w-4 h-4 mr-2" /> Jeux
            </TabsTrigger>
            <TabsTrigger value="ophelia" className="font-black uppercase">
              <Mic className="w-4 h-4 mr-2" /> Ophélia
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 p-4 overflow-hidden">

            {/* MUSIQUE */}
            <TabsContent value="music" className="space-y-4">
              {[{
                id: 1,
                title: "L'Orchestra",
                artist: "Canta u Populu Corsu",
                votes: 12,
              }].map((m) => (
                <CyrneaBlock key={m.id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-black text-xl uppercase">{m.title}</p>
                      <p className="text-[10px] uppercase opacity-60">
                        {m.artist}
                      </p>
                    </div>
                    <Button
                      className="border-4 border-black bg-white hover:bg-[#FFD500]"
                      onClick={() => castVote(`music:${m.id}`)}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          roomData.votes?.[`music:${m.id}`]
                            ? "text-[#E10600] fill-[#E10600]"
                            : "text-black"
                        }`}
                        strokeWidth={3}
                      />
                      <span className="ml-2 font-black">
                        {m.votes + (roomData.results?.[`music:${m.id}`] || 0)}
                      </span>
                    </Button>
                  </div>
                </CyrneaBlock>
              ))}
            </TabsContent>

            {/* OPHÉLIA */}
            <TabsContent value="ophelia" className="flex flex-col space-y-4">
              <div className="border-4 border-black flex-1 flex flex-col">
                <div className="bg-black text-white text-[10px] uppercase font-black p-2">
                  Ophélia · La voix du bar
                </div>
                <Chat variant="minimal" className="flex-1" />
              </div>

              <div className="border-4 border-black bg-[#FFD500] flex justify-center py-4">
                <TalkButton
                  size="lg"
                  vocalState={vocalState}
                  isRecording={isRecording}
                  isTranscribing={isTranscribing}
                  startRecording={startRecording}
                  stopRecording={stopRecording}
                  duration={duration}
                />
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </main>
    </div>
  );
}
