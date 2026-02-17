import React from "react";
import { Icon } from "../components/Icon";
import { GAMES } from "../lib/gameManager.js";
import { MondrianBlock } from "../utils/uiUtils";
import { TheUser } from "../singletons/index.js";

/**
 * Écran des jeux interactifs
 */
const GamesScreen = ({ activeGames, castVote, sendMessage, currentUser }) => {
  // Accès direct au singleton User
  const pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  const latestGame = activeGames?.find((g) => g.type === "game_start");

  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4">
      <div className="flex items-center gap-4 mb-8">
        <div className={`bg-mondrian-yellow w-4 h-full min-h-[60px] border-4 border-black`}>
          <Icon name="gamepad2" className="w-5 h-5 text-mondrian-yellow" />
        </div>
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter">Arcade</h2>
          <p className="text-xs font-bold opacity-60">Défiez le bar</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {latestGame ? (
          <GameInterface game={latestGame} sendMessage={sendMessage} pseudo={pseudo} />
        ) : (
          <>
            {activeGames?.length > 0 && (
              <div
                className={`bg-mondrian-red border-8 border-black p-6 mb-8 text-white relative animate-pulse shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`}
              >
                <h3 className="text-2xl font-black uppercase text-center mb-2">
                  ★ Défi en cours ★
                </h3>
                <div className="text-center font-bold uppercase text-sm">
                  Rejoignez {activeGames[0].metadata?.game || activeGames[0].metadata?.gameId} !
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 pb-8">
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
    </div>
  );
};

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

export default GamesScreen;
