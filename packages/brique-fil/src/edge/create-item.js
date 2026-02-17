/* eslint-env deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (req, context) => {
  const method = req.method;

  const supabaseUrl = globalThis.Deno?.env.get("SUPABASE_URL");
  const supabaseKey = globalThis.Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (method === "GET") {
    try {
      const url = new URL(req.url);
      const roomId = url.searchParams.get("room_id");

      let query = supabase.from("posts").select("*").limit(20);
      if (roomId) {
        query = query.eq("metadata->>room_id", roomId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await req.json();
    const { title, content, external_url, type } = body;

    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        content: content || "",
        metadata: {
          title,
          external_url,
          type: type || "fil_link",
          fil_score: 1,
          fil_comment_count: 0,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};
