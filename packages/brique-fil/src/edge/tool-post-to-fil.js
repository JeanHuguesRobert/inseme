export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const { data, error } = await supabase
    .from("posts")
    .insert({
      title: args.title,
      content: args.content,
      metadata: {
        type: "fil",
        author_id: args.author_id,
        tags: args.tags || [],
      },
    })
    .select()
    .single();

  if (error) return `Erreur lors de la publication sur le Fil: ${error.message}`;

  return `Actualité publiée avec succès (ID: ${data.id})`;
}
