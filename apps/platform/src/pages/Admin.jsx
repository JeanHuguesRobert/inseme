import React, { useState } from "react";
import { Link } from "react-router-dom";
import SiteFooter from "../components/layout/SiteFooter";
import { useCurrentUser } from "@inseme/cop-host";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import SiteConfigEditor from "../components/admin/SiteConfigEditor";
import { getConfig } from "../common/config/instanceConfig.client.js";

export default function Admin() {
  const { currentUser, loading } = useCurrentUser();

  async function handleExportMyData() {
    if (!currentUser) return alert("Connectez-vous pour exporter vos données");
    try {
      const res = await fetch("/api/export-user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return alert("Export failed: " + res.status + " " + txt);
      }
      const json = await res.json();
      // If the function returns a download URL, open it
      if (json?.url) {
        window.open(json.url, "_blank");
      } else {
        alert("Export requested — check your email or the server logs.");
      }
    } catch (err) {
      // Fallback: prompt to contact the admin
      const contact = getConfig("contact_email");
      if (contact) {
        window.location.href = `mailto:${contact}?subject=Export%20request&body=Please%20export%20my%20data%20for%20user%20id%20${currentUser.id}`;
      } else {
        alert("Export failed: " + (err?.message || String(err)));
      }
    }
  }

  const role = currentUser ? getUserRole(currentUser) : null;
  const [q, setQ] = useState("");
  const ql = String(q || "").toLowerCase();

  const userLinks = [
    { label: "Votre tableau de bord", to: "/user-dashboard" },
    { label: "Modifier votre profil", to: "/user-profile" },
    { label: "Voir votre page publique", to: `/users/${currentUser?.id || ""}` },
    { label: "Gérer vos abonnements", to: "/subscriptions" },
  ];

  const adminLinks = [
    { label: "🔐 Configuration Vault", to: "/admin/vault" },
    { label: "API Testing", to: "/admin/api" },
    { label: "COP Administration", to: "/admin/cop" },
    { label: "Entities editor", to: "/admin/entities" },
    { label: "Data review", to: "/admin/data-review" },
    { label: "🏛️ Gestion Instances (Communes)", to: "/admin/saas" },
    { label: "📊 Leads Transparence", to: "/admin/leads" },
  ];

  const filterLinks = (links) =>
    links.filter(
      (l) => !ql || l.label.toLowerCase().includes(ql) || l.to.toLowerCase().includes(ql)
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Admin / Tools</h1>
      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher outils, ex: profile, entities..."
          className="w-full px-3 py-2 border "
        />
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">User tools</h2>
        <p className="text-sm text-gray-400 mb-3">
          Tools available for regular authenticated users.
        </p>
        {!currentUser ? (
          <div className="mb-3">Connectez-vous pour accéder aux outils utilisateur.</div>
        ) : (
          <div className="space-y-2">
            {filterLinks(userLinks).map((l) => (
              <Link key={l.to} to={l.to} className="block text-primary hover:underline">
                {l.label}
              </Link>
            ))}
            <div>
              <button
                onClick={handleExportMyData}
                className="px-3 py-1 border bg-primary-600 text-bauhaus-white"
              >
                Exporter mes données
              </button>
            </div>
            <div>
              <a
                href={`mailto:${getConfig("contact_email", "")}?subject=Support%20request`}
                className="block text-sm text-gray-500"
              >
                Contacter le support
              </a>
            </div>
          </div>
        )}
      </section>

      {role === ROLE_ADMIN && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold">Admin tools</h2>
          <p className="text-sm text-gray-400 mb-3">Privileged tools (admin only)</p>
          <ul className="space-y-2">
            {filterLinks(adminLinks).map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-primary hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <SiteConfigEditor />
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
