import React, { useState } from "react";
import { useCurrentUser } from "@inseme/cop-host";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import EntityList from "../../components/admin/EntityList";
import EntityEditor from "../../components/admin/EntityEditor";

const DEFAULT_TYPES = ["users", "posts", "groups", "wiki", "comments", "subscriptions"];

export default function Entities() {
  const { currentUser } = useCurrentUser();
  const [type, setType] = useState(DEFAULT_TYPES[0]);
  const [selectedId, setSelectedId] = useState(null);

  const role = getUserRole(currentUser);
  if (role !== ROLE_ADMIN) {
    return <div className="p-6">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="page-title">Admin — Entities editor</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Entity type</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setSelectedId(null);
              }}
              className="w-full"
            >
              {DEFAULT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <EntityList type={type} onSelect={(id) => setSelectedId(id)} />
        </div>

        <div className="md:col-span-3">
          <EntityEditor
            type={type}
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onSaved={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
