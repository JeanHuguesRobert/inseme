import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env?.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  import.meta.env?.SUPABASE_SERVICE_KEY ||
  import.meta.env?.SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env?.VITE_SUPABASE_SERVICE_KEY;

let supabase = null;
function client() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY env variables required");
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

export async function createTopic({ title, description, created_by = null, metadata = {} } = {}) {
  // Insert into cop_topic (canonical table)
  const payload = { title, metadata: { ...(metadata || {}), description }, created_by };
  const { data, error } = await client().from("cop_topic").insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function getTopic(id) {
  // Read from cop_topic
  const { data, error } = await client().from("cop_topic").select().eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listTopics({ limit = 50, offset = 0 } = {}) {
  // List cop_topic rows
  const { data, error } = await client()
    .from("cop_topic")
    .select()
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function createParticipant({
  topic_id,
  user_id = null,
  role = "participant",
  metadata = {},
} = {}) {
  // Participants table uses topic_id
  const { data, error } = await client()
    .from("cop_participants")
    .insert([{ topic_id, user_id, role, metadata }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createEvent({
  topic_id,
  type,
  payload = {},
  meta = {},
  created_by = null,
} = {}) {
  const { data, error } = await client()
    .from("cop_event")
    .insert([{ topic_id, type, payload, meta, created_by }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createUserMessage({
  topic_id,
  participant_id = null,
  content,
  content_type = "text",
  metadata = {},
} = {}) {
  // Shortcut for creating a user_message event (canonical)
  if (!content) throw new Error("content required for user_message");
  const { data: ev, error: evErr } = await client()
    .from("cop_event")
    .insert([
      {
        topic_id,
        type: "user_message",
        payload: { content, participant_id, content_type },
        meta: metadata,
      },
    ])
    .select()
    .single();
  if (evErr) throw evErr;
  return ev;
}

export async function listEvents(topic_id, { limit = 100, offset = 0, type = null } = {}) {
  const q = client().from("cop_event").select("*").eq("topic_id", topic_id);
  if (type) q.eq("type", type);
  const { data, error } = await q
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export default {
  createTopic,
  getTopic,
  listTopics,
  createParticipant,
  createEvent,
  createUserMessage,
  listEvents,
};
