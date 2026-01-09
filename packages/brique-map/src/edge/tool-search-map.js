export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("map_places")
    .select("*")
    .ilike("name", `%${args.query}%`)
    .limit(10);

  if (error) return `Erreur carte: ${error.message}`;
  if (!data || data.length === 0) return "Aucun lieu trouvé correspondant à votre recherche.";

  return JSON.stringify(data);
}
