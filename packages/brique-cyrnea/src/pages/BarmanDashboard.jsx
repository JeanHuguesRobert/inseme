import React, { useState, useMemo } from "react";
import {
  Users,
  Music,
  MessageSquare,
  Trophy,
  Play,
  SkipForward,
  Zap,
  Archive,
  Coffee,
  Radio,
  Camera,
  Image,
  X,
  Send,
  MapPin,
  Wind,
  Home,
  QrCode,
  Wifi,
  Globe,
  Map,
  BookOpen,
  Heart,
  Clock,
  Settings,
  Sparkles,
  Newspaper,
  Moon,
  Volume2,
} from "lucide-react";
import { Button, Badge } from "@inseme/ui";
import { useInsemeContext, TalkButton, OPHELIA_ID, MondrianBlock, CameraModal } from "@inseme/room";
import { storage } from "@inseme/cop-host";
import { getBarRoles } from "../lib/roles";
import FundingWidget from "./FundingWidget";
import { getDailyAlibi, BAR_RITUALS } from "../lib/almanac";
import { GAME_PACKS, game_reducer } from "../lib/gameManager";

const MASTER_SESAME = "42";

/* =========================
   BROADCAST OVERLAY
   ========================= */

const BroadcastOverlay = ({ event }) => {
  if (!event) return null;

  const isUrlChange = event.type === "url_change";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-8 overflow-hidden ${isUrlChange ? "bg-black/60 backdrop-blur-md pointer-events-auto" : "pointer-events-none"}`}
    >
      {isUrlChange && (
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
                url.search = window.location.search;
                window.location.href = url.toString();
              }}
              className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-mondrian-red transition-colors shadow-[8px_8px_0px_0px_var(--mondrian-red)] active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              REJOINDRE LE BAR
            </button>
          </div>
        </MondrianBlock>
      )}
    </div>
  );
};

/* =========================
   COMPOSANTS DASHBOARD (VIBRANT & COMPACT)
   ========================= */

const CollectiveMoodWidget = ({ semanticWindow }) => {
  if (!semanticWindow) return null;

  const themes = semanticWindow.themes || [];
  const mood = semanticWindow.group_mood || "Neutre";
  const intensity = semanticWindow.intensity || 0;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mondrian-yellow" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Ambiance Collective
          </span>
        </div>
        <Badge variant="outline" className="text-[8px] border-white text-white">
          {Math.round(intensity * 100)}%
        </Badge>
      </div>

      <div className="flex-1 p-2 flex flex-col justify-center">
        <div className="mb-2">
          <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter leading-none block mb-1">
            Humeur dominante
          </span>
          <span className="text-sm font-black uppercase text-mondrian-blue">{mood}</span>
        </div>
        <div>
          <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter leading-none block mb-1">
            Sujets chauds
          </span>
          <div className="flex flex-wrap gap-1">
            {themes.slice(0, 3).map((t, i) => (
              <span
                key={i}
                className="bg-white border border-black/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MondrianBlock>
  );
};

const GlobalConfigWidget = ({
  ssid,
  password,
  onUpdate,
  commune,
  currentUser,
  barSesame,
  hasSesameSession,
  onSesameValidated,
  onSesameChange,
  facebookUrl,
  instagramUrl,
  customLinks,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempSsid, setTempSsid] = useState(ssid || "");
  const [tempPass, setTempPass] = useState(password || "");
  const [tempCommune, setTempCommune] = useState(commune || "");
  const [tempSesame, setTempSesame] = useState(barSesame || "");
  const [tempFacebook, setTempFacebook] = useState(facebookUrl || "");
  const [tempInstagram, setTempInstagram] = useState(instagramUrl || "");
  const [tempCustomLinks, setTempCustomLinks] = useState(
    Array.isArray(customLinks) ? customLinks : []
  );
  const [sesameInput, setSesameInput] = useState("");
  const [sesameError, setSesameError] = useState("");

  const sesameRequired = !!barSesame;
  const canConfigure = currentUser?.can?.configure;
  const hasAccess = canConfigure && (!sesameRequired || hasSesameSession);

  React.useEffect(() => {
    setTempSsid(ssid || "");
    setTempPass(password || "");
    setTempCommune(commune || "");
    setTempSesame(barSesame || "");
    setTempFacebook(facebookUrl || "");
    setTempInstagram(instagramUrl || "");
    setTempCustomLinks(Array.isArray(customLinks) ? customLinks : []);
  }, [ssid, password, commune, barSesame, facebookUrl, instagramUrl, customLinks]);

  const handleCustomLinkChange = (index, field, value) => {
    setTempCustomLinks((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const current = next[index] || {};
      next[index] = { ...current, [field]: value };
      return next;
    });
  };

  const handleAddCustomLink = () => {
    setTempCustomLinks((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [...base, { label: "", url: "" }];
    });
  };

  const handleRemoveCustomLink = (index) => {
    setTempCustomLinks((prev) => {
      if (!Array.isArray(prev)) return [];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = () => {
    const normalizedCustomLinks = (Array.isArray(tempCustomLinks) ? tempCustomLinks : []).filter(
      (link) =>
        link &&
        typeof link.label === "string" &&
        typeof link.url === "string" &&
        link.label.trim() &&
        link.url.trim()
    );

    onUpdate({
      wifi_ssid: tempSsid,
      wifi_password: tempPass,
      commune: tempCommune,
      facebook_url: tempFacebook,
      instagram_url: tempInstagram,
      custom_links: normalizedCustomLinks,
    });
    if (onSesameChange) {
      onSesameChange(tempSesame);
    }
    setIsEditing(false);
  };

  const handleSesameSubmit = () => {
    const entered = sesameInput;
    const matchesBar = barSesame && entered === barSesame;
    const matchesMaster = entered === MASTER_SESAME;

    if (matchesBar || matchesMaster) {
      setSesameError("");
      setSesameInput("");
      if (onSesameValidated) {
        onSesameValidated();
      }
    } else {
      setSesameError("Mauvais sésame");
    }
  };

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-mondrian-yellow" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Configuration Ville & Bar
          </span>
        </div>
        {hasAccess && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] font-black uppercase hover:text-mondrian-yellow transition-colors"
          >
            {isEditing ? "ANNULER" : "MODIFIER"}
          </button>
        )}
      </div>

      <div className="flex-1 p-3 flex flex-col justify-center">
        {isEditing && hasAccess ? (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">Ville / Commune</label>
              <input
                value={tempCommune}
                onChange={(e) => setTempCommune(e.target.value)}
                placeholder="EX: CORTE"
                className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">WiFi (SSID)</label>
              <input
                value={tempSsid}
                onChange={(e) => setTempSsid(e.target.value)}
                placeholder="NOM DU WIFI"
                className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">WiFi Password</label>
              <input
                value={tempPass}
                onChange={(e) => setTempPass(e.target.value)}
                placeholder="MOT DE PASSE"
                className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">
                Sésame configuration bar (optionnel)
              </label>
              <input
                type="password"
                value={tempSesame}
                onChange={(e) => setTempSesame(e.target.value)}
                placeholder="Mot de passe partagé"
                className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">Liens sociaux</label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                <input
                  value={tempFacebook}
                  onChange={(e) => setTempFacebook(e.target.value)}
                  placeholder="Lien Facebook du bar"
                  className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
                />
                <input
                  value={tempInstagram}
                  onChange={(e) => setTempInstagram(e.target.value)}
                  placeholder="Lien Instagram du bar"
                  className="border-2 border-black p-1 text-xs font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase opacity-40">
                Liens personnalisés
              </label>
              <div className="space-y-2 mt-1">
                {Array.isArray(tempCustomLinks) &&
                  tempCustomLinks.map((link, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        value={link.label || ""}
                        onChange={(e) => handleCustomLinkChange(index, "label", e.target.value)}
                        placeholder="Nom"
                        className="border-2 border-black p-1 text-[10px] font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
                      />
                      <input
                        value={link.url || ""}
                        onChange={(e) => handleCustomLinkChange(index, "url", e.target.value)}
                        placeholder="Lien"
                        className="border-2 border-black p-1 text-[10px] font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomLink(index)}
                        className="border-2 border-black px-2 py-1 text-[10px] font-black uppercase bg-black text-white hover:bg-mondrian-red transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  onClick={handleAddCustomLink}
                  className="border-2 border-dashed border-black px-2 py-1 text-[10px] font-black uppercase bg-white hover:bg-mondrian-yellow/20 transition-colors"
                >
                  Ajouter un lien
                </button>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="bg-mondrian-red text-white border-2 border-black p-1 text-[10px] font-black uppercase hover:bg-black transition-colors"
            >
              ENREGISTRER
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-mondrian-red" />
                <p className="text-xs font-black uppercase">{commune || "Commune non définie"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-mondrian-blue" />
                <p className="text-xs font-bold uppercase">{ssid || "WiFi non configuré"}</p>
              </div>
            </div>
            {sesameRequired && canConfigure && !hasSesameSession && (
              <div className="border-t border-black/10 pt-2">
                <p className="text-[8px] font-black uppercase opacity-60 mb-1">
                  Sésame requis pour modifier la configuration du bar.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={sesameInput}
                    onChange={(e) => setSesameInput(e.target.value)}
                    placeholder="Entrer le sésame"
                    className="flex-1 border-2 border-black p-1 text-[10px] font-bold uppercase tracking-tighter focus:bg-mondrian-yellow/10 outline-none"
                  />
                  <button
                    onClick={handleSesameSubmit}
                    className="px-2 border-2 border-black bg-black text-white text-[10px] font-black uppercase hover:bg-mondrian-yellow hover:text-black transition-colors"
                  >
                    Valider
                  </button>
                </div>
                {sesameError && (
                  <p className="text-[8px] font-black text-mondrian-red mt-1">{sesameError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </MondrianBlock>
  );
};

const SuspendedCoffeeWidget = ({ count, onDistribute, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-mondrian-yellow" />
          <span className="text-[10px] font-black uppercase tracking-widest">Suspendus</span>
        </div>
        <span className="bg-mondrian-yellow text-black px-2 py-0.5 text-[10px] font-black rounded-sm">
          STOCK: {count}
        </span>
      </div>
      <button
        disabled={count <= 0 || !canModerate}
        onClick={onDistribute}
        className={`flex-1 flex flex-col items-center justify-center p-3 transition-all ${
          count > 0 && canModerate
            ? "bg-mondrian-yellow hover:bg-black hover:text-mondrian-yellow text-black"
            : "bg-white text-black/20 cursor-not-allowed opacity-50"
        }`}
      >
        <Coffee className="w-8 h-8 mb-2" strokeWidth={3} />
        <span className="font-black uppercase text-[10px] tracking-tighter leading-none">
          {!canModerate
            ? "Accès réservé"
            : count > 0
              ? "Distribuer un café"
              : "Aucun café en attente"}
        </span>
      </button>
    </MondrianBlock>
  );
};

const RitualsWidget = ({ onTrigger, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex justify-between items-center mb-2 border-b-4 border-black pb-2 px-2 pt-2 bg-black text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-mondrian-yellow" strokeWidth={4} />
          <h2 className="text-lg font-black tracking-tighter uppercase">Rituels</h2>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 divide-x-2 divide-y-2 divide-black overflow-hidden relative">
        {!canModerate && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center p-4 text-center">
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">
              Réservé aux Barmen
            </span>
          </div>
        )}
        {BAR_RITUALS.map((ritual) => (
          <button
            key={ritual.id}
            disabled={!canModerate}
            onClick={() => onTrigger(ritual)}
            className={`flex flex-col items-center justify-center p-2 transition-colors group text-center ${
              canModerate ? "hover:bg-mondrian-yellow" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <span className="font-black text-[10px] uppercase leading-tight mb-1">
              {ritual.name}
            </span>
            <span className="text-[8px] font-bold opacity-60 leading-tight">{ritual.ritual}</span>
          </button>
        ))}
      </div>
    </MondrianBlock>
  );
};

