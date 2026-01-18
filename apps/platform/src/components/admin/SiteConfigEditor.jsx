import React, { useEffect, useState } from "react";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import { updateEntityAsAdmin } from "../../lib/adminApi.js";

export default function SiteConfigEditor() {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState({ redirect_enabled: false, redirect_url: "" });
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/config");
        // Debug log
        console.log("SiteConfigEditor: load", res, json);
        if (!res.ok) throw new Error("Failed to load site-config");
        const json = await res.json();
        setCfg(json);
        setUserId(json.user_id || null);
      } catch (err) {
        console.error("Failed to load site-config", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!currentUser || getUserRole(currentUser) !== ROLE_ADMIN) return null;

  async function save() {
    if (!userId) return alert("No site owner configured");
    try {
      // Fetch current user row to merge metadata safely
      await updateEntityAsAdmin("users", userId, { metadata: { site_config: cfg } });
    } catch (err) {
      console.error("Save failed", err);
      alert("Save failed: " + (err.message || String(err)));
    }
  }

  return (
    <div className="mt-4 p-3 bg-white shadow">
      <h3 className="font-semibold mb-2">Site redirect (dev tunnel)</h3>
      {loading ? (
        <div>Chargement...</div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!cfg.redirect_enabled}
              onChange={(e) => setCfg({ ...cfg, redirect_enabled: e.target.checked })}
            />
            <span>Activer la redirection vers l'URL de développement (tunnel)</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600">Redirect URL</label>
            <input
              className="w-full border px-2 py-1"
              value={cfg.redirect_url || ""}
              onChange={(e) => setCfg({ ...cfg, redirect_url: e.target.value })}
              placeholder="https://abcd.tunnel-url.io"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1 bg-blue-600 text-white ">
              Save
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem("site_redirect_override", "deployed");
                alert("Session will use deployed site");
              }}
              className="px-3 py-1 border "
            >
              Use deployed this session
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem("site_redirect_override", "tunnel");
                alert("Session will use tunnel URL");
              }}
              className="px-3 py-1 border "
            >
              Use tunnel this session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
