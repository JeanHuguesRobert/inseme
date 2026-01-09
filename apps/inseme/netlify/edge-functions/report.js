import OpenAI from "https://esm.sh/openai@4";
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/report",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error } = runtime;
  try {
    let body = {};
    try {
      if (request.body) {
        body = await request.json();
      }
    } catch (e) {
      console.warn("[Report] Malformed JSON or empty body");
    }

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return error("Messages array required", 400);
    }

    const apiKey = getConfig("OPENAI_API_KEY");
    if (!apiKey) {
      return error("OpenAI API key missing", 500);
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `
        Tu es le Secrétaire de Séance d'une assemblée démocratique (Inseme).
        Ton rôle est de générer un Procès-Verbal (PV) formel, synthétique et juridiquement clair.
        
        FORMAT DE SORTIE (Markdown strict):
        # PROCÈS-VERBAL D'ASSEMBLÉE
        **RÉFÉRENCE**: INSEME-SESSION-${Date.now()}
        **DATE**: ${new Date().toLocaleDateString("fr-FR")}
        **LIEU**: Assemblée Numérique Inseme
        
        ---

        ## 1. OUVERTURE DE LA SÉANCE
        - Heure de début.
        - Contexte de la réunion.

        ## 2. ORDRE DU JOUR
        - Liste structurée des thèmes abordés.

        ## 3. SYNTHÈSE DES DÉBATS & ARGUMENTAIRES
        Pour chaque point d'importance:
        ### [Sujet]
        - **Résumé des échanges**: Synthèse neutre.
        - **Positions exprimées**: Résumé des arguments POUR et CONTRE.
        - **Médiation**: Interventions d'Ophélia (si pertinentes).

        ## 4. DÉCISIONS & VOTES
        - **Propositions**: Énoncé exact des propositions.
        - **Résultats**: Décompte des votes (Pour/Contre/Abstention) si disponibles.
        - **Statut**: Adopté / Rejeté / En suspens.

        ## 5. CLÔTURE & ACTIONS
        - Heure de fin.
        - Liste des actions à entreprendre (To-Do).
        - Date de la prochaine séance (si mentionnée).

        ---
        *Ce document est généré automatiquement par Ophélia, médiatrice d'Inseme, et fait foi de l'historique des échanges.*
        `;

    // Format history for the LLM
    const conversation = messages
      .map((m) => {
        const time = new Date(m.created_at).toLocaleTimeString();
        const type = m.metadata?.type || "chat";
        return `[${time}] [${type}] ${m.name}: ${m.message}`;
      })
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Voici l'historique de la séance à synthétiser:\n\n${conversation}`,
        },
      ],
      temperature: 0.3, // Low temperature for factual reporting
    });

    const report = completion.choices[0].message.content;

    return json({ report });
  } catch (err) {
    console.error("Report Generation Error:", err);
    return error(err.message);
  }
});
