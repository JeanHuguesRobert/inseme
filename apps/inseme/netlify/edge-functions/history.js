import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/history",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error, getSupabase } = runtime;
  try {
    let body = {};
    try {
      if (request.body) {
        body = await request.json();
      }
    } catch (e) {
      console.warn("[History] Malformed JSON or empty body");
    }

    const { query, filters = {} } = body;
    const { room_id, user, date_from, date_to, type, limit = 20 } = filters;

    if (!room_id) {
      return error("Room ID is required", 400);
    }

    const supabase = getSupabase();

    let dbQuery = supabase
      .from("inseme_messages")
      .select("*")
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply filters
    if (query && query.trim() !== "") {
      dbQuery = dbQuery.ilike("message", `%${query}%`);
    }

    if (user) {
      dbQuery = dbQuery.ilike("name", `%${user}%`);
    }

    if (type) {
      if (type === "presence") {
        dbQuery = dbQuery.eq("type", "presence_log");
      } else {
        dbQuery = dbQuery.eq("type", type);
      }
    }

    if (date_from) {
      dbQuery = dbQuery.gte("created_at", date_from);
    }

    if (date_to) {
      dbQuery = dbQuery.lte("created_at", date_to);
    }

    const { data, error: dbError } = await dbQuery;

    if (dbError) throw dbError;

    return json({ results: data });
  } catch (err) {
    return error(err.message);
  }
});

