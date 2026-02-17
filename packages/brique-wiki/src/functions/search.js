import { loadInstanceConfig, newSupabase } from "@inseme/cop-host/backend.js";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  const params = req.method === "GET" ? req.queryStringParameters || {} : await req.json();
  const query = params.query;
  const scope = params.scope; // 'global' ou 'room'
  const room_slug = params.room_slug;

  if (!query) {
    return new Response(JSON.stringify({ error: "query required" }), {
      status: 400,
    });
  }

  try {
    const supabase = await newSupabase();

    // On utilise textSearch pour profiter du Full Text Search de PostgreSQL
    // On filtre par fts_tokens qui a été ajouté au schéma
    let dbQuery = supabase
      .from("wiki_pages")
      .select("title, slug, summary, content")
      .textSearch("fts_tokens", query, {
        type: "websearch", // Permet d'utiliser une syntaxe proche de Google (ex: "mot1 mot2 -mot3")
        config: "french",
      })
      .limit(5);

    if (scope === "room" && room_slug) {
      // On cherche par slug (pattern room:slug)
      dbQuery = dbQuery.or(`slug.eq.room:${room_slug},slug.ilike.room:${room_slug}:%`);
    } else if (scope === "global") {
      // Pour la recherche globale, on exclut peut-être les pages de room ?
      // Ou on laisse tout, mais on priorise le global.
      // Ici on laisse tout pour maximiser la découverte.
    }

    const { data: results, error } = await dbQuery;

    if (error) throw error;

    return new Response(JSON.stringify({ results: results || [] }), {
      status: 200,
    });
  } catch (err) {
    console.error("wiki-search error", err.message || err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), {
      status: 500,
    });
  }
};
