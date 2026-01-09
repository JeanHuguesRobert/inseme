import { getMetadata } from "./metadata.js";
import {
  POST_TYPES,
  getPostType,
  getShareInfo,
  getShares,
} from "./socialMetadata.js";

/**
 * Returns the gazette name if the post is published in a gazette.
 */
export function getPostGazette(post) {
  return getMetadata(post, "gazette", null);
}

/**
 * Returns the author object of the post.
 */
export function getAuthor(post) {
  return post?.author_id || null;
}

/**
 * Returns the source URL of the post (e.g. external link).
 */
export function getPostSourceUrl(post) {
  return getMetadata(post, "sourceUrl", null);
}

/**
 * Checks if the post belongs to a Gazette.
 */
export function isGazettePost(post, optional_gazette_name = null) {
  const gazette = getPostGazette(post);
  if (!gazette) return false;
  if (optional_gazette_name) {
    return gazette === optional_gazette_name;
  }
  return true;
}

/**
 * Checks if the post is specifically a Facebook post.
 */
export function isFacebookPost(post) {
  const url = getPostSourceUrl(post);
  return url && url.includes("facebook.com");
}

/**
 * Checks if the post is a share.
 */
export function isShare(post) {
  return getPostType(post) === POST_TYPES.SHARE;
}

/**
 * Gets share info if this is a share post.
 */
export function getPostShareInfo(post) {
  return getShareInfo(post);
}

/**
 * Gets all shares of this post.
 */
export function getPostShares(post) {
  return getShares(post);
}
