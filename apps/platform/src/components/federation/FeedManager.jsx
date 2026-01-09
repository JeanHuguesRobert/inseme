import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { parseFeed, detectFeedType } from "../../lib/FeedAdapter.js";

export default function FeedManager({ userId, onSubscriptionsChanged }) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Friendly Instances");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    fetchSubscriptions();
  }, [userId]);

  async function fetchSubscriptions() {
    const { data, error } = await getSupabase()
      .from("user_feed_subscriptions")
      .select(
        `
        feed_id,
        category,
        feed:feeds (id, url, title, type)
      `
      )
      .eq("user_id", userId);

    if (data) {
      setSubscriptions(data);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("URL inaccessible");

      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {}

      const type = detectFeedType(json || text);
      const parsed = parseFeed(json || text);

      setTestResult({
        title: parsed.title,
        type: type,
        valid: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleAdd() {
    if (!testResult || !testResult.valid) return;

    try {
      // 1. Upsert feed
      const { data: feed, error: feedError } = await getSupabase()
        .from("feeds")
        .upsert(
          {
            url: url,
            title: testResult.title,
            type: testResult.type,
            is_internal: false,
          },
          { onConflict: "url" }
        )
        .select()
        .single();

      if (feedError) throw feedError;

      // 2. Add subscription
      const { error: subError } = await getSupabase().from("user_feed_subscriptions").insert({
        user_id: userId,
        feed_id: feed.id,
        category: category,
      });

      if (subError) {
        if (subError.code === "23505") {
          // Unique violation
          setError("Vous êtes déjà abonné à ce flux.");
          return;
        }
        throw subError;
      }

      setUrl("");
      setTestResult(null);
      fetchSubscriptions();
      if (onSubscriptionsChanged) onSubscriptionsChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(feedId) {
    await getSupabase()
      .from("user_feed_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("feed_id", feedId);

    fetchSubscriptions();
    if (onSubscriptionsChanged) onSubscriptionsChanged();
  }

  return (
    <div className="feed-manager bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Gérer mes abonnements</h2>

      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemple.com/api/feed/posts"
            className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={handleTest}
            disabled={testing || !url}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
          >
            {testing ? "..." : "Tester"}
          </button>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {testResult && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <div className="font-bold text-green-800 dark:text-green-200">Flux valide !</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {testResult.title} ({testResult.type})
            </div>

            <div className="mt-3 flex gap-2 items-center">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="Pertitellu Platform">Plateforme Pertitellu</option>
                <option value="Friendly Instances">Instances amies</option>
                <option value="Media">Médias</option>
                <option value="Institutions">Institutions</option>
                <option value="Other">Autre</option>
              </select>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                S'abonner
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300">
          Mes flux ({subscriptions.length})
        </h3>
        {subscriptions.map((sub) => (
          <div
            key={sub.feed.id}
            className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded"
          >
            <div>
              <div className="font-medium">{sub.feed.title || sub.feed.url}</div>
              <div className="text-xs text-gray-500">
                {sub.category} • {sub.feed.type}
              </div>
            </div>
            <button
              onClick={() => handleRemove(sub.feed.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
