import React, { useEffect, useState } from "react";
import { listEntities } from "../../lib/adminApi.js";

export default function EntityList({ type, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    listEntities(type)
      .then((d) => {
        // Ensure items are sorted by updated_at desc if present, otherwise keep order from server
        const sorted = d.slice();
        if (sorted.length > 0 && Object.prototype.hasOwnProperty.call(sorted[0], "updated_at")) {
          sorted.sort((a, b) => {
            const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return tb - ta;
          });
        }
        setItems(sorted);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{type}</h3>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-2 border ">
              <div className="truncate">
                <div className="font-medium">{it.title || it.display_name || it.name || it.id}</div>
                <div className="text-xs text-gray-400 truncate">{it.id}</div>
              </div>
              <div>
                <button
                  onClick={() => onSelect(it.id)}
                  className="px-3 py-1 bg-primary-600 text-bauhaus-white "
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
