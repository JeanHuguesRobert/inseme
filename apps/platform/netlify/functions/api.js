import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig } from "../../common/config/instanceConfig.backend.js";

export default async (request, context) => {
  // Charger la configuration
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseAnonKey = getConfig("SUPABASE_ANON_KEY");

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Authentication
  let supabase;
  let user;
  const authHeader = request.headers.get("Authorization");

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    user = authUser;
  } else {
    // Optional: Check for x-api-key for service-level access if needed
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers,
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace("/api/v1", ""); // Assuming mapped to /api/v1/*
  const method = request.method;

  try {
    // --- POSTS & TASKS ---
    if (path === "/posts" && method === "GET") {
      const type = url.searchParams.get("type");
      const groupId = url.searchParams.get("groupId");
      const limit = parseInt(url.searchParams.get("limit") || "10");

      let qb = supabase
        .from("posts")
        .select("*, author:users(display_name)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (type) qb = qb.eq("metadata->>type", type);
      if (groupId) qb = qb.eq("metadata->>groupId", groupId);

      const { data, error } = await qb;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    if (path === "/posts" && method === "POST") {
      let body = {};
      try {
        if (request.body) {
          body = await request.json();
        }
      } catch (e) {
        console.warn("[API] Malformed JSON or empty body");
      }
      const { content, title, type = "post", groupId, tags, ...meta } = body;

      const { data, error } = await supabase
        .from("posts")
        .insert({
          content,
          title,
          author_id: user.id,
          metadata: { type, groupId, tags, source: "api", ...meta },
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 201, headers });
    }

    if (path.startsWith("/posts/") && method === "PUT") {
      const id = path.split("/")[2];
      let body = {};
      try {
        if (request.body) {
          body = await request.json();
        }
      } catch (e) {
        console.warn("[API] Malformed JSON or empty body");
      }
      const { content, title } = body;

      const updates = {};
      if (content) updates.content = content;
      if (title) updates.title = title;

      const { data, error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    // --- GROUPS & MISSIONS ---
    if (path === "/groups" && method === "GET") {
      const type = url.searchParams.get("type"); // e.g., 'mission'
      const limit = parseInt(url.searchParams.get("limit") || "10");

      let qb = supabase.from("groups").select("*").limit(limit);
      if (type) qb = qb.eq("metadata->>type", type);

      const { data, error } = await qb;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    if (path === "/groups" && method === "POST") {
      const body = await request.json();
      const { name, description, type = "group", ...meta } = body;

      const { data, error } = await supabase
        .from("groups")
        .insert({
          name,
          description,
          created_by: user.id,
          metadata: { type, source: "api", ...meta },
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join
      await supabase
        .from("group_members")
        .insert({ group_id: data.id, user_id: user.id, role: "admin" });

      return new Response(JSON.stringify(data), { status: 201, headers });
    }

    if (path.startsWith("/groups/") && method === "PUT") {
      const id = path.split("/")[2];
      const body = await request.json();
      const { name, description, location, status } = body;

      const updates = {};
      if (name) updates.name = name;
      if (description) updates.description = description;

      if (location || status) {
        const { data: current } = await supabase
          .from("groups")
          .select("metadata")
          .eq("id", id)
          .single();
        if (current) {
          updates.metadata = {
            ...current.metadata,
            ...(location ? { location } : {}),
            ...(status ? { status } : {}),
          };
        }
      }

      const { data, error } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    if (path.match(/\/groups\/[^\/]+\/join/) && method === "POST") {
      const id = path.split("/")[2];
      const { error } = await supabase.from("group_members").insert({
        group_id: id,
        user_id: user.id,
        role: "member",
      });
      if (error && error.code !== "23505") throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path.match(/\/groups\/[^\/]+\/leave/) && method === "POST") {
      const id = path.split("/")[2];
      const { error } = await supabase
        .from("group_members")
        .delete()
        .match({ group_id: id, user_id: user.id });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- PROPOSITIONS ---
    if (path === "/propositions" && method === "GET") {
      const status = url.searchParams.get("status") || "active";
      const limit = parseInt(url.searchParams.get("limit") || "10");

      const { data, error } = await supabase
        .from("propositions")
        .select("*, author:users(display_name)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    if (path === "/propositions" && method === "POST") {
      const body = await request.json();
      const { title, description, tags = [] } = body;

      const { data: prop, error } = await supabase
        .from("propositions")
        .insert({
          title,
          description,
          author_id: user.id,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Handle tags (simplified)
      if (tags.length > 0) {
        // Logic to link tags would go here, similar to agent tool
      }

      return new Response(JSON.stringify(prop), { status: 201, headers });
    }

    if (path.startsWith("/propositions/") && method === "PUT") {
      const id = path.split("/")[2];
      const body = await request.json();
      const { status, title } = body;

      const updates = {};
      if (status) updates.status = status;
      if (title) updates.title = title;

      const { data, error } = await supabase
        .from("propositions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    // --- INTERACTIONS ---
    if (path === "/votes" && method === "POST") {
      const { proposition_id, value } = await request.json();
      const { error } = await supabase.from("votes").upsert(
        {
          proposition_id,
          user_id: user.id,
          vote_value: value,
        },
        { onConflict: "proposition_id, user_id" }
      );

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path === "/reactions" && method === "POST") {
      const { post_id, emoji } = await request.json();
      const { error } = await supabase.from("reactions").insert({
        post_id,
        user_id: user.id,
        emoji,
      });
      if (error && error.code !== "23505") throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path === "/comments" && method === "POST") {
      const { post_id, content } = await request.json();
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 201, headers });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
