import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "@inseme/cop-host";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import { useSupabase } from "../../contexts/SupabaseContext";
import SiteFooter from "../../components/layout/SiteFooter";

// Catégories de configuration pour l'affichage
const CONFIG_CATEGORIES = {
  identity: {
    label: "🏛️ Identité",
    description: "Nom de la communauté, type, slogan",
    keys: ["community_name", "community_type", "community_tagline", "community_code", "city_name"],
  },
  branding: {
    label: "🎨 Branding",
    description: "Mouvement, parti, hashtag, assistant",
    keys: ["movement_name", "party_name", "hashtag", "bot_name", "assistant_name"],
  },
  contact: {
    label: "📧 Contact",
    description: "Email de contact",
    keys: ["contact_email"],
  },
  urls: {
    label: "🔗 URLs",
    description: "URLs de l'application",
    keys: ["app_url", "app_base_url"],
  },
  federation: {
    label: "🛰️ Fédération",
    description: "Paramètres de fédération (hub parent)",
    keys: ["parent_hub_url", "parent_hub_api_key"],
  },
  features: {
    label: "⚙️ Fonctionnalités",
    description: "Options et paramètres",
    keys: ["disable_provider_randomization", "llm_stream_timeout_ms", "site_config_cache_ttl"],
  },
};

// Clés sensibles qui ne doivent pas être éditables via l'UI
const SENSITIVE_KEYS = [
  "supabase_url",
  "supabase_service_role_key",
  "supabase_anon_key",
  "openai_api_key",
  "anthropic_api_key",
  "gemini_api_key",
  "mistral_api_key",
  "huggingface_api_key",
  "grok_api_key",
  "github_token",
  "github_client_secret",
  "google_client_secret",
  "facebook_client_secret",
  "brave_search_api_key",
  "cron_api_key",
  "cli_token",
  "postgres_url",
  "database_url",
];

// Descriptions des clés pour l'aide contextuelle
const KEY_DESCRIPTIONS = {
  community_name: "Nom de la communauté (ex: Corte)",
  community_type: "Type: municipality, university, association, copro, other",
  community_tagline: "Slogan court (ex: CAPITALE)",
  community_code: "Code INSEE ou identifiant",
  city_name: "Nom de la ville (alias de community_name)",
  movement_name: "Nom du mouvement citoyen",
  party_name: "Nom du parti/groupe",
  hashtag: "Hashtag principal (sans #)",
  bot_name: "Nom interne du bot",
  assistant_name: "Nom public de l'assistant IA (ex: Ophélia)",
  contact_email: "Email de contact public",
  app_url: "URL principale de l'application",
  app_base_url: "URL de base pour les callbacks OAuth",
  parent_hub_url: "URL du hub parent (ex: https://corse.transparence.fr)",
  parent_hub_api_key:
    "Clé API du hub parent (utilisée pour proposer des pages) — stockée dans le vault",
  disable_provider_randomization: "Désactiver la rotation des providers IA (true/false)",
  llm_stream_timeout_ms: "Timeout pour le streaming LLM en ms",
  site_config_cache_ttl: "Durée du cache de config en secondes",
};

