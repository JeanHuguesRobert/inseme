import { getSupabase } from "./supabase.js";
import { createSharePostMetadata } from "@inseme/cop-host";
import { isShare, getPostShareInfo } from "./postPredicates.js";

/**
 * Resolves to the original post by following the share chain.
 * Application-level logic only (no database functions).
 */
export async function resolveToOriginal(postId) {
  const MAX_DEPTH = 10;
  let currentId = postId;
  let depth = 0;

  while (depth < MAX_DEPTH) {
    // Fetch current post
    const { data: post, error } = await getSupabase()
      .from("posts")
      .select("*, author_id(*)")
      .eq("id", currentId)
      .single();

    if (error || !post) return null;
    if (post.metadata?.isDeleted) return null;

    // Check if it's a share
    if (!isShare(post)) {
      return post; // Found the original
    }

    // Get what it shares
    const shareInfo = getPostShareInfo(post);
    if (!shareInfo || shareInfo.entityType !== "post") {
      return null; // Invalid or non-post share
    }

    // Follow the chain
    currentId = shareInfo.entityId;
    depth++;
  }

  throw new Error("Share chain too deep");
}

/**
 * Shares a post to a gazette/group.
 */
export async function sharePost(postId, target, currentUser, comment = "") {
  // Resolve to original (shares always reference the original)
  const original = await resolveToOriginal(postId);
  if (!original) throw new Error("Cannot resolve to original");

  // Create the share post
  const shareMetadata = createSharePostMetadata("post", original.id, {
    userId: currentUser.id,
    gazette: target.gazette,
    groupId: target.groupId,
    title: `Partage: ${original.metadata?.title || ""}`,
  });

  const content = comment || `Je partage: ${original.metadata?.title || "ce post"}`;

  const { data: sharePost, error } = await getSupabase()
    .from("posts")
    .insert({
      author_id: currentUser.id,
      content,
      metadata: shareMetadata,
    })
    .select()
    .single();

  if (error) throw error;

  // Update tracking on original
  await trackShare(original.id, sharePost);

  // Update user's share count
  await incrementUserShareCount(currentUser.id);

  return sharePost;
}

/**
 * Adds share to the original post's tracking array.
 */
async function trackShare(originalId, sharePost) {
  const { data: original, error: fetchErr } = await getSupabase()
    .from("posts")
    .select("metadata")
    .eq("id", originalId)
    .single();

  if (fetchErr) return; // Non-critical

  const metadata = original.metadata || {};
  const shares = metadata.shares || [];
  const shareInfo = sharePost.metadata?.share;

  shares.push({
    sharePostId: sharePost.id,
    gazette: shareInfo?.sharedToGazette,
    groupId: shareInfo?.sharedToGroup,
    sharedBy: shareInfo?.sharedBy,
    sharedAt: shareInfo?.sharedAt,
    isDeleted: false,
  });

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
}

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

  // Decrement user's share count
  if (deletedSharePost.author_id) {
    await decrementUserShareCount(deletedSharePost.author_id);
  }
}

/**
 * Increments user's share count in metadata.
 */
async function incrementUserShareCount(userId) {
  const { data: user, error: fetchErr } = await getSupabase()
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .single();

  if (fetchErr) return;

  const metadata = user.metadata || {};
  const currentCount = metadata.shareCount || 0;

  await getSupabase()
    .from("users")
    .update({
      metadata: {
        ...metadata,
        shareCount: currentCount + 1,
      },
    })
    .eq("id", userId);
}

/**
 * Decrements user's share count in metadata.
 */
async function decrementUserShareCount(userId) {
  const { data: user, error: fetchErr } = await getSupabase()
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .single();

  if (fetchErr) return;

  const metadata = user.metadata || {};
  const currentCount = metadata.shareCount || 0;

  await getSupabase()
    .from("users")
    .update({
      metadata: {
        ...metadata,
        shareCount: Math.max(0, currentCount - 1), // Never go negative
      },
    })
    .eq("id", userId);
}
