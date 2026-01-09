export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  // Les projets sont des groupes avec un type spécifique dans metadata
  const { data: projects, error: projErr } = await supabase
    .from("groups")
    .select("id, name, description, metadata")
    .or("metadata->>type.eq.mission,metadata->>type.eq.project");

  if (projErr) return `Erreur liste projets: ${projErr.message}`;

  if (!projects || projects.length === 0) {
    // Fallback: list all groups if metadata filter fails or returns nothing
    const { data: allGroups, error: allGErr } = await supabase
      .from("groups")
      .select("id, name, description, metadata")
      .limit(10);
    if (allGErr) return `Erreur liste groupes: ${allGErr.message}`;
    return JSON.stringify(allGroups);
  }

  return JSON.stringify(projects);
}
