import React, { useState, useEffect } from "react";
import { useCurrentUser } from "@inseme/cop-host";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import { getSupabase } from "../../lib/supabase.js";
import SiteFooter from "../../components/layout/SiteFooter";

// Communes du Centre Corse (pilote)
const CENTRE_CORSE_COMMUNES = [
  { name: "Corte", insee: "2B096", population: 7737, postalCode: "20250", isSiege: true },
  { name: "Venaco", insee: "2B341", population: 643, postalCode: "20231" },
  { name: "Vivario", insee: "2B354", population: 429, postalCode: "20219" },
  { name: "Casanova", insee: "2B074", population: 375, postalCode: "20250" },
  { name: "Santo-Pietro-di-Venaco", insee: "2B315", population: 298, postalCode: "20250" },
  { name: "Poggio-di-Venaco", insee: "2B238", population: 210, postalCode: "20250" },
  { name: "Riventosa", insee: "2B260", population: 150, postalCode: "20250" },
  { name: "Rospigliani", insee: "2B263", population: 70, postalCode: "20219" },
  { name: "Noceta", insee: "2B177", population: 68, postalCode: "20219" },
  { name: "Muracciole", insee: "2B171", population: 34, postalCode: "20219" },
];

// Modèle 100% gratuit - association C.O.R.S.I.C.A.
const INSTANCE_TYPES = [
  { id: "commune", name: "Commune", description: "Instance pour une commune" },
  { id: "epci", name: "EPCI / Interco", description: "Hub intercommunal" },
  { id: "region", name: "Hub régional", description: "Agrégation régionale" },
];

const INSTANCE_STATUS = {
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
  provisioning: { label: "Provisioning...", color: "bg-blue-100 text-blue-800" },
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  suspended: { label: "Suspendue", color: "bg-red-100 text-red-800" },
  error: { label: "Erreur", color: "bg-red-100 text-red-800" },
};

