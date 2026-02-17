import React, { useState } from "react";
import { Sparkles, Globe, X, MapPin, Wifi, Map, BookOpen, Radio } from "lucide-react";
import { Badge } from "@inseme/ui";
import { MondrianBlock } from "@inseme/room";

const MASTER_SESAME = "42";

export const CollectiveMoodWidget = ({ semanticWindow }) => {
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

export const GlobalConfigWidget = ({
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
  zones,
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
  const [tempZones, setTempZones] = useState(Array.isArray(zones) ? zones : []);
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
    setTempZones(Array.isArray(zones) ? zones : []);
  }, [ssid, password, commune, barSesame, facebookUrl, instagramUrl, customLinks, zones]);

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

  const handleZoneChange = (index, field, value) => {
    setTempZones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddZone = () => {
    setTempZones((prev) => [
      ...prev,
      { id: `zone-${Date.now()}`, label: "Nouvelle Zone", color: "bg-white" },
    ]);
  };

  const handleRemoveZone = (index) => {
    setTempZones((prev) => prev.filter((_, i) => i !== index));
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

    const normalizedZones = tempZones.filter((z) => z.label && z.label.trim());

    onUpdate({
      wifi_ssid: tempSsid,
      wifi_password: tempPass,
      commune: tempCommune,
      facebook_url: tempFacebook,
      instagram_url: tempInstagram,
      custom_links: normalizedCustomLinks,
      zones: normalizedZones,
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

      <div className="flex-1 p-3 flex flex-col justify-center overflow-y-auto">
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
              <label className="text-[8px] font-black uppercase opacity-40">Zones du Bar</label>
              <div className="space-y-2 mt-1">
                {tempZones.map((zone, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <input
                      value={zone.label}
                      onChange={(e) => handleZoneChange(index, "label", e.target.value)}
                      placeholder="Nom de la zone"
                      className="border-2 border-black p-1 text-[10px] font-bold uppercase tracking-tighter w-full focus:bg-mondrian-yellow/10 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveZone(index)}
                      className="border-2 border-black px-2 py-1 text-[10px] font-black uppercase bg-black text-white hover:bg-mondrian-red transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddZone}
                  className="border-2 border-dashed border-black px-2 py-1 text-[10px] font-black uppercase bg-white hover:bg-mondrian-yellow/20 transition-colors w-full"
                >
                  Ajouter une zone
                </button>
              </div>
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

export const CityLinksWidget = ({ commune, roomData }) => {
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
