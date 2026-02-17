import { createClient } from "@supabase/supabase-js";

let client = null;
export async function initStore({ supabaseUrl, serviceKey } = {}) {
  const url = supabaseUrl || import.meta.env?.SUPABASE_URL;
  const sKey =
    serviceKey ||
    import.meta.env?.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env?.SUPABASE_SERVICE_KEY;
  if (!url || !sKey)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for supabaseStore");
  client = createClient(url, sKey);
  return client;
}

export async function getTopic(id) {
  if (!client) await initStore();
  const { data, error } = await client.from("cop_topic").select("*").eq("id", id).single();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function saveTopic(topic) {
  if (!client) await initStore();
  const { data, error } = await client.from("cop_topic").upsert(topic).select();
  if (error) throw error;
  return data || null;
}

export async function getTask(id) {
  if (!client) await initStore();
  const { data, error } = await client.from("cop_task").select("*").eq("id", id).single();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function findTaskBySourceEvent({ topicId, type, sourceEventId } = {}) {
  if (!client) await initStore();
  if (!sourceEventId) return null;
  const { data, error } = await client
    .from("cop_task")
    .select("*")
    .eq("topic_id", topicId)
    .eq("type", type)
    .eq("source_event_id", sourceEventId)
    .limit(1);
  if (error) throw error;
  return (data || [])[0] || null;
}

export async function saveTask(task) {
  if (!client) await initStore();
  // If task contains source_event_id, use upsert by unique constraint (topic_id,type,source_event_id) so repeated new task requests are idempotent
  const onConflict = task && task.source_event_id ? "topic_id,type,source_event_id" : undefined;
  const { data, error } = await client
    .from("cop_task")
    .upsert(task, onConflict ? { onConflict } : {})
    .select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function listTasks({ status, limit = 100 } = {}) {
  if (!client) await initStore();
  let q = client
    .from("cop_task")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.in("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Claim a task for processing: update a pending task to be claimed by workerId for leaseSeconds atomically.
 * Returns the claimed task or null if none.
 */
export async function claimTask({ workerId, leaseSeconds = 60 } = {}) {
  if (!client) await initStore();
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  // Find a task with status pending and no lease or expired lease, and atomically claim it
  const { data, error } = await client.rpc("cop_claim_task", {
    p_worker_id: workerId,
    p_lease_until: leaseUntil,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getSteps(taskId) {
  if (!client) await initStore();
  const { data, error } = await client
    .from("cop_step")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getNextPendingStep(taskId) {
  if (!client) await initStore();
  const { data, error } = await client
    .from("cop_step")
    .select("*")
    .eq("task_id", taskId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data || [])[0] || null;
}

export async function claimStep({ taskId, workerId, leaseSeconds = 60 } = {}) {
  if (!client) await initStore();
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await client.rpc("cop_claim_step", {
    p_task_id: taskId,
    p_worker_id: workerId,
    p_lease_until: leaseUntil,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function saveStep(step) {
  if (!client) await initStore();
  // idempotent upsert: prefer to upsert by primary key (id), otherwise use task_id+name unique constraint
  const onConflict = step && !step.id ? "task_id,name" : undefined;
  const { data, error } = await client
    .from("cop_step")
    .upsert(step, onConflict ? { onConflict } : {})
    .select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function saveArtifact(artifact) {
  if (!client) await initStore();
  // Try upsert if we have source_task_id + source_step_id, otherwise insert
  const onConflict =
    artifact && artifact.source_task_id && artifact.source_step_id
      ? "source_task_id,source_step_id,type"
      : undefined;
  if (onConflict) {
    const { data, error } = await client
      .from("cop_artifact")
      .upsert(artifact, { onConflict })
      .select()
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }
  const { data, error } = await client.from("cop_artifact").insert([artifact]).select().limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listArtifacts({ topicId, type, limit = 100 } = {}) {
  if (!client) await initStore();
  let q = client
    .from("cop_artifact")
    .select("*")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export default {
  initStore,
  getTopic,
  saveTopic,
  getTask,
  saveTask,
  listTasks,
  getSteps,
  getNextPendingStep,
  claimTask,
  claimStep,
  saveStep,
  saveArtifact,
  listArtifacts,
};