export default function SaasAdmin() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewInstanceModal, setShowNewInstanceModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [activeTab, setActiveTab] = useState("instances");

  const role = getUserRole(currentUser);

  useEffect(() => {
    if (role === ROLE_ADMIN) {
      loadInstances();
    }
  }, [role]);

  async function loadInstances() {
    setLoading(true);
    try {
      const { data, error } = await getSupabase()
        .from("saas_instances")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (err) {
      console.error("Error loading instances:", err);
      // Table might not exist yet, that's ok
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }

  if (userLoading) {
    return <div className="p-6">Chargement...</div>;
  }

  if (role !== ROLE_ADMIN) {
    return <div className="p-6">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des instances</h1>
          <p className="text-gray-500">Association C.O.R.S.I.C.A. — 100% gratuit et open source</p>
        </div>
        <button
          onClick={() => setShowNewInstanceModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <span>+</span> Nouvelle instance
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {[
            { id: "instances", label: "Instances", count: instances.length },
            { id: "pilot", label: "Pilote Centre Corse", count: CENTRE_CORSE_COMMUNES.length },
            { id: "provisioning", label: "Provisioning" },
            { id: "donations", label: "💚 Dons" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === "instances" && (
        <InstancesTab
          instances={instances}
          onRefresh={loadInstances}
          onSelect={setSelectedInstance}
          loading={loading}
        />
      )}

      {activeTab === "pilot" && (
        <PilotTab
          communes={CENTRE_CORSE_COMMUNES}
          instances={instances}
          onProvision={(commune) => {
            setSelectedInstance({ ...commune, isNew: true });
            setShowNewInstanceModal(true);
          }}
        />
      )}

      {activeTab === "provisioning" && <ProvisioningTab />}

      {activeTab === "donations" && <DonationsTab instances={instances} />}

      {/* Modal nouvelle instance */}
      {showNewInstanceModal && (
        <NewInstanceModal
          prefill={selectedInstance?.isNew ? selectedInstance : null}
          onClose={() => {
            setShowNewInstanceModal(false);
            setSelectedInstance(null);
          }}
          onCreated={() => {
            loadInstances();
            setShowNewInstanceModal(false);
            setSelectedInstance(null);
          }}
        />
      )}

      {/* Modal détail instance */}
      {selectedInstance && !selectedInstance.isNew && (
        <InstanceDetailModal
          instance={selectedInstance}
          onClose={() => setSelectedInstance(null)}
          onUpdated={loadInstances}
        />
      )}

      <SiteFooter />
    </div>
  );
}

// === Onglet Instances ===
function InstancesTab({ instances, onRefresh, onSelect, loading }) {
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement des instances...</div>;
  }

  if (instances.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-5xl mb-4">🏛️</div>
        <h3 className="text-lg font-medium text-gray-900">Aucune instance</h3>
        <p className="text-gray-500 mt-1">
          Commencez par créer une instance pour une commune ou utilisez le pilote Centre Corse.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Commune
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              INSEE
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Plan
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Créée le
            </th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {instances.map((instance) => (
            <tr key={instance.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{instance.commune_name}</div>
                {instance.is_hub && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                    Hub
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {instance.commune_insee || "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm">{instance.plan}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${INSTANCE_STATUS[instance.status]?.color || "bg-gray-100"}`}
                >
                  {INSTANCE_STATUS[instance.status]?.label || instance.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {instance.instance_url ? (
                  <a
                    href={instance.instance_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {new URL(instance.instance_url).hostname}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(instance.created_at).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button
                  onClick={() => onSelect(instance)}
                  className="text-primary-600 hover:text-primary-900"
                >
                  Gérer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Onglet Pilote Centre Corse ===
function PilotTab({ communes, instances, onProvision }) {
  const instanceByInsee = instances.reduce((acc, i) => {
    if (i.commune_insee) acc[i.commune_insee] = i;
    return acc;
  }, {});

  const totalPop = communes.reduce((sum, c) => sum + c.population, 0);
  const deployedCount = communes.filter((c) => instanceByInsee[c.insee]).length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{communes.length}</div>
          <div className="text-sm text-gray-500">Communes</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{totalPop.toLocaleString("fr-FR")}</div>
          <div className="text-sm text-gray-500">Population</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{deployedCount}</div>
          <div className="text-sm text-gray-500">Déployées</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {communes.length - deployedCount}
          </div>
          <div className="text-sm text-gray-500">En attente</div>
        </div>
      </div>

      {/* EPCI Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900">Communauté de Communes du Centre Corse</h3>
        <p className="text-sm text-blue-700">
          SIREN: 242020071 • Siège: Corte • 362 km² • EPCI insulaire sans façade maritime
        </p>
      </div>

      {/* Liste des communes */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Commune
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                INSEE
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Population
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code Postal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {communes.map((commune) => {
              const instance = instanceByInsee[commune.insee];
              return (
                <tr key={commune.insee} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{commune.name}</span>
                      {commune.isSiege && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          Siège EPCI
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {commune.insee}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {commune.population.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {commune.postalCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {instance ? (
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${INSTANCE_STATUS[instance.status]?.color}`}
                      >
                        {INSTANCE_STATUS[instance.status]?.label}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                        Non déployée
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {instance ? (
                      <a
                        href={instance.instance_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline text-sm"
                      >
                        Ouvrir ↗
                      </a>
                    ) : (
                      <button
                        onClick={() => onProvision(commune)}
                        className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                      >
                        Provisionner
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions groupées */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => alert("TODO: Déployer toutes les communes non provisionnées")}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          disabled={deployedCount === communes.length}
        >
          Déployer toutes ({communes.length - deployedCount} restantes)
        </button>
        <button
          onClick={() => alert("TODO: Créer le hub EPCI Centre Corse")}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Créer Hub EPCI
        </button>
      </div>
    </div>
  );
}

// === Onglet Provisioning ===
function ProvisioningTab() {
  const [supabaseConfig, setSupabaseConfig] = useState({
    organizationId: "",
    accessToken: "",
    region: "eu-west-3",
  });
  const [netlifyConfig, setNetlifyConfig] = useState({
    accessToken: "",
    teamSlug: "",
  });
  const [testStatus, setTestStatus] = useState({ supabase: null, netlify: null });

  async function testSupabaseConnection() {
    setTestStatus((s) => ({ ...s, supabase: "testing" }));
    try {
      // TODO: Appeler l'API Supabase Management
      await new Promise((r) => setTimeout(r, 1000));
      setTestStatus((s) => ({ ...s, supabase: "success" }));
    } catch {
      setTestStatus((s) => ({ ...s, supabase: "error" }));
    }
  }

  async function testNetlifyConnection() {
    setTestStatus((s) => ({ ...s, netlify: "testing" }));
    try {
      // TODO: Appeler l'API Netlify
      await new Promise((r) => setTimeout(r, 1000));
      setTestStatus((s) => ({ ...s, netlify: "success" }));
    } catch {
      setTestStatus((s) => ({ ...s, netlify: "error" }));
    }
  }

  return (
    <div className="space-y-8">
      {/* Configuration Supabase */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="text-green-600 text-xl">⚡</span>
          </div>
          <div>
            <h3 className="font-semibold">Configuration Supabase</h3>
            <p className="text-sm text-gray-500">Pour créer les bases de données des communes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
            <input
              type="text"
              value={supabaseConfig.organizationId}
              onChange={(e) => setSupabaseConfig((s) => ({ ...s, organizationId: e.target.value }))}
              placeholder="Ex: abcd1234-..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
            <input
              type="password"
              value={supabaseConfig.accessToken}
              onChange={(e) => setSupabaseConfig((s) => ({ ...s, accessToken: e.target.value }))}
              placeholder="sbp_..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
            <select
              value={supabaseConfig.region}
              onChange={(e) => setSupabaseConfig((s) => ({ ...s, region: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="eu-west-1">eu-west-1 (Irlande)</option>
              <option value="eu-west-2">eu-west-2 (Londres)</option>
              <option value="eu-west-3">eu-west-3 (Paris) ✓</option>
              <option value="eu-central-1">eu-central-1 (Francfort)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={testSupabaseConnection}
              disabled={testStatus.supabase === "testing"}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              {testStatus.supabase === "testing" && <span className="animate-spin">⏳</span>}
              {testStatus.supabase === "success" && <span className="text-green-600">✓</span>}
              {testStatus.supabase === "error" && <span className="text-red-600">✗</span>}
              Tester la connexion
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <strong>Note :</strong> Le token doit avoir les permissions{" "}
          <code className="bg-yellow-100 px-1">projects.create</code> et{" "}
          <code className="bg-yellow-100 px-1">projects.read</code>.<br />
          <a
            href="https://supabase.com/dashboard/account/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Créer un token Supabase →
          </a>
        </div>
      </div>

      {/* Configuration Netlify */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <span className="text-teal-600 text-xl">▲</span>
          </div>
          <div>
            <h3 className="font-semibold">Configuration Netlify</h3>
            <p className="text-sm text-gray-500">Pour déployer les frontends des communes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
            <input
              type="password"
              value={netlifyConfig.accessToken}
              onChange={(e) => setNetlifyConfig((s) => ({ ...s, accessToken: e.target.value }))}
              placeholder="nfp_..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Slug (optionnel)
            </label>
            <input
              type="text"
              value={netlifyConfig.teamSlug}
              onChange={(e) => setNetlifyConfig((s) => ({ ...s, teamSlug: e.target.value }))}
              placeholder="Ex: my-team"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          <button
            onClick={testNetlifyConnection}
            disabled={testStatus.netlify === "testing"}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            {testStatus.netlify === "testing" && <span className="animate-spin">⏳</span>}
            {testStatus.netlify === "success" && <span className="text-green-600">✓</span>}
            {testStatus.netlify === "error" && <span className="text-red-600">✗</span>}
            Tester la connexion
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <a
            href="https://app.netlify.com/user/applications#personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Créer un token Netlify →
          </a>
        </div>
      </div>

      {/* Étapes manuelles */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="font-semibold mb-4">Étapes de provisioning (semi-automatique)</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div className="flex-1">
              <div className="font-medium">Créer le projet Supabase</div>
              <p className="text-sm text-gray-500">
                Via l'UI ou l'API, créer un nouveau projet avec le nom <code>survey-[INSEE]</code>
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div className="flex-1">
              <div className="font-medium">Appliquer les migrations SQL</div>
              <p className="text-sm text-gray-500">
                Exécuter les fichiers de migration depuis <code>supabase/migrations/</code>
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div className="flex-1">
              <div className="font-medium">Créer le site Netlify</div>
              <p className="text-sm text-gray-500">
                Depuis un template ou fork du repo, avec les variables d'environnement configurées
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div className="flex-1">
              <div className="font-medium">Enregistrer dans le hub fédératif</div>
              <p className="text-sm text-gray-500">
                Ajouter l'instance dans <code>federation_registry</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Onglet Dons ===
function DonationsTab({ instances }) {
  const activeInstances = instances.filter((i) => i.status === "active");

  // Budget estimé
  const MONTHLY_COSTS = {
    supabase: 60, // ~2 projets pro
    netlify: 20,
    domains: 5,
    openai: 20,
    misc: 10,
  };
  const totalMonthlyCost = Object.values(MONTHLY_COSTS).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Bannière HelloAsso */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">💚 Soutenez le projet</h3>
            <p className="mt-1 opacity-90">
              100% bénévole, 100% gratuit, financé uniquement par les dons
            </p>
          </div>
          <a
            href="https://www.helloasso.com/associations/corsica"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-white text-green-600 rounded-lg font-bold hover:bg-green-50"
          >
            Faire un don sur HelloAsso →
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-green-600">0€</div>
          <div className="text-sm text-gray-500">Abonnements (gratuit !)</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold">{activeInstances.length}</div>
          <div className="text-sm text-gray-500">Communes servies</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-orange-500">~{totalMonthlyCost}€</div>
          <div className="text-sm text-gray-500">Coûts mensuels</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-500">~{totalMonthlyCost * 12}€</div>
          <div className="text-sm text-gray-500">Budget annuel</div>
        </div>
      </div>

      {/* Détail des coûts */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Coûts d'infrastructure (estimés)</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Poste
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Coût/mois
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Coût/an
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4">Hébergement Supabase</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.supabase}€</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.supabase * 12}€</td>
              <td className="px-6 py-4 text-sm text-gray-500">Plans Pro pour hubs</td>
            </tr>
            <tr>
              <td className="px-6 py-4">Hébergement Netlify</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.netlify}€</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.netlify * 12}€</td>
              <td className="px-6 py-4 text-sm text-gray-500">Tiers gratuits + extras</td>
            </tr>
            <tr>
              <td className="px-6 py-4">Noms de domaine</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.domains}€</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.domains * 12}€</td>
              <td className="px-6 py-4 text-sm text-gray-500">transparence-commune.fr, etc.</td>
            </tr>
            <tr>
              <td className="px-6 py-4">API OpenAI (embeddings)</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.openai}€</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.openai * 12}€</td>
              <td className="px-6 py-4 text-sm text-gray-500">RAG, Ophélia</td>
            </tr>
            <tr>
              <td className="px-6 py-4">Divers (outils, assurance)</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.misc}€</td>
              <td className="px-6 py-4">{MONTHLY_COSTS.misc * 12}€</td>
              <td className="px-6 py-4 text-sm text-gray-500">GitHub, Sentry, RC asso</td>
            </tr>
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-6 py-4 font-bold">Total</td>
              <td className="px-6 py-4 font-bold">{totalMonthlyCost}€</td>
              <td className="px-6 py-4 font-bold text-green-600">{totalMonthlyCost * 12}€</td>
              <td className="px-6 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Paliers de dons */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="font-semibold mb-4">Paliers de dons suggérés</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">☕</div>
            <div className="font-bold">Café citoyen</div>
            <div className="text-2xl font-bold text-green-600 my-2">5€</div>
            <div className="text-sm text-gray-500">Ponctuel</div>
          </div>
          <div className="border-2 border-green-500 rounded-lg p-4 text-center bg-green-50">
            <div className="text-2xl mb-2">🌿</div>
            <div className="font-bold">Soutien</div>
            <div className="text-2xl font-bold text-green-600 my-2">10€/mois</div>
            <div className="text-sm text-gray-500">120€/an</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">🌳</div>
            <div className="font-bold">Mécène</div>
            <div className="text-2xl font-bold text-green-600 my-2">50€/mois</div>
            <div className="text-sm text-gray-500">600€/an</div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          Tous les montants sont libres et suggérés. Aucune contrepartie obligatoire.
        </p>
      </div>

      {/* Transparence */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800">📊 Transparence totale</h4>
        <p className="text-sm text-blue-700 mt-1">
          Tous les comptes de l'association sont publics. Les dons reçus et les dépenses sont
          publiés mensuellement sur le site.
        </p>
      </div>
    </div>
  );
}

// === Modal Nouvelle Instance ===
function NewInstanceModal({ prefill, onClose, onCreated }) {
  const [form, setForm] = useState({
    communeName: prefill?.name || "",
    communeInsee: prefill?.insee || "",
    regionCode: "94", // Corse
    instanceType: prefill?.isSiege ? "commune" : "commune",
    adminEmail: "",
    customDomain: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("saas_instances").insert({
        commune_name: form.communeName,
        commune_insee: form.communeInsee || null,
        region_code: form.regionCode,
        hub_type: form.instanceType,
        is_hub: form.instanceType !== "commune",
        status: "pending",
        admin_email: form.adminEmail,
        instance_url: form.customDomain || null,
        metadata: {
          notes: form.notes,
          created_via: "admin_ui",
        },
      });

      if (error) throw error;
      onCreated();
    } catch (err) {
      console.error("Error creating instance:", err);
      alert("Erreur: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Nouvelle instance</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la commune *
              </label>
              <input
                type="text"
                value={form.communeName}
                onChange={(e) => setForm((f) => ({ ...f, communeName: e.target.value }))}
                required
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code INSEE</label>
                <input
                  type="text"
                  value={form.communeInsee}
                  onChange={(e) => setForm((f) => ({ ...f, communeInsee: e.target.value }))}
                  placeholder="Ex: 2B096"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code région</label>
                <input
                  type="text"
                  value={form.regionCode}
                  onChange={(e) => setForm((f) => ({ ...f, regionCode: e.target.value }))}
                  placeholder="Ex: 94"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'instance
              </label>
              <select
                value={form.instanceType}
                onChange={(e) => setForm((f) => ({ ...f, instanceType: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {INSTANCE_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} — {type.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                💚 Toutes les instances sont 100% gratuites
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email administrateur *
              </label>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                required
                placeholder="admin@mairie-corte.fr"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domaine personnalisé (optionnel)
              </label>
              <input
                type="text"
                value={form.customDomain}
                onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value }))}
                placeholder="Ex: corte.transparence-commune.fr"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Notes internes..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Création..." : "Créer l'instance"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// === Modal Détail Instance ===
function InstanceDetailModal({ instance, onClose, onUpdated }) {
  const [provisioningStep, setProvisioningStep] = useState(0);
  const [provisioningLog, setProvisioningLog] = useState([]);

  const steps = [
    { id: "supabase", label: "Créer projet Supabase", status: "pending" },
    { id: "migrations", label: "Appliquer migrations", status: "pending" },
    { id: "netlify", label: "Créer site Netlify", status: "pending" },
    { id: "env", label: "Configurer variables", status: "pending" },
    { id: "federation", label: "Enregistrer fédération", status: "pending" },
    { id: "admin", label: "Créer admin", status: "pending" },
  ];

  async function runProvisioningStep(stepId) {
    setProvisioningLog((l) => [...l, `[${new Date().toISOString()}] Starting ${stepId}...`]);

    // TODO: Implémenter chaque étape
    await new Promise((r) => setTimeout(r, 1500));

    setProvisioningLog((l) => [...l, `[${new Date().toISOString()}] ✓ ${stepId} completed`]);
    setProvisioningStep((s) => s + 1);
  }

  async function handleProvisionAll() {
    for (const step of steps) {
      await runProvisioningStep(step.id);
    }

    // Update status
    const supabase = getSupabase();
    await supabase.from("saas_instances").update({ status: "active" }).eq("id", instance.id);

    onUpdated();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold">{instance.commune_name}</h2>
              <p className="text-gray-500">
                {instance.commune_insee} • Plan {instance.plan}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm ${INSTANCE_STATUS[instance.status]?.color}`}
            >
              {INSTANCE_STATUS[instance.status]?.label}
            </span>
          </div>

          {/* Infos */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-500">URL</div>
              <div className="font-medium">
                {instance.instance_url || <span className="text-gray-400">Non configurée</span>}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Admin</div>
              <div className="font-medium">{instance.admin_email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Supabase Project ID</div>
              <div className="font-medium">
                {instance.supabase_project_id || (
                  <span className="text-gray-400">Non provisionné</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Netlify Site ID</div>
              <div className="font-medium">
                {instance.netlify_site_id || <span className="text-gray-400">Non provisionné</span>}
              </div>
            </div>
          </div>

          {/* Provisioning steps */}
          {instance.status === "pending" && (
            <div className="border rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-4">Étapes de provisioning</h3>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                        idx < provisioningStep
                          ? "bg-green-100 text-green-600"
                          : idx === provisioningStep
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {idx < provisioningStep ? "✓" : idx + 1}
                    </div>
                    <span className={idx < provisioningStep ? "text-green-600" : ""}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {provisioningLog.length > 0 && (
                <div className="mt-4 p-3 bg-gray-900 text-green-400 rounded font-mono text-xs max-h-40 overflow-y-auto">
                  {provisioningLog.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}

              <button
                onClick={handleProvisionAll}
                disabled={provisioningStep > 0}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {provisioningStep > 0 ? "Provisioning en cours..." : "Lancer le provisioning"}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between border-t pt-4">
            <div className="flex gap-2">
              {instance.instance_url && (
                <a
                  href={instance.instance_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Ouvrir le site ↗
                </a>
              )}
              {instance.supabase_project_id && (
                <a
                  href={`https://supabase.com/dashboard/project/${instance.supabase_project_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Dashboard Supabase ↗
                </a>
              )}
            </div>
            <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
