export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  let query = supabase.from("wiki_pages").select("*");

  if (args.query) {
    query = query.or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`);
  }

  if (args.scope === "room" && args.room_slug) {
    query = query.eq("metadata->>room_slug", args.room_slug);
  }

  const { data, error } = await query.limit(5);

  if (error) return `Erreur Wiki: ${error.message}`;
  if (!data || data.length === 0) return "Aucun résultat trouvé dans le Wiki.";

  return JSON.stringify(data.map(p => ({
    title: p.title,
    slug: p.slug,
    summary: p.content.substring(0, 200) + "..."
  })));
}
