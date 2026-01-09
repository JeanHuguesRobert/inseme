import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";

export default function ShareDialog({ post, onShare, onCancel }) {
  const [gazettes, setGazettes] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await getSupabase()
          .from("posts")
          .select("metadata->>gazette as gazette")
          .not("metadata->>gazette", "is", null)
          .limit(1000);

        const names = [...new Set((data || []).map((d) => d.gazette).filter(Boolean))];
        if (!names.includes("global")) names.unshift("global");
        setGazettes(names);
        setLoading(false);
      } catch (err) {
        console.error("Error loading gazettes:", err);
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!selected) {
      alert("Sélectionnez une gazette");
      return;
    }
    onShare(selected);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="theme-card p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Partager</h2>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block mb-2 text-sm font-medium">Gazette:</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-4 bg-gray-800 border-gray-600 text-white"
            >
              <option value="">-- Choisir --</option>
              {gazettes.map((g) => (
                <option key={g} value={g}>
                  {g === "global" ? "LA GAZETTE (global)" : g}
                </option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onCancel} className="btn btn-ghost">
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Partager
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