const ZoneSwitcher = ({ currentZone, onZoneChange }) => (
  <MondrianBlock
    color="white"
    className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
  >
    <div className="bg-black text-white p-2 flex items-center gap-2 border-b-4 border-black">
      <MapPin className="w-4 h-4 text-mondrian-yellow" />
      <span className="text-[10px] font-black uppercase tracking-widest">Zone</span>
    </div>
    <div className="flex-1 flex flex-col">
      <button
        onClick={() => onZoneChange("indoor")}
        className={`flex-1 flex items-center gap-3 px-4 transition-colors ${currentZone === "indoor" ? "bg-mondrian-blue text-white" : "hover:bg-mondrian-blue/10 text-black"}`}
      >
        <Home className="w-5 h-5" />
        <span className="font-black uppercase text-xs">Intérieur</span>
      </button>
      <div className="h-1 bg-black" />
      <button
        onClick={() => onZoneChange("outdoor")}
        className={`flex-1 flex items-center gap-3 px-4 transition-colors ${currentZone === "outdoor" ? "bg-mondrian-red text-white" : "hover:bg-mondrian-red/10 text-black"}`}
      >
        <Wind className="w-5 h-5" />
        <span className="font-black uppercase text-xs">Extérieur</span>
      </button>
    </div>
  </MondrianBlock>
);

const AlmanacWidget = ({ alibi, onTrigger }) => (
  <div
    className="flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-colors p-2 rounded border border-white/20"
    onClick={onTrigger}
  >
    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-mondrian-yellow mb-0.5 whitespace-nowrap">
      L'Alibi du {alibi.date}
    </div>
    <div className="text-sm font-black text-white uppercase leading-none truncate max-w-[150px]">
      {alibi.name}
    </div>
    <div className="text-[8px] font-bold text-white/70 uppercase tracking-tighter mt-1 italic">
      Rituel: {alibi.ritual}
    </div>
  </div>
);

