// src/lib/federation.js
// Module de fédération des consultations
// Permet l'import/export de consultations entre instances du réseau

import { getSupabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";
import {
  COMMUNITY_NAME,
  COMMUNE_INSEE,
  REGION_NAME,
  REGION_CODE,
  IS_NATIONAL_HUB,
} from "../constants.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Instance courante (pour identification dans le réseau)
 */
export const CURRENT_INSTANCE = {
  url: typeof window !== "undefined" ? window.location.origin : "",
  name: COMMUNITY_NAME,
  insee: COMMUNE_INSEE,
  region: REGION_NAME,
  regionCode: REGION_CODE,
  isHub: IS_NATIONAL_HUB,
};

/**
 * Types d'instances dans le réseau fédéré
 */
export const INSTANCE_TYPES = {
  commune: { label: "Commune", icon: "🏘️" },
  region: { label: "Région", icon: "🗺️" },
  national: { label: "National", icon: "🇫🇷" },
  custom: { label: "Réseau personnalisé", icon: "🌐" },
};

// ============================================================================
// REGISTRE DES INSTANCES
// ============================================================================

/**
 * Récupère la liste des instances actives du réseau
 * @param {Object} options - Filtres (type, region, hub)
 * @returns {Promise<Array>}
 */
export async function getRegisteredInstances(options = {}) {
  const { type = null, regionCode = null, hubOnly = false } = options;

  let query = getSupabase()
    .from("federation_registry")
    .select("*")
    .eq("status", "active")
    .order("instance_name");

  if (type) {
    query = query.eq("instance_type", type);
  }
  if (regionCode) {
    query = query.eq("region_code", regionCode);
  }
  if (hubOnly) {
    query = query.eq("is_hub", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erreur récupération instances:", error);
    return [];
  }

  return data || [];
}

// Helper: create a remote client with isolated auth (no session persistence)
function createRemoteClient(url, key) {
  const hostKey = (() => {
    try {
      return new URL(url).host.replace(/[:]/g, "-");
    } catch (e) {
      return "remote";
    }
  })();

  return createClient(url, key || "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: `sb-remote-${hostKey}`,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
}

/**
 * Enregistre cette instance dans le réseau fédéré d'un hub
 * @param {string} hubUrl - URL du hub (régional ou national)
 * @param {string} apiKey - Clé API pour l'authentification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function registerWithHub(hubUrl, apiKey) {
  try {
    const hubClient = createRemoteClient(hubUrl, apiKey);

    const { data, error } = await hubClient
      .from("federation_registry")
      .upsert(
        {
          instance_url: CURRENT_INSTANCE.url,
          instance_name: CURRENT_INSTANCE.name,
          instance_type: "commune",
          commune_name: CURRENT_INSTANCE.name,
          commune_insee: CURRENT_INSTANCE.insee,
          region_name: CURRENT_INSTANCE.region,
          region_code: CURRENT_INSTANCE.regionCode,
          api_endpoint: `${CURRENT_INSTANCE.url}/api`,
          status: "pending", // Sera validé par le hub
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: "instance_url",
        }
      )
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// DÉCOUVERTE DE CONSULTATIONS
// ============================================================================

/**
 * Découvre les consultations disponibles sur une instance distante
 * @param {string} instanceUrl - URL de l'instance
 * @param {string} apiKey - Clé API (optionnelle pour consultations publiques)
 * @param {Object} filters - Filtres (scope, status)
 * @returns {Promise<Array>}
 */
export async function discoverRemoteConsultations(instanceUrl, apiKey = null, filters = {}) {
  const { scope = null, status = "active" } = filters;

  try {
    // Si on a une clé API, créer un client Supabase
    if (apiKey) {
      const remoteClient = createRemoteClient(instanceUrl, apiKey);

      let query = remoteClient
        .from("consultations")
        .select(
          `
          id, slug, title, description, scope,
          starts_at, ends_at, response_count, status,
          federation_config
        `
        )
        .eq("status", status);

      if (scope) {
        query = query.eq("scope", scope);
      }

      // Ne récupérer que les consultations qui autorisent l'import
      query = query.contains("federation_config", { allow_import: true });

      const { data, error } = await query;

      if (error) {
        console.error("Erreur découverte consultations:", error);
        return [];
      }

      return (data || []).map((c) => ({
        ...c,
        source_instance: instanceUrl,
      }));
    }

    // Sinon, essayer via API publique (si exposée)
    const response = await fetch(
      `${instanceUrl}/api/consultations?scope=${scope || ""}&status=${status}`
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return (data || []).map((c) => ({
      ...c,
      source_instance: instanceUrl,
    }));
  } catch (err) {
    console.error("Erreur découverte:", err);
    return [];
  }
}

/**
 * Récupère les détails d'une consultation distante (incluant le schéma)
 * @param {string} instanceUrl - URL de l'instance source
 * @param {string} consultationId - ID de la consultation
 * @param {string} apiKey - Clé API
 * @returns {Promise<Object|null>}
 */
export async function fetchRemoteConsultation(instanceUrl, consultationId, apiKey) {
  try {
    const remoteClient = createRemoteClient(instanceUrl, apiKey);

    const { data, error } = await remoteClient
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .single();

    if (error) {
      console.error("Erreur récupération consultation distante:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Erreur fetch distant:", err);
    return null;
  }
}

// ============================================================================
// IMPORT DE CONSULTATIONS
// ============================================================================

/**
 * Importe une consultation depuis une instance distante
 * @param {Object} remoteConsultation - Consultation distante
 * @param {Object} options - Options d'import
 * @returns {Promise<{success: boolean, localConsultation?: Object, error?: string}>}
 */
export async function importConsultation(remoteConsultation, options = {}) {
  const {
    apiKey = null,
    autoSync = true,
    syncIntervalHours = 1,
    customSlug = null,
    customTitle = null,
  } = options;

  try {
    // Vérifier que la consultation autorise l'import
    if (!remoteConsultation.federation_config?.allow_import) {
      return { success: false, error: "Cette consultation n'autorise pas l'import" };
    }

    // Vérifier qu'on n'a pas déjà importé cette consultation
    const { data: existing } = await getSupabase()
      .from("consultations")
      .select("id")
      .eq("source_instance", remoteConsultation.source_instance)
      .eq("source_consultation_id", remoteConsultation.id)
      .single();

    if (existing) {
      return {
        success: false,
        error: "Cette consultation est déjà importée",
        localConsultation: existing,
      };
    }

    // Créer la consultation locale
    const localSlug = customSlug || `imported-${remoteConsultation.slug}`;
    const localTitle = customTitle || `${remoteConsultation.title} (${COMMUNITY_NAME})`;

    const { data: localConsultation, error: createError } = await getSupabase()
      .from("consultations")
      .insert({
        slug: localSlug,
        title: localTitle,
        description: remoteConsultation.description,
        schema: remoteConsultation.schema,
        scope: remoteConsultation.scope,
        starts_at: remoteConsultation.starts_at,
        ends_at: remoteConsultation.ends_at,
        status: "active",
        // Métadonnées de fédération
        source_instance: remoteConsultation.source_instance,
        source_consultation_id: remoteConsultation.id,
        sync_endpoint: `${remoteConsultation.source_instance}/api/sync`,
        sync_api_key: apiKey,
        federation_config: {
          ...remoteConsultation.federation_config,
          imported_from: remoteConsultation.source_instance,
          imported_at: new Date().toISOString(),
          auto_sync: autoSync,
          sync_interval_hours: syncIntervalHours,
        },
      })
      .select()
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    // Enregistrer l'import
    await getSupabase().from("consultation_imports").insert({
      local_consultation_id: localConsultation.id,
      source_instance: remoteConsultation.source_instance,
      source_consultation_id: remoteConsultation.id,
      source_slug: remoteConsultation.slug,
      auto_sync: autoSync,
      sync_interval_hours: syncIntervalHours,
      status: "active",
    });

    console.log(`✓ Consultation importée: ${localTitle}`);

    return { success: true, localConsultation };
  } catch (err) {
    console.error("Erreur import:", err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// SYNCHRONISATION DES RÉPONSES
// ============================================================================

/**
 * Synchronise les réponses locales vers l'instance source
 * @param {string} consultationId - ID de la consultation locale
 * @returns {Promise<{success: boolean, synced: number, failed: number}>}
 */
export async function syncResponsesToSource(consultationId) {
  try {
    // Récupérer la consultation et ses infos de sync
    const { data: consultation, error: consultationError } = await getSupabase()
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .single();

    if (consultationError || !consultation) {
      return { success: false, error: "Consultation non trouvée" };
    }

    // Vérifier que c'est une consultation importée
    if (!consultation.source_instance || !consultation.source_consultation_id) {
      return { success: false, error: "Pas une consultation importée" };
    }

    // Récupérer les réponses en attente de sync
    const { data: pendingResponses, error: fetchError } = await getSupabase()
      .from("consultation_responses")
      .select("*")
      .eq("consultation_id", consultationId)
      .eq("sync_status", "pending")
      .limit(100);

    if (fetchError || !pendingResponses?.length) {
      return { success: true, synced: 0, failed: 0 };
    }

    // Créer le client pour l'instance source
    const sourceClient = createRemoteClient(
      consultation.source_instance,
      consultation.sync_api_key
    );

    let synced = 0;
    let failed = 0;

    for (const response of pendingResponses) {
      try {
        // Préparer les données pour la source
        const sourceData = {
          consultation_id: consultation.source_consultation_id,
          responses: {
            ...response.responses,
            _commune: COMMUNITY_NAME,
            _insee: COMMUNE_INSEE,
            _source_instance: CURRENT_INSTANCE.url,
            _imported_response_id: response.id,
          },
          schema_version: response.schema_version,
          is_complete: response.is_complete,
          user_agent_category: response.user_agent_category,
          source: `federated:${COMMUNITY_NAME}`,
          session_id: response.session_id ? `${COMMUNE_INSEE}:${response.session_id}` : null,
          completed_at: response.completed_at,
        };

        // Envoyer vers la source
        const { data: sourceResponse, error: syncError } = await sourceClient
          .from("consultation_responses")
          .insert(sourceData)
          .select("id")
          .single();

        if (syncError) {
          // Marquer comme échoué
          await getSupabase()
            .from("consultation_responses")
            .update({
              sync_status: "failed",
              sync_attempts: response.sync_attempts + 1,
              sync_error: syncError.message,
            })
            .eq("id", response.id);
          failed++;
        } else {
          // Marquer comme synchronisé
          await getSupabase()
            .from("consultation_responses")
            .update({
              sync_status: "synced",
              synced_at: new Date().toISOString(),
              source_response_id: sourceResponse.id,
              sync_error: null,
            })
            .eq("id", response.id);
          synced++;
        }
      } catch (err) {
        await getSupabase()
          .from("consultation_responses")
          .update({
            sync_status: "failed",
            sync_attempts: response.sync_attempts + 1,
            sync_error: err.message,
          })
          .eq("id", response.id);
        failed++;
      }
    }

    // Mettre à jour les stats de sync de la consultation
    await getSupabase()
      .from("consultations")
      .update({
        last_synced_at: new Date().toISOString(),
        synced_response_count: consultation.synced_response_count + synced,
        updated_at: new Date().toISOString(),
      })
      .eq("id", consultationId);

    console.log(`✓ Sync terminée: ${synced} réussies, ${failed} échouées`);

    return { success: true, synced, failed };
  } catch (err) {
    console.error("Erreur sync:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Réessaie la synchronisation des réponses échouées
 * @param {string} consultationId - ID de la consultation
 * @param {number} maxAttempts - Nombre max de tentatives (défaut: 3)
 * @returns {Promise<{success: boolean, retried: number}>}
 */
export async function retrySyncFailures(consultationId, maxAttempts = 3) {
  // Remettre les réponses échouées en "pending" si elles n'ont pas atteint le max
  const { data, error } = await getSupabase()
    .from("consultation_responses")
    .update({ sync_status: "pending" })
    .eq("consultation_id", consultationId)
    .eq("sync_status", "failed")
    .lt("sync_attempts", maxAttempts)
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  const retried = data?.length || 0;

  if (retried > 0) {
    // Relancer la sync
    await syncResponsesToSource(consultationId);
  }

  return { success: true, retried };
}

// ============================================================================
// EXPORT DE CONSULTATIONS (pour les hubs)
// ============================================================================

/**
 * Publie une consultation pour qu'elle soit importable par d'autres instances
 * @param {string} consultationId - ID de la consultation
 * @param {Object} options - Options de publication
 * @returns {Promise<{success: boolean}>}
 */
export async function publishConsultation(consultationId, options = {}) {
  const {
    allowImport = true,
    allowedRegions = [], // [] = toutes les régions
    autoSync = true,
    anonymizeExport = false,
  } = options;

  const { data, error } = await getSupabase()
    .from("consultations")
    .update({
      federation_config: {
        allow_import: allowImport,
        allowed_regions: allowedRegions,
        auto_sync: autoSync,
        anonymize_for_export: anonymizeExport,
        published_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", consultationId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, consultation: data };
}

/**
 * Dépublie une consultation (n'accepte plus d'imports)
 * @param {string} consultationId - ID de la consultation
 * @returns {Promise<{success: boolean}>}
 */
export async function unpublishConsultation(consultationId) {
  const { error } = await getSupabase()
    .from("consultations")
    .update({
      "federation_config->allow_import": false,
      "federation_config->unpublished_at": new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", consultationId);

  return { success: !error, error: error?.message };
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si une consultation est importée
 * @param {Object} consultation - La consultation
 * @returns {boolean}
 */
export function isImportedConsultation(consultation) {
  return !!(consultation?.source_instance && consultation?.source_consultation_id);
}

/**
 * Vérifie si une consultation peut être importée
 * @param {Object} consultation - La consultation distante
 * @returns {boolean}
 */
export function canImportConsultation(consultation) {
  return consultation?.federation_config?.allow_import === true;
}

/**
 * Récupère les stats de synchronisation d'une consultation
 * @param {string} consultationId - ID de la consultation
 * @returns {Promise<Object>}
 */
export async function getSyncStats(consultationId) {
  const { data: consultation } = await getSupabase()
    .from("consultations")
    .select("synced_response_count, last_synced_at, response_count")
    .eq("id", consultationId)
    .single();

  const { data: pending } = await getSupabase()
    .from("consultation_responses")
    .select("id", { count: "exact" })
    .eq("consultation_id", consultationId)
    .eq("sync_status", "pending");

  const { data: failed } = await getSupabase()
    .from("consultation_responses")
    .select("id", { count: "exact" })
    .eq("consultation_id", consultationId)
    .eq("sync_status", "failed");

  return {
    total: consultation?.response_count || 0,
    synced: consultation?.synced_response_count || 0,
    pending: pending?.length || 0,
    failed: failed?.length || 0,
    lastSyncedAt: consultation?.last_synced_at,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Configuration
  CURRENT_INSTANCE,
  INSTANCE_TYPES,

  // Registre
  getRegisteredInstances,
  registerWithHub,

  // Découverte
  discoverRemoteConsultations,
  fetchRemoteConsultation,

  // Import
  importConsultation,
  isImportedConsultation,
  canImportConsultation,

  // Sync
  syncResponsesToSource,
  retrySyncFailures,
  getSyncStats,

  // Publication (hubs)
  publishConsultation,
  unpublishConsultation,
};
