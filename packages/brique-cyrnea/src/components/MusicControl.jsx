import React, { useState, useEffect } from "react";
import { useInsemeContext, MondrianBlock } from "@inseme/room";
import { TheBar } from "../singletons/index.js";
import { Music, Play, Pause, SkipForward, SkipBack, Power } from "lucide-react";

const SPOTIFY_CLIENT_ID = "VOTRE_CLIENT_ID_SPOTIFY"; // To be configured via settings
const DEFAULT_REDIRECT_URI = window.location.origin + "/bar"; // Need to handle auth callback

const MusicControl = ({ roomMetadata, _onToggle, _onVolumeChange }) => {
  const { updateRoomSettings } = useInsemeContext();
  const [token, setToken] = useState(sessionStorage.getItem("spotify_bar_token"));
  const [player, setPlayer] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [_deviceId, setDeviceId] = useState(null);
  const [status, setStatus] = useState("Déconnecté");

  // Accès direct au singleton Bar
  const _barName = TheBar.name;

  // Configuration from Room Settings (if available)
  const configClientId = roomMetadata?.settings?.spotify_client_id || SPOTIFY_CLIENT_ID;

  // Handle OAuth Callback in URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        setToken(accessToken);
        sessionStorage.setItem("spotify_bar_token", accessToken);
        window.location.hash = ""; // Clear hash
      }
    }
  }, []);

  // Initialize Player
  useEffect(() => {
    if (!token) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: `Cyrnea Bar Player`,
        getOAuthToken: (cb) => {
          cb(token);
        },
        volume: 0.5,
      });

      p.addListener("ready", ({ device_id }) => {
        console.debug("Ready with Device ID", device_id);
        setDeviceId(device_id);
        setStatus("Prêt (Device ID: " + device_id + ")");
      });

      p.addListener("not_ready", ({ device_id }) => {
        console.debug("Device ID has gone offline", device_id);
        setStatus("Offline");
      });

      p.addListener("player_state_changed", (state) => {
        if (!state) return;

        setIsPaused(state.paused);
        const track = state.track_window.current_track;
        setCurrentTrack(track);

        // Broadcast to Supabase via Room Settings
        const metadata = {
          source: "spotify",
          id: track.id,
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          album: track.album.name,
          cover: track.album.images[0]?.url,
          timestamp: Date.now(),
          position: state.position,
          is_paused: state.paused,
        };

        // Optimistic update to avoid heavy DB calls on every ms,
        // but for "state change" it's fine.
        updateRoomSettings({
          music: metadata,
        });
      });

      p.connect();
      setPlayer(p);
    };

    return () => {
      if (player) player.disconnect();
    };
  }, [token]);

  const handleLogin = () => {
    // Current URL as redirect
    // We need to strip sub-paths if we want a clean redirect,
    // but for BarmanDashboard, we are usually at /bar/:id
    const redirectUri = window.location.href.split("#")[0];
    const scope =
      "streaming user-read-playback-state user-modify-playback-state user-read-currently-playing";
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${configClientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    setToken(null);
    sessionStorage.removeItem("spotify_bar_token");
    if (player) player.disconnect();
    setPlayer(null);
    setStatus("Déconnecté");
  };

  if (!token) {
    return (
      <MondrianBlock color="white" className="border-4 border-black p-6 text-center">
        <Music className="w-12 h-12 mx-auto mb-4 text-black" />
        <h3 className="text-xl font-black uppercase mb-2">Musique du Bar</h3>
        <p className="text-xs mb-6 font-bold text-slate-500">
          Connectez Spotify pour contrôler l'ambiance et synchroniser les clients.
        </p>
        <button
          onClick={handleLogin}
          className="bg-[#1db954] text-white font-black uppercase py-3 px-6 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_black] active:shadow-none hover:brightness-110"
        >
          Connexion Spotify
        </button>
      </MondrianBlock>
    );
  }

  return (
    <MondrianBlock color="white" className="border-4 border-black p-0 overflow-hidden">
      {/* Header */}
      <div className="bg-[#1db954] p-3 border-b-4 border-black flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Music className="w-5 h-5 fill-current" />
          <span className="font-black uppercase tracking-widest text-sm">Spotify Bar</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-[10px] font-bold uppercase bg-black text-white px-2 py-1 rounded hover:bg-red-600"
        >
          Déco
        </button>
      </div>

      {/* Player UI */}
      <div className="p-4">
        {currentTrack ? (
          <div className="flex items-center gap-4 mb-6">
            <img
              src={currentTrack.album.images[0]?.url}
              alt="Cover"
              className="w-20 h-20 border-2 border-black shadow-md"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-black uppercase text-lg leading-none truncate">
                {currentTrack.name}
              </h4>
              <p className="font-bold text-slate-500 text-sm truncate">
                {currentTrack.artists.map((a) => a.name).join(", ")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] font-black uppercase bg-black text-white px-1.5 py-0.5 rounded">
                  {status}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 opacity-50">
            <Music className="w-12 h-12 mx-auto mb-2" />
            <p className="font-bold uppercase text-xs">Aucune lecture en cours</p>
            <p className="text-[10px]">{status}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => player?.previousTrack()}
            className="w-12 h-12 flex items-center justify-center bg-white border-2 border-black rounded-full hover:bg-slate-100 active:scale-95"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => player?.togglePlay()}
            className="w-16 h-16 flex items-center justify-center bg-black text-white border-2 border-black rounded-full hover:bg-slate-900 active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
          >
            {isPaused ? (
              <Play className="w-8 h-8 fill-current ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-current" />
            )}
          </button>

          <button
            onClick={() => player?.nextTrack()}
            className="w-12 h-12 flex items-center justify-center bg-white border-2 border-black rounded-full hover:bg-slate-100 active:scale-95"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>
    </MondrianBlock>
  );
};

export default MusicControl;
