import React, { useEffect, useState } from "react";
import { useInsemeContext, MondrianBlock } from "@inseme/room";
import { Music, Radio, Disc3, ExternalLink, Volume2 } from "lucide-react";

export default function RadioView() {
  const { roomMetadata, roomData } = useInsemeContext();
  const musicState = roomMetadata?.settings?.music || {};
  const barName = roomMetadata?.name || "Cyrnea";

  const [clientStatus, setClientStatus] = useState("Prêt à synchroniser");

  // Logic to play on user's Spotify
  const handlePlayOnSpotify = async () => {
    if (!musicState.uri) return alert("Aucune musique en cours au bar.");

    // Simple token flow for demo/POC
    // In production, this should be a proper OAuth flow
    let userToken = sessionStorage.getItem("spotify_client_token");

    if (!userToken) {
      const manual = prompt("Veuillez entrer votre Token Spotify (Bearer) pour synchroniser :");
      if (manual) {
        userToken = manual;
        sessionStorage.setItem("spotify_client_token", manual);
      } else {
        // Redirect to auth if needed, but for now prompt is safer to stay in app
        return;
      }
    }

    if (userToken && musicState.uri) {
      setClientStatus("Lancement...");
      try {
        const res = await fetch(`https://api.spotify.com/v1/me/player/play`, {
          method: "PUT",
          body: JSON.stringify({ uris: [musicState.uri], position_ms: musicState.position || 0 }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
        });

        if (res.status === 204) {
          setClientStatus("Lecture lancée sur votre appareil !");
        } else if (res.status === 404) {
          setClientStatus("Erreur: Aucun appareil Spotify actif.");
          alert("Ouvrez Spotify sur votre appareil pour que Cyrnea puisse le contrôler.");
        } else {
          const err = await res.json();
          setClientStatus("Erreur: " + (err.error?.message || "Inconnue"));
        }
      } catch (e) {
        console.error(e);
        setClientStatus("Erreur communication Spotify");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col items-center justify-center font-sans text-slate-100">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-mondrian-red rounded-full mb-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] border-2 border-black">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">Radio {barName}</h1>
          <p className="text-sm font-bold uppercase tracking-widest opacity-60">
            L'ambiance du bar, chez vous.
          </p>
        </div>

        {/* Now Playing Card */}
        <MondrianBlock
          color="white"
          className="border-4 border-black p-0 overflow-hidden shadow-[8px_8px_0px_0px_var(--mondrian-blue)]"
        >
          <div className="bg-black p-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
              <Volume2 className="w-3 h-3 animate-pulse" /> En Direct
            </span>
            <span className="text-[10px] font-bold uppercase text-white/60">
              {musicState.source || "OFFLINE"}
            </span>
          </div>

          <div className="p-6 text-center">
            {musicState.cover ? (
              <img
                src={musicState.cover}
                alt="Album Art"
                className="w-48 h-48 mx-auto mb-6 border-4 border-black shadow-lg"
              />
            ) : (
              <div className="w-48 h-48 mx-auto mb-6 border-4 border-black bg-slate-100 flex items-center justify-center">
                <Disc3 className="w-16 h-16 text-slate-300 animate-spin-slow" />
              </div>
            )}

            <h2 className="text-2xl font-black uppercase leading-tight mb-1 text-black">
              {musicState.name || "En attente..."}
            </h2>
            <p className="text-sm font-bold uppercase text-slate-500 mb-6">
              {musicState.artist || "Aucune musique détectée"}
            </p>

            {musicState.uri && (
              <button
                onClick={handlePlayOnSpotify}
                className="w-full bg-[#1db954] text-white font-black uppercase py-4 px-6 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 hover:brightness-110"
              >
                <Music className="w-5 h-5 fill-current" />
                Lire sur mon Spotify
              </button>
            )}

            <p className="mt-4 text-[10px] font-bold uppercase text-slate-400">{clientStatus}</p>
          </div>
        </MondrianBlock>

        {/* Footer Info */}
        <div className="text-center">
          <a
            href={`/app/${roomData?.slug || roomMetadata?.id}`}
            className="text-xs font-bold uppercase underline hover:text-mondrian-blue"
          >
            Retour à l'app client
          </a>
        </div>
      </div>
    </div>
  );
}
