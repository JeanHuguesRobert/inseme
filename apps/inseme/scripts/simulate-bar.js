/**
 * apps/inseme/scripts/simulate-bar.js
 * Script de simulation d'une conversation au bar Cyrnea avec Ophélia.
 * Teste les modes texte et vocal (TTS).
 */

const GATEWAY_URL = process.env.OPHELIA_URL || "http://localhost:8888/api/chat-stream";
const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";

async function simulateChat(question, history = [], room_id = "bar-cyrnea-test") {
  console.log(`\n[USER]: ${question}`);

  const payload = {
    question: question,
    messages: history,
    room_id: room_id,
    model: "gpt-4o",
    role: "mediator",
    room_settings: {
      name: "Le Cyrnea",
      ophelia: { voice: "nova" },
    },
  };

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let toolTraces = [];

    process.stdout.write("[OPHÉLIA]: ");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Extraction des payloads spéciaux (Tool Traces)
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith(TOOL_TRACE_PREFIX)) {
          const jsonStr = line.replace(TOOL_TRACE_PREFIX, "");
          try {
            const trace = JSON.parse(jsonStr);
            toolTraces.push(trace);
            if (trace.phase === "finish" && trace.vocal_payload) {
              const bytes = trace.vocal_payload.length;
              console.log(`\n🔊 [AUDIO PAYLOAD DÉTECTÉ] (${bytes} bytes)`);
              // Optionnel: Sauvegarder pour vérification
              // const fs = await import('fs');
              // fs.writeFileSync(`test_vocal_${Date.now()}.mp3`, Buffer.from(trace.vocal_payload, 'base64'));
            }
          } catch (_e) {
            // Ignorer si JSON partiel
          }
        } else if (!line.startsWith("__")) {
          // C'est du texte standard ou du <Think>
          process.stdout.write(line);
          fullText += line;
        }
      }
    }

    console.log("\n");
    return { text: fullText, traces: toolTraces };
  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    return null;
  }
}

async function runScenario() {
  console.log("=== SIMULATION CONVERSATION BAR CYRNEA ===");
  const history = [];
  const roomId = "test-bar-" + Date.now();

  // Étape 1 : Commande au bar (Texte)
  const step1 = await simulateChat(
    "Salut ! Je voudrais un café serré s'il vous plaît. Henry est là ?",
    history,
    roomId
  );
  if (step1)
    history.push(
      {
        role: "user",
        content: "Salut ! Je voudrais un café serré s'il vous plaît. Henry est là ?",
      },
      { role: "assistant", content: step1.text }
    );

  // Étape 2 : Question historique à Ophélia (Vocal)
  const step2 = await simulateChat(
    "Ophélia, peux-tu me raconter l'histoire du premier gramophone du bar ? Utilise ta voix pour me répondre.",
    history,
    roomId
  );
  if (step2)
    history.push(
      {
        role: "user",
        content:
          "Ophélia, peux-tu me raconter l'histoire du premier gramophone du bar ? Utilise ta voix pour me répondre.",
      },
      { role: "assistant", content: step2.text }
    );

  // Étape 3 : Commentaire sur l'ambiance
  const step3 = await simulateChat(
    "C'est fascinant. L'ambiance est vraiment spéciale ici aujourd'hui.",
    history,
    roomId
  );
  if (step3)
    history.push(
      {
        role: "user",
        content: "C'est fascinant. L'ambiance est vraiment spéciale ici aujourd'hui.",
      },
      { role: "assistant", content: step3.text }
    );
  console.log("\n=== SIMULATION TERMINÉE ===");
}

runScenario();
