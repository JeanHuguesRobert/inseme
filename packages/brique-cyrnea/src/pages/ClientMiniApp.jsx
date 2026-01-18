// packages/brique-cyrnea/pages/ClientMiniApp.jsx

import React, { useState, useEffect, useMemo } from "react";
import {
  Music,
  Gamepad2,
  Mic,
  MicOff,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Volume2,
  VolumeX,
  Radio,
  Camera,
  Image,
  X,
  Send,
  MapPin,
  Wind,
  Home,
  Coffee,
  Users,
  Briefcase,
  Sparkles,
  Globe,
  Map,
  BookOpen,
  Trophy,
  Share2,
  QrCode,
  Activity,
  Headphones,
  Moon,
  Coins,
  DollarSign,
  User,
  CreditCard,
  Smartphone,
  Handshake,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Newspaper,
} from "lucide-react";
import { Button } from "@inseme/ui";
import { useInsemeContext, TalkButton, Chat, MondrianBlock, CameraModal } from "@inseme/room";
import { storage } from "@inseme/cop-host";
import { GAMES } from "../lib/gameManager";

/* =========================
   COMPOSANTS UI MONDRIAN
   ========================= */

const MondrianTabTrigger = ({ isActive, onClick, color, icon: Icon, label }) => (
  <MondrianBlock
    color={isActive ? color : "white"}
    className={`
      flex flex-col items-center justify-center p-4 transition-all duration-300
      ${isActive ? "flex-1" : "hover:bg-slate-100"}
      cursor-pointer border-t-8 border-x-4 border-b-0 border-black
      active:bg-black active:text-white
    `}
    onClick={onClick}
  >
    <Icon
      className={`w-8 h-8 mb-2 ${isActive ? "scale-110" : "opacity-60"}`}
      strokeWidth={isActive ? 3 : 2}
    />
    <span className="font-black text-[10px] md:text-xs tracking-widest">{label}</span>
  </MondrianBlock>
);

const GameBlock = ({ game, color, onSignal }) => (
  <MondrianBlock
    color={color}
    className="border-8 border-black min-h-[200px] relative hover:scale-[1.02] transition-transform duration-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
    onClick={() => onSignal(game.id)}
  >
    <div className="absolute top-4 right-4 text-6xl opacity-20 rotate-12 pointer-events-none">
      {game.icon}
    </div>

    <div className="relative z-10 flex flex-col h-full justify-between">
      <div>
        <h3 className="text-4xl font-black italic tracking-tighter leading-none mb-4 mix-blend-hard-light">
          {game.label}
        </h3>
        <p className="text-xs font-bold border-l-4 border-black pl-3 leading-relaxed max-w-[80%]">
          {game.description}
        </p>
      </div>

      <div className="flex justify-between items-end mt-6">
        <span className="bg-black text-white text-[10px] font-black uppercase px-2 py-1">
          {game.reward}
        </span>
        <div className="bg-white border-4 border-black p-2 hover:bg-black hover:text-white transition-colors cursor-pointer">
          <span className="font-black uppercase text-xs">JOUER</span>
        </div>
      </div>
    </div>
  </MondrianBlock>
);

