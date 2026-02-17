import React from "react";
import { Sparkles, MapPin, Home, Wind, Coffee, Play, Clock, Moon, Trophy } from "lucide-react";
import { Button, Badge } from "@inseme/ui";
import { MondrianBlock } from "@inseme/room";
import { BAR_RITUALS } from "../lib/almanac.js";

export const CoffeeDistributorWidget = ({ count, onDistribute, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-mondrian-yellow" />
          <span className="text-[10px] font-black uppercase tracking-widest">Suspendus</span>
        </div>
        <span className="bg-mondrian-yellow text-black px-2 py-0.5 text-[10px] font-black rounded-sm">
          STOCK: {count || 0}
        </span>
      </div>
      <button
        disabled={!count || count <= 0 || !canModerate}
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

export const RitualsWidget = ({ onTrigger, currentUser }) => {
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

export const ZoneSwitcher = ({ currentZone, onZoneChange, zones }) => {
  const hasCustomZones = Array.isArray(zones) && zones.length > 0;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center gap-2 border-b-4 border-black">
        <MapPin className="w-4 h-4 text-mondrian-yellow" />
        <span className="text-[10px] font-black uppercase tracking-widest">Zone</span>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto min-h-[100px]">
        {!hasCustomZones ? (
          <>
            <button
              onClick={() => onZoneChange("indoor")}
              className={`flex-1 flex items-center gap-3 px-4 py-3 transition-colors ${currentZone === "indoor" ? "bg-mondrian-blue text-white" : "hover:bg-mondrian-blue/10 text-black"}`}
            >
              <Home className="w-5 h-5" />
              <span className="font-black uppercase text-xs">Intérieur</span>
            </button>
            <div className="h-[2px] bg-black" />
            <button
              onClick={() => onZoneChange("outdoor")}
              className={`flex-1 flex items-center gap-3 px-4 py-3 transition-colors ${currentZone === "outdoor" ? "bg-mondrian-red text-white" : "hover:bg-mondrian-red/10 text-black"}`}
            >
              <Wind className="w-5 h-5" />
              <span className="font-black uppercase text-xs">Extérieur</span>
            </button>
          </>
        ) : (
          zones.map((zone, i) => (
            <React.Fragment key={zone.id || i}>
              <button
                onClick={() => onZoneChange(zone.id)}
                className={`flex-1 min-h-[50px] flex items-center gap-3 px-4 py-3 transition-colors ${
                  currentZone === zone.id
                    ? "bg-mondrian-yellow text-black"
                    : "hover:bg-black/10 text-black"
                }`}
              >
                <MapPin className="w-5 h-5" />
                <span className="font-black uppercase text-xs">{zone.label}</span>
              </button>
              {i < zones.length - 1 && <div className="h-[2px] bg-black" />}
            </React.Fragment>
          ))
        )}
      </div>
    </MondrianBlock>
  );
};

export const SessionControlWidget = ({
  isOpen,
  onStartSession,
  onEndSession,
  currentUser,
  isAfter,
}) => {
  const canModerate = currentUser?.can?.moderate;

  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="bg-black text-white p-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-mondrian-yellow" />
          <span className="text-[10px] font-black uppercase tracking-widest">Session</span>
        </div>
        <Badge
          variant="outline"
          className={isOpen ? "bg-mondrian-blue text-white" : "bg-mondrian-red text-white"}
        >
          {isOpen ? "OUVERT" : "FERMÉ"}
        </Badge>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {!isOpen ? (
          <Button
            onClick={onStartSession}
            disabled={!canModerate}
            className="w-full bg-mondrian-blue text-white font-black uppercase border-2 border-black hover:bg-black"
          >
            OUVRIR LE BAR
          </Button>
        ) : (
          <Button
            onClick={onEndSession}
            disabled={!canModerate}
            className="w-full bg-mondrian-red text-white font-black uppercase border-2 border-black hover:bg-black"
          >
            CLÔTURER LA SOIRÉE
          </Button>
        )}
        {isAfter && (
          <div className="bg-black text-mondrian-yellow p-2 text-[10px] font-black uppercase text-center border-2 border-black animate-pulse">
            MODE AFTER ACTIF
          </div>
        )}
      </div>
    </MondrianBlock>
  );
};

export const LegendsWidget = ({ onPromoteToLegend, currentUser }) => {
  const canModerate = currentUser?.can?.moderate;
  return (
    <MondrianBlock
      color="white"
      className="border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-5 h-5 text-mondrian-yellow" />
        <h3 className="font-black uppercase text-sm">Panthéon des Légendes</h3>
      </div>
      <p className="text-[10px] font-bold opacity-60 uppercase mb-4">
        Promouvez les meilleures macagna dans l'histoire du bar.
      </p>
      {/* Ce widget est un placeholder car la logique est dans le Feed,
          mais il peut servir à afficher les légendes actuelles plus tard */}
    </MondrianBlock>
  );
};

export const MusicControlWidget = ({ onToggle, volume, onVolumeChange, currentUser }) => {
  // Simple placeholder for consistency as MusicControl component is imported separately
  return null;
};
