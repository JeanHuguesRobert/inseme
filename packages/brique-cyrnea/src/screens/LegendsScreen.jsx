import React from "react";
import { Icon } from "../components/Icon";
import { MondrianBlock } from "../utils/uiUtils";
import { TheUser } from "../singletons/index.js";

/**
 * Écran d'affichage des légendes du bar
 */
const LegendsScreen = ({ legends, currentUser }) => {
  // Accès direct au singleton User
  const _pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4">
      <MondrianBlock
        color="white"
        className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        <div className="bg-black text-white p-3 flex items-center justify-between border-b-4 border-black">
          <h2 className="text-xl font-black italic tracking-tighter uppercase">
            Livre des Légendes
          </h2>
          <Icon name="trophy" className="w-5 h-5 text-mondrian-yellow" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]">
          {legends.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
              <div className="text-6xl mb-4">⭐</div>
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
                  <div className="absolute -top-3 -left-3 bg-mondrian-yellow text-black border-4 border-black px-2 py-0.5 text-[10px] font-black rotate-[-5deg]">
                    {legend.author}
                  </div>
                  <div className="flex items-start gap-4">
                    {legend.icon && <div className="text-4xl">{legend.icon}</div>}
                    <div className="flex-1">
                      <h3 className="font-black text-lg leading-tight mb-2">
                        {legend.original_message || legend.title}
                      </h3>
                      {legend.description && (
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {legend.description}
                        </p>
                      )}
                      {legend.image_url && (
                        <img
                          src={legend.image_url}
                          alt="Légende"
                          className="mt-4 border-4 border-black w-full grayscale hover:grayscale-0 transition-all"
                        />
                      )}
                      <div className="text-[8px] font-bold opacity-40 mt-4 text-right uppercase">
                        {new Date(legend.timestamp).toLocaleTimeString()} •{" "}
                        {legend.barName || "Bar"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </MondrianBlock>
    </div>
  );
};

export default LegendsScreen;
