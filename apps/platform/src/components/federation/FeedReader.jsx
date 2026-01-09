import { useState, useEffect } from "react";
import { parseFeed } from "../../lib/FeedAdapter.js";

/**
 * FeedReader Component
 * Fetches, parses, and displays a combined stream of items from multiple feeds.
 *
 * @param {Array} feeds - Array of feed objects { id, url, title, category }
 * @param {number} limit - Max items to display per feed (before aggregation)
 */
export default function FeedReader({ feeds = [], limit = 10, onImport = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAllFeeds() {
      setLoading(true);
      setError(null);
      let allItems = [];

      try {
        const promises = feeds.map(async (feed) => {
          try {
            const response = await fetch(feed.url);
            if (!response.ok) throw new Error(`Failed to fetch ${feed.url}`);

            const text = await response.text();
            let json = null;
            try {
              json = JSON.parse(text);
            } catch (e) {
              // Not JSON, pass text to adapter
            }

            const parsed = parseFeed(json || text);

            // Add source info
            return parsed.items.slice(0, limit).map((item) => ({
              ...item,
              _source: {
                id: feed.id,
                title: feed.title || parsed.title,
                url: feed.url,
                category: feed.category,
              },
            }));
          } catch (err) {
            console.error(`Error fetching feed ${feed.url}:`, err);
            return []; // Return empty array on error to not break everything
          }
        });

        const results = await Promise.all(promises);
        allItems = results.flat();

        // Sort by date descending
        allItems.sort((a, b) => {
          const dateA = new Date(a.date_published || a.created_at || 0);
          const dateB = new Date(b.date_published || b.created_at || 0);
          return dateB - dateA;
        });

        setItems(allItems);
      } catch (err) {
        setError("Failed to load feeds");
      } finally {
        setLoading(false);
      }
    }

    if (feeds.length > 0) {
      fetchAllFeeds();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [feeds, limit]);

  if (loading) return <div className="p-4 text-center">Chargement des flux...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (items.length === 0)
    return (
      <div className="p-4 text-gray-500">Aucun élément à afficher. Abonnez-vous à des flux !</div>
    );

  return (
    <div className="feed-reader space-y-4">
      {items.map((item, index) => (
        <FeedItemCard
          key={`${item._source.id}-${item.id}-${index}`}
          item={item}
          onImport={onImport}
        />
      ))}
    </div>
  );
}

function FeedItemCard({ item, onImport }) {
  const date = new Date(item.date_published || item.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="feed-item bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {item._source.title}
        </div>
        <div className="text-xs text-gray-500">{date}</div>
      </div>

      <h3 className="text-lg font-bold mb-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-gray-900 dark:text-white"
        >
          {item.title}
        </a>
      </h3>

      <div
        className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-3"
        dangerouslySetInnerHTML={{
          __html: item.content_html || item.summary || item.content_text || "",
        }}
      />

      <div className="flex justify-between items-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span>{item.author?.name || "Inconnu"}</span>
          {item._meta?.item_type && (
            <span className="capitalize bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              {item._meta.item_type}
            </span>
          )}
        </div>

        {onImport && (
          <button
            onClick={() => onImport(item)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors"
            title="Importer ce sujet pour en débattre ici"
          >
            <span>📥</span> Importer & Débattre
          </button>
        )}
      </div>
    </div>
  );
}
