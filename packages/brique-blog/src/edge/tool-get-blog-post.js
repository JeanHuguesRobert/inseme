export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", args.id)
    .single();

  if (error) return `Erreur article: ${error.message}`;
  if (!data) return "Article non trouvé.";

  return JSON.stringify(data);
}
