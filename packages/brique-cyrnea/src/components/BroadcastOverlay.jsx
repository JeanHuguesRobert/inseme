import React from "react";
import { Icon } from "./Icon";
import { MondrianBlock } from "../utils/uiUtils";

/**
 * Overlay pour les événements broadcast
 */
const BroadcastOverlay = ({ event }) => {
  if (!event) return null;

  const isBell = event.type === "bell";
  const isUrlChange = event.type === "url_change";
  const isPhoneRevealed = event.type === "phone_revealed";
  const isBarmanSuccess = event.type === "barman_success";
  const isBarmanCleared = event.type === "barman_cleared";
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
              <Icon name="phone" className="w-6 h-6" />
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
            <Icon name="radio" className="w-16 h-16 mb-6 animate-pulse" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4 leading-none">
              Nouvelle Fréquence
            </h2>
            <p className="font-bold uppercase text-sm mb-8 leading-relaxed">
              La connexion au bar a été mise à jour pour plus de stabilité. Basculez sur le nouveau
              canal !
            </p>
            <button
              onClick={() => {
                try {
                  const newUrlObj = new URL(event.newUrl);
                  const targetUrl = new URL(window.location.href);
                  targetUrl.protocol = newUrlObj.protocol;
                  targetUrl.host = newUrlObj.host;
                  targetUrl.port = newUrlObj.port;
                  window.location.href = targetUrl.toString();
                } catch (e) {
                  console.error("Invalid URL for new frequency", event.newUrl, e);
                  window.location.href = event.newUrl;
                }
              }}
              className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-mondrian-red transition-colors shadow-[8px_8px_0px_0px_var(--mondrian-red)] active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              REJOINDRE LE BAR
            </button>
          </div>
        </MondrianBlock>
      ) : isBarmanSuccess ? (
        <MondrianBlock
          color="white"
          className="max-w-md border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300 pointer-events-auto flex flex-col items-center text-center"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-4 leading-none">
            FÉLICITATIONS !
          </h2>
          <p className="font-bold uppercase text-sm mb-6 leading-relaxed">
            Vous êtes maintenant identifié comme Barman.
          </p>
          <div className="bg-mondrian-blue text-white px-4 py-2 border-4 border-black font-black uppercase text-xl transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            MODE STAFF ACTIVÉ
          </div>
        </MondrianBlock>
      ) : isBarmanCleared ? (
        <MondrianBlock
          color="white"
          className="max-w-md border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300 pointer-events-auto flex flex-col items-center text-center"
        >
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-4 leading-none">
            AU REVOIR !
          </h2>
          <p className="font-bold uppercase text-sm mb-6 leading-relaxed">
            Vous n'êtes plus identifié comme Barman.
          </p>
          <div className="bg-mondrian-red text-white px-4 py-2 border-4 border-black font-black uppercase text-xl transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            MODE STAFF DÉSACTIVÉ
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
                    <Icon name="volume2" className="w-6 h-6" />
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

export default BroadcastOverlay;
