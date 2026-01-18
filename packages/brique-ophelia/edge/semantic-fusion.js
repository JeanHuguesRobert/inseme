/**
 * packages/brique-ophelia/edge/semantic-fusion.js
 *
 * Central Semantic Fusion Module.
 * Collects local semantic states and aggregates them into a sliding window.
 * Produces a "current moment" for Ophélia.
 */

import { createAIClient, buildProviderOrder, resolveModel } from "./lib/providers.js";

const MAX_BUFFER_SIZE = 100; // Capacité maximale du buffer brut (sécurité)
const AI_UPDATE_THRESHOLD_MS = 30 * 1000; // 30 secondes entre chaque synthèse IA pour plus de réactivité
const statesBuffer = new Map(); // roomId -> { states: [], cachedWindow: null, lastAIUpdate: 0, totalProcessed: 0 }

export async function handleSemanticState(payload, runtime) {
  const { roomId, locuteur_id, timestamp } = payload;
  if (!roomId) return;

  if (!statesBuffer.has(roomId)) {
    statesBuffer.set(roomId, {
      states: [],
      cachedWindow: null,
      lastAIUpdate: 0,
      totalProcessed: 0,
    });
  }

  const roomData = statesBuffer.get(roomId);

  // Ajout du nouvel état
  roomData.states.push({
    ...payload,
    timestamp: payload.timestamp || Date.now(),
  });

  // Capacité de sécurité pour éviter les fuites mémoire si l'IA ne nettoie pas assez vite
  if (roomData.states.length > MAX_BUFFER_SIZE) {
    roomData.states = roomData.states.slice(-MAX_BUFFER_SIZE);
  }

  statesBuffer.set(roomId, roomData);

  return { status: "ok", count: roomData.states.length };
}

export async function getSemanticWindow(roomId, runtime) {
  const roomData = statesBuffer.get(roomId) || {
    states: [],
    cachedWindow: null,
    lastAIUpdate: 0,
    totalProcessed: 0,
  };
  const roomStates = roomData.states;

  if (roomStates.length === 0) {
    return (
      roomData.cachedWindow || {
        themes_dominants: [],
        locuteurs: [],
        questions_ouvertes: [],
        tensions: [],
        etat_du_groupe: "calme",
        moment_courant: "Aucune activité récente détectée.",
      }
    );
  }

  const now = Date.now();

  // On déclenche l'IA si on a de nouveaux messages ET (assez de temps écoulé OU buffer trop plein)
  const shouldUpdate =
    roomStates.length > 0 &&
    (now - roomData.lastAIUpdate > AI_UPDATE_THRESHOLD_MS || roomStates.length > 20);

  if (!shouldUpdate && roomData.cachedWindow) {
    return roomData.cachedWindow;
  }

  // Tentative de synthèse IA adaptative
  try {
    const providers = buildProviderOrder(runtime);
    const provider = providers[0];
    const model = resolveModel(provider, "fast");
    const ai = createAIClient(runtime, provider);

    // On prépare les signaux à envoyer (on limite pour le prompt, mais on garde la trace pour le nettoyage)
    const signalsToProcess = roomStates.slice(0, 30);

    const contextForAI = signalsToProcess.map((s) => ({
      locuteur: s.locuteur_id,
      profil: s.profil,
      message: s.message_brut,
      themes: s.themes_detectes,
      type: s.type_interaction,
      intensite: s.intensite,
      age: Math.round((now - s.timestamp) / 1000) + "s",
    }));

    const prompt = `Tu es le module de Fusion Sémantique d'Ophélia. 
Ton rôle est de maintenir la "Mémoire Vive" (Moment Présent) de la salle en fusionnant les nouveaux signaux avec le contexte existant.

CONTEXTE PRÉCÉDENT (Le moment tel qu'il était) :
${JSON.stringify(roomData.cachedWindow || "Aucun contexte préalable.", null, 2)}

NOUVEAUX SIGNAUX SÉMANTIQUES (À intégrer) :
${JSON.stringify(contextForAI, null, 2)}

TÂCHE :
1. Analyse comment ces nouveaux signaux modifient ou confirment l'ambiance et les thèmes.
2. Produis une nouvelle synthèse qui "compresse" l'histoire tout en gardant les points saillants.
3. Détermine si certains thèmes sont devenus obsolètes ou si de nouvelles questions ont émergé.

Réponds UNIQUEMENT en JSON avec ce format :
{
  "themes_dominants": ["thème1", "thème2"],
  "etat_du_groupe": "calme|animé|tendu|joyeux|etc.",
  "moment_courant": "Description textuelle riche et évolutive du moment présent...",
  "questions_ouvertes": ["question1", "etc."],
  "tensions": ["source de tension éventuelle"],
  "consumption_count": number // Indique combien de signaux parmi les ${signalsToProcess.length} fournis sont désormais "intégrés" dans ta synthèse et peuvent être retirés du buffer (0 à ${signalsToProcess.length}).
}`;

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en dynamique de groupe. Ta mission est de condenser le flux sémantique sans perdre l'essentiel.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);

    // Extraction des locuteurs (on garde une trace algorithmique pour la précision)
    const actors = new Map();
    roomStates.forEach((s) => {
      if (!actors.has(s.locuteur_id)) {
        actors.set(s.locuteur_id, {
          id: s.locuteur_id,
          profil: s.profil,
          interventions: 0,
        });
      }
      actors.get(s.locuteur_id).interventions++;
    });

    const finalWindow = {
      ...aiResult,
      locuteurs: Array.from(actors.values()),
    };

    // Nettoyage adaptatif du buffer
    const consumptionCount = Math.min(aiResult.consumption_count || 0, signalsToProcess.length);
    roomData.states = roomData.states.slice(consumptionCount);
    roomData.totalProcessed += consumptionCount;

    // Mise à jour du cache
    roomData.cachedWindow = finalWindow;
    roomData.lastAIUpdate = now;
    statesBuffer.set(roomId, roomData);

    return finalWindow;
  } catch (err) {
    console.error("[SemanticFusion] Adaptive AI synthesis failed:", err);
    return roomData.cachedWindow || { moment_courant: "Erreur de synthèse." };
  }
}
