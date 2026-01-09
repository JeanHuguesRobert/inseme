export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, summary, created_at, metadata")
    .eq("metadata->>type", "fil")
    .order("created_at", { ascending: false })
    .limit(args.limit || 10);

  if (error) return `Erreur Fil: ${error.message}`;

  if (!data || data.length === 0) {
    return "Aucune actualité trouvée sur le Fil.";
  }

  return JSON.stringify(data);
}
