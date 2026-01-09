import OpenAI from "https://esm.sh/openai@4";
import { loadInstanceConfig, getConfig } from "@inseme/cop-host/backend.js";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }),
      { status: 405 }
    );
  }

  try {
    const { defaultTitle, pageContent } = await req.json();

    if (!defaultTitle || !pageContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "defaultTitle et pageContent sont requis.",
        }),
      };
    }

    // Load instance config
    await loadInstanceConfig();

    const openaiApiKey = getConfig("openai_api_key");
    if (!openaiApiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Clé API OpenAI non configurée." }),
      };
    }

    const client = new OpenAI({ apiKey: openaiApiKey });

    const systemPrompt = `Tu es un assistant expert en optimisation de titres et de slugs pour des pages wiki. Ton rôle est de prendre un titre par défaut et le contenu d'une page, et de générer un nouveau titre plus concis et un slug correspondant. Le titre doit être court, informatif et ne pas dépasser 10 mots. Le slug doit être une version kebab-case du titre optimisé, en minuscules, sans caractères spéciaux (sauf les tirets) et sans accents.`;
    const userQuestion = `Optimise le titre et génère un slug pour la page wiki suivante. Titre par défaut: "${defaultTitle}". Contenu: "${pageContent.substring(0, 1000)}...". Réponds uniquement avec un objet JSON au format { "optimizedTitle": "Nouveau Titre", "optimizedSlug": "nouveau-titre" }.`;

    const response = await client.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuestion },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const aiResponse = response.choices[0].message.content;
    let optimizedData;
    try {
      optimizedData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error("Erreur de parsing de la réponse de l'IA:", parseError);
      // Fallback si l'IA ne renvoie pas un JSON valide
      optimizedData = {
        optimizedTitle: defaultTitle,
        optimizedSlug: defaultTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      };
    }

    return new Response(JSON.stringify(optimizedData), { status: 200 });
  } catch (error) {
    console.error("Erreur lors de l'optimisation du titre/slug:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};
