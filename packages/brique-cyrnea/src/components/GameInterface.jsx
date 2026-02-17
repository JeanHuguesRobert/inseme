import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";
import { GAMES } from "../lib/gameManager.js";

/**
 * Interface de jeu pour les jeux interactifs
 */
const GameInterface = ({ game, sendMessage, pseudo }) => {
  const { gameId, gameState } = game.metadata;
  const gamePack = GAMES[gameId];
  const [input, setInput] = useState("");

  // Gestion des sons (Audio Hints)
  useEffect(() => {
    if (gameState?.audio_hint) {
      const audioMap = {
        correct: "/sounds/correct.mp3",
        wrong: "/sounds/wrong.mp3",
        hint: "/sounds/hint.mp3",
        win: "/sounds/win.mp3",
        lose: "/sounds/lose.mp3",
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
        game_id: gameId,
        action: type,
        payload,
        timestamp: Date.now(),
      },
    });
  };

  // Rendu spécifique selon le type de jeu
  if (gamePack?.render) {
    return gamePack.render({
      gameState,
      input,
      setInput,
      onAction: handleAction,
      pseudo,
    });
  }

  // Rendu par défaut (Mots Croisés)
  return (
    <div className="space-y-4">
      <div className="bg-black text-white p-3 font-bold text-sm italic border-l-8 border-mondrian-yellow relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1 opacity-20">
          <Icon name="volume2" className="w-4 h-4" />
        </div>
        "{gameState.broadcast_msg}"
      </div>

      {/* Grid Display pour Mots Croisés */}
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
            <button
              onClick={() => handleAction("DRAW", { description: input })}
              className="bg-mondrian-red text-white border-4 border-black font-black uppercase hover:translate-x-1 hover:translate-y-1 transition-transform"
              disabled={!input.trim()}
            >
              Dessiner
            </button>
            <button
              onClick={() => handleAction("GUESS", { word: input })}
              className="bg-mondrian-blue text-white border-4 border-black font-black uppercase hover:translate-x-1 hover:translate-y-1 transition-transform"
              disabled={!input.trim()}
            >
              Deviner
            </button>
          </div>
        </div>
      )}

      {/* Score / Leveling */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-center bg-slate-50 p-2">
        <div className="flex items-center gap-1">
          <Icon name="trophy" className="w-3 h-3 text-mondrian-yellow" />
          <span className="font-black text-[10px] uppercase">
            Niveau {gameState.leveling?.[pseudo] || 1}
          </span>
        </div>
        <span className="font-black text-[10px] uppercase">
          Score: {gameState.scores?.[pseudo] || 0} pts
        </span>
      </div>
    </div>
  );
};

export default GameInterface;
