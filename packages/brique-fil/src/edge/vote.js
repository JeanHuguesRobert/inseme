/* eslint-env deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = globalThis.Deno?.env.get("SUPABASE_URL");
  const supabaseKey = globalThis.Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  try {
    const { postId, voteValue } = await req.json(); // voteValue: 1, -1, or 0 (remove)

    // Check existing reaction
    const { data: existing } = await supabase
      .from("reactions")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .in("emoji", ["+1", "-1"])
      .single();

    const targetEmoji = voteValue === 1 ? "+1" : voteValue === -1 ? "-1" : null;

    if (existing) {
      if (targetEmoji && existing.emoji !== targetEmoji) {
        // Change vote
        await supabase.from("reactions").update({ emoji: targetEmoji }).eq("id", existing.id);
      } else if (!targetEmoji || existing.emoji === targetEmoji) {
        // Remove vote (toggle off)
        await supabase.from("reactions").delete().eq("id", existing.id);
      }
    } else if (targetEmoji) {
      // Create vote
      await supabase.from("reactions").insert({
        post_id: postId,
        user_id: user.id,
        emoji: targetEmoji,
      });
    }

    // Re-calculate score (Naive approach: Count all +1 and -1)
    // In production, use a Database Function or Trigger for performance
    const { count: upvotes } = await supabase
      .from("reactions")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("emoji", "+1");
    // const { count: downvotes } = await supabase.from("reactions").select("*", { count: 'exact', head: true }).eq("post_id", postId).eq("emoji", "-1");

    // Simplified score: just upvotes for now or simple sum
    const score = upvotes || 0; // - (downvotes || 0);

    // Update post metadata
    await supabase
      .rpc("update_post_metadata", {
        p_id: postId,
        p_key: "fil_score",
        p_value: score,
      })
      .catch(async () => {
        // Fallback if RPC doesn't exist: Read, Update
        const { data: p } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", postId)
          .single();
        if (p) {
          const meta = p.metadata || {};
          meta.fil_score = score;
          await supabase.from("posts").update({ metadata: meta }).eq("id", postId);
        }
      });

    return new Response(JSON.stringify({ score, userVote: voteValue }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
