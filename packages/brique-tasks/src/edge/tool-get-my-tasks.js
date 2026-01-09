export default async function handler(runtime, args) {
  const { supabase } = runtime;
  if (!supabase) return "Supabase non disponible.";

  const taskLimit = args.limit || 10;
  // Note: Since 'tasks' table is still WIP, this might fail or return empty
  const { data: myTasks, error: myTErr } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(taskLimit);

  if (myTErr) return `Erreur mes tâches: ${myTErr.message}`;
  if (!myTasks || myTasks.length === 0) return "Aucune tâche trouvée.";

  return JSON.stringify(myTasks);
}
