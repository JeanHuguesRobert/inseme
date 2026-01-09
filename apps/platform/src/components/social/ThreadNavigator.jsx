import { Link } from "react-router-dom";
import { getPostTitle } from "../../../../../packages/cop-host/src/lib/socialMetadata.js";

/**
 * Breadcrumb navigation showing the path from root to current post
 */
export default function ThreadNavigator({ threadPath }) {
  if (!threadPath || threadPath.length === 0) return null;

  return (
    <nav className="text-sm text-gray-400 mb-4 flex items-center gap-2 flex-wrap">
      <Link to="/social" className="hover:text-gray-200 transition-colors">
        Social
      </Link>

      {threadPath.map((post, index) => {
        const isLast = index === threadPath.length - 1;
        const title = getPostTitle(post);
        const truncatedTitle = title.length > 40 ? title.substring(0, 40) + "..." : title;

        return (
          <span key={post.id} className="flex items-center gap-2">
            <span className="text-gray-600">›</span>
            {isLast ? (
              <span className="text-gray-50 font-medium">{truncatedTitle}</span>
            ) : (
              <Link
                to={`/posts/${post.id}`}
                className="hover:text-gray-200 transition-colors hover:underline"
              >
                {truncatedTitle}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
