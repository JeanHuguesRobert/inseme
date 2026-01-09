export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("wiki_pages")
    .insert({
      title: args.title,
      content: args.content,
      slug: args.title.toLowerCase().replace(/ /g, "-"),
      metadata: {
        proposed_by_ai: true,
        room_slug: args.room_slug
      }
    })
    .select()
    .single();

  if (error) return `Erreur proposition Wiki: ${error.message}`;

  return `Page Wiki proposée avec succès (ID: ${data.id}, Slug: ${data.slug})`;
}