const CityLinksWidget = ({ commune, roomData }) => {
  const barSlug = roomData?.slug || roomData?.id || "cyrnea";

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-mondrian-blue text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-white" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Liens de la Commune
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 flex flex-col gap-2 justify-center">
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`/gazette/${commune || "global"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-2 bg-mondrian-yellow border-2 border-black hover:bg-black hover:text-mondrian-yellow transition-all group"
            title="La Gazette"
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[7px] font-black uppercase mt-1">Gazette</span>
          </a>
          <a
            href={`/wiki/${commune || "commune"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-2 bg-white border-2 border-black hover:bg-black hover:text-white transition-all group"
            title="Wiki Local"
          >
            <Globe className="w-4 h-4" />
            <span className="text-[7px] font-black uppercase mt-1">Wiki</span>
          </a>
          <a
            href={`/blog/${barSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-2 bg-mondrian-red text-white border-2 border-black hover:bg-black hover:text-mondrian-red transition-all group"
            title="Blog du Bar"
          >
            <Radio className="w-4 h-4" />
            <span className="text-[7px] font-black uppercase mt-1">Blog</span>
          </a>
        </div>
      </div>
    </MondrianBlock>
  );
};

const RoleSwitcher = ({ currentRole, onRoleChange, currentUser, BAR_ROLES }) => {
  const canConfigure = currentUser?.can?.configure;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex justify-between items-center mb-2 border-b-4 border-black pb-2 px-2 pt-2 bg-black text-white">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-mondrian-yellow" strokeWidth={4} />
          <h2 className="text-lg font-black tracking-tighter">Ambiance</h2>
        </div>
      </div>
      <div className="flex-1 flex flex-col divide-y-2 divide-black overflow-hidden relative">
        {!canConfigure && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center p-4 text-center">
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">
              Réservé aux Administrateurs
            </span>
          </div>
        )}
        {Object.values(BAR_ROLES).map((role) => (
          <button
            key={role.id}
            disabled={!canConfigure}
            onClick={() => onRoleChange(role.id)}
            className={`flex-1 flex flex-col justify-center p-3 text-left transition-colors group ${
              currentRole === role.id ? "bg-mondrian-yellow" : "hover:bg-mondrian-yellow/10"
            } ${!canConfigure ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-xs">{role.name}</span>
              {currentRole === role.id && <Zap className="w-4 h-4 text-black animate-pulse" />}
            </div>
            <span className="text-[9px] font-bold opacity-60 leading-tight">
              {role.description}
            </span>
          </button>
        ))}
      </div>
    </MondrianBlock>
  );
};

const DashHeader = ({
  barName,
  activeSpeakersCount,
  onShowPass,
  alibi,
  onTriggerRitual,
  currentUser,
  isAfter,
  sessionStatus,
  terminology,
}) => (
  <header
    className={`grid grid-cols-12 border-4 border-black mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-1000 ${
      isAfter ? "bg-black" : "bg-white"
    }`}
  >
    <MondrianBlock
      color={isAfter ? "black" : "red"}
      className="col-span-12 md:col-span-8 border-b-4 md:border-b-0 md:border-r-4 border-black p-4 flex flex-row items-center justify-between"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h1
            className={`text-3xl md:text-5xl font-black tracking-tighter leading-none italic mix-blend-hard-light ${
              isAfter ? "text-mondrian-blue" : "text-white"
            }`}
          >
            {isAfter ? "After " : ""}
            {barName} Dash
          </h1>
          <div className="flex flex-wrap gap-2">
            {isAfter ? (
              <div className="flex items-center gap-2 bg-mondrian-blue text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest rounded-full animate-pulse">
                <Moon className="w-3 h-3" />
                <span>AFTER MODE</span>
              </div>
            ) : (
              <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest rounded-full hidden md:inline-block">
                BETA
              </span>
            )}

            {sessionStatus === "open" ? (
              <div className="flex items-center gap-2 bg-mondrian-blue text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest rounded-full">
                <Play className="w-3 h-3 fill-current" />
                <span>{terminology?.session || "Session"} Ouverte</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-mondrian-red text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest rounded-full">
                <Clock className="w-3 h-3" />
                <span>{terminology?.session || "Session"} Close</span>
              </div>
            )}
          </div>
        </div>
        {currentUser && (
          <div className="mt-2 bg-black/20 px-2 py-0.5 inline-block">
            <span className="text-[9px] font-black uppercase text-white tracking-widest">
              {currentUser.summary}
            </span>
          </div>
        )}
      </div>
      <div className="text-right hidden md:block">
        <AlmanacWidget alibi={alibi} onTrigger={onTriggerRitual} />
      </div>
    </MondrianBlock>

    <div
      className="col-span-6 md:col-span-2 bg-mondrian-yellow border-r-4 md:border-r-0 border-black flex items-center justify-center p-2 gap-2 text-black cursor-pointer hover:bg-white transition-colors group"
      onClick={onShowPass}
    >
      <QrCode className="w-8 h-8 group-hover:scale-110 transition-transform" strokeWidth={3} />
      <span className="text-xs font-black uppercase tracking-widest leading-none">
        Pass
        <br />
        Entrée
      </span>
    </div>

    <div className="col-span-6 md:col-span-2 flex flex-col divide-y-4 border-black bg-white">
      <div className="flex-1 bg-white flex items-center justify-center p-2 gap-2 text-black">
        <Users className="w-5 h-5" strokeWidth={3} />
        <span className="text-2xl font-black">{activeSpeakersCount}</span>
      </div>
      {/* Funding Widget */}
      <div className="flex-1">
        <FundingWidget />
      </div>

      <div className="flex-1 bg-black flex items-center justify-center p-2 gap-2">
        <div className="w-2 h-2 bg-mondrian-red rounded-full border border-white animate-pulse" />
        <span className="text-white font-black uppercase tracking-widest text-[10px]">LIVE</span>
      </div>
    </div>
  </header>
);

