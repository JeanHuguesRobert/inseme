import React, { useEffect } from "react";
import { TheBar, TheUser } from "../singletons/index.js";
import { useHybridPresence } from "../hooks/useHybridPresence.js";
import { Icon } from "../components/Icon";
import { MondrianBlock } from "../utils/uiUtils";
import { Share2 } from "lucide-react";
/**
 * Écran de la ville avec informations et liens sociaux
 */
const CityScreen = ({ context, currentUser, roomMetadata, roomData }) => {
  // Accès direct aux singletons
  const barName = TheBar.name;
  const commune = TheBar.commune;
  const barSlug = TheBar.slug;
  const facebookUrl = TheBar.settings.facebook_url;
  const instagramUrl = TheBar.settings.instagram_url;
  const customLinks = TheBar.settings.customLinks || [];

  const { presenceHistory: presentPeople } = useHybridPresence(
    TheBar.id || roomMetadata?.id,
    TheUser.id || currentUser?.user_id
  );

  useEffect(() => {
    console.debug("[Presence Debug] CityScreen update:", {
      presentPeople,
      barName,
      roomData,
      currentUser: currentUser?.pseudo,
      roomMetadata: roomMetadata?.id,
      roomMetadataSettings: roomMetadata?.settings,
      roomMetadataName: roomMetadata?.name,
      roomMetadataDisplayName: roomMetadata?.settings?.displayName,
    });
  }, [presentPeople, barName, roomData]);

  const getDuration = (dateStr) => {
    if (!dateStr) return "À l'instant";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "À l'instant";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h${Math.floor((mins % 60) / 10) * 10}`;
  };

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
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
              {commune || ""}
            </h2>
          </div>
          <Icon name="map" className="w-8 h-8" />
        </div>

        <div className="flex-1 p-6 space-y-6 bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px] flex flex-col justify-center">
          {/* PRESENCE BLOCK */}
          <div className="bg-white border-4 border-black p-4 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4">
            <div className="absolute -top-3 -left-3 bg-black text-white px-2 py-1 text-[10px] font-black uppercase rotate-[-2deg] border-2 border-white shadow-sm">
              Présents au {barName}
            </div>

            <div className="flex flex-wrap gap-3 mt-2">
              {presentPeople?.length > 0 ? (
                presentPeople.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-slate-50 border-2 border-black p-1 pr-3 rounded-full animate-in zoom-in duration-300"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 border-black text-white shadow-sm ${
                        ["bg-mondrian-red", "bg-mondrian-blue", "bg-mondrian-yellow text-black"][
                          i % 3
                        ]
                      }`}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black leading-none truncate max-w-[100px]">
                        {u.name}
                      </span>
                      <span className="text-[8px] font-bold opacity-60 leading-none mt-0.5">
                        {getDuration(u.joined_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 opacity-50">
                  <Icon name="wind" className="w-4 h-4" />
                  <span className="text-xs font-bold italic">C'est calme pour le moment...</span>
                </div>
              )}
            </div>
            <p className="text-[8px] font-bold uppercase text-right mt-2 opacity-40">
              Liste mise à jour en temps réel
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* GAZETTE VILLE */}
            <a
              href={`/gazette/global`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div
                className={`relative bg-mondrian-yellow border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform`}
              >
                <div className="bg-black text-white p-2 border-2 border-black">
                  <Icon name="bookOpen" className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">La Gazette</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Journal de la ville de {commune}
                  </p>
                </div>
              </div>
            </a>

            {/* WIKI LOCAL */}
            <a
              href={`/wiki/${commune}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
              <div className="relative bg-white border-2 border-black p-3 flex items-center gap-3 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                <div className="bg-black text-white p-2 border-2 border-black">
                  <Icon name="globe" className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">Wiki Local</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Savoirs & Histoire de la région
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
                  <Icon name="newspaper" className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase leading-none">Gazette du Bar</h4>
                  <p className="text-[8px] font-bold uppercase opacity-60">
                    Moments choisis du {barName}
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
                  <Icon name="radio" className="w-5 h-5" />
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
        </div>
      </MondrianBlock>
    </div>
  );
};

export default CityScreen;
