import { getSupabase } from "../client/supabase.js";
import { getPostShareInfo } from "./postPredicates.js";

/**
 * Marks a share as deleted in tracking.
 */
export async function markShareDeleted(deletedSharePost) {
  const shareInfo = getPostShareInfo(deletedSharePost);
  if (!shareInfo || shareInfo.entityType !== "post") return;

  const originalId = shareInfo.entityId;

  const { data: original, error } = await getSupabase()
    .from("posts")
    .select("metadata")
    .eq("id", originalId)
    .single();

  if (error) return;

  const metadata = original.metadata || {};
  const shares = (metadata.shares || []).map((s) =>
    s.sharePostId === deletedSharePost.id ? { ...s, isDeleted: true } : s
  );

  await getSupabase()
    .from("posts")
    .update({
      metadata: {
        ...metadata,
        shares,
        shareCount: shares.filter((s) => !s.isDeleted).length,
      },
    })
    .eq("id", originalId);

  // Decrement user's share count if needed (optional logic depending on requirements)
}
