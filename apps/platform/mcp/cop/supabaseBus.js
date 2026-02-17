import { createClient } from "@supabase/supabase-js";

let writeClient = null;
let readClient = null;

export async function initBus({ supabaseUrl, serviceKey, anonKey } = {}) {
  const url = supabaseUrl || import.meta.env?.SUPABASE_URL;
  const sKey =
    serviceKey ||
    import.meta.env?.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env?.SUPABASE_SERVICE_KEY;
  const aKey =
    anonKey || import.meta.env?.SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !sKey)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for mcp/cop supabaseBus");
  writeClient = createClient(url, sKey);
  readClient = createClient(url, aKey || sKey);
  return { writeClient, readClient };
}

export async function publish({ topicId, type, payload = {}, meta = {}, createdBy = null } = {}) {
  if (!writeClient) await initBus();
  const rec = { topic_id: topicId, type, payload, meta, created_by: createdBy };
  const { data, error } = await writeClient.from("cop_event").insert([rec]).select().limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchSince({ topicId, since, limit = 100 } = {}) {
  if (!readClient) await initBus();
  let q = readClient
    .from("cop_event")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (topicId) q = q.eq("topic_id", topicId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchLatest({ topicId, limit = 50 } = {}) {
  if (!readClient) await initBus();
  let q = readClient
    .from("cop_event")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (topicId) q = q.eq("topic_id", topicId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reverse();
}

export async function subscribe({ topicId } = {}, onEvent) {
  if (!readClient) await initBus();
  if (!readClient.channel) throw new Error("Supabase client missing .channel (runtime)");
  const channelName = `cop_topic_${topicId}`;
  const sub = readClient
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cop_event", filter: `topic_id=eq.${topicId}` },
      (payload) => {
        try {
          onEvent(payload.new || payload);
        } catch (e) {
          console.error("cop bus handler error", e);
        }
      }
    )
    .subscribe();
  return () => {
    try {
      readClient.removeChannel(sub);
    } catch (e) {
      console.warn("removeChannel failed", e);
    }
  };
}

export default { initBus, publish, fetchSince, fetchLatest, subscribe };