const normalizePublicLink = (link) => {
  if (!link) return link;
  const label = typeof link.label === "string" ? link.label.trim() : "";
  let url = typeof link.url === "string" ? link.url.trim() : "";
  if (!url) return { ...link, label, url };

  const lowerUrl = url.toLowerCase();
  const lowerLabel = label.toLowerCase();

  const isFacebook =
    lowerLabel.includes("facebook") ||
    lowerLabel === "fb" ||
    lowerUrl.includes("facebook.com") ||
    lowerUrl.includes("fb.com");
  const isInstagram =
    lowerLabel.includes("instagram") ||
    lowerLabel.includes("insta") ||
    lowerUrl.includes("instagram.com");

  if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
    const looksLikeEmail =
      lowerUrl.includes("@") && !lowerUrl.includes(" ") && !lowerUrl.startsWith("mailto:");
    const digits = url.replace(/[\s().-]/g, "").replace(/^\+/, "");
    const looksLikePhone =
      !lowerUrl.startsWith("tel:") && digits.length >= 6 && /^\d+$/.test(digits);

    if (looksLikeEmail) {
      url = `mailto:${url}`;
      return {
        ...link,
        label: label || "Email",
        url,
      };
    }

    if (looksLikePhone) {
      const compact = url.replace(/\s+/g, "");
      url = `tel:${compact}`;
      return {
        ...link,
        label: label || "Téléphone",
        url,
      };
    }

    if (isFacebook) {
      const handle = url
        .replace(/^@/, "")
        .replace(/^facebook\.com\//i, "")
        .replace(/^fb\.com\//i, "")
        .replace(/^www\.facebook\.com\//i, "");
      url = `https://www.facebook.com/${handle}`;
      return {
        ...link,
        label: label || "Facebook",
        url,
      };
    }

    if (isInstagram) {
      const handle = url
        .replace(/^@/, "")
        .replace(/^instagram\.com\//i, "")
        .replace(/^www\.instagram\.com\//i, "");
      const stripped = handle.replace(/\/+$/, "");
      url = `https://www.instagram.com/${stripped}/`;
      return {
        ...link,
        label: label || "Instagram",
        url,
      };
    }

    if (/[a-z0-9-]+\.[a-z]{2,}/.test(lowerUrl)) {
      url = `https://${url}`;
      return {
        ...link,
        label,
        url,
      };
    }

    return { ...link, label, url };
  }

  if (isFacebook) {
    url = url
      .replace(/^https?:\/\/facebook\.com\//i, "https://www.facebook.com/")
      .replace(/^https?:\/\/m\.facebook\.com\//i, "https://www.facebook.com/")
      .replace(/^https?:\/\/fb\.com\//i, "https://www.facebook.com/");
    return {
      ...link,
      label: label || "Facebook",
      url,
    };
  }

  if (isInstagram) {
    url = url
      .replace(/^https?:\/\/instagram\.com\//i, "https://www.instagram.com/")
      .replace(/^https?:\/\/www\.instagram\.com\//i, "https://www.instagram.com/");
    if (!url.endsWith("/")) {
      url = `${url}/`;
    }
    return {
      ...link,
      label: label || "Instagram",
      url,
    };
  }

  return { ...link, label, url };
};

/* =========================
   SCREENS
   ========================= */

const LegendsScreen = ({ legends }) => (
  <div className="h-full flex flex-col pt-4 px-4 pb-4">
    <MondrianBlock
      color="white"
      className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-3 flex items-center justify-between border-b-4 border-black">
        <h2 className="text-xl font-black italic tracking-tighter uppercase">Livre des Légendes</h2>
        <Trophy className="w-5 h-5 text-mondrian-yellow" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]">
        {legends.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
            <Sparkles className="w-12 h-12 mb-4" />
            <p className="font-black uppercase text-sm">
              Aucune légende pour l'instant... Soyez brillants !
            </p>
          </div>
        ) : (
          legends
            .slice()
            .reverse()
            .map((legend, i) => (
              <div
                key={i}
                className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative group animate-in zoom-in duration-300"
              >
                <div className="absolute -top-3 -left-3 bg-mondrian-yellow text-black border-4 border-black px-2 py-0.5 text-[10px] font-black uppercase rotate-[-5deg]">
                  {legend.author}
                </div>
                <p className="text-lg font-black leading-tight italic mt-2">
                  "{legend.original_message}"
                </p>
                {legend.image_url && (
                  <img
                    src={legend.image_url}
                    alt="Légende"
                    className="mt-4 border-4 border-black w-full grayscale hover:grayscale-0 transition-all"
                  />
                )}
                <div className="text-[8px] font-bold opacity-40 mt-4 text-right uppercase">
                  {new Date(legend.timestamp).toLocaleTimeString()} • {legend.barName || "Bar"}
                </div>
              </div>
            ))
        )}
      </div>
    </MondrianBlock>
  </div>
);

const CityScreen = ({ commune, roomMetadata }) => {
  const barName = roomMetadata?.name || "Le Bar";
  const barSlug = roomMetadata?.slug || "bar";
  const settings = roomMetadata?.settings || {};
  const facebookUrl = settings.facebook_url;
  const instagramUrl = settings.instagram_url;
  const customLinks = Array.isArray(settings.custom_links)
    ? settings.custom_links.filter(
        (link) =>
          link &&
          typeof link.label === "string" &&
          typeof link.url === "string" &&
          link.label.trim() &&
          link.url.trim()
      )
    : [];

  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4">
      <MondrianBlock
        color="white"
        className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        <div
          className={`bg-mondrian-blue text-white p-4 flex items-center justify-between border-b-8 border-black`}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">
              Ma Commune
            </p>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
              {commune || "Ville"}
            </h2>
          </div>
          <Map className="w-8 h-8" />
        </div>

        <div className="flex-1 p-6 space-y-6 bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px] flex flex-col justify-center">
          <p className="text-[10px] font-bold border-l-4 border-black pl-3 leading-relaxed uppercase">
            L'application {barName} est connectée aux services citoyens de votre ville. Retrouvez
            l'actualité locale et la mémoire collective.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {/* GAZETTE VILLE */}
            <a
              href={`/gazette/${commune || "global"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div
                className={`relative bg-mondrian-yellow border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform`}
              >
                <div className="bg-black text-white p-2 border-2 border-black">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">La Gazette</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Journal de la ville de {commune || "Ville"}
                  </p>
                </div>
              </div>
            </a>

            {/* GAZETTE DU BAR */}
            <a
              href={`/gazette/${barSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                <div className="bg-black text-white p-2 border-2 border-black">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">Gazette du Bar</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Moments choisis du {barName}
                  </p>
                </div>
              </div>
            </a>

            {/* WIKI LOCAL */}
            <a
              href={`/wiki/${commune || "commune"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                <div className="bg-black text-white p-2 border-2 border-black">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">Wiki Local</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Savoirs & Histoire de la région
                  </p>
                </div>
              </div>
            </a>

            <a
              href={`/blog/${barSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div
                className={`relative bg-mondrian-red text-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform`}
              >
                <div className={`bg-black text-mondrian-red p-2 border-2 border-black`}>
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">Le Journal du Bar</h4>
                  <p className="text-[8px] font-bold uppercase opacity-80">
                    Les coulisses de {barName}
                  </p>
                </div>
              </div>
            </a>
          </div>

          {(facebookUrl || instagramUrl || customLinks.length > 0) && (
            <div className="space-y-3">
              <p className="text-[8px] font-black uppercase opacity-60">
                Présence en ligne du {barName}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
                    <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                      <div className="bg-black text-white p-2 border-2 border-black">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase leading-none">
                          Facebook du Bar
                        </h4>
                        <p className="text-[8px] font-bold uppercase opacity-60">
                          Rejoindre la page Facebook du {barName}
                        </p>
                      </div>
                    </div>
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
                    <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                      <div className="bg-black text-white p-2 border-2 border-black">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase leading-none">
                          Instagram du Bar
                        </h4>
                        <p className="text-[8px] font-bold uppercase opacity-60">
                          Découvrir les photos du {barName}
                        </p>
                      </div>
                    </div>
                  </a>
                )}
                {customLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
                    <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                      <div className="bg-black text-white p-2 border-2 border-black">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase leading-none">{link.label}</h4>
                        <p className="text-[8px] font-bold uppercase opacity-60">
                          Ouvrir le lien dans le navigateur
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 border-t-2 border-black/10">
            <p className="text-[8px] font-black uppercase text-center opacity-40">
              Une plateforme pour les citoyens par les citoyens
            </p>
          </div>
        </div>
      </MondrianBlock>
    </div>
  );
};

const GameInterface = ({ game, sendMessage, pseudo }) => {
  const { gameId, gameState } = game.metadata;
  const gamePack = GAMES[gameId];
  const [input, setInput] = useState("");

  // Gestion des sons (Audio Hints)
  useEffect(() => {
    if (gameState?.audio_hint) {
      const audioMap = {
        victory_fanfare: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
        success_chime: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
        action_pop: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
        ia_thinking: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
      };

      const soundUrl = audioMap[gameState.audio_hint];
      if (soundUrl) {
        const audio = new Audio(soundUrl);
        audio.volume = 0.4;
        audio.play().catch((e) => console.warn("Audio play blocked:", e));
      }
    }
  }, [gameState?.audio_hint]);

  const handleAction = async (type, payload = {}) => {
    sendMessage(`[ACTION JEU] : ${pseudo} - ${type}`, {
      type: "game_action",
      metadata: {
        gameId,
        action: { type, payload, actorId: pseudo },
      },
    });
    setInput("");
  };

  if (!gamePack) return null;

  return (
    <MondrianBlock
      color="white"
      className="border-8 border-black p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex items-center gap-2 border-b-4 border-black pb-2">
        <span className="text-4xl">{gamePack.meta.icon}</span>
        <div className="flex-1">
          <h3 className="font-black uppercase text-xl leading-none">{gamePack.meta.label}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-black text-white text-[8px] font-black px-1 uppercase">
              {gameState.phase}
            </span>
            {gameState.next_input_source === "HUMAN" && (
              <span className="bg-mondrian-blue text-white text-[8px] font-black px-1 uppercase animate-pulse">
                À VOUS DE JOUER
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-black text-white p-3 font-bold text-sm italic border-l-8 border-mondrian-yellow relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1 opacity-20">
          <Radio className="w-4 h-4" />
        </div>
        "{gameState.broadcast_msg}"
      </div>

      {/* Grid Display for Mots Croisés */}
      {gameState.display?.type === "GRID" && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase opacity-60">Grille Collective :</p>
          <div
            className="grid gap-1 border-4 border-black p-1 bg-black"
            style={{
              gridTemplateColumns: `repeat(${gameState.display.size}, 1fr)`,
            }}
          >
            {gameState.display.data.map((cell, i) => (
              <div
                key={i}
                onClick={() => {
                  if (gameState.phase === "GAME_OVER") return;
                  const val = window.prompt("Entrez une lettre :");
                  if (val && val.length === 1)
                    handleAction("FILL_CELL", {
                      index: i,
                      value: val.toUpperCase(),
                    });
                }}
                className={`aspect-square flex items-center justify-center font-black text-lg border-2 border-black cursor-pointer transition-all ${
                  cell === "empty"
                    ? "bg-white hover:bg-mondrian-yellow"
                    : "bg-mondrian-blue text-white scale-[0.95]"
                } ${gameState.phase === "GAME_OVER" ? "cursor-not-allowed opacity-80" : ""}`}
              >
                {cell === "empty" ? "" : cell}
              </div>
            ))}
          </div>
        </div>
      )}

      {gameId === "pictionary_social" && (
        <div className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Décrivez votre dessin ou devinez..."
            className="w-full border-4 border-black p-3 font-black uppercase text-sm focus:outline-none focus:bg-mondrian-yellow transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleAction("GUESS", { word: input })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleAction("DRAW", { description: input })}
              className="bg-mondrian-red text-white border-4 border-black font-black uppercase hover:translate-x-1 hover:translate-y-1 transition-transform"
              disabled={!input.trim()}
            >
              Dessiner
            </Button>
            <Button
              onClick={() => handleAction("GUESS", { word: input })}
              className="bg-mondrian-blue text-white border-4 border-black font-black uppercase hover:translate-x-1 hover:translate-y-1 transition-transform"
              disabled={!input.trim()}
            >
              Deviner
            </Button>
          </div>
        </div>
      )}

      {/* Score / Leveling */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-center bg-slate-50 p-2">
        <div className="flex items-center gap-1">
          <Trophy className="w-3 h-3 text-mondrian-yellow" strokeWidth={4} />
          <span className="font-black text-[10px] uppercase">
            Niveau {gameState.leveling?.[pseudo] || 1}
          </span>
        </div>
        <span className="font-black text-[10px] uppercase">
          Score: {gameState.scores?.[pseudo] || 0} pts
        </span>
      </div>
    </MondrianBlock>
  );
};

const GamesScreen = ({ activeGames, castVote, sendMessage, pseudo }) => {
  const latestGame = activeGames?.find((g) => g.type === "game_start");

  return (
    <div className="p-4 space-y-8 pb-32">
      <div className="flex items-center gap-4 mb-8">
        <div className={`bg-mondrian-yellow w-4 h-full min-h-[60px] border-4 border-black`} />
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter">Arcade</h2>
          <p className="text-xs font-bold opacity-60">Défiez le bar</p>
        </div>
      </div>

      {latestGame ? (
        <GameInterface game={latestGame} sendMessage={sendMessage} pseudo={pseudo} />
      ) : (
        <>
          {activeGames?.length > 0 && (
            <div
              className={`bg-mondrian-red border-8 border-black p-6 mb-8 text-white relative animate-pulse shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`}
            >
              <h3 className="text-2xl font-black uppercase text-center mb-2">★ Défi en cours ★</h3>
              <div className="text-center font-bold uppercase text-sm">
                Rejoignez {activeGames[0].metadata?.game || activeGames[0].metadata?.gameId} !
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {Object.values(GAMES).map((game, i) => (
              <GameBlock
                key={game.id}
                game={{
                  id: game.id,
                  icon: game.meta.icon,
                  label: game.meta.label,
                  description: game.meta.description,
                  reward: game.meta.reward,
                }}
                color={i % 2 === 0 ? "blue" : "yellow"}
                onSignal={(id) => castVote(`game_signal:${id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ProfileScreen = ({
  context,
  pseudo,
  zone,
  isBarman,
  roomMetadata,
  onEditPseudo,
  onOpenBarmanModal,
  onZoneChange,
  publicLinks,
  onPublicLinksChange,
}) => {
  const barName = roomMetadata?.name || "Bar";
  const commune = roomMetadata?.settings?.commune || "Ville";
  const nativeLang = context.nativeLang;
  const isHandsFree = context.isHandsFree;
  const isSilent = context.isSilent;
  const gabrielEnabled = context.gabrielConfig?.enabled;

  const safePublicLinks = Array.isArray(publicLinks) ? publicLinks : [];

  const handleAddPublicLink = () => {
    const next = [...safePublicLinks, { label: "", url: "" }];
    if (onPublicLinksChange) onPublicLinksChange(next);
  };

  const handlePublicLinkChange = (index, field, value) => {
    const base = Array.isArray(publicLinks) ? publicLinks : [];
    const next = base.map((link, i) => (i === index ? { ...link, [field]: value } : link));
    if (onPublicLinksChange) onPublicLinksChange(next);
  };

  const handleRemovePublicLink = (index) => {
    const base = Array.isArray(publicLinks) ? publicLinks : [];
    const next = base.filter((_, i) => i !== index);
    if (onPublicLinksChange) onPublicLinksChange(next);
  };

  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4">
      <MondrianBlock
        color="white"
        className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        <div className="bg-black text-white p-4 border-b-8 border-black flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
              Mon Profil
            </p>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
              Identité & Rôles
            </h2>
          </div>
          <User className="w-8 h-8" />
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]">
          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Client
            </h3>
            <div className="space-y-2 text-[10px] font-bold uppercase">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Pseudo</span>
                <button
                  onClick={onEditPseudo}
                  className="px-2 py-1 border-2 border-black bg-mondrian-yellow text-black font-black tracking-widest"
                >
                  {pseudo || "Choisir un pseudo"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Zone</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onZoneChange("indoor")}
                    className={`px-2 py-1 border-2 border-black font-black ${
                      zone === "indoor" ? "bg-mondrian-blue text-white" : "bg-white text-black"
                    }`}
                  >
                    Intérieur
                  </button>
                  <button
                    onClick={() => onZoneChange("outdoor")}
                    className={`px-2 py-1 border-2 border-black font-black ${
                      zone === "outdoor" ? "bg-mondrian-red text-white" : "bg-white text-black"
                    }`}
                  >
                    Extérieur
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Langue</span>
                <span className="px-2 py-1 border-2 border-black bg-white">
                  {nativeLang === "fr" ? "Français" : "Anglais"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Mains libres</span>
                <span className="px-2 py-1 border-2 border-black bg-white">
                  {isHandsFree ? "Activé" : "Désactivé"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Mode silencieux</span>
                <span className="px-2 py-1 border-2 border-black bg-white">
                  {isSilent ? "Activé" : "Désactivé"}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Barman
            </h3>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="opacity-60">Statut {isBarman ? "actuel" : "possible"}</span>
              <button
                onClick={onOpenBarmanModal}
                className={`px-3 py-1 border-2 border-black font-black ${
                  isBarman ? "bg-mondrian-yellow text-black" : "bg-white text-black"
                }`}
              >
                {isBarman ? "Modifier mes infos" : "Me déclarer barman"}
              </button>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              Bar
            </h3>
            <div className="space-y-1 text-[10px] font-bold uppercase">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Nom</span>
                <span className="px-2 py-1 border-2 border-black bg-white">{barName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Commune</span>
                <span className="px-2 py-1 border-2 border-black bg-white">{commune}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">Agent Gabriel</span>
                <span className="px-2 py-1 border-2 border-black bg-white">
                  {gabrielEnabled ? "Activé (privé)" : "Désactivé"}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Carte de liens publique
            </h3>
            <p className="text-[9px] font-bold uppercase opacity-60 mb-3">
              Ces liens sont sous ton contrôle et peuvent être partagés publiquement.
            </p>
            <div className="space-y-2">
              {safePublicLinks.map((link, index) => (
                <div key={index} className="grid grid-cols-[1fr_1.2fr_auto] gap-2 items-center">
                  <input
                    value={link.label || ""}
                    onChange={(e) => handlePublicLinkChange(index, "label", e.target.value)}
                    placeholder="Nom"
                    className="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase tracking-tighter focus:bg-mondrian-yellow/10 outline-none"
                  />
                  <input
                    value={link.url || ""}
                    onChange={(e) => handlePublicLinkChange(index, "url", e.target.value)}
                    placeholder="Lien"
                    className="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase tracking-tighter focus:bg-mondrian-yellow/10 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePublicLink(index)}
                    className="border-2 border-black px-2 py-1 text-[10px] font-black uppercase bg-black text-white hover:bg-mondrian-red transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddPublicLink}
                className="border-2 border-dashed border-black px-3 py-1 text-[10px] font-black uppercase bg-white hover:bg-mondrian-yellow/20 transition-colors"
              >
                Ajouter un lien
              </button>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Mentions Légales
            </h3>
            <div className="space-y-2">
              <a
                href="/briques/democracy/legal/terms-of-use.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Conditions Générales d'Utilisation
                </span>
                <Globe className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </a>
              <a
                href="/briques/democracy/legal/privacy-policy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Politique de Confidentialité
                </span>
                <Globe className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </section>
        </div>
      </MondrianBlock>
    </div>
  );
};

/* =========================
   OPHELIA SCREEN COMPONENTS
   ========================= */

const OpheliaHeader = ({
  isGabrielMode,
  onToggleGabriel,
  showGabrielSettings,
  onToggleSettings,
  isAfter,
  gabrielConfigured,
}) => (
  <div
    className={`p-3 flex justify-between items-center text-white border-b-4 shrink-0 transition-colors duration-1000 ${isAfter ? "bg-black border-mondrian-blue/30" : "bg-black border-black"}`}
  >
    <div className="flex items-center gap-2">
      {!isAfter ? (
        <>
          {gabrielConfigured ? (
            <>
              <button
                onClick={onToggleGabriel}
                className={`px-2 py-0.5 border-2 border-white text-[10px] font-black uppercase transition-colors ${
                  !isGabrielMode ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                Ophélia
              </button>
              <button
                onClick={onToggleGabriel}
                className={`px-2 py-0.5 border-2 border-white text-[10px] font-black uppercase transition-colors ${
                  isGabrielMode ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                Gabriel
              </button>
            </>
          ) : (
            <div className="px-2 py-0.5 border-2 border-white bg-white text-black text-[10px] font-black uppercase">
              Ophélia
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-mondrian-blue animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-mondrian-blue">
            Mode After
          </span>
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => (window.location.href = window.location.pathname.replace("/app", "/vocal"))}
        className="p-1 hover:bg-white hover:text-black transition-colors rounded border border-transparent hover:border-black"
        title="Dialogue Vocal"
      >
        <Volume2 className="w-4 h-4" />
      </button>
      <button
        onClick={onToggleSettings}
        className="p-1 hover:bg-white hover:text-black transition-colors rounded border border-transparent hover:border-black"
      >
        <Zap className={`w-4 h-4 ${showGabrielSettings ? "fill-current" : ""}`} />
      </button>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-mondrian-red rounded-full border border-black/20" />
        <div className="w-2 h-2 bg-mondrian-yellow rounded-full border border-black/20" />
        <div className="w-2 h-2 bg-mondrian-blue rounded-full border border-black/20" />
      </div>
    </div>
  </div>
);

const GabrielSettingsPanel = ({ context, onToggleSettings }) => (
  <div
    className={`absolute top-12 left-0 right-0 z-[60] bg-mondrian-yellow border-b-8 border-black p-4 animate-in slide-in-from-top duration-300`}
  >
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm font-black uppercase italic tracking-tighter">Config Gabriel AI</h3>
      <button onClick={onToggleSettings}>
        <X className="w-5 h-5" />
      </button>
    </div>
    <div className="space-y-3">
      <div>
        <label className="text-[8px] font-black uppercase block mb-1 opacity-60">
          API URL (OpenAI Compatible)
        </label>
        <input
          type="text"
          value={context.gabrielConfig?.url || ""}
          onChange={(e) => context.updateGabrielConfig({ url: e.target.value })}
          placeholder="https://api.openai.com/v1/chat/completions"
          className="w-full bg-white border-2 border-black p-2 text-[10px] font-bold focus:outline-none"
        />
      </div>
      <div>
        <label className="text-[8px] font-black uppercase block mb-1 opacity-60">API Key</label>
        <input
          type="password"
          value={context.gabrielConfig?.key || ""}
          onChange={(e) => context.updateGabrielConfig({ key: e.target.value })}
          placeholder="sk-..."
          className="w-full bg-white border-2 border-black p-2 text-[10px] font-bold focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="gabriel-enabled"
          checked={context.gabrielConfig?.enabled || false}
          onChange={(e) => context.updateGabrielConfig({ enabled: e.target.checked })}
          className="w-4 h-4 border-2 border-black rounded-none checked:bg-black"
        />
        <label htmlFor="gabriel-enabled" className="text-[10px] font-black uppercase">
          Activer Gabriel (Privé)
        </label>
      </div>
      <p className="text-[8px] font-bold opacity-60 italic mt-2">
        Si non configuré, Gabriel utilise une instance Ophélia personnalisée avec vos données.
      </p>
    </div>
  </div>
);

const AttachmentPreview = ({ attachment, onClearAttachment, onSend }) => (
  <div className="absolute top-14 left-4 z-50 w-32 h-32 border-8 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group">
    <img src={attachment.previewUrl} className="w-full h-full object-cover" alt="Capture" />
    <button
      onClick={onClearAttachment}
      className={`absolute -top-4 -right-4 bg-mondrian-red text-white border-4 border-black p-1 hover:bg-black`}
    >
      <X className="w-5 h-5" />
    </button>
    <Button
      className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-8 bg-black text-white border-4 border-black text-[10px] font-black uppercase"
      onClick={onSend}
    >
      ENVOYER
    </Button>
  </div>
);

const OpheliaInputBar = ({ text, onTextChange, onSend, attachment, context }) => {
  const tags = [
    { id: "@barman", label: "Barman", icon: Coffee, color: "bg-mondrian-red" },
    {
      id: "@clients",
      label: "Clients",
      icon: Users,
      color: "bg-mondrian-yellow",
    },
    {
      id: "@equipe",
      label: "Équipe",
      icon: Briefcase,
      color: "bg-mondrian-blue",
    },
  ];

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex gap-2 px-1">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => {
              if (text.includes(tag.id)) {
                onTextChange(text.replace(tag.id, "").trim());
              } else {
                onTextChange(`${tag.id} ${text}`.trim());
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 border-2 border-black text-[8px] font-black uppercase tracking-tighter transition-all ${
              text.includes(tag.id)
                ? `${tag.color} text-white translate-y-0.5 shadow-none`
                : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none"
            }`}
          >
            <tag.icon className="w-2.5 h-2.5" />
            {tag.label}
          </button>
        ))}
      </div>
      <div className="w-full flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Tapez un message..."
            className="w-full bg-white border-4 border-black p-3 font-black text-xs focus:ring-0 focus:outline-none placeholder:text-black/30 pr-12"
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            <TalkButton
              size="sm"
              showLabel={false}
              vocalState={context.vocalState}
              isRecording={context.isRecording}
              isTranscribing={context.isTranscribing}
              vocalError={context.vocalError}
              transcriptionPreview={context.transcriptionPreview}
              duration={context.duration}
              startRecording={context.startRecording}
              stopRecording={context.stopRecording}
              isHandsFree={context.isHandsFree}
              microMode={context.microMode}
              onMicroModeChange={context.changeMicroMode}
              className="border-0 shadow-none hover:shadow-none translate-x-0 translate-y-0 hover:translate-x-0 hover:translate-y-0"
            />
            <button
              onClick={onSend}
              disabled={!text && !attachment}
              className={`px-3 h-full border-l-4 border-black flex items-center justify-center transition-colors ${
                text || attachment ? "bg-mondrian-red text-white" : "text-black/20"
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OpheliaActionButtons = ({
  context,
  isMobile,
  attachment,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  onTip,
  onSuspendu,
  onInvite,
  onAfter,
  onEditPseudo,
  pseudo,
  isAfter,
}) => (
  <div className="flex items-center justify-center gap-4 w-full">
    <button
      onClick={() => {
        const next = !context.isHandsFree;
        context.setIsHandsFree(next);
        localStorage.setItem("inseme_hands_free", next ? "true" : "false");
      }}
      className={`p-3 rounded-full border-4 border-black transition-all ${
        context.isHandsFree
          ? "bg-black text-white"
          : "bg-white text-black hover:bg-black hover:text-white"
      }`}
      title="Mode Mains Libres"
    >
      <Headphones className="w-6 h-6" strokeWidth={3} />
    </button>

    <button
      onClick={() => {
        if (isMobile) {
          onAttach();
        } else {
          onAttachCamera();
        }
      }}
      className={`p-3 rounded-full border-4 border-black transition-all ${
        attachment
          ? "bg-mondrian-red text-white"
          : "bg-white text-black hover:bg-black hover:text-white"
      }`}
      title={isMobile ? "Prendre une photo (Caméra)" : "Prendre une photo (Webcam)"}
    >
      <Camera className="w-6 h-6" strokeWidth={3} />
    </button>

    <button
      onClick={onAttachGallery}
      className={`p-3 rounded-full border-4 border-black transition-all ${
        attachment
          ? "bg-mondrian-red text-white"
          : "bg-white text-black hover:bg-black hover:text-white"
      }`}
      title="Choisir une image (Galerie)"
    >
      <Image className="w-6 h-6" strokeWidth={3} />
    </button>

    <button
      onClick={onTip}
      className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all"
      title="Offrir une tournée"
    >
      <Coffee className="w-6 h-6" strokeWidth={3} />
    </button>

    <button
      onClick={onSuspendu}
      className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all"
      title="Offrir un café suspendu"
    >
      <Heart className="w-6 h-6 text-red-600" strokeWidth={3} />
    </button>

    <button
      onClick={onInvite}
      disabled={!pseudo}
      className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      title="Inviter un ami"
    >
      <QrCode className="w-6 h-6" strokeWidth={3} />
    </button>

    <button
      onClick={onAfter}
      className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-black hover:text-mondrian-yellow transition-all"
      title="Proposer un After"
    >
      <Moon className="w-6 h-6" strokeWidth={3} />
    </button>

    <div
      className={`${isAfter ? "bg-black text-mondrian-blue border-mondrian-blue" : "bg-white text-black border-black"} px-2 py-1 border-4 flex flex-col items-center justify-center cursor-pointer hover:bg-black hover:text-white transition-colors min-w-[80px]`}
      onClick={onEditPseudo}
    >
      <span className="text-[7px] font-black uppercase opacity-60 leading-none mb-0.5">
        {isAfter ? "PAS DE NOM" : context.currentUser?.summary || "USER"}
      </span>
      <span className="text-[10px] font-black text-center leading-tight uppercase tracking-tighter">
        {pseudo || (isAfter ? "???" : "???")}
      </span>
    </div>
  </div>
);

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
  onEditPseudo,
  pseudo,
  isAfter,
}) => (
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
      onEditPseudo={onEditPseudo}
      pseudo={pseudo}
      isAfter={isAfter}
    />
  </div>
);

const OpheliaScreen = ({
  context,
  isMobile,
  attachment,
  text,
  onTextChange,
  onSend,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  onClearAttachment,
  onTip,
  pseudo,
  onEditPseudo,
  onSuspendu,
  onInvite,
  onAfter,
  isAfter,
  isGabrielMode,
  onToggleGabriel,
  showGabrielSettings,
  onToggleSettings,
}) => (
  <div className="h-full flex flex-col pt-4 px-4 pb-4 text-black transition-colors duration-1000 overflow-hidden relative">
    {isAfter && (
      <div className="absolute inset-0 bg-mondrian-black z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_70%)]" />
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
      </div>
    )}
    <MondrianBlock
      color={isAfter ? "black" : "white"}
      className={`flex-1 border-8 ${isAfter ? "border-mondrian-blue/50 shadow-[0px_20px_50px_rgba(0,0,0,0.2)]" : "border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"} flex flex-col transition-all duration-1000 overflow-hidden relative z-10 backdrop-blur-sm`}
    >
      <OpheliaHeader
        isGabrielMode={isGabrielMode}
        onToggleGabriel={onToggleGabriel}
        showGabrielSettings={showGabrielSettings}
        onToggleSettings={onToggleSettings}
        isAfter={isAfter}
        gabrielConfigured={context.gabrielConfig?.enabled}
      />

      {showGabrielSettings && (
        <GabrielSettingsPanel context={context} onToggleSettings={onToggleSettings} />
      )}

      {attachment && (
        <AttachmentPreview
          attachment={attachment}
          onClearAttachment={onClearAttachment}
          onSend={onSend}
        />
      )}

      <div
        className={`flex-1 overflow-hidden relative ${isAfter ? "bg-black" : "bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]"}`}
      >
        <Chat
          variant="minimal"
          className={`h-full p-4 ${isAfter ? "text-mondrian-blue" : "text-black"}`}
        />
      </div>

      <OpheliaInputArea
        text={text}
        onTextChange={onTextChange}
        onSend={onSend}
        attachment={attachment}
        context={context}
        isMobile={isMobile}
        onAttach={onAttach}
        onAttachCamera={onAttachCamera}
        onAttachGallery={onAttachGallery}
        onTip={onTip}
        onSuspendu={onSuspendu}
        onInvite={onInvite}
        onAfter={onAfter}
        onEditPseudo={onEditPseudo}
        pseudo={pseudo}
        isAfter={isAfter}
      />
    </MondrianBlock>
  </div>
);

const InviteModal = ({ isOpen, onClose, pseudo, roomMetadata, clientUrl }) => {
  if (!isOpen) return null;
  const roomSettings = roomMetadata?.settings;
  const barName = roomMetadata?.name || "Bar";
  const inviteUrl = `${clientUrl}/app?room=${roomMetadata?.slug}&invited_by=${encodeURIComponent(pseudo)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(inviteUrl)}&bgcolor=FFD500`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${barName} - Rejoins-moi au bar !`,
          text: `Je suis au ${barName} sous le pseudo ${pseudo}. Rejoins-moi !`,
          url: inviteUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      alert("Lien d'invitation copié !");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-red)] relative overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="p-8 flex flex-col items-center">
          <MondrianBlock
            color="yellow"
            className="mb-8 p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <img src={qrUrl} alt="Invitation QR Code" className="w-64 h-64 mix-blend-multiply" />
          </MondrianBlock>

          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-center leading-none">
            Invite un Ami
          </h2>
          <p className="text-[10px] font-bold text-center uppercase tracking-widest opacity-60 mb-6 px-3 py-1 bg-slate-100 border border-black/10 rounded-full">
            Fais scanner ce code pour l'aider à entrer
          </p>

          <button
            onClick={handleShare}
            className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-mondrian-red transition-colors"
          >
            <Share2 className="w-5 h-5" />
            Partager le Lien
          </button>
        </div>
      </MondrianBlock>
    </div>
  );
};

const TipModal = ({ isOpen, onClose, barmans, onTip, pseudo, context }) => {
  const [selectedBarman, setSelectedBarman] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [privacy, setPrivacy] = useState("all"); // all, recipient, anon
  const [tipMethod, setTipMethod] = useState("stripe"); // stripe, wero, physical
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  useEffect(() => {
    setPhoneRevealed(false);
  }, [selectedBarman]);

  if (!isOpen) return null;

  const suggestedAmounts = [2, 5, 10, 20];

  const handleRevealPhone = () => {
    setPhoneRevealed(true);
    // Notification discrète au barman
    if (context.sendBroadcast) {
      context.sendBroadcast("phone_revealed", {
        from: pseudo || "Un client",
        to: selectedBarman.name,
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedBarman || (!amount && tipMethod === "stripe")) return;
    setIsSubmitting(true);
    try {
      await onTip({
        barman: selectedBarman,
        amount: parseFloat(amount) || 0,
        message,
        privacy,
        attachment,
        method: tipMethod,
      });
      if (tipMethod !== "stripe") {
        onClose();
      }
    } catch (err) {
      alert("Erreur lors de l'opération.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCapturePhoto = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const roomId =
            context.roomMetadata?.id || context.roomMetadata?.slug || context.roomName || "tips";
          const url = await storage.uploadEphemeral(roomId, file);
          setAttachment({ type: "photo", url });
        } catch (err) {
          console.error("Photo upload failed:", err);
          alert("Erreur lors de l'upload de la photo.");
        }
      }
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-yellow)] relative p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="flex flex-col gap-6">
          <header className="text-center">
            <Coins className="w-12 h-12 mx-auto mb-4 text-mondrian-yellow" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              Laisser un Pourboire
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
              Merci de soutenir le staff !
            </p>
          </header>

          {/* SÉLECTION BARMAN */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">Pour qui ?</label>
            <div className="flex flex-wrap gap-2">
              {barmans.length > 0 ? (
                barmans.map((b) => (
                  <button
                    key={b.user_id}
                    onClick={() => setSelectedBarman(b)}
                    className={`px-4 py-2 border-4 border-black font-black uppercase text-xs transition-all ${
                      selectedBarman?.user_id === b.user_id
                        ? "bg-mondrian-yellow translate-y-1 shadow-none"
                        : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                  >
                    {b.name} ({b.place || "Bar"})
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center gap-4 py-8 bg-slate-50 border-4 border-dashed border-black/20">
                  <p className="text-[10px] font-bold text-black/40 uppercase text-center px-4">
                    Aucun barman n'est connecté pour le moment.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      // On ouvre la modal barman via un petit délai pour éviter les conflits de focus
                      setTimeout(
                        () => window.dispatchEvent(new CustomEvent("inseme:open_barman_modal")),
                        100
                      );
                    }}
                    className="text-[10px] font-black uppercase underline hover:text-mondrian-red"
                  >
                    Vous êtes barman ? Déclarez-vous !
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MÉTHODE DE PAIEMENT */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">Moyen de paiement</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "stripe", label: "CB / Stripe", icon: CreditCard },
                { id: "wero", label: "Wero (Tel)", icon: Smartphone },
                { id: "physical", label: "En Personne", icon: Handshake },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTipMethod(m.id)}
                  className={`p-3 border-4 border-black flex flex-col items-center gap-2 transition-all ${
                    tipMethod === m.id
                      ? "bg-black text-white translate-y-1 shadow-none"
                      : "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  }`}
                >
                  <m.icon className="w-6 h-6" />
                  <span className="text-[9px] font-black uppercase leading-none text-center">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* MONTANT */}
          {(tipMethod === "stripe" || tipMethod === "wero") && (
            <div>
              <label className="text-xs font-black uppercase mb-2 block">Combien ? (en €)</label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {suggestedAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`py-2 border-4 border-black font-black text-sm transition-all ${
                      amount === amt.toString()
                        ? "bg-black text-white translate-y-1 shadow-none"
                        : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                  >
                    {amt}€
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Montant libre..."
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border-4 border-black p-4 font-black text-xl focus:ring-0 focus:outline-none"
                />
                {tipMethod === "stripe" && amount && parseFloat(amount) < 2 && (
                  <div className="absolute -bottom-6 left-0 flex items-center gap-1 text-[8px] font-black text-mondrian-red uppercase animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Attention : frais Stripe élevés sur les petits dons (min 2€ conseillé)
                  </div>
                )}
              </div>

              {tipMethod === "wero" && selectedBarman?.phone && (
                <div className="mt-6 bg-mondrian-yellow border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-top duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase italic">
                      Numéro Wero de {selectedBarman.name} :
                    </span>
                    <Smartphone className="w-4 h-4" />
                  </div>

                  {selectedBarman.phone_visibility === "private" && !phoneRevealed ? (
                    <button
                      onClick={handleRevealPhone}
                      className="w-full bg-black text-white p-4 font-black uppercase text-xs flex items-center justify-center gap-3 border-2 border-black hover:bg-white hover:text-black transition-all group"
                    >
                      <Lock className="w-4 h-4 group-hover:hidden" />
                      <Unlock className="w-4 h-4 hidden group-hover:block" />
                      Révéler le numéro
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <a
                        href={`tel:${selectedBarman.phone}`}
                        className="flex-1 bg-black text-white p-3 font-black text-center text-lg border-2 border-black hover:bg-white hover:text-black transition-colors"
                      >
                        {selectedBarman.phone}
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedBarman.phone);
                          alert("Numéro copié !");
                        }}
                        className="bg-white text-black p-3 border-2 border-black hover:bg-black hover:text-white transition-colors"
                        title="Copier le numéro"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="mt-3 bg-white/50 border border-black/10 p-2 flex items-start gap-2">
                    <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                    <p className="text-[7px] font-bold uppercase leading-tight">
                      {selectedBarman.phone_visibility === "private"
                        ? "Usage restreint : le barman est notifié que vous consultez son numéro pour ce don."
                        : "Usage restreint : numéro partagé pour faciliter votre don Wero. Merci de rester courtois."}
                    </p>
                  </div>

                  <p className="text-[8px] font-bold mt-2 uppercase leading-tight opacity-70">
                    Le virement Wero est direct et sans frais. Effectuez-le depuis votre app
                    bancaire après avoir validé ici.
                  </p>
                </div>
              )}

              {tipMethod === "wero" && !selectedBarman?.phone && (
                <p className="text-[8px] font-bold opacity-40 mt-1 uppercase">
                  Note: Ce barman n'a pas renseigné son numéro. Le don Wero se fera manuellement
                  s'il vous le communique.
                </p>
              )}
            </div>
          )}

          {tipMethod === "physical" && (
            <div className="bg-slate-50 border-4 border-dashed border-black/20 p-6 text-center animate-in zoom-in duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white border-4 border-black mb-4 rotate-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Handshake className="w-10 h-10 text-black" />
              </div>
              <h3 className="text-xl font-black uppercase italic mb-2">Le Geste Noble 🤝</h3>
              <p className="text-[10px] font-bold uppercase leading-tight max-w-[250px] mx-auto">
                Espèces, QR Code direct ou simple merci : validez ici pour que tout le bar célèbre
                ce moment de convivialité traditionnelle !
              </p>
            </div>
          )}

          {/* MESSAGE & ATTACHMENTS */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">
              Un petit mot, une photo ou un vocal ?
            </label>
            <div className="relative">
              <textarea
                placeholder="EX: Merci pour la bière ! ✨"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white border-4 border-black p-4 font-bold text-sm focus:ring-0 focus:outline-none h-24 resize-none"
              />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  onClick={handleCapturePhoto}
                  title="Prendre une photo"
                  className={`p-2 border-2 border-black transition-colors ${attachment?.type === "photo" ? "bg-mondrian-yellow" : "bg-white hover:bg-slate-100"}`}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <div title="Enregistrer un vocal">
                  <TalkButton
                    size="sm"
                    showLabel={false}
                    vocalState={context.vocalState}
                    isRecording={context.isRecording}
                    isTranscribing={context.isTranscribing}
                    vocalError={context.vocalError}
                    duration={context.duration}
                    startRecording={() => {
                      if (context.startRecording) context.startRecording();
                    }}
                    stopRecording={async () => {
                      if (context.stopRecording) {
                        const blob = await context.stopRecording();
                        if (blob) {
                          try {
                            const roomId =
                              context.roomMetadata?.id ||
                              context.roomMetadata?.slug ||
                              context.roomName ||
                              "tips";
                            const url = await storage.uploadVocal(roomId, blob);
                            setAttachment({
                              type: "vocal",
                              url,
                            });
                          } catch (err) {
                            console.error("Vocal upload failed:", err);
                            alert("Erreur lors de l'upload du message vocal.");
                          }
                        }
                      }
                    }}
                    className="border-2 border-black shadow-none hover:shadow-none translate-x-0 translate-y-0"
                  />
                </div>
              </div>
            </div>
            {attachment && (
              <div className="mt-2 flex items-center justify-between bg-mondrian-yellow/10 border-2 border-black p-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                  {attachment.type === "photo" ? (
                    <div className="w-8 h-8 border-2 border-black overflow-hidden">
                      <img
                        src={attachment.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span className="text-[10px] font-black uppercase">
                    {attachment.type === "photo" ? "Photo prête" : "Vocal prêt"}
                  </span>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="bg-black text-white p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-[8px] font-bold opacity-40 mt-1 uppercase">
              Les pièces jointes sont visibles selon vos réglages de confidentialité.
            </p>
          </div>

          {/* CONFIDENTIALITÉ */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">Qui voit ce don ?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "Tout le bar", icon: Globe },
                { id: "recipient", label: "Juste lui", icon: User },
                { id: "anon", label: "Anonyme", icon: VolumeX },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id)}
                  className={`p-2 border-2 border-black flex flex-col items-center gap-1 transition-all ${
                    privacy === p.id ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase leading-none text-center">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!selectedBarman || (!amount && tipMethod !== "physical") || isSubmitting}
            onClick={handleSubmit}
            className={`w-full py-4 border-4 border-black font-black uppercase tracking-widest transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${
              tipMethod === "stripe"
                ? "bg-mondrian-red text-white hover:bg-black"
                : tipMethod === "wero"
                  ? "bg-mondrian-yellow text-black hover:bg-black hover:text-white"
                  : "bg-black text-white hover:bg-mondrian-blue"
            }`}
          >
            {isSubmitting
              ? "Opération..."
              : tipMethod === "stripe"
                ? "Donner via Stripe"
                : tipMethod === "wero"
                  ? "Annoncer le don Wero"
                  : "Confirmer l'interaction"}
          </button>
        </div>
      </MondrianBlock>
    </div>
  );
};

const BarmanModal = ({ isOpen, onClose, onDeclare, currentToken }) => {
  const [stripeId, setStripeId] = useState("");
  const [place, setPlace] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisibility, setPhoneVisibility] = useState("private"); // 'private' ou 'public'
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!stripeId || !place) return;
    setIsSubmitting(true);
    try {
      await onDeclare({ stripeId, place, phone, phoneVisibility });
    } catch (err) {
      alert("Erreur lors de la déclaration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-blue)] relative p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="flex flex-col gap-6 max-h-[80vh] overflow-y-auto pr-2">
          <header className="text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-mondrian-blue" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              Espace Barman
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
              Déclarez-vous pour recevoir des dons
            </p>
          </header>

          <div className="bg-blue-50 border-4 border-mondrian-blue p-4 flex gap-3">
            <Activity className="w-6 h-6 text-mondrian-blue shrink-0" />
            <p className="text-[10px] font-bold leading-tight text-mondrian-blue">
              DÉCLARATION SUR L'HONNEUR : Vous certifiez être un membre du staff ou autorisé par
              l'établissement. L'application décline toute responsabilité sur les fonds reçus.
            </p>
          </div>

          <div>
            <label className="text-xs font-black uppercase mb-2 block">
              Où êtes-vous ? (Poste/Nom)
            </label>
            <input
              type="text"
              placeholder="EX: Bar Central, Terrasse, Salle 1..."
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="w-full bg-white border-4 border-black p-4 font-black text-xl focus:ring-0 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase mb-2 block">
              ID Compte Stripe (acct_...)
            </label>
            <input
              type="text"
              placeholder="EX: acct_1234567890abcdef..."
              value={stripeId}
              onChange={(e) => setStripeId(e.target.value)}
              className="w-full bg-white border-4 border-black p-4 font-mono text-sm focus:ring-0 focus:outline-none"
            />
            <p className="text-[8px] font-bold opacity-40 mt-1 uppercase">
              Requis pour les dons par carte. Trouvable sur votre dashboard Stripe.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase mb-2 block">
                Téléphone (Optionnel - Pour Wero)
              </label>
              <input
                type="tel"
                placeholder="EX: 06 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border-4 border-black p-4 font-black text-xl focus:ring-0 focus:outline-none"
              />
            </div>

            {phone && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPhoneVisibility("private")}
                  className={`border-4 border-black p-3 flex flex-col items-center gap-2 transition-all ${phoneVisibility === "private" ? "bg-black text-white" : "bg-white text-black hover:bg-slate-50"}`}
                >
                  <Lock className="w-5 h-5" />
                  <span className="text-[8px] font-black uppercase leading-tight text-center">
                    Sur demande
                    <br />
                    (Sécurisé)
                  </span>
                </button>
                <button
                  onClick={() => setPhoneVisibility("public")}
                  className={`border-4 border-black p-3 flex flex-col items-center gap-2 transition-all ${phoneVisibility === "public" ? "bg-mondrian-yellow text-black" : "bg-white text-black hover:bg-slate-50"}`}
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-[8px] font-black uppercase leading-tight text-center">
                    Public
                    <br />
                    (Pour Wero)
                  </span>
                </button>
              </div>
            )}

            <p className="text-[8px] font-bold opacity-40 uppercase leading-tight">
              {phoneVisibility === "private"
                ? "Le client devra cliquer pour révéler votre numéro. Vous serez notifié de chaque consultation."
                : "Votre numéro sera directement affiché aux clients choisissant le mode Wero."}
            </p>
          </div>

          <button
            disabled={!stripeId || !place || isSubmitting}
            onClick={handleSubmit}
            className="w-full bg-mondrian-blue text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-black transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1"
          >
            {isSubmitting ? "Enregistrement..." : "Activer mon profil"}
          </button>

          {currentToken && (
            <button
              onClick={() => onDeclare(null)}
              className="w-full bg-white text-mondrian-red py-2 border-2 border-mondrian-red font-black uppercase text-[10px] hover:bg-red-50 transition-colors"
            >
              Arrêter d'être barman
            </button>
          )}
        </div>
      </MondrianBlock>
    </div>
  );
};

/* =========================
   BROADCAST OVERLAY
   ========================= */

const BroadcastOverlay = ({ event }) => {
  if (!event) return null;

  const isBell = event.type === "bell";
  const isUrlChange = event.type === "url_change";
  const isPhoneRevealed = event.type === "phone_revealed";
  const isImperial = event.level === "imperial";
  const isRoyal = event.level === "royal";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-8 overflow-hidden ${isUrlChange ? "bg-black/60 backdrop-blur-md pointer-events-auto" : "pointer-events-none"}`}
    >
      {isPhoneRevealed ? (
        <div className="absolute top-10 right-10 animate-in slide-in-from-right duration-500">
          <MondrianBlock
            color="white"
            className="border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4"
          >
            <div className="bg-mondrian-yellow p-2 border-2 border-black">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase leading-tight">Numéro Consulté</p>
              <p className="text-[8px] font-bold uppercase opacity-60">
                {event.from} regarde votre Wero
              </p>
            </div>
          </MondrianBlock>
        </div>
      ) : isUrlChange ? (
        <MondrianBlock
          color="yellow"
          className="max-w-md border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300 pointer-events-auto"
        >
          <div className="flex flex-col items-center text-center">
            <Radio className="w-16 h-16 mb-6 animate-pulse" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4 leading-none">
              Nouvelle Fréquence
            </h2>
            <p className="font-bold uppercase text-sm mb-8 leading-relaxed">
              La connexion au bar a été mise à jour pour plus de stabilité. Basculez sur le nouveau
              canal !
            </p>
            <button
              onClick={() => {
                const url = new URL(event.newUrl);
                url.search = window.location.search; // Garder les paramètres (room, etc.)
                window.location.href = url.toString();
              }}
              className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-mondrian-red transition-colors shadow-[8px_8px_0px_0px_var(--mondrian-red)] active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              REJOINDRE LE BAR
            </button>
          </div>
        </MondrianBlock>
      ) : isBell ? (
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
          <div className="text-8xl md:text-9xl animate-bounce">🔔</div>
          <div className="bg-black text-mondrian-yellow px-6 py-2 border-4 border-mondrian-yellow font-black uppercase text-xl md:text-2xl mt-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            Dernière Tournée !
          </div>
          <div className="absolute inset-0 border-[20px] border-mondrian-yellow animate-ping opacity-20" />
        </div>
      ) : (
        <div className="flex flex-col items-center animate-in zoom-in duration-300 text-center">
          <div className="text-8xl md:text-9xl animate-bounce mb-4">
            {isImperial ? "🦅🏆🔥" : isRoyal ? "👑💎✨" : "🍻✨"}
          </div>
          <div
            className={`px-6 py-2 border-4 border-black font-black uppercase text-xl md:text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
              isImperial
                ? "bg-mondrian-red text-white"
                : isRoyal
                  ? "bg-mondrian-yellow text-black"
                  : "bg-white text-black"
            }`}
          >
            {isImperial
              ? "POURBOIRE IMPÉRIAL !"
              : isRoyal
                ? "POURBOIRE ROYAL !"
                : event.method === "wero"
                  ? "POURBOIRE WERO ! 📱"
                  : event.method === "physical"
                    ? "REMERCIEMENT PHYSIQUE ! 🤝"
                    : "POURBOIRE !"}
          </div>

          {event.from && (
            <div className="mt-6 bg-black text-white px-4 py-2 border-4 border-white font-black uppercase italic tracking-tighter text-2xl animate-in fade-in slide-in-from-bottom duration-700 delay-300">
              {event.from} A RÉGALÉ {event.to || "LE BAR"} !
            </div>
          )}

          {event.message && (
            <div className="mt-4 max-w-lg bg-white/90 backdrop-blur-sm text-black px-6 py-4 border-4 border-black font-bold italic text-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom duration-700 delay-500">
              "{event.message}"
            </div>
          )}

          {event.attachment && (
            <div className="mt-4 animate-in zoom-in duration-700 delay-700">
              {event.attachment.type === "photo" ? (
                <div className="border-8 border-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rotate-2 overflow-hidden max-w-[250px]">
                  <img src={event.attachment.url} alt="Tip Attachment" className="w-full h-auto" />
                </div>
              ) : (
                <div className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4">
                  <div className="w-12 h-12 bg-mondrian-yellow border-4 border-black flex items-center justify-center animate-pulse">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase leading-none">Message Vocal</p>
                    <audio src={event.attachment.url} controls className="mt-2 h-8" />
                  </div>
                </div>
              )}
            </div>
          )}

          {isImperial && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: "20px",
                    height: "20px",
                    backgroundColor: "var(--mondrian-yellow)",
                    borderRadius: "50%",
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.3,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================
   MAIN APP
   ========================= */

export default function ClientMiniApp() {
  const context = useInsemeContext();
  const {
    castVote,
    roomData,
    roomMetadata,
    messages,
    sendMessage,
    setPresenceMetadata,
    sendBroadcast,
    isAfter,
  } = context;

  const barName = roomMetadata?.name || "Bar";
  const commune = roomMetadata?.settings?.commune || "Ville";

  const [screen, setScreen] = useState(
    () => localStorage.getItem("inseme_client_screen") || "ophelia"
  );
  const [pseudo, setPseudo] = useState(() => {
    const saved = localStorage.getItem("inseme_client_pseudo");
    return saved === "s" ? "" : saved || "";
  });
  const [invitedBy, setInvitedBy] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("invited_by") || "";
  });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [zone, setZone] = useState(() => localStorage.getItem("inseme_client_zone") || "indoor");
  const [isEditingPseudo, setIsEditingPseudo] = useState(
    !localStorage.getItem("inseme_client_pseudo")
  );
  const [isGabrielMode, setIsGabrielMode] = useState(
    () => localStorage.getItem("inseme_gabriel_mode") === "true"
  );
  const [showGabrielSettings, setShowGabrielSettings] = useState(false);

  // Force disable Gabriel mode if not configured
  useEffect(() => {
    if (isGabrielMode && !context.gabrielConfig?.enabled) {
      setIsGabrielMode(false);
      localStorage.setItem("inseme_gabriel_mode", "false");
    }
  }, [isGabrielMode, context.gabrielConfig?.enabled]);

  const [broadcastEvent, setBroadcastEvent] = useState(null);
  const [showTipSuccess, setShowTipSuccess] = useState(false);
  const [tipSuccessData, setTipSuccessData] = useState(null);

  // Tipping state
  const [tipToken, setTipToken] = useState(() => localStorage.getItem("inseme_tip_token") || "");
  const [isTippingModalOpen, setIsTippingModalOpen] = useState(false);
  const [isBarmanModalOpen, setIsBarmanModalOpen] = useState(false);
  const [publicLinks, setPublicLinks] = useState(() => {
    try {
      const raw = localStorage.getItem("inseme_client_public_links");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const normalizedPublicLinks = useMemo(() => {
    if (!Array.isArray(publicLinks)) return [];
    return publicLinks
      .map(normalizePublicLink)
      .filter(
        (link) =>
          link &&
          typeof link.label === "string" &&
          typeof link.url === "string" &&
          link.label.trim() &&
          link.url.trim()
      );
  }, [publicLinks]);

  useEffect(() => {
    try {
      localStorage.setItem("inseme_client_public_links", JSON.stringify(normalizedPublicLinks));
    } catch (e) {
      console.error("Failed to persist client public links", e);
    }
  }, [normalizedPublicLinks]);

  // Détection du succès du pourboire (retour de Stripe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tip_success") === "true") {
      const amount = params.get("amount");
      const barman = params.get("barman");
      const msg = params.get("msg");
      const priv = params.get("priv") || "all";

      setTipSuccessData({ amount, barman, message: msg, privacy: priv });
      setShowTipSuccess(true);

      // Récupérer l'éventuelle pièce jointe stockée avant le départ vers Stripe
      const pendingAttachment = localStorage.getItem("inseme_pending_tip_attachment");
      let attachment = null;
      if (pendingAttachment) {
        try {
          attachment = JSON.parse(pendingAttachment);
          localStorage.removeItem("inseme_pending_tip_attachment");
        } catch (e) {
          console.error("Failed to parse pending attachment", e);
        }
      }

      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Célébration locale
      const level =
        parseFloat(amount) >= 50 ? "imperial" : parseFloat(amount) >= 20 ? "royal" : "classic";

      // Broadcast automatique
      if (sendBroadcast) {
        sendBroadcast("celebrate", {
          level,
          from: priv === "all" ? pseudo : priv === "anon" ? "Anonyme" : "Un client",
          to: barman,
          amount,
          message: priv === "all" ? msg : null,
          privacy: priv,
          realFrom: pseudo,
          attachment: priv === "all" ? attachment : null,
        });
      }

      // Fermer après 5s
      setTimeout(() => {
        setShowTipSuccess(false);
        setTipSuccessData(null);
      }, 5000);
    }
  }, [pseudo, sendBroadcast]);

  // Derived: Active barmans from presence
  const barmans = useMemo(() => {
    if (!roomData?.connectedUsers) return [];
    return roomData.connectedUsers.filter((u) => u.role === "barman" && u.tipToken);
  }, [roomData?.connectedUsers]);

  const isBarman = useMemo(() => {
    return !!tipToken;
  }, [tipToken]);

  useEffect(() => {
    if (tipToken) {
      const storedPlace = localStorage.getItem("inseme_barman_place") || "Bar";
      const storedPhone = localStorage.getItem("inseme_barman_phone") || "";
      const storedPhoneVisibility =
        localStorage.getItem("inseme_barman_phone_visibility") || "private";
      setPresenceMetadata({
        role: "barman",
        tipToken: tipToken,
        place: storedPlace,
        phone: storedPhone,
        phone_visibility: storedPhoneVisibility,
        public_links: normalizedPublicLinks,
      });
    } else {
      setPresenceMetadata({
        role: "client",
        tipToken: null,
        place: null,
        phone: null,
        phone_visibility: null,
        public_links: normalizedPublicLinks,
      });
    }
  }, [tipToken, normalizedPublicLinks, setPresenceMetadata]);

  const handleDeclareBarman = async (data) => {
    if (!data) {
      setTipToken("");
      localStorage.removeItem("inseme_tip_token");
      localStorage.removeItem("inseme_barman_place");
      localStorage.removeItem("inseme_barman_phone");
      localStorage.removeItem("inseme_barman_phone_visibility");
      setIsBarmanModalOpen(false);
      return;
    }

    const { stripeId, place, phone, phoneVisibility } = data;
    try {
      const response = await fetch("/.netlify/functions/tipping", {
        method: "POST",
        body: JSON.stringify({
          action: "sign-token",
          stripe_account_id: stripeId,
          barman_name: pseudo,
          place,
          phone,
          phone_visibility: phoneVisibility,
        }),
      });

      const result = await response.json();
      if (result.token) {
        setTipToken(result.token);
        localStorage.setItem("inseme_tip_token", result.token);
        localStorage.setItem("inseme_barman_place", place);
        if (phone) {
          localStorage.setItem("inseme_barman_phone", phone);
          localStorage.setItem("inseme_barman_phone_visibility", phoneVisibility);
        }
        setIsBarmanModalOpen(false);
      } else {
        throw new Error(result.error || "Token error");
      }
    } catch (err) {
      console.error("Barman declaration failed:", err);
      alert("Erreur: " + err.message);
    }
  };

  const handleTip = async ({ barman, amount, message, privacy, attachment, method = "stripe" }) => {
    try {
      // Pour Wero et Physical, on ne passe pas par Stripe, on broadcast juste l'intention/ambiance
      if (method === "wero" || method === "physical") {
        const level = amount >= 50 ? "imperial" : amount >= 20 ? "royal" : "classic";

        if (sendBroadcast) {
          sendBroadcast("celebrate", {
            level,
            from: privacy === "all" ? pseudo : privacy === "anon" ? "Anonyme" : "Un client",
            to: barman.name,
            amount: method === "physical" ? null : amount, // On cache le montant si physique (discrétion)
            message: privacy === "all" ? message : null,
            privacy,
            realFrom: pseudo,
            attachment: privacy === "all" ? attachment : null,
            method,
          });
        }

        // Overlay local immédiat pour le donneur
        setTipSuccessData({
          amount: method === "physical" ? "Don" : amount,
          barman: barman.name,
          message,
          privacy,
          method,
        });
        setShowTipSuccess(true);
        setTimeout(() => {
          setShowTipSuccess(false);
          setTipSuccessData(null);
        }, 5000);

        return;
      }

      // Sauvegarder la pièce jointe localement car le redirect vers Stripe va rafraîchir la page
      if (attachment) {
        localStorage.setItem("inseme_pending_tip_attachment", JSON.stringify(attachment));
      }

      const response = await fetch("/.netlify/functions/tipping", {
        method: "POST",
        body: JSON.stringify({
          action: "create-session",
          token: barman.tipToken,
          amount,
          metadata: {
            from_pseudo: privacy === "anon" ? "Anonyme" : pseudo,
            message: message,
            privacy: privacy,
            room_slug: roomMetadata?.slug,
            attachment_type: attachment?.type,
            attachment_url: attachment?.url, // On passe l'URL (base64 ou autre)
          },
          success_url:
            window.location.href.split("?")[0] +
            "?tip_success=true" +
            "&amount=" +
            amount +
            "&barman=" +
            encodeURIComponent(barman.name) +
            "&priv=" +
            privacy +
            (message ? "&msg=" + encodeURIComponent(message.substring(0, 100)) : ""),
          cancel_url: window.location.href,
        }),
      });

      const result = await response.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || "Session error");
      }
    } catch (err) {
      console.error("Tipping failed:", err);
      alert("Erreur: " + err.message);
    }
  };

  const roomSettings = roomMetadata?.settings;

  const clientUrl = useMemo(() => {
    // Priorité 1: Tunnel URL (ngrok/cloudflare) - Requis par l'utilisateur
    if (roomSettings?.tunnel_url) return roomSettings.tunnel_url;

    // Priorité 2: IP locale injectée par le script tunnel (Fallback WiFi)
    if (roomSettings?.local_ip && roomSettings.local_ip !== "localhost") {
      return `http://${roomSettings.local_ip}:${window.location.port || 8888}`;
    }

    // Priorité 3: L'origine actuelle
    const origin = window.location.origin;
    if (origin.includes("localhost") && roomSettings?.local_ip) {
      return origin.replace("localhost", roomSettings.local_ip);
    }

    return origin;
  }, [roomSettings?.tunnel_url, roomSettings?.local_ip]);

  // Détection de changement d'URL publique (Tunnel)
  useEffect(() => {
    if (!clientUrl) return;

    const currentOrigin = window.location.origin;
    // On ne compare que si on est sur un tunnel (pas localhost)
    if (
      clientUrl.includes("ngrok") ||
      clientUrl.includes("cloudflare") ||
      clientUrl.includes("lhr.life")
    ) {
      if (currentOrigin !== clientUrl && !currentOrigin.includes("localhost")) {
        console.warn(`[Inseme] Tunnel URL changed: ${clientUrl}`);
        setBroadcastEvent({
          type: "url_change",
          newUrl: clientUrl,
        });
      }
    }
  }, [clientUrl]);

  useEffect(() => {
    const handleCelebrate = (e) => {
      const { level } = e.detail;
      setBroadcastEvent({ type: "celebrate", level });
      setTimeout(() => setBroadcastEvent(null), level === "imperial" ? 5000 : 2000);
    };

    const handleBell = () => {
      setBroadcastEvent({ type: "bell" });
      setTimeout(() => setBroadcastEvent(null), 3000);
    };

    window.addEventListener("inseme:celebrate", handleCelebrate);
    window.addEventListener("inseme:bell_ring", handleBell);
    window.addEventListener("inseme:open_barman_modal", () => setIsBarmanModalOpen(true));
    return () => {
      window.removeEventListener("inseme:celebrate", handleCelebrate);
      window.removeEventListener("inseme:bell_ring", handleBell);
      window.removeEventListener("inseme:open_barman_modal", () => setIsBarmanModalOpen(true));
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("inseme_client_screen", screen);
  }, [screen]);

  useEffect(() => {
    if (pseudo) localStorage.setItem("inseme_client_pseudo", pseudo);
  }, [pseudo]);

  useEffect(() => {
    localStorage.setItem("inseme_client_zone", zone);
  }, [zone]);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent.toLowerCase();
      setIsMobile(/mobile|android|iphone|ipad|tablet/i.test(ua));
    };
    checkMobile();
  }, []);

  const BLACKLIST = [
    "BARMAN",
    "OPHELIA",
    "OPHÉLIA",
    "ADMIN",
    "STAFF",
    "ROOT",
    "INSEME",
    "MODERATEUR",
    "SYSTEME",
    "SYSTÈME",
  ];

  const validatePseudo = (val) => {
    const cleaned = val.trim().toUpperCase();
    if (BLACKLIST.includes(cleaned)) return false;
    if (cleaned.length < 2) return false;
    return true;
  };

  const handleToggleGabriel = () => {
    const newMode = !isGabrielMode;
    setIsGabrielMode(newMode);
    localStorage.setItem("inseme_gabriel_mode", String(newMode));
  };

  useEffect(() => {
    if (isAfter && !pseudo) {
      const nocturnalPseudos = [
        "Chat Noir",
        "Hibou",
        "Lune Rose",
        "Noctambule",
        "Étoile Filante",
        "Rêveur",
        "Ombre",
        "Lumière",
      ];
      const randomPseudo = nocturnalPseudos[Math.floor(Math.random() * nocturnalPseudos.length)];
      setPseudo(randomPseudo);
    }
  }, [isAfter, pseudo]);

  const handleAfter = () => {
    if (isAfter) {
      alert("Vous êtes déjà dans un After !");
      return;
    }

    const confirmAfter = confirm(
      "Voulez-vous proposer un After ? Cela créera une salle éphémère et préviendra les autres participants."
    );

    if (confirmAfter) {
      const parentSlug = roomMetadata?.slug;
      if (!parentSlug) {
        alert("Impossible de créer un After : endroit introuvable.");
        return;
      }

      const afterSlug = `${parentSlug}-after-${Math.random().toString(36).substring(2, 7)}`;

      // Envoyer un message pour prévenir les autres avec un ton plus cool
      sendMessage({
        message: `🌙 L'After commence ! On se retrouve de l'autre côté pour finir la soirée tranquillement... 🥂\n\nRejoindre l'after : ${clientUrl}/app?room=${afterSlug}`,
        type: "after_proposal",
        metadata: {
          parent_slug: parentSlug,
          after_slug: afterSlug,
          proposed_by: pseudo || "Un noctambule",
          is_cool: true,
        },
      });

      // Envoyer un broadcast pour un effet visuel chez tout le monde
      if (sendBroadcast) {
        sendBroadcast("bell_ring", {
          message: `EXTINCTION DES FEUX... DIRECTION L'AFTER ! 🌙`,
        });
      }

      // Rediriger vers le nouvel After
      setTimeout(() => {
        window.location.search = `?room=${afterSlug}`;
      }, 1000);
    }
  };

  const [attachment, setAttachment] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    setPresenceMetadata((prev) => ({ ...prev, zone }));
  }, [zone, setPresenceMetadata]);

  const activeGames = messages?.filter(
    (msg) =>
      (msg.type === "challenge_start" || msg.type === "game_start") &&
      msg.metadata?.status === "active"
  );

  const legends = useMemo(() => {
    return (
      messages
        ?.filter((msg) => msg.type === "legend_add")
        .map((msg) => ({ ...msg.metadata, barName })) || []
    );
  }, [messages, barName]);

  const activeRituals = messages?.filter(
    (msg) => msg.type === "ritual_trigger" && new Date() - new Date(msg.created_at) < 60000 * 5 // 5 minutes
  );

  const vibeScore = useMemo(() => {
    const base = 70;
    const votes = roomData?.results || {};
    const positive = votes["vibe:up"] || 0;
    const negative = votes["vibe:down"] || 0;
    const score = base + positive * 5 - negative * 5;
    return Math.max(0, Math.min(100, score));
  }, [roomData?.results]);

  const vibeColor = useMemo(() => {
    if (vibeScore > 80) return "var(--mondrian-red)"; // Red - Hot
    if (vibeScore > 50) return "var(--mondrian-yellow)"; // Yellow - Good
    return "var(--mondrian-blue)"; // Blue - Chill
  }, [vibeScore]);

  const handleValidatePseudo = () => {
    if (!validatePseudo(pseudo)) return;

    const isFirstTime = !localStorage.getItem("inseme_client_pseudo");
    setIsEditingPseudo(false);

    if (isFirstTime) {
      let welcomeMsg = `[SYSTÈME] : Un nouveau client vient de se connecter sous le pseudo ${pseudo.trim().toUpperCase()} à ${barName} ! Bienvenue.`;
      if (invitedBy) {
        welcomeMsg += ` Merci à ${invitedBy.toUpperCase()} de l'avoir aidé à entrer. 🍻`;
      }

      sendMessage(welcomeMsg, {
        type: "welcome_client",
        metadata: {
          pseudo: pseudo.trim().toUpperCase(),
          invited_by: invitedBy || undefined,
        },
      });
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-50 font-mono flex flex-col fixed inset-0 text-black overflow-hidden">
      <BroadcastOverlay event={broadcastEvent} />
      {/* HEADER FIXE */}
      <header className="h-20 grid grid-cols-12 border-b-8 border-black bg-white shrink-0 z-50 transition-colors duration-1000">
        <div
          className="col-span-8 p-4 flex items-center border-r-8 border-black transition-colors duration-1000"
          style={{ backgroundColor: vibeColor }}
        >
          <h1
            className={`text-3xl md:text-5xl font-black italic tracking-tighter transition-colors duration-1000 ${vibeColor === "var(--mondrian-yellow)" ? "text-black" : "text-white"}`}
          >
            {barName}
          </h1>
        </div>
        <div className="col-span-4 flex">
          <button
            className="flex-1 bg-white hover:bg-black hover:text-white transition-colors border-r-4 border-black flex items-center justify-center"
            onClick={() => castVote("vibe:up")}
          >
            <ThumbsUp className="w-6 h-6" strokeWidth={3} />
          </button>
          <button
            className="flex-1 bg-white hover:bg-black hover:text-white transition-colors flex items-center justify-center"
            onClick={() => castVote("vibe:down")}
          >
            <ThumbsDown className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* CONTENU SCROLLABLE */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        {activeRituals?.length > 0 && (
          <div
            className="bg-mondrian-yellow border-b-8 border-black p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500 cursor-pointer hover:bg-black hover:text-mondrian-yellow transition-colors group"
            onClick={() => setScreen("ophelia")}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 group-hover:rotate-12 transition-transform" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                  Rituel Actif
                </p>
                <h3 className="text-xl font-black italic tracking-tighter leading-none">
                  {activeRituals[activeRituals.length - 1].metadata?.name}
                </h3>
              </div>
            </div>
            <div className="bg-black text-mondrian-yellow px-4 py-2 border-4 border-black group-hover:bg-mondrian-yellow group-hover:text-black transition-colors font-black text-xs uppercase">
              PARTICIPER
            </div>
          </div>
        )}

        {screen === "games" && <GamesScreen activeGames={activeGames} castVote={castVote} />}
        {screen === "legends" && <LegendsScreen legends={legends} />}
        {screen === "city" && <CityScreen commune={commune} roomMetadata={roomMetadata} />}
        {screen === "profile" && (
          <ProfileScreen
            context={context}
            pseudo={pseudo}
            zone={zone}
            isBarman={isBarman}
            roomMetadata={roomMetadata}
            onEditPseudo={() => setIsEditingPseudo(true)}
            onOpenBarmanModal={() => setIsBarmanModalOpen(true)}
            onZoneChange={setZone}
            publicLinks={normalizedPublicLinks}
            onPublicLinksChange={setPublicLinks}
          />
        )}
        {screen === "ophelia" && (
          <OpheliaScreen
            context={context}
            isMobile={isMobile}
            attachment={attachment}
            text={message}
            onTextChange={setMessage}
            onAttach={() => fileInputRef.current?.click()}
            onAttachCamera={() => setIsCameraOpen(true)}
            onAttachGallery={() => document.getElementById("client-gallery-input")?.click()}
            onClearAttachment={() => {
              if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
              setAttachment(null);
            }}
            onSend={async () => {
              if (!message.trim() && !attachment) return;

              const currentMsg = message;
              setMessage("");

              await sendMessage(
                currentMsg || "📸 Signal Visuel",
                {
                  type: "visual_signal",
                  pseudonym: pseudo || undefined,
                },
                attachment?.file
              );

              if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
              setAttachment(null);

              // Trigger AI response if in the right screen
              if (screen === "ophelia") {
                if (isGabrielMode) {
                  context.askGabriel(currentMsg);
                } else {
                  context.askOphélia(currentMsg);
                }
              }
            }}
            onTip={() => setIsTippingModalOpen(true)}
            onSuspendu={async () => {
              await sendMessage(
                `❤️ ${pseudo.toUpperCase() || "UN CLIENT"} offre un CAFÉ SUSPENDU ! Quelle générosité ! ✨`,
                {
                  type: "ritual_participation",
                  metadata: { ritual: "suspendu", name: "Café Suspendu" },
                  pseudonym: pseudo || undefined,
                }
              );
            }}
            onInvite={() => setIsInviteModalOpen(true)}
            onAfter={handleAfter}
            isAfter={isAfter}
            pseudo={pseudo}
            onEditPseudo={() => setIsEditingPseudo(true)}
            isGabrielMode={isGabrielMode}
            onToggleGabriel={handleToggleGabriel}
            showGabrielSettings={showGabrielSettings}
            onToggleSettings={() => setShowGabrielSettings(!showGabrielSettings)}
          />
        )}
      </main>

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        pseudo={pseudo}
        roomMetadata={roomMetadata}
        clientUrl={clientUrl}
      />

      {isEditingPseudo && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <MondrianBlock
            color="yellow"
            className="w-full max-w-md border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          >
            <h2 className="text-4xl font-black tracking-tighter mb-4 italic">Ton Pseudo ?</h2>
            <p className="text-xs font-bold mb-6 opacity-60">Pour que le barman sache qui régale</p>

            <div className="bg-black/5 border-2 border-black/10 p-3 mb-6 flex items-start gap-3">
              <Wind className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold leading-tight">
                Ici, la parole est libre. L'IA Ophélia est une animatrice, pas un gendarme. Elle est
                là pour l'ambiance et la macagna, pas pour surveiller.{" "}
                <span className="underline">Anonymat total</span> : pas de comptes, pas de flicage.
              </p>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="EX: PIET, GINA, BAMBINO..."
              value={pseudo}
              className="w-full bg-white border-4 border-black p-4 font-black text-xl focus:ring-0 focus:outline-none mb-6"
              onChange={(e) => setPseudo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && validatePseudo(pseudo)) handleValidatePseudo();
              }}
            />

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => setZone("indoor")}
                className={`border-4 border-black p-4 flex flex-col items-center gap-2 transition-all ${zone === "indoor" ? "bg-mondrian-blue text-white shadow-none translate-y-1" : "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`}
              >
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Intérieur</span>
              </button>
              <button
                onClick={() => setZone("outdoor")}
                className={`border-4 border-black p-4 flex flex-col items-center gap-2 transition-all ${zone === "outdoor" ? "bg-mondrian-red text-white shadow-none translate-y-1" : "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`}
              >
                <Wind className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Extérieur</span>
              </button>
            </div>

            <button
              disabled={!validatePseudo(pseudo)}
              onClick={handleValidatePseudo}
              className={`w-full bg-mondrian-red text-white border-4 border-black p-4 font-black uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none translate-y-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed`}
            >
              VALIDER
            </button>

            {!validatePseudo(pseudo) && pseudo.length > 0 && (
              <p className="text-[10px] font-black uppercase text-red-600 mt-4 text-center">
                {BLACKLIST.includes(pseudo.trim().toUpperCase())
                  ? "DÉSO, CE NOM EST RÉSERVÉ AU STAFF"
                  : "PSEUDO TROP COURT"}
              </p>
            )}
          </MondrianBlock>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            setAttachment({
              file,
              previewUrl: URL.createObjectURL(file),
            });
          }
        }}
      />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          const previewUrl = URL.createObjectURL(file);
          setAttachment({ file, previewUrl });
        }}
      />

      <input
        type="file"
        id="client-gallery-input"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            const previewUrl = URL.createObjectURL(file);
            setAttachment({ file, previewUrl });
          }
        }}
      />

      {/* NAVIGATION BAS */}
      <nav className="h-24 bg-white border-t-8 border-black shrink-0 relative z-50">
        <div className="grid grid-cols-7 h-full gap-0">
          <MondrianTabTrigger
            label="Légendes"
            icon={Trophy}
            isActive={screen === "legends"}
            onClick={() => setScreen("legends")}
            color="yellow"
          />
          <MondrianTabTrigger
            label="Ma Ville"
            icon={Map}
            isActive={screen === "city"}
            onClick={() => setScreen("city")}
            color="white"
          />
          <MondrianTabTrigger
            label="Jeux"
            icon={Zap}
            isActive={screen === "games"}
            onClick={() => setScreen("games")}
            color="yellow"
          />
          <MondrianTabTrigger
            label="Vocal"
            icon={Mic}
            isActive={false}
            onClick={() => (window.location.href = "/vocal")}
            color="white"
          />
          <MondrianTabTrigger
            label="Ophélia"
            icon={Radio}
            isActive={screen === "ophelia"}
            onClick={() => setScreen("ophelia")}
            color="red"
          />
          <MondrianTabTrigger
            label={isBarman ? "Barman" : "Tip"}
            icon={isBarman ? User : Coins}
            isActive={isTippingModalOpen || isBarmanModalOpen}
            onClick={() => (isBarman ? setIsBarmanModalOpen(true) : setIsTippingModalOpen(true))}
            color="blue"
          />
          <MondrianTabTrigger
            label="Profil"
            icon={User}
            isActive={screen === "profile"}
            onClick={() => setScreen("profile")}
            color="white"
          />
        </div>
      </nav>

      {/* MODALS TIPPING */}
      <TipModal
        isOpen={isTippingModalOpen}
        onClose={() => setIsTippingModalOpen(false)}
        barmans={barmans}
        onTip={handleTip}
        pseudo={pseudo}
        context={context}
      />
      <BarmanModal
        isOpen={isBarmanModalOpen}
        onClose={() => setIsBarmanModalOpen(false)}
        onDeclare={handleDeclareBarman}
        currentToken={tipToken}
      />

      {/* OVERLAY SUCCÈS POURBOIRE */}
      {showTipSuccess && tipSuccessData && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-black/60 backdrop-blur-md pointer-events-none">
          <MondrianBlock
            color="yellow"
            className="max-w-md border-8 border-black p-8 shadow-[16px_16px_0px_0px_var(--mondrian-red)] animate-in zoom-in duration-500"
          >
            <div className="flex flex-col items-center text-center">
              {tipSuccessData.method === "physical" ? (
                <Handshake className="w-20 h-20 mb-6 text-mondrian-blue animate-bounce" />
              ) : tipSuccessData.method === "wero" ? (
                <Smartphone className="w-20 h-20 mb-6 text-mondrian-yellow animate-bounce" />
              ) : (
                <Sparkles className="w-20 h-20 mb-6 text-mondrian-red animate-bounce" />
              )}
              <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-4 leading-none">
                {tipSuccessData.method === "physical" ? "C'EST FAIT ! 🤝" : "MERCI ! 🍻"}
              </h2>
              <p className="font-black uppercase text-xl mb-2">
                {tipSuccessData.method === "physical"
                  ? `Remerciement pour ${tipSuccessData.barman}`
                  : `${tipSuccessData.amount}€ pour ${tipSuccessData.barman}`}
              </p>
              <p className="font-bold uppercase text-[10px] opacity-60 leading-tight max-w-[200px]">
                {tipSuccessData.method === "wero"
                  ? "N'oubliez pas d'effectuer le virement sur votre application bancaire !"
                  : tipSuccessData.method === "physical"
                    ? "L'échange physique a été annoncé au bar. Santé !"
                    : "Votre soutien fait vivre le bar. Santé !"}
              </p>
            </div>
          </MondrianBlock>
        </div>
      )}
    </div>
  );
}
