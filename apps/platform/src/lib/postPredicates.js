import {
  getMetadata,
  POST_TYPES,
  LINKED_TYPES,
  getPostType,
  getShareInfo,
  getShares,
  getShareCount,
} from "@inseme/cop-host";

// ============================================================================
// GETTERS (Read-Only Instance Accessors)
// ============================================================================

/**
 * Returns the gazette name if the post is published in a gazette.
 * Returns null otherwise.
 * @param {Object} post
 * @returns {string|null}
 */
export function getPostGazette(post) {
  return getMetadata(post, "gazette", null);
}

/**
 * Returns the author object of the post.
 * @param {Object} post
 * @returns {Object|null}
 */
export function getAuthor(post) {
  return post?.author_id || null;
}

/**
 * Returns the source URL of the post (e.g. external link).
 * @param {Object} post
 * @returns {string|null}
 */
export function getPostSourceUrl(post) {
  return getMetadata(post, "sourceUrl", null);
}

/**
 * Returns the group ID if the post belongs to a group.
 * @param {Object} post
 * @returns {string|null}
 */
export function getPostGroupId(post) {
  return getMetadata(post, "groupId", null);
}

/**
 * Returns the event details if the post is an event.
 * @param {Object} post
 * @returns {Object|null}
 */
export function getPostEvent(post) {
  return getMetadata(post, "event", null);
}

/**
 * Returns the incident details if the post is an incident.
 * @param {Object} post
 * @returns {Object|null}
 */
export function getPostIncident(post) {
  return getMetadata(post, "incident", null);
}

// ============================================================================
// PREDICATES (Nature & State)
// ============================================================================

/**
 * Checks if the post belongs to a Gazette.
 * If optional_gazette_name is provided, checks if it belongs to that specific gazette.
 * @param {Object} post
 * @param {string} [optional_gazette_name]
 * @returns {boolean}
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
 * Checks if the post belongs to the global Gazette.
 * @param {Object} post
 * @returns {boolean}
 */
export function isGlobalGazettePost(post) {
  return isGazettePost(post, "global");
}

/**
 * Checks if the post is an event.
 * @param {Object} post
 * @returns {boolean}
 */
export function isEventPost(post) {
  return getMetadata(post, "subtype") === "event";
}

/**
 * Checks if the post is an incident.
 * @param {Object} post
 * @returns {boolean}
 */
export function isIncidentPost(post) {
  return getMetadata(post, "subtype") === "incident";
}

/**
 * Checks if the post is from an external source (e.g. Facebook).
 * @param {Object} post
 * @returns {boolean}
 */
export function isExternalPost(post) {
  return !!getPostSourceUrl(post);
}

/**
 * Checks if the post is specifically a Facebook post.
 * @param {Object} post
 * @returns {boolean}
 */
export function isFacebookPost(post) {
  const url = getPostSourceUrl(post);
  return url && url.includes("facebook.com");
}

/**
 * Checks if the post belongs to a group.
 * @param {Object} post
 * @returns {boolean}
 */
export function isGroupPost(post) {
  return !!getPostGroupId(post);
}

/**
 * Checks if the post is linked to another entity (Wiki, Proposition, etc.).
 * @param {Object} post
 * @returns {boolean}
 */
export function isContextualPost(post) {
  return !!getMetadata(post, "linkedType") && !!getMetadata(post, "linkedId");
}

/**
 * Checks if the post is pinned.
 * @param {Object} post
 * @returns {boolean}
 */
export function isPinnedPost(post) {
  return getMetadata(post, "isPinned", false) === true;
}

/**
 * Checks if the post is locked.
 * @param {Object} post
 * @returns {boolean}
 */
export function isLockedPost(post) {
  return getMetadata(post, "isLocked", false) === true;
}

/**
 * Checks if the post is a share.
 * @param {Object} post
 * @returns {boolean}
 */
export function isShare(post) {
  return getPostType(post) === POST_TYPES.SHARE;
}

/**
 * Gets share info if this is a share post.
 * @param {Object} post
 * @returns {Object|null}
 */
export function getPostShareInfo(post) {
  return getShareInfo(post);
}

/**
 * Gets all shares of this post (where it's been shared to).
 * @param {Object} post
 * @returns {Array}
 */
export function getPostShares(post) {
  return getShares(post);
}

/**
 * Gets the count of active shares.
 * @param {Object} post
 * @returns {number}
 */
export function getPostShareCount(post) {
  return getShareCount(post);
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Checks if the user is the author of the post.
 * @param {Object} post
 * @param {Object} user
 * @returns {boolean}
 */
export function isAuthor(post, user) {
  if (!post || !user) return false;
  return post.author_id === user.id;
}

/**
 * Determines if a user can edit a post.
 * @param {Object} post
 * @param {Object} user
 * @param {Object} options - { metadata: Object, context: Object }
 * @returns {boolean}
 */
export function canEditPost(post, user, options = {}) {
  if (!post || !user) return false;

  // 1. Author can always edit (unless locked? usually yes, but let's say yes for now)
  if (isAuthor(post, user)) return true;

  // 2. Gazette Editors can edit gazette posts
  if (isGazettePost(post)) {
    // Check if user is editor in options to avoid DB call
    if (options.context?.isGazetteEditor) return true;
    // If we have specific gazette editor flag for this gazette
    const gazetteName = getPostGazette(post);
    if (options.context?.gazetteEditorships?.includes(gazetteName)) return true;
  }

  // 3. Group Admins can edit group posts
  if (isGroupPost(post)) {
    if (options.context?.isGroupAdmin) return true;
    const groupId = getPostGroupId(post);
    if (options.context?.adminGroupIds?.includes(groupId)) return true;
  }

  return false;
}

/**
 * Determines if a user can delete a post.
 * @param {Object} post
 * @param {Object} user
 * @param {Object} options
 * @returns {boolean}
 */
export function canDeletePost(post, user, options = {}) {
  // Usually same rules as edit, plus maybe moderators
  return canEditPost(post, user, options);
}

// ============================================================================
// AUDIT
// ============================================================================

/**
 * Returns a comprehensive audit object with all predicate results.
 * @param {Object} post
 * @param {Object} [opt_author] - The user to check permissions against (optional)
 * @param {Object} [options] - Options for permission checks
 * @returns {Object}
 */
export function audit(post, opt_author = null, options = {}) {
  if (!post) return {};

  const result = {
    // Identity
    id: post.id,
    type: getPostType(post),
    gazette: getPostGazette(post),
    author: getAuthor(post),

    // Nature
    isGazette: isGazettePost(post),
    isGlobalGazette: isGlobalGazettePost(post),
    isEvent: isEventPost(post),
    isExternal: isExternalPost(post),
    isFacebook: isFacebookPost(post),
    isGroup: isGroupPost(post),
    isContextual: isContextualPost(post),

    // State
    isPinned: isPinnedPost(post),
    isLocked: isLockedPost(post),
  };

  // Permissions (only if author provided)
  if (opt_author) {
    result.permissions = {
      isAuthor: isAuthor(post, opt_author),
      canEdit: canEditPost(post, opt_author, options),
      canDelete: canDeletePost(post, opt_author, options),
    };
  }

  return result;
}
