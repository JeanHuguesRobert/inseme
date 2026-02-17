import React, { useEffect, useState } from "react";
import { useCurrentUser } from "@inseme/cop-host";
import { wrapFetch } from "../lib/api.js";

export default function ActeList() {
  const { session } = useCurrentUser();
  const [actes, setActes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = session?.access_token;
        const data = await wrapFetch("/api/actes?limit=20", { token });
        if (!mounted) return;
        setActes(data?.data ?? []);
      } catch (err) {
        if (!mounted) return;
        setError(err);
      } finally {
        if (!mounted) {
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [session]);

  if (loading) return <div className="p-4">Loading actes…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error.message}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Actes</h1>
      <div className="grid gap-4">
        {actes.length === 0 && <div>No actes found.</div>}
        {actes.map((a) => (
          <article key={a.id} className="border p-3 rounded">
            <h2 className="text-lg font-semibold">{a.objet_court}</h2>
            <div className="text-sm text-gray-600">{a.date_acte}</div>
            {a.objet_complet && <p className="mt-2">{a.objet_complet}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