const QrPassModal = ({ isOpen, onClose, roomSettings, onWelcome, barName, roomSlug: propSlug }) => {
  if (!isOpen) return null;
  const [showWifi, setShowWifi] = useState(false);
  const [newPseudo, setNewPseudo] = useState("");

  const [broadcastEvent, setBroadcastEvent] = useState(null);

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
  React.useEffect(() => {
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

  const roomSlug =
    propSlug || roomSettings?.slug || window.location.search.match(/room=([^&]+)/)?.[1] || "cyrnea";
  const appInviteUrl = `${clientUrl}/app?room=${roomSlug}`;

  const wifiSsid = roomSettings?.wifi_ssid || `${barName}-WiFi`;
  const wifiPass = roomSettings?.wifi_password || "bar-pass";
  const wifiQr = `WIFI:S:${wifiSsid};T:WPA;P:${wifiPass};;`;

  const appQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(appInviteUrl)}&bgcolor=ffd500`;
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(wifiQr)}&bgcolor=ffd500`;

  const handleWelcome = () => {
    if (!newPseudo.trim()) return;
    onWelcome(newPseudo.trim());
    setNewPseudo("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-red)] relative overflow-hidden my-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="p-8 flex flex-col items-center">
          <div className="flex gap-2 mb-6 w-full">
            <button
              onClick={() => setShowWifi(false)}
              className={`flex-1 py-2 px-4 border-4 border-black font-black uppercase text-xs transition-colors flex items-center justify-center gap-2 ${!showWifi ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"}`}
            >
              <Globe className="w-4 h-4" /> App
            </button>
            <button
              onClick={() => setShowWifi(true)}
              className={`flex-1 py-2 px-4 border-4 border-black font-black uppercase text-xs transition-colors flex items-center justify-center gap-2 ${showWifi ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"}`}
            >
              <Wifi className="w-4 h-4" /> WiFi
            </button>
          </div>

          <MondrianBlock
            color="yellow"
            className="mb-8 p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <img
              src={showWifi ? wifiQrUrl : appQrUrl}
              alt={showWifi ? "WiFi QR Code" : "Invitation QR Code"}
              className="w-64 h-64 md:w-80 md:h-80 mix-blend-multiply"
            />
          </MondrianBlock>

          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-center leading-none">
            {showWifi ? "Accès WiFi" : "Carte d'Entrée"}
          </h2>
          <p className="text-[10px] font-bold text-center uppercase tracking-widest opacity-60 mb-6 bg-slate-100 px-3 py-1 border border-black/10 rounded-full truncate max-w-full">
            {showWifi ? `SSID: ${wifiSsid}` : clientUrl}
          </p>

          {!showWifi && (
            <div className="w-full border-4 border-black bg-slate-50 p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                <Users className="w-3 h-3" /> Arrivée Client
              </h3>
              <div className="flex gap-2">
                <input
                  value={newPseudo}
                  onChange={(e) => setNewPseudo(e.target.value)}
                  placeholder="PSEUDO..."
                  className="flex-1 border-2 border-black p-2 text-xs font-bold uppercase focus:bg-yellow-50 outline-none"
                />
                <button
                  onClick={handleWelcome}
                  disabled={!newPseudo.trim()}
                  className="bg-black text-white px-4 py-2 text-[10px] font-black uppercase hover:bg-mondrian-red transition-colors disabled:opacity-50"
                >
                  Bienvenue
                </button>
              </div>
            </div>
          )}

          <div className="w-full border-t-4 border-black pt-4 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
            <span>{showWifi ? wifiPass : roomSettings?.commune || "Inseme"}</span>
            <span>2026 Edition</span>
          </div>
        </div>
      </MondrianBlock>
    </div>
  );
};

const VibeWidget = ({ score, onCheck, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex justify-between items-center mb-2 border-b-4 border-black pb-2 px-2 pt-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-mondrian-red" strokeWidth={4} />
          <h2 className="text-lg font-black tracking-tighter">Vibe</h2>
        </div>
        <span className="text-3xl font-black italic">{score}%</span>
      </div>

      <div className="flex-1 flex flex-col gap-2 p-2 pt-0">
        <div className="h-4 border-2 border-black bg-white relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-mondrian-blue to-mondrian-red transition-all duration-700 ease-out border-r-2 border-black"
            style={{ width: `${score}%` }}
          />
        </div>

        <Button
          className={`w-full h-10 border-2 border-black font-black uppercase text-xs rounded-none transition-all active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            canModerate
              ? "bg-mondrian-yellow text-black hover:bg-black hover:text-mondrian-yellow"
              : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
          }`}
          onClick={onCheck}
          disabled={!canModerate}
        >
          {canModerate ? "Vote Vibe" : "Accès Réservé"}
        </Button>
      </div>
    </MondrianBlock>
  );
};

const MusicWidget = ({ currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="blue"
      className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full relative overflow-hidden"
    >
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-mondrian-red rounded-full animate-bounce" />
        <div className="w-1.5 h-1.5 bg-mondrian-yellow rounded-full animate-bounce delay-75" />
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-150" />
      </div>

      <div className="p-4 flex flex-col justify-center h-full text-white">
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <Music className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Now Playing</span>
        </div>
        <p className="text-xl md:text-2xl font-black leading-none tracking-tighter italic truncate">
          Terra
        </p>
        <p className="text-xs font-bold mt-1 opacity-90">I Muvrini</p>
      </div>

      <div className="absolute bottom-0 right-0 p-2">
        <Button
          size="icon"
          disabled={!canModerate}
          className={`h-8 w-8 bg-black text-white border-2 border-white hover:bg-mondrian-red ${!canModerate ? "opacity-30 cursor-not-allowed" : ""}`}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </MondrianBlock>
  );
};

const GamesWidget = ({ onStartChallenge, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;
  const games = Object.values(GAME_PACKS);

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col"
    >
      <div className="border-b-4 border-black p-2 bg-black text-white flex justify-between items-center">
        <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
          <Trophy className="w-4 h-4 text-mondrian-yellow" strokeWidth={4} />
          Logic Social Games
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto relative">
        {(!onStartChallenge || !canModerate) && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center p-4 text-center">
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">
              {!canModerate ? "Réservé aux Barmen" : "Interaction restreinte"}
            </span>
          </div>
        )}
        {games.map((g, i) => (
          <div
            key={g.id}
            className={`flex items-center justify-between border-b-2 border-black p-3 transition-colors group
                  ${i % 3 === 0 ? "bg-mondrian-red text-white" : i % 3 === 1 ? "bg-mondrian-blue text-white" : "bg-mondrian-yellow text-black"}
                  ${onStartChallenge && canModerate ? "cursor-pointer hover:brightness-110" : "opacity-50 cursor-not-allowed"}
               `}
            onClick={() => onStartChallenge && canModerate && onStartChallenge(g.id, "Tous")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{g.icon}</span>
              <div>
                <p className="font-black uppercase text-sm leading-none">{g.label}</p>
                <p className="text-[9px] font-bold uppercase opacity-80">{g.description}</p>
              </div>
            </div>
            <Play className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </MondrianBlock>
  );
};

const MicWidget = ({
  context,
  isMobile,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  attachment,
  onClearAttachment,
  text,
  onTextChange,
  onSend,
  onTip,
  onLastCall,
  onAfter,
  onCloseEvening,
  onOpenEvening,
  sessionStatus,
  terminology,
}) => {
  const { currentUser } = context;
  const canSpeak = currentUser?.can?.speak;

  return (
    <MondrianBlock
      color="yellow"
      className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center p-4 text-center h-full relative"
    >
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5" strokeWidth={4} />
          <h2 className="text-xl font-black uppercase tracking-tighter">Live Mic</h2>
        </div>
        <button
          onClick={() =>
            (window.location.href = window.location.pathname.replace("/bar", "/vocal"))
          }
          className="p-2 hover:bg-black hover:text-mondrian-yellow transition-colors border-2 border-black"
          title="Mode 100% Vocal"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {sessionStatus === "closed" && (
        <div className="absolute inset-0 bg-mondrian-yellow/90 backdrop-blur-md z-[40] flex flex-col items-center justify-center p-6 text-center">
          <Play className="w-12 h-12 text-black mb-4 animate-pulse fill-current" />
          <h3 className="text-2xl font-black text-black uppercase tracking-tighter mb-2">
            {terminology?.session || "Soirée"} Close
          </h3>
          <p className="text-[10px] font-bold text-black uppercase mb-6 max-w-[200px]">
            Le bar est actuellement fermé. Ouvrez-le pour commencer à enregistrer les logs et
            activer Ophélia.
          </p>
          <Button
            onClick={onOpenEvening}
            className="w-full bg-black text-white hover:bg-white hover:text-black font-black uppercase tracking-widest rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] transition-all"
          >
            Ouvrir la {terminology?.session || "Soirée"}
          </Button>
        </div>
      )}

      {!canSpeak && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-30 flex items-center justify-center p-4 text-center">
          <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">
            Interaction restreinte
          </span>
        </div>
      )}

      {attachment && (
        <div className="absolute top-2 right-2 w-16 h-16 border-2 border-black bg-white group overflow-hidden z-20">
          <img src={attachment.previewUrl} className="w-full h-full object-cover" alt="Preview" />
          <button
            onClick={onClearAttachment}
            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 w-full flex flex-col justify-center items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-black p-4 border-4 border-white rounded-full relative shadow-lg">
            <TalkButton
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
              size="lg"
              className="scale-125 border-2 border-white"
              disabled={!canSpeak}
            />
          </div>

          <button
            disabled={!canSpeak}
            onClick={() => {
              if (isMobile) {
                onAttach();
              } else {
                onAttachCamera();
              }
            }}
            className={`p-4 rounded-full border-4 border-black transition-all ${
              attachment
                ? "bg-mondrian-red text-white"
                : "bg-white text-black hover:bg-black hover:text-white"
            } ${!canSpeak ? "opacity-50 cursor-not-allowed" : ""}`}
            title={isMobile ? "Prendre une photo (Caméra)" : "Prendre une photo (Webcam)"}
          >
            <Camera className="w-6 h-6" strokeWidth={3} />
          </button>

          <button
            disabled={!canSpeak}
            onClick={onAttachGallery}
            className={`p-4 rounded-full border-4 border-black transition-all ${
              attachment
                ? "bg-mondrian-red text-white"
                : "bg-white text-black hover:bg-black hover:text-white"
            } ${!canSpeak ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Choisir une image (Galerie)"
          >
            <Image className="w-6 h-6" strokeWidth={3} />
          </button>

          <button
            disabled={!canSpeak}
            onClick={() => handleTip("normal")}
            onContextMenu={(e) => {
              e.preventDefault();
              handleTip("royal");
            }}
            onDoubleClick={() => handleTip("imperial")}
            className={`p-4 rounded-full border-4 border-black bg-mondrian-yellow text-black hover:bg-white transition-all group ${
              !canSpeak ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Signaler un pourboire (Clic: Normal, Double: Impérial, Droit: Royal)"
          >
            <Heart
              className="w-6 h-6 group-hover:scale-125 transition-transform text-mondrian-red"
              strokeWidth={3}
              fill="currentColor"
            />
          </button>

          <button
            disabled={!canSpeak}
            onClick={handleLastCall}
            className={`p-4 rounded-full border-4 border-black bg-black text-white hover:bg-mondrian-red transition-all group ${
              !canSpeak ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Dernière tournée ! (Sonne la cloche)"
          >
            <Clock className="w-6 h-6 group-hover:rotate-12 transition-transform" strokeWidth={3} />
          </button>

          <button
            disabled={!canSpeak}
            onClick={onAfter}
            className={`p-4 rounded-full border-4 border-black bg-mondrian-blue text-white hover:bg-black hover:text-mondrian-blue transition-all group ${
              !canSpeak ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Proposer un After (Salle éphémère)"
          >
            <Moon
              className="w-6 h-6 group-hover:scale-110 transition-transform animate-pulse"
              strokeWidth={3}
            />
          </button>

          <button
            disabled={!canSpeak}
            onClick={onCloseEvening}
            className={`p-4 rounded-full border-4 border-black bg-white text-black hover:bg-black hover:text-white transition-all group ${
              !canSpeak ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Clôturer la soirée"
          >
            <Archive
              className="w-6 h-6 group-hover:scale-110 transition-transform"
              strokeWidth={3}
            />
          </button>
        </div>

        <div className="w-full relative mt-2">
          <input
            type="text"
            disabled={!canSpeak}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={canSpeak ? "Flash message..." : "Lecture seule"}
            className="w-full bg-white border-4 border-black p-2 font-black text-xs focus:ring-0 focus:outline-none placeholder:text-black/30 pr-10 disabled:bg-slate-50"
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <button
            onClick={onSend}
            disabled={!canSpeak || (!text && !attachment)}
            className={`absolute right-1 top-1 bottom-1 px-2 border-l-2 border-black flex items-center justify-center transition-colors ${
              (text || attachment) && canSpeak ? "bg-mondrian-red text-white" : "text-black/20"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 shrink-0">
        <div className="w-2 h-2 bg-mondrian-red rounded-full animate-pulse" />
        <p className="text-[10px] font-black uppercase tracking-widest text-black/60">
          Diffusion Prioritaire
        </p>
      </div>
    </MondrianBlock>
  );
};

const FeedWidget = ({ messages, onPromoteToLegend, onPromoteToGazette, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col"
    >
      <div className="flex justify-between items-center p-2 border-b-4 border-black bg-slate-50">
        <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
          <MessageSquare className="w-4 h-4" strokeWidth={4} /> Feed
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0 scrollbar-hide bg-white">
        {messages
          .slice(-12)
          .reverse()
          .map((msg, i) => (
            <div
              key={i}
              className={`p-2 border-b border-black text-xs flex flex-col gap-1 text-black group relative ${msg.user_id === OPHELIA_ID ? "bg-mondrian-yellow/10" : "bg-white"}`}
            >
              <div className="flex items-start gap-2">
                <span className="font-black uppercase text-[10px] min-w-[60px] text-right truncate text-mondrian-blue">
                  {msg.name}
                </span>
                <p className="font-bold leading-tight uppercase flex-1">{msg.message}</p>
                <div className="flex gap-1">
                  {msg.type === "after_proposal" && (
                    <button
                      onClick={() => (window.location.search = `?room=${msg.metadata?.after_slug}`)}
                      className="p-1 bg-mondrian-blue text-white border-2 border-black hover:bg-black hover:text-mondrian-blue transition-all flex items-center gap-1 px-2 animate-pulse"
                      title="Rejoindre l'After"
                    >
                      <Moon className="w-3 h-3" />
                      <span className="text-[8px] font-black">REJOINDRE L'AFTER</span>
                    </button>
                  )}
                  {onPromoteToLegend && canModerate && msg.user_id !== OPHELIA_ID && (
                    <button
                      onClick={() => onPromoteToLegend(msg)}
                      className="p-1 bg-mondrian-yellow border-2 border-black hover:bg-black hover:text-mondrian-yellow transition-all"
                      title="Ajouter aux Légendes"
                    >
                      <Trophy className="w-3 h-3" />
                    </button>
                  )}
                  {onPromoteToGazette && canModerate && msg.user_id !== OPHELIA_ID && (
                    <button
                      onClick={() => onPromoteToGazette(msg)}
                      className="p-1 bg-mondrian-blue text-white border-2 border-black hover:bg-black hover:text-mondrian-blue transition-all"
                      title="Promouvoir en Gazette de la Ville"
                    >
                      <Newspaper className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {msg.metadata?.image_url && (
                <div className="ml-[68px] mt-1 border border-black max-w-[120px]">
                  <img src={msg.metadata.image_url} alt="Signal" className="w-full h-auto" />
                </div>
              )}
            </div>
          ))}
      </div>
    </MondrianBlock>
  );
};

export default function BarmanDashboard() {
  const context = useInsemeContext();
  const {
    messages,
    activeSpeakers,
    sendMessage,
    roomData,
    roomMetadata,
    updateRoomSettings,
    presenceMetadata,
    setPresenceMetadata,
    askOphélia,
    sendBroadcast,
    currentUser,
    isAfter,
    isEphemeral,
    generateReport,
    cleanupEphemeralLogs,
    endSession,
    startSession,
    terminology,
  } = context;

  const sessionStatus = roomData?.sessionStatus || "closed";

  const barName = roomMetadata?.name || "Bar";
  const barSlug = roomMetadata?.slug || roomMetadata?.id || "bar";
  const BAR_ROLES = useMemo(() => getBarRoles(barName), [barName]);

  const [mobileTab, setMobileTab] = useState(
    () => localStorage.getItem("inseme_barman_tab") || "overview"
  ); // overview, games, mic, settings

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = React.useRef(null);
  const galleryInputRef = React.useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const barSesame = roomMetadata?.settings?.bar_sesame || "";
  const sesameStorageKey = `inseme_bar_sesame_ok_${barSlug}`;
  const [hasSesameSession, setHasSesameSession] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(sesameStorageKey) === "true";
  });

  React.useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent.toLowerCase();
      setIsMobile(/mobile|android|iphone|ipad|tablet/i.test(ua));
    };
    checkMobile();
  }, []);

  const handleSesameValidated = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(sesameStorageKey, "true");
    }
    setHasSesameSession(true);
  };

  const handleSesameChange = async (newSesame) => {
    await updateRoomSettings({
      ...roomMetadata?.settings,
      bar_sesame: newSesame || null,
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem(sesameStorageKey);
    }
  };

  // Restricted Access Guard
  if (currentUser && !currentUser.can.moderate) {
    return (
      <div className="min-h-screen bg-mondrian-red flex items-center justify-center p-8">
        <MondrianBlock
          color="white"
          className="max-w-md p-8 border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] text-center"
        >
          <Zap className="w-16 h-16 mx-auto mb-6 text-mondrian-red" strokeWidth={4} />
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 italic">
            Accès Réservé
          </h1>
          <p className="font-bold uppercase text-sm mb-6 leading-tight">
            Désolé, ce tableau de bord est réservé aux barmen et administrateurs.
          </p>
          <div className="bg-slate-100 p-4 border-2 border-black mb-6">
            <span className="text-[10px] font-black uppercase opacity-60 block mb-1">
              Votre Statut
            </span>
            <span className="text-xs font-black uppercase">{currentUser.summary}</span>
          </div>
          <Button
            onClick={() => (window.location.href = "/")}
            className="w-full bg-black text-white hover:bg-mondrian-blue transition-colors rounded-none font-black uppercase"
          >
            Retour à l'accueil
          </Button>
        </MondrianBlock>
      </div>
    );
  }

  // Persist mobile tab
  React.useEffect(() => {
    localStorage.setItem("inseme_barman_tab", mobileTab);
  }, [mobileTab]);

  const currentRole = roomMetadata?.settings?.ophelia?.role || "bar-indoor";
  const currentZone = presenceMetadata?.zone || "indoor";

  const handleZoneChange = (zone) => {
    setPresenceMetadata((prev) => ({ ...prev, zone }));
    localStorage.setItem("inseme_barman_zone", zone);
  };

  // Restore zone on mount
  React.useEffect(() => {
    const savedZone = localStorage.getItem("inseme_barman_zone");
    if (savedZone) {
      setPresenceMetadata((prev) => ({ ...prev, zone: savedZone }));
    }
  }, [setPresenceMetadata]);

  const handleRoleChange = async (roleId) => {
    await updateRoomSettings({
      ...roomMetadata?.settings,
      ophelia: {
        ...roomMetadata?.settings?.ophelia,
        role: roleId,
      },
    });

    const roleName = BAR_ROLES[roleId === "bar-outdoor" ? "outdoor" : "indoor"].name;
    sendMessage(`[SYSTÈME] : Changement d'ambiance -> ${roleName}`, {
      type: "system_info",
    });
  };

  const handleWiFiUpdate = async (settings) => {
    await updateRoomSettings({
      ...roomMetadata?.settings,
      ...settings,
    });
    sendMessage(`[SYSTÈME] : Configuration du bar mise à jour.`, {
      type: "system_info",
    });
  };

  const vibeScore = useMemo(() => {
    const base = 70;
    const votes = roomData?.results || {};
    const positive = votes["vibe:up"] || 0;
    const negative = votes["vibe:down"] || 0;
    const score = base + positive * 5 - negative * 5;
    return Math.max(0, Math.min(100, score));
  }, [roomData?.results]);

  const handleStartChallenge = (gameId, target) => {
    const gamePack = GAME_PACKS[gameId];
    if (!gamePack) return;

    // Inject persistent leveling from room settings
    const initialState = {
      ...gamePack.state_machine.initial,
      leveling: roomMetadata?.settings?.player_levels || {},
    };

    sendMessage(
      `[JEU] : ${gamePack.meta.label.toUpperCase()} lancé ! ${gamePack.narrative_prompts.intro}`,
      {
        type: "game_start",
        metadata: {
          gameId,
          target,
          status: "active",
          gameState: initialState,
        },
      }
    );
  };

  const handleVibeCheck = () => {
    sendMessage("inseme vote vibe", {
      type: "vibe_check",
      metadata: { is_flash_poll: true },
    });
  };

  // Heartbeat SYSTEM_TICK every 30s for Logic-Driven Social Engine
  React.useEffect(() => {
    if (!currentUser?.can?.moderate) return;

    const interval = setInterval(() => {
      const activeGameMsg = messages
        .slice()
        .reverse()
        .find(
          (m) =>
            (m.type === "game_start" || m.type === "game_update") && m.metadata.status === "active"
        );

      if (activeGameMsg) {
        const { gameId } = activeGameMsg.metadata;
        sendMessage(`[TICK]`, {
          type: "game_action",
          metadata: {
            gameId,
            action: { type: "SYSTEM_TICK", actorId: "SYSTEM", payload: {} },
          },
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [messages, currentUser, sendMessage]);

  // Logic-Driven Social Engine: Process Game Actions (Arbitre & Reducer)
  React.useEffect(() => {
    const lastMessage = messages?.[messages.length - 1];
    if (!lastMessage || !currentUser?.can?.moderate) return;

    if (lastMessage.type === "game_action") {
      const { gameId, action } = lastMessage.metadata;
      const gamePack = GAME_PACKS[gameId];

      const activeGameMsg = messages
        .slice()
        .reverse()
        .find(
          (m) =>
            (m.type === "game_start" || m.type === "game_update") &&
            m.metadata.gameId === gameId &&
            m.metadata.status === "active"
        );

      if (activeGameMsg && gamePack) {
        const currentState = activeGameMsg.metadata.gameState;

        // --- CENTRALISATION BACKEND (Ophélia) ---
        // On demande à Ophélia d'arbitrer et d'animer le jeu via ses outils Edge.
        const prompt = `ALERTE JEU : Une action "${action.type}" a été émise par ${
          action.actorId
        } pour le jeu "${gamePack.meta.label}".
                        1. Utilise l'outil "manage_game" pour obtenir le nouvel état.
                        2. Si l'action est valide, utilise "send_room_message" avec le type "game_update" pour diffuser le nouvel état (metadata.gameState).
                        3. Commente l'action de façon arrogante ou stylée Mondrian.
                        État actuel : ${JSON.stringify(currentState)}
                        Action : ${JSON.stringify(action)}`;

        askOphélia(prompt).catch((e) => console.error("Erreur délégation Ophélia", e));
      }
    }
  }, [messages, currentUser, sendMessage, askOphélia]);

  const handleTip = (level = "normal") => {
    const messages = {
      normal: `[POURBOIRE] : Un immense merci pour le geste ! 🍻✨`,
      royal: `[POURBOIRE ROYAL] : 👑 UN GESTE DE ROI ! Le comptoir s'incline. Merci ! 💎✨`,
      imperial: `[POURBOIRE IMPÉRIAL] : 🦅 L'EMPIRE VOUS SALUE ! Un pourboire historique ! 🍾🏆🔥`,
    };

    sendMessage(messages[level] || messages.normal, {
      type: "tip",
      metadata: { level },
    });

    if (level === "royal" || level === "imperial") {
      sendBroadcast("celebrate", { id: `tip-${level}-${Date.now()}`, level });
    }
  };

  const handleLastCall = () => {
    sendMessage(`[SYSTÈME] : 🚨 DERNIÈRE TOURNÉE ! Les commandes ferment bientôt. 🕛`, {
      type: "last_call",
    });

    sendBroadcast("bell_ring", {
      type: "last_call",
      time: new Date().toLocaleTimeString(),
    });

    // Dispatch local event for dashboard animations or persistence if needed
    window.dispatchEvent(
      new CustomEvent("inseme:event", {
        detail: { type: "last_call" },
      })
    );
  };

  const suspendedCount = useMemo(() => {
    const totalGifts =
      messages?.filter(
        (msg) => msg.type === "ritual_participation" && msg.metadata?.ritual === "suspendu"
      ).length || 0;

    const totalDistributed =
      messages?.filter(
        (msg) => msg.type === "ritual_consumed" && msg.metadata?.ritual === "suspendu"
      ).length || 0;

    return Math.max(0, totalGifts - totalDistributed);
  }, [messages]);

  const handleDistributeSuspended = () => {
    sendMessage(
      `[SYSTÈME] : ☕ Un café suspendu vient d'être offert à un client chanceux ! Merci aux généreux donateurs.`,
      {
        type: "ritual_consumed",
        metadata: { ritual: "suspendu" },
      }
    );
  };

  const handlePromoteToLegend = (msg) => {
    sendMessage(`[LÉGENDE] : Une nouvelle macagna entre dans l'histoire ! 🏆`, {
      type: "legend_add",
      metadata: {
        original_message: msg.message,
        author: msg.name,
        timestamp: msg.created_at,
        image_url: msg.metadata?.image_url,
      },
    });
  };

  const handlePromoteToGazette = (msg) => {
    const commune = roomMetadata?.settings?.commune || "la Ville";
    sendMessage(
      `[GAZETTE] : Un moment de ${barName} est proposé pour la Gazette de ${commune} ! 🗞️`,
      {
        type: "gazette_draft",
        metadata: {
          content: msg.message,
          author: msg.name,
          source: `${barName} Bar`,
          commune,
          image_url: msg.metadata?.image_url,
          gazette: barSlug,
        },
      }
    );
  };

  const handleCloseEvening = async () => {
    const confirmClose = confirm(
      "Voulez-vous clôturer la soirée ? Cela générera un résumé et nettoiera les messages anciens pour préserver l'anonymat."
    );
    if (confirmClose) {
      try {
        // Utilisation du mécanisme unifié de clôture (endSession)
        if (endSession) {
          await endSession();
        } else {
          // Fallback au cas où endSession ne serait pas dispo
          if (generateReport) await generateReport();
          if (cleanupEphemeralLogs) await cleanupEphemeralLogs(3);
        }

        // Message de confirmation local
        sendMessage("🌙 La soirée est officiellement archivée. À demain ! 🥂", {
          type: "system_summary",
          is_ai: true,
        });
      } catch (err) {
        alert("Erreur lors de la clôture : " + err.message);
      }
    }
  };

  const handleAfter = () => {
    const confirmAfter = confirm(
      "Voulez-vous proposer un After ? Cela créera une salle éphémère et préviendra les autres participants."
    );
    if (confirmAfter) {
      const parentSlug = roomMetadata?.slug || barSlug;
      const afterSlug = `${parentSlug}-after-${Math.random().toString(36).substring(2, 7)}`;

      const clientUrl = roomMetadata?.settings?.tunnel_url || window.location.origin;
      // Message d'invitation avec un style spécial pour l'after
      sendMessage(
        `🌙 L'After commence ! On se retrouve de l'autre côté pour finir la soirée tranquillement... 🥂\n\nRejoindre l'after : ${clientUrl}/app?room=${afterSlug}`,
        {
          type: "after_proposal",
          metadata: {
            parent_slug: parentSlug,
            after_slug: afterSlug,
            proposed_by: "Le Barman",
            is_cool: true,
          },
        }
      );

      if (sendBroadcast) {
        sendBroadcast("bell_ring", {
          message: `EXTINCTION DES FEUX... DIRECTION L'AFTER ! 🌙`,
        });
      }

      // Petit délai pour laisser le message s'envoyer avant de rediriger
      setTimeout(() => {
        window.location.search = `?room=${afterSlug}`;
      }, 1500);
    }
  };

  const handleWelcomeClient = (pseudo) => {
    const barmanName = currentUser?.display_name || "le Barman";
    sendMessage(
      `[SYSTÈME] : ${pseudo} vient d'arriver à ${barName} ! Merci à ${barmanName} de l'avoir aidé à entrer. 🥳`,
      {
        type: "welcome_client",
        metadata: { pseudo, invited_by: barmanName },
      }
    );
  };

  const alibi = useMemo(() => getDailyAlibi(), []);

  const handleTriggerRitual = () => {
    sendMessage(`[RITUEL] : Aujourd'hui c'est la ${alibi.name}. Rituel : ${alibi.ritual} ! 🍷🐚`, {
      type: "ritual_trigger",
      metadata: { ritual: alibi.name },
    });
  };

  const handleTriggerBarRitual = (ritual) => {
    sendMessage(`[RITUEL] : ${ritual.name.toUpperCase()} ! ${ritual.ritual} 🍻✨`, {
      type: "ritual_trigger",
      metadata: { ritual: ritual.id, name: ritual.name },
    });

    if (ritual.id === "echo") {
      askOphélia(
        "[SYSTÈME] : Le rituel de l'Écho du Comptoir a été lancé. C'est l'heure de ta synthèse de clôture !"
      );
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
  };

  const clearAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  };

  const handleSend = async () => {
    if (!message.trim() && !attachment) return;

    // Barmans send "SNAPSHOTS" by default if attachment, or system_summary if text only?
    // Let's use "snapshot" for anything sent from the Dashboard Action area for now.
    await sendMessage(message || "📸 Partage d'un moment", { type: "snapshot" }, attachment?.file);

    setMessage("");
    clearAttachment();
  };

  return (
    <div
      className={`h-[100dvh] text-black font-mono flex flex-col fixed inset-0 overflow-hidden transition-colors duration-1000 ${
        isAfter ? "bg-black" : "bg-white"
      }`}
    >
      <QrPassModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        roomSettings={roomMetadata?.settings}
        roomSlug={barSlug}
        onWelcome={handleWelcomeClient}
        barName={barName}
      />

      <div className="p-4 md:p-8 shrink-0">
        <DashHeader
          barName={barName}
          activeSpeakersCount={activeSpeakers?.length || 0}
          onShowPass={() => setIsQrModalOpen(true)}
          alibi={alibi}
          onTriggerRitual={handleTriggerRitual}
          currentUser={currentUser}
          isAfter={isAfter}
          sessionStatus={sessionStatus}
          terminology={terminology}
        />
      </div>

      <div className="flex-1 overflow-y-auto md:overflow-visible px-4 md:px-8 pb-32 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[calc(100vh-250px)]">
          {/* LEFT COLUMN - VIBE & MUSIC & ROLES */}
          <div
            className={`md:col-span-4 flex flex-col gap-6 h-full ${mobileTab === "overview" || mobileTab === "settings" ? "block" : "hidden md:flex"}`}
          >
            <div className={`flex-[0.2] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <CollectiveMoodWidget semanticWindow={context.semanticWindow} />
            </div>
            <div className={`flex-[0.2] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <GlobalConfigWidget
                ssid={roomMetadata?.settings?.wifi_ssid}
                password={roomMetadata?.settings?.wifi_password}
                onUpdate={handleWiFiUpdate}
                commune={roomMetadata?.settings?.commune}
                currentUser={currentUser}
                barSesame={barSesame}
                hasSesameSession={hasSesameSession}
                onSesameValidated={handleSesameValidated}
                onSesameChange={handleSesameChange}
                facebookUrl={roomMetadata?.settings?.facebook_url}
                instagramUrl={roomMetadata?.settings?.instagram_url}
                customLinks={roomMetadata?.settings?.custom_links}
              />
            </div>
            <div className={`flex-[0.2] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <CityLinksWidget commune={roomMetadata?.settings?.commune} roomData={roomData} />
            </div>
            <div className={`flex-[0.2] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <RoleSwitcher
                currentRole={currentRole}
                onRoleChange={handleRoleChange}
                currentUser={currentUser}
                BAR_ROLES={BAR_ROLES}
              />
            </div>
            <div className={`flex-[0.2] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <ZoneSwitcher currentZone={currentZone} onZoneChange={handleZoneChange} />
            </div>
            <div className={`flex-[0.4] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <RitualsWidget onTrigger={handleTriggerBarRitual} currentUser={currentUser} />
            </div>
            <div className={`flex-[0.3] ${mobileTab === "settings" ? "block" : "hidden md:block"}`}>
              <SuspendedCoffeeWidget
                count={suspendedCount}
                onDistribute={handleDistributeSuspended}
                currentUser={currentUser}
              />
            </div>
            <div className={`flex-[0.3] ${mobileTab === "overview" ? "block" : "hidden md:block"}`}>
              <VibeWidget score={vibeScore} onCheck={handleVibeCheck} currentUser={currentUser} />
            </div>
            <div className={`flex-[0.4] ${mobileTab === "overview" ? "block" : "hidden md:block"}`}>
              <MusicWidget currentUser={currentUser} />
            </div>
          </div>

          {/* CENTER COLUMN - FEED & GAMES */}
          <div
            className={`md:col-span-5 flex flex-col gap-6 h-full ${mobileTab === "overview" || mobileTab === "games" ? "block" : "hidden md:flex"}`}
          >
            <div
              className={`flex-1 min-h-[400px] md:min-h-0 ${mobileTab === "overview" ? "block" : "hidden md:block"}`}
            >
              <FeedWidget
                messages={messages}
                onPromoteToLegend={currentUser?.can?.moderate ? handlePromoteToLegend : null}
                onPromoteToGazette={currentUser?.can?.moderate ? handlePromoteToGazette : null}
                currentUser={currentUser}
              />
            </div>
            <div
              className={`h-[250px] shrink-0 ${mobileTab === "games" ? "block h-full min-h-[500px]" : "hidden md:block"}`}
            >
              <GamesWidget
                onStartChallenge={currentUser?.can?.speak ? handleStartChallenge : null}
                currentUser={currentUser}
              />
            </div>
          </div>

          {/* RIGHT COLUMN - MIC */}
          <div
            className={`md:col-span-3 h-full ${mobileTab === "mic" ? "block min-h-[500px]" : "hidden md:block"}`}
          >
            <div className="h-full flex flex-col gap-4">
              <MicWidget
                context={context}
                isMobile={isMobile}
                onAttach={() => fileInputRef.current?.click()}
                onAttachCamera={() => setIsCameraOpen(true)}
                onAttachGallery={() => galleryInputRef.current?.click()}
                attachment={attachment}
                onClearAttachment={clearAttachment}
                text={message}
                onTextChange={setMessage}
                onSend={handleSend}
                onTip={handleTip}
                onLastCall={handleLastCall}
                onAfter={handleAfter}
                onCloseEvening={handleCloseEvening}
                onOpenEvening={startSession}
                sessionStatus={sessionStatus}
                terminology={terminology}
              />
              {(attachment || message.trim()) && (
                <Button
                  className="w-full bg-mondrian-red text-white border-4 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                  onClick={handleSend}
                >
                  {attachment ? "Partager capture" : "Diffuser flash"}
                </Button>
              )}
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
          />
          <input
            type="file"
            ref={galleryInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          const previewUrl = URL.createObjectURL(file);
          setAttachment({ file, previewUrl });
        }}
      />

      {/* BROADCAST OVERLAY */}
      <BroadcastOverlay event={broadcastEvent} />

      {/* MOBILE NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t-4 border-black grid grid-cols-4 z-50">
        <div
          onClick={() => setMobileTab("overview")}
          className={`flex flex-col items-center justify-center border-r-4 border-black ${mobileTab === "overview" ? "bg-mondrian-red text-white" : "bg-white text-black"}`}
        >
          <Zap className="w-6 h-6 mb-1" strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">Dash</span>
        </div>
        <div
          onClick={() => setMobileTab("games")}
          className={`flex flex-col items-center justify-center border-r-4 border-black ${mobileTab === "games" ? "bg-mondrian-yellow text-black" : "bg-white text-black"}`}
        >
          <Trophy className="w-6 h-6 mb-1" strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">Jeux</span>
        </div>
        <div
          onClick={() => setMobileTab("mic")}
          className={`flex flex-col items-center justify-center border-r-4 border-black ${mobileTab === "mic" ? "bg-mondrian-blue text-white" : "bg-white text-black"}`}
        >
          <Radio className="w-6 h-6 mb-1" strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">Mic</span>
        </div>
        <div
          onClick={() => setMobileTab("settings")}
          className={`flex flex-col items-center justify-center ${mobileTab === "settings" ? "bg-black text-white" : "bg-white text-black"}`}
        >
          <Settings className="w-6 h-6 mb-1" strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">Config</span>
        </div>
      </div>
    </div>
  );
}
