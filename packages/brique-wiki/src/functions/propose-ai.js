import { loadInstanceConfig, newSupabase } from "@inseme/cop-host/backend.js";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  try {
    const { slug, title, content, summary, room_id } = await req.json();

    if (!slug || !title || !content) {
      return new Response(
        JSON.stringify({ error: "slug, title and content are required" }),
        { status: 400 }
      );
    }

    const supabase = await newSupabase();

    const { data, error } = await supabase
      .from("wiki_pages")
      .upsert(
        {
          slug,
          title,
          content,
          summary,
          metadata: {
            is_proposed: true,
            ai_generated: true,
            updated_at: new Date().toISOString(),
          },
        },
        { onConflict: "slug" }
      )
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, page: data?.[0] }), {
      status: 200,
    });
  } catch (err) {
    const msg = (err.message || String(err)).replace(
      /postgres:\/\/.*@/,
      "postgres://***@"
    );
    console.error("wiki-propose-ai error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
    });
  }
};
