export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, summary, created_at")
    .eq("metadata->>type", "blog")
    .order("created_at", { ascending: false })
    .limit(args.limit || 10);

  if (error) return `Erreur blog: ${error.message}`;
  if (!data || data.length === 0) return "Aucun article de blog trouvé.";

  return JSON.stringify(data);
}
