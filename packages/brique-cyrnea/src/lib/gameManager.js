/**
 * packages/brique-cyrnea/src/lib/gameManager.js
 * The Logic-Driven Social Engine
 */

// --- Prolog Engine Helper (Backend Delegation) ---
const queryProlog = async (logic, goal) => {
  try {
    const response = await fetch("/.netlify/functions/gen-ophelia-prolog-executor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts: logic, query: goal }),
    });
    if (!response.ok) throw new Error("Prolog executor failed");
    const data = await response.json();

    // Si la réponse contient des résultats, on renvoie le premier ou true
    if (data.answers && data.answers.length > 0) {
      const first = data.answers[0];
      // Si c'est un objet avec des liens (substitutions), on les renvoie
      if (typeof first === "object" && Object.keys(first).length > 0) {
        return first;
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Prolog Engine Error:", error);
    return false;
  }
};

// --- Game Packs Registry (Extended Format) ---
export const GAME_PACKS = {
  pictionary_social: {
    id: "pictionary_social",
    meta: {
      label: "Pictionary Social",
      icon: "🎨",
      reward: "Badge Artiste",
      description: "L'IA juge vos descriptions de dessins. Validé par Prolog.",
    },
    logic_rules: `
      % Un coup est valide si c'est un dessin (DRAW), une devinette (GUESS) ou le TICK système
      valid_move('DRAW', _Actor, _Payload).
      valid_move('GUESS', _Actor, _Payload).
      valid_move('IA_JUDGE', 'IA', _Payload).
      valid_move('SYSTEM_TICK', 'SYSTEM', _Payload).
      
      % Condition de victoire : score >= 100
      game_over(Score) :- Score >= 100.
    `,
    state_machine: {
      initial: {
        phase: "WAITING_FOR_PLAYER",
        players: [],
        history: [],
        currentDrawer: null,
        currentWord: null,
        scores: {},
        leveling: {},
        idle_since: 0,
        display: { type: "TEXT", content: "Bienvenue au Pictionary Social !" },
        broadcast_msg: "Qui veut dessiner ?",
        next_input_source: "DASHBOARD",
      },
      valid_actions: ["DRAW", "GUESS", "IA_JUDGE", "SYSTEM_TICK"],
    },
    narrative_prompts: {
      arrogance_level: 0.6,
      intro: "Bienvenue au Pictionary Social ! Qui veut dessiner ?",
      victory: "Magnifique ! Un vrai talent brut chez {player}.",
      idle: [
        "Alors, on a perdu son pinceau ?",
        "Le bar attend vos chefs-d'œuvre...",
        "On s'endort sur sa palette ?",
      ],
      fail: "C'est... abstrait. Très abstrait. Essayez encore.",
    },
  },
  mots_croises_social: {
    id: "mots_croises_social",
    meta: {
      label: "Mots Croisés Live",
      icon: "📝",
      reward: "Succès Badge",
      description: "Collaborez pour remplir la grille.",
    },
    logic_rules: `
      % Grille 5x5 simplifiée
      grid_size(5).
      valid_move('FILL_CELL', _Actor, _Payload).
      valid_move('SYSTEM_TICK', 'SYSTEM', _Payload).
      
      % Fin si plus de cases 'empty'
      game_over(Grid) :- \\+ member(empty, Grid).
    `,
    state_machine: {
      initial: {
        grid: Array(25).fill("empty"),
        scores: {},
        leveling: {},
        history: [],
        phase: "ACTIVE",
        idle_since: 0,
        display: { type: "GRID", size: 5, data: Array(25).fill("empty") },
        broadcast_msg: "La grille est prête. À vous de jouer !",
        next_input_source: "CHAT_ONLY",
      },
      valid_actions: ["FILL_CELL", "SYSTEM_TICK"],
    },
    narrative_prompts: {
      arrogance_level: 0.9,
      intro: "Bienvenue dans l'arène des mots, mortels.",
      victory: "Pas mal pour des humains. La grille est complète.",
      idle: [
        "Vous dormez ?",
        "Le bar va fermer avant que vous trouviez.",
        "Même un dictionnaire poussiéreux irait plus vite.",
      ],
    },
  },
};

// --- Universal Reducer (Double Loop Architecture) ---
/**
 * @param {Object} state - État actuel (ctx_in)
 * @param {Object} event - {type, payload, actorId}
 * @param {Object} gamePack - Configuration du jeu étendue
 * @returns {Promise<Object>} - Nouvel état (ctx_out) respectant le Broadcast Contract
 */
export async function game_reducer(state, event, gamePack) {
  // 1. HEMISPHERE GAUCHE (Prolog) - Validation & Logique Pure
  const goal = `valid_move('${event.type}', '${event.actorId}', _).`;
  const isLegal = await queryProlog(gamePack.logic_rules, goal);

  if (!isLegal && event.type !== "SYSTEM_TICK") {
    return {
      ...state,
      error: "Action non autorisée (Prolog).",
      broadcast_msg: "Action impossible selon les règles sacrées.",
      next_actor: event.actorId,
    };
  }

  // 2. REDUCTEUR D'ETAT (JS) - Transition de l'état
  let { newState, nextActor, instructions } = applyBusinessLogic(state, event, gamePack);

  // 3. HEMISPHERE DROIT (Narratif) - Préparation du Payload de Diffusion
  // Note: La partie IA générative (LLM) est gérée par le Dashboard via askOphélia
  // si next_actor === "IA" ou suite à un SYSTEM_TICK.

  // Vérification de victoire via Prolog
  if (gamePack.id === "pictionary_social" && event.type === "IA_JUDGE") {
    const score = newState.scores[event.payload.targetPlayer] || 0;
    const isOver = await queryProlog(gamePack.logic_rules, `game_over(${score}).`);
    if (isOver === true) {
      newState.phase = "GAME_OVER";
      newState.broadcast_msg = gamePack.narrative_prompts.victory.replace(
        "{player}",
        event.payload.targetPlayer
      );
      newState.audio_hint = "victory_fanfare";
      nextActor = "BROADCAST";
    }
  }

  if (gamePack.id === "mots_croises_social" && event.type === "FILL_CELL") {
    const gridList = newState.grid.map((c) => (c === "empty" ? "empty" : "filled"));
    const isOver = await queryProlog(gamePack.logic_rules, `game_over([${gridList.join(", ")}]).`);
    if (isOver === true) {
      newState.phase = "GAME_OVER";
      newState.broadcast_msg = gamePack.narrative_prompts.victory;
      newState.audio_hint = "success_chime";
      nextActor = "BROADCAST";
    }
  }

  return {
    ...newState,
    next_actor: nextActor,
    instructions: instructions,
    error: null,
  };
}

// --- Business Logic Processor ---
function applyBusinessLogic(state, event, gamePack) {
  let newState = { ...state };
  let nextActor = "BROADCAST";
  let instructions = "";

  // Gestion du Heartbeat (SYSTEM_TICK)
  if (event.type === "SYSTEM_TICK") {
    newState.idle_since = (state.idle_since || 0) + 1;
    if (newState.idle_since >= 3) {
      nextActor = "IA"; // L'IA doit relancer l'ambiance
      instructions = "RELANCE_AMBIANCE";
      newState.audio_hint = "ia_thinking";
    }
    return { newState, nextActor, instructions };
  }

  // Reset idle_since sur action humaine
  newState.idle_since = 0;
  newState.history = [...(state.history || []), event];
  newState.audio_hint = "action_pop";

  switch (gamePack.id) {
    case "pictionary_social":
      if (event.type === "DRAW") {
        newState.phase = "WAITING_FOR_IA";
        nextActor = "IA";
        instructions = `JUGEMENT_DESSIN: ${event.payload.description}`;
        newState.broadcast_msg = `L'IA examine le dessin de ${event.actorId}...`;
      } else if (event.type === "IA_JUDGE") {
        const score = event.payload.score || 0;
        const player = event.payload.targetPlayer;
        newState.scores[player] = (newState.scores[player] || 0) + score;
        newState.phase = "WAITING_FOR_PLAYER";
        nextActor = "BROADCAST";
        newState.broadcast_msg = `[IA] ${score}/10 : ${event.payload.comment}`;

        // Leveling persisté (score/50 +1)
        newState.leveling[player] = Math.floor(newState.scores[player] / 50) + 1;
      }
      break;

    case "mots_croises_social":
      if (event.type === "FILL_CELL") {
        const { index, value } = event.payload;
        newState.grid[index] = value;
        newState.display.data = [...newState.grid];
        nextActor = "BROADCAST";
        newState.broadcast_msg = `Case ${index} remplie avec "${value}" par ${event.actorId}.`;
      }
      break;
  }

  return { newState, nextActor, instructions };
}

// Export legacy GAMES for compatibility
export const GAMES = GAME_PACKS;

export function startChallenge(gameId, tableId) {
  console.log(`Challenge ${gameId} lancé à la table ${tableId}`);
  const gamePack = GAME_PACKS[gameId];
  return {
    success: true,
    challengeId: Math.random().toString(36).substr(2, 9),
    state: gamePack ? gamePack.state_machine.initial : null,
  };
}