export default function VaultConfig() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const supabase = useSupabase();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const role = currentUser ? getUserRole(currentUser) : null;
  const isAdmin = role === ROLE_ADMIN;

  // Charger les configurations depuis le vault
  useEffect(() => {
    if (!supabase || !isAdmin) return;

    async function loadConfigs() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("instance_config")
          .select("key, value, updated_at")
          .order("key");

        if (fetchError) throw fetchError;
        setConfigs(data || []);
      } catch (err) {
        console.error("Failed to load vault configs:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    }

    loadConfigs();
  }, [supabase, isAdmin]);

  // Filtrer les configs
  const filteredConfigs = useMemo(() => {
    let result = configs;

    // Filtre par catégorie
    if (activeCategory !== "all") {
      const categoryKeys = CONFIG_CATEGORIES[activeCategory]?.keys || [];
      result = result.filter((c) => categoryKeys.includes(c.key));
    }

    // Filtre par recherche
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        (c) =>
          c.key.toLowerCase().includes(lowerFilter) || c.value.toLowerCase().includes(lowerFilter)
      );
    }

    return result;
  }, [configs, activeCategory, filter]);

  // Clés non présentes dans le vault (pour suggestions)
  const missingKeys = useMemo(() => {
    const existingKeys = new Set(configs.map((c) => c.key));
    const allCategoryKeys = Object.values(CONFIG_CATEGORIES).flatMap((cat) => cat.keys);
    return allCategoryKeys.filter((k) => !existingKeys.has(k) && !SENSITIVE_KEYS.includes(k));
  }, [configs]);

  // Sauvegarder une modification
  async function handleSave(key, value) {
    setSaving(true);
    try {
      // Déterminer si la clé doit être publique (par défaut true pour les clés non sensibles)
      const isSecret = SENSITIVE_KEYS.includes(key);
      const isPublic = !isSecret;

      const { error: upsertError } = await supabase.from("instance_config").upsert(
        {
          key,
          value,
          is_public: isPublic,
          is_secret: isSecret,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (upsertError) throw upsertError;

      // Mettre à jour l'état local
      setConfigs((prev) => {
        const idx = prev.findIndex((c) => c.key === key);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], value, updated_at: new Date().toISOString() };
          return updated;
        } else {
          return [...prev, { key, value, updated_at: new Date().toISOString() }];
        }
      });

      setEditingKey(null);
      setEditValue("");
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Erreur: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  // Supprimer une clé
  async function handleDelete(key) {
    if (!confirm(`Supprimer la clé "${key}" du vault ?`)) return;

    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from("instance_config").delete().eq("key", key);

      if (deleteError) throw deleteError;

      setConfigs((prev) => prev.filter((c) => c.key !== key));
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Erreur: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  // Ajouter une nouvelle clé
  async function handleAddNew() {
    if (!newKey.trim()) {
      alert("La clé est requise");
      return;
    }
    if (SENSITIVE_KEYS.includes(newKey.toLowerCase())) {
      alert("Cette clé est sensible et doit être configurée via les variables d'environnement");
      return;
    }
    await handleSave(newKey.trim().toLowerCase(), newValue);
    setNewKey("");
    setNewValue("");
  }

  // Affichage si non admin
  if (userLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">🔐 Configuration Vault</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Accès réservé aux administrateurs.
        </div>
        <Link to="/admin" className="text-primary hover:underline mt-4 inline-block">
          ← Retour à l'administration
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🔐 Configuration Vault</h1>
          <p className="text-gray-600 text-sm mt-1">
            Gérez les configurations centralisées de l'instance
          </p>
        </div>
        <Link to="/admin" className="text-primary hover:underline">
          ← Retour
        </Link>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Fonctionnement du Vault</h3>
        <p className="text-sm text-blue-700">
          Les valeurs stockées ici sont <strong>prioritaires</strong> sur les variables
          d'environnement. Les clés sensibles (API keys, secrets) doivent être configurées via
          Netlify pour des raisons de sécurité.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">{error}</div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Rechercher une clé..."
          className="flex-1 min-w-[200px] px-3 py-2 border rounded"
        />
        <select
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">Toutes les catégories</option>
          {Object.entries(CONFIG_CATEGORIES).map(([key, cat]) => (
            <option key={key} value={key}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Liste des configurations */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement des configurations...</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Clé</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valeur</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Modifié</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {filter || activeCategory !== "all"
                      ? "Aucune configuration trouvée avec ces filtres"
                      : "Aucune configuration dans le vault. Ajoutez-en une ci-dessous."}
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((cfg) => (
                  <tr key={cfg.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{cfg.key}</code>
                      {KEY_DESCRIPTIONS[cfg.key] && (
                        <p className="text-xs text-gray-500 mt-1">{KEY_DESCRIPTIONS[cfg.key]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingKey === cfg.key ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm">
                          {cfg.value || <em className="text-gray-400">(vide)</em>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {cfg.updated_at
                        ? new Date(cfg.updated_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingKey === cfg.key ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleSave(cfg.key, editValue)}
                            disabled={saving}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? "..." : "✓"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingKey(null);
                              setEditValue("");
                            }}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingKey(cfg.key);
                              setEditValue(cfg.value);
                            }}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() => handleDelete(cfg.key)}
                            className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ajouter une nouvelle configuration */}
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">➕ Ajouter une configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clé</label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="ma_cle"
              className="w-full px-3 py-2 border rounded"
              list="suggested-keys"
            />
            <datalist id="suggested-keys">
              {missingKeys.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valeur</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="valeur"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddNew}
              disabled={saving || !newKey.trim()}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </div>
        {newKey && KEY_DESCRIPTIONS[newKey] && (
          <p className="mt-2 text-sm text-gray-600">{KEY_DESCRIPTIONS[newKey]}</p>
        )}
      </div>

      {/* Clés sensibles */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">🔒 Clés sensibles</h2>
        <p className="text-sm text-yellow-700 mb-4">
          Ces clés contiennent des secrets et doivent être configurées via les variables
          d'environnement Netlify, pas dans ce vault :
        </p>
        <div className="flex flex-wrap gap-2">
          {SENSITIVE_KEYS.map((k) => (
            <code key={k} className="text-xs bg-yellow-100 px-2 py-1 rounded text-yellow-800">
              {k}
            </code>
          ))}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
