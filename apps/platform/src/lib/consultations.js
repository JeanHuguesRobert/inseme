// src/lib/consultations.js
// API pour la gestion des consultations et réponses
// Stockage flexible avec Supabase - Logique métier côté JavaScript
// Supporte la fédération nationale (double écriture local + national)

import { getSupabase } from "./supabase.js";
import { createClient } from "@supabase/supabase-js";
import {
  getConfig,
  newSupabase as createLocalSupabase,
} from "../common/config/instanceConfig.client.js";

import { getDynamicConfig } from "../constants.js";

// Ces imports sont maintenus pour les valeurs par défaut (si non trouvées dans le vault)
import {
  NATIONAL_API_URL as DEFAULT_NATIONAL_API_URL,
  NATIONAL_API_KEY as DEFAULT_NATIONAL_API_KEY,
  COMMUNE_INSEE as DEFAULT_COMMUNE_INSEE,
  COMMUNITY_NAME as DEFAULT_COMMUNITY_NAME,
  IS_NATIONAL_HUB as DEFAULT_IS_NATIONAL_HUB,
  REGION_NAME as DEFAULT_REGION_NAME,
  HASHTAG as DEFAULT_HASHTAG,
} from "../constants.js";

// Client Supabase pour la base nationale (si configurée et différente de la locale)
let nationalSupabase = null;

/**
 * Initialise le client national de manière dynamique
 * Appelé lors de la première utilisation pour garantir que la config est chargée
 */
function getNationalSupabase() {
  if (nationalSupabase) return nationalSupabase;

  const url = getConfig("NATIONAL_API_URL", DEFAULT_NATIONAL_API_URL);
  const key = getConfig("NATIONAL_API_KEY", DEFAULT_NATIONAL_API_KEY);

  // IS_NATIONAL_HUB est maintenant déterminé dynamiquement si possible
  const isHub = getConfig("IS_NATIONAL_HUB", DEFAULT_IS_NATIONAL_HUB);

  if (url && key && !isHub) {
    try {
      const hostKey = new URL(url).host.replace(/[:]/g, "-");
      nationalSupabase = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          storageKey: `sb-remote-${hostKey}`,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      });
    } catch (err) {
      console.warn("Impossible de créer le client national:", err);
    }
  }
  return nationalSupabase;
}

/**
 * Génère un identifiant de session unique pour les réponses anonymes
 * Basé sur le fingerprint du navigateur (stable pour la session)
 */
export function generateSessionId() {
  // Vérifier si on a déjà un sessionId stocké
  const stored = sessionStorage.getItem("consultation_session_id");
  if (stored) return stored;

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0,
  ].join("|");

  // Hash simple du fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const sessionId = `${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
  sessionStorage.setItem("consultation_session_id", sessionId);
  return sessionId;
}

/**
 * Détermine la catégorie d'appareil
 */
export function getUserAgentCategory() {
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
    if (/tablet|ipad/i.test(ua)) return "tablet";
    return "mobile";
  }
  return "desktop";
}

/**
 * Hash simple d'une chaîne
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// VALIDATION DES RÉPONSES
// ============================================================================

/**
 * Valide les réponses par rapport au schéma de la consultation
 * @param {Object} responses - Les réponses du formulaire
 * @param {Object} schema - Le schéma de la consultation
 * @returns {{valid: boolean, errors: Array<{field: string, message: string}>}}
 */
export function validateResponses(responses, schema) {
  const errors = [];

  if (!schema?.sections) {
    return { valid: true, errors: [] };
  }

  schema.sections.forEach((section) => {
    // Ignorer les sections optionnelles si aucun champ n'est rempli
    const sectionFields = section.questions?.map((q) => q.id) || [];
    const hasAnyValue = sectionFields.some((id) => {
      const val = responses[id];
      return (
        val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0)
      );
    });

    // Si section optionnelle et rien de rempli, on skip
    if (section.optional && !hasAnyValue) return;

    section.questions?.forEach((q) => {
      const value = responses[q.id];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      // Champs conditionnels : vérifier si la condition est remplie
      if (q.conditionalOn && !responses[q.conditionalOn]) {
        return; // Champ pas requis si condition non remplie
      }

      // Champs requis (sauf si section optionnelle)
      if (!section.optional && isEmpty && q.type !== "checkbox") {
        errors.push({
          field: q.id,
          message: `Ce champ est requis`,
          section: section.id,
        });
        return;
      }

      // Validation par type
      if (!isEmpty) {
        switch (q.type) {
          case "email":
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors.push({ field: q.id, message: "Adresse email invalide" });
            }
            break;

          case "scale": {
            const numVal = typeof value === "number" ? value : parseInt(value);
            if (isNaN(numVal) || numVal < (q.min || 1) || numVal > (q.max || 5)) {
              errors.push({
                field: q.id,
                message: `La valeur doit être entre ${q.min || 1} et ${q.max || 5}`,
              });
            }
            break;
          }

          case "radio":
          case "select": {
            if (q.options && !q.options.includes(value)) {
              errors.push({ field: q.id, message: "Valeur non valide" });
            }
            break;
          }

          case "checkbox": {
            if (Array.isArray(value) && q.options) {
              const invalid = value.filter((v) => !q.options.includes(v));
              if (invalid.length > 0) {
                errors.push({ field: q.id, message: "Options non valides" });
              }
            }
            break;
          }

          case "text":
          case "textarea": {
            if (q.maxLength && value.length > q.maxLength) {
              errors.push({
                field: q.id,
                message: `Maximum ${q.maxLength} caractères`,
              });
            }
            break;
          }
          default:
            // Type non géré, pas de validation spécifique
            break;
        }
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// SAUVEGARDE BROUILLON (localStorage)
// ============================================================================

const DRAFT_PREFIX = "consultation_draft_";

/**
 * Sauvegarde un brouillon de réponses dans localStorage
 * @param {string} consultationSlug - Slug de la consultation
 * @param {Object} responses - Les réponses partielles
 */
export function saveDraft(consultationSlug, responses) {
  try {
    const key = DRAFT_PREFIX + consultationSlug;
    const draft = {
      responses,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch (err) {
    console.warn("Impossible de sauvegarder le brouillon:", err);
    return false;
  }
}

/**
 * Récupère un brouillon sauvegardé
 * @param {string} consultationSlug - Slug de la consultation
 * @returns {{responses: Object, savedAt: string}|null}
 */
export function loadDraft(consultationSlug) {
  try {
    const key = DRAFT_PREFIX + consultationSlug;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const draft = JSON.parse(stored);

    // Vérifier que le brouillon n'est pas trop vieux (7 jours)
    const savedAt = new Date(draft.savedAt);
    const now = new Date();
    const daysDiff = (now - savedAt) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      clearDraft(consultationSlug);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn("Erreur lecture brouillon:", err);
    return null;
  }
}

/**
 * Supprime un brouillon
 * @param {string} consultationSlug - Slug de la consultation
 */
export function clearDraft(consultationSlug) {
  try {
    const key = DRAFT_PREFIX + consultationSlug;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("Erreur suppression brouillon:", err);
  }
}

/**
 * Vérifie si un brouillon existe
 * @param {string} consultationSlug - Slug de la consultation
 * @returns {boolean}
 */
export function hasDraft(consultationSlug) {
  return loadDraft(consultationSlug) !== null;
}

/**
 * Formate la date de sauvegarde pour affichage
 * @param {string} isoDate - Date ISO
 * @returns {string} Date formatée
 */
export function formatDraftDate(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// CONSULTATIONS
// ============================================================================

/**
 * Récupère une consultation par son slug
 * @param {string} slug - Identifiant unique de la consultation
 * @returns {Promise<Object|null>} La consultation ou null
 */
export async function getConsultationBySlug(slug) {
  const { data, error } = await getSupabase()
    .from("consultations")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Erreur récupération consultation:", error);
    return null;
  }

  return data;
}

/**
 * Récupère toutes les consultations actives
 * @returns {Promise<Array>} Liste des consultations actives
 */
export async function getActiveConsultations() {
  const now = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from("consultations")
    .select("id, slug, title, description, response_count, starts_at, ends_at")
    .eq("status", "active")
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur récupération consultations actives:", error);
    return [];
  }

  return data || [];
}

/**
 * Vérifie si une consultation accepte encore des réponses
 * @param {Object} consultation - La consultation à vérifier
 * @returns {boolean}
 */
export function isConsultationOpen(consultation) {
  if (!consultation) return false;
  if (consultation.status !== "active") return false;

  const now = new Date();
  if (consultation.starts_at && new Date(consultation.starts_at) > now) return false;
  if (consultation.ends_at && new Date(consultation.ends_at) < now) return false;

  return true;
}

// ============================================================================
// RÉPONSES
// ============================================================================

/**
 * Soumet une réponse à une consultation
 * Gère la détection de doublons et l'incrémentation du compteur côté JS
 * Synchronise aussi vers la source appropriée (nationale ou instance source si importée)
 * @param {string} consultationId - ID de la consultation
 * @param {Object} responses - Les réponses au formulaire
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
 */
export async function submitConsultationResponse(consultationId, responses, options = {}) {
  const {
    userId = null,
    sessionId = generateSessionId(),
    isComplete = true,
    source = "web",
    syncToNational = true, // Par défaut, on synchronise vers la base nationale
  } = options;

  try {
    // Vérifier que la consultation existe et est ouverte
    // Inclure les champs de fédération pour déterminer où synchroniser
    const { data: consultation, error: consultationError } = await getSupabase()
      .from("consultations")
      .select(
        `
        id, slug, status, starts_at, ends_at, schema, response_count,
        scope, source_instance, source_consultation_id, sync_endpoint, sync_api_key,
        federation_config
      `
      )
      .eq("id", consultationId)
      .single();

    if (consultationError || !consultation) {
      return { success: false, error: "Consultation non trouvée" };
    }

    if (!isConsultationOpen(consultation)) {
      return { success: false, error: "Cette consultation est fermée" };
    }

    // Vérifier les doublons AVANT insertion (côté JS)
    const hasDuplicate = await hasAlreadyResponded(consultationId, { userId, sessionId });
    if (hasDuplicate) {
      return {
        success: false,
        error: "duplicate",
        message: "Vous avez déjà répondu à cette consultation",
      };
    }

    // Déterminer le statut de sync initial
    // - Consultations importées: pending (à synchroniser vers la source)
    // - Consultations locales: not_applicable (pas de sync)
    // - Consultations nationales hébergées ici: pending si on n'est pas le hub
    const isImported = !!(consultation.source_instance && consultation.source_consultation_id);
    const needsSync =
      isImported || (syncToNational && getNationalSupabase() && consultation.scope === "national");
    const initialSyncStatus = needsSync ? "pending" : "not_applicable";

    // Préparer les données locales
    const responseData = {
      consultation_id: consultationId,
      user_id: userId,
      session_id: userId ? null : sessionId, // session_id uniquement si anonyme
      responses,
      schema_version: consultation.schema?.version || 1,
      is_complete: isComplete,
      user_agent_category: getUserAgentCategory(),
      source,
      completed_at: isComplete ? new Date().toISOString() : null,
      sync_status: initialSyncStatus,
    };

    // Insérer la réponse localement
    const { data, error } = await getSupabase()
      .from("consultation_responses")
      .insert(responseData)
      .select()
      .single();

    if (error) {
      // Gérer le cas de doublon (contrainte UNIQUE violée)
      if (error.code === "23505") {
        return {
          success: false,
          error: "duplicate",
          message: "Vous avez déjà répondu à cette consultation",
        };
      }
      console.error("Erreur soumission réponse:", error);
      return { success: false, error: "Erreur lors de l'envoi" };
    }

    // Incrémenter le compteur de réponses (côté JS, pas de trigger)
    await incrementResponseCount(consultationId);

    // Synchroniser vers la source appropriée
    if (needsSync && isComplete) {
      if (isImported) {
        // Consultation importée: sync vers l'instance source
        await syncResponseToSource(consultation, data.id, responses, {
          sessionId,
          source,
        });
      } else if (syncToNational && getNationalSupabase() && consultation.slug) {
        // Consultation nationale hébergée: sync vers le hub national
        await syncResponseToNational(consultation.slug, responses, {
          localResponseId: data.id,
          sessionId,
          isComplete,
          source,
        });
      }
    }

    return { success: true, data };
  } catch (err) {
    console.error("Erreur inattendue:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

/**
 * Synchronise une réponse vers l'instance source (pour consultations importées)
 * Non-bloquant : si la synchro échoue, la réponse locale reste valide
 * @param {Object} consultation - La consultation locale (importée)
 * @param {string} localResponseId - ID de la réponse locale
 * @param {Object} responses - Les réponses
 * @param {Object} metadata - Métadonnées
 */
async function syncResponseToSource(consultation, localResponseId, responses, metadata = {}) {
  if (!consultation.source_instance || !consultation.source_consultation_id) {
    return;
  }

  try {
    // Créer le client pour l'instance source (utiliser client isolé pour éviter conflits d'auth)
    const _host = (() => {
      try {
        return new URL(consultation.source_instance).host.replace(/[:]/g, "-");
      } catch (e) {
        return "remote";
      }
    })();
    const sourceClient = createClient(consultation.source_instance, consultation.sync_api_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: `sb-remote-${_host}`,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });

    // Préparer les données pour la source
    const sourceData = {
      consultation_id: consultation.source_consultation_id,
      responses: {
        ...responses,
        _commune: getConfig("COMMUNITY_NAME", DEFAULT_COMMUNITY_NAME),
        _insee: getConfig("COMMUNE_INSEE", DEFAULT_COMMUNE_INSEE),
        _source_instance: typeof window !== "undefined" ? window.location.origin : "",
        _imported_response_id: localResponseId,
      },
      schema_version: consultation.schema?.version || 1,
      is_complete: true,
      user_agent_category: getUserAgentCategory(),
      source: `federated:${getConfig("COMMUNITY_NAME", DEFAULT_COMMUNITY_NAME)}`,
      session_id: metadata.sessionId
        ? `${getConfig("COMMUNE_INSEE", DEFAULT_COMMUNE_INSEE)}:${metadata.sessionId}`
        : null,
      completed_at: new Date().toISOString(),
    };

    // Envoyer vers la source
    const { data: sourceResponse, error: syncError } = await sourceClient
      .from("consultation_responses")
      .insert(sourceData)
      .select("id")
      .single();

    if (syncError) {
      console.warn("Erreur sync vers source:", syncError.message);
      // Marquer comme échoué
      await getSupabase()
        .from("consultation_responses")
        .update({
          sync_status: "failed",
          sync_attempts: 1,
          sync_error: syncError.message,
        })
        .eq("id", localResponseId);
    } else {
      // Marquer comme synchronisé
      await getSupabase()
        .from("consultation_responses")
        .update({
          sync_status: "synced",
          synced_at: new Date().toISOString(),
          source_response_id: sourceResponse.id,
        })
        .eq("id", localResponseId);

      // Incrémenter le compteur de sync sur la consultation
      await getSupabase()
        .from("consultations")
        .update({
          synced_response_count: (consultation.synced_response_count || 0) + 1,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", consultation.id);

      console.log(`✓ Réponse synchronisée vers ${consultation.source_instance}`);
    }
  } catch (err) {
    console.warn("Erreur sync source:", err);
    await getSupabase()
      .from("consultation_responses")
      .update({
        sync_status: "failed",
        sync_attempts: 1,
        sync_error: err.message,
      })
      .eq("id", localResponseId);
  }
}

/**
 * Synchronise une réponse vers la base nationale
 * Non-bloquant : si la synchro échoue, la réponse locale reste valide
 * @param {string} consultationSlug - Slug de la consultation
 * @param {Object} responses - Les réponses
 * @param {Object} metadata - Métadonnées
 */
async function syncResponseToNational(consultationSlug, responses, metadata = {}) {
  const nationalSupabaseClient = getNationalSupabase();
  if (!nationalSupabaseClient) return;

  try {
    // Trouver la consultation nationale par son slug
    const { data: nationalConsultation, error: findError } = await nationalSupabaseClient
      .from("consultations")
      .select("id, schema")
      .eq("slug", consultationSlug)
      .single();

    if (findError || !nationalConsultation) {
      console.warn(`Consultation nationale "${consultationSlug}" non trouvée`);
      return;
    }

    // Préparer les données pour la base nationale
    // On ajoute les infos de provenance (commune)
    const nationalResponseData = {
      consultation_id: nationalConsultation.id,
      responses: {
        ...responses,
        _commune: getConfig("COMMUNITY_NAME", DEFAULT_COMMUNITY_NAME),
        _insee: getConfig("COMMUNE_INSEE", DEFAULT_COMMUNE_INSEE),
        _source_instance: window.location.origin,
      },
      schema_version: nationalConsultation.schema?.version || 1,
      is_complete: metadata.isComplete ?? true,
      user_agent_category: getUserAgentCategory(),
      source: `federated:${getConfig("COMMUNITY_NAME", DEFAULT_COMMUNITY_NAME)}`,
      session_id: metadata.sessionId
        ? `${getConfig("COMMUNE_INSEE", DEFAULT_COMMUNE_INSEE)}:${metadata.sessionId}`
        : null,
      completed_at: new Date().toISOString(),
    };

    // Insérer dans la base nationale
    const { error: insertError } = await nationalSupabaseClient
      .from("consultation_responses")
      .insert(nationalResponseData);

    if (insertError) {
      // Log mais ne pas bloquer - la synchro peut être retentée
      console.warn("Erreur synchro nationale:", insertError.message);
    } else {
      console.log(`✓ Réponse synchronisée vers la base nationale (${consultationSlug})`);
    }
  } catch (err) {
    console.warn("Erreur synchro nationale:", err);
    // Non-bloquant
  }
}

/**
 * Incrémente le compteur de réponses d'une consultation
 * @param {string} consultationId - ID de la consultation
 */
async function incrementResponseCount(consultationId) {
  try {
    // Récupérer le count actuel et incrémenter
    const { data: consultation } = await getSupabase()
      .from("consultations")
      .select("response_count")
      .eq("id", consultationId)
      .single();

    if (consultation) {
      await getSupabase()
        .from("consultations")
        .update({
          response_count: (consultation.response_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", consultationId);
    }
  } catch (err) {
    console.error("Erreur incrémentation compteur:", err);
    // Non-bloquant, la réponse a déjà été enregistrée
  }
}

/**
 * Vérifie si l'utilisateur/session a déjà répondu
 * @param {string} consultationId - ID de la consultation
 * @param {Object} options - userId ou sessionId
 * @returns {Promise<boolean>}
 */
export async function hasAlreadyResponded(consultationId, options = {}) {
  const { userId, sessionId } = options;

  if (!userId && !sessionId) return false;

  let query = getSupabase()
    .from("consultation_responses")
    .select("id")
    .eq("consultation_id", consultationId);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.error("Erreur vérification doublon:", error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Récupère les réponses d'un utilisateur à une consultation
 * @param {string} consultationId - ID de la consultation
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>}
 */
export async function getUserResponse(consultationId, userId) {
  if (!userId) return null;

  const { data, error } = await getSupabase()
    .from("consultation_responses")
    .select("*")
    .eq("consultation_id", consultationId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      // Pas une erreur "no rows"
      console.error("Erreur récupération réponse:", error);
    }
    return null;
  }

  return data;
}

// ============================================================================
// STATISTIQUES (toute la logique côté JavaScript)
// ============================================================================

/**
 * Récupère les statistiques complètes d'une consultation
 * Remplace la fonction SQL get_consultation_stats
 * @param {string} consultationId - ID de la consultation
 * @returns {Promise<Object>}
 */
export async function getConsultationStats(consultationId) {
  try {
    // Récupérer toutes les réponses
    const { data: responses, error } = await getSupabase()
      .from("consultation_responses")
      .select("responses, is_complete, user_id, source, user_agent_category")
      .eq("consultation_id", consultationId);

    if (error) {
      console.error("Erreur récupération stats:", error);
      return null;
    }

    if (!responses || responses.length === 0) {
      return {
        totalResponses: 0,
        completeResponses: 0,
        anonymousResponses: 0,
        completionRate: 0,
        bySource: {},
        byDevice: {},
        byField: {},
      };
    }

    // Calculer les stats de base
    const stats = {
      totalResponses: responses.length,
      completeResponses: responses.filter((r) => r.is_complete).length,
      anonymousResponses: responses.filter((r) => !r.user_id).length,
      completionRate: Math.round(
        (100 * responses.filter((r) => r.is_complete).length) / responses.length
      ),
      bySource: {},
      byDevice: {},
      byField: {},
    };

    // Agrégation par source
    responses.forEach((r) => {
      const source = r.source || "unknown";
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;
    });

    // Agrégation par device
    responses.forEach((r) => {
      const device = r.user_agent_category || "unknown";
      stats.byDevice[device] = (stats.byDevice[device] || 0) + 1;
    });

    // Agrégation par champ de réponse
    responses.forEach(({ responses: r }) => {
      if (!r) return;
      Object.entries(r).forEach(([key, value]) => {
        if (!stats.byField[key]) {
          stats.byField[key] = { values: {}, _isNumeric: false };
        }

        if (Array.isArray(value)) {
          // Choix multiples
          value.forEach((v) => {
            stats.byField[key].values[v] = (stats.byField[key].values[v] || 0) + 1;
          });
        } else if (typeof value === "number") {
          // Échelle numérique
          stats.byField[key]._isNumeric = true;
          if (!stats.byField[key]._sum) {
            stats.byField[key]._sum = 0;
            stats.byField[key]._count = 0;
            stats.byField[key]._min = value;
            stats.byField[key]._max = value;
          }
          stats.byField[key]._sum += value;
          stats.byField[key]._count += 1;
          stats.byField[key]._min = Math.min(stats.byField[key]._min, value);
          stats.byField[key]._max = Math.max(stats.byField[key]._max, value);
          stats.byField[key]._average = stats.byField[key]._sum / stats.byField[key]._count;
          // Aussi compter les valeurs individuelles pour histogramme
          stats.byField[key].values[value] = (stats.byField[key].values[value] || 0) + 1;
        } else if (value !== null && value !== undefined && value !== "") {
          // Choix simple
          stats.byField[key].values[value] = (stats.byField[key].values[value] || 0) + 1;
        }
      });
    });

    return stats;
  } catch (err) {
    console.error("Erreur calcul stats:", err);
    return null;
  }
}

/**
 * Calcule les statistiques agrégées des réponses
 * Alias de getConsultationStats pour compatibilité
 * @param {string} consultationId - ID de la consultation
 * @returns {Promise<Object>}
 */
export async function calculateResponseStats(consultationId) {
  return getConsultationStats(consultationId);
}

/**
 * Formate les statistiques pour l'affichage avec Recharts
 * @param {Object} stats - Statistiques de getConsultationStats
 * @param {string} field - Nom du champ
 * @returns {Array|Object} Données formatées pour Recharts
 */
export function formatStatsForChart(stats, field) {
  if (!stats?.byField?.[field]) return [];

  const fieldStats = stats.byField[field];

  // Si c'est un champ numérique (scale), retourner les stats numériques
  if (fieldStats._isNumeric) {
    return {
      average: Math.round(fieldStats._average * 10) / 10,
      count: fieldStats._count,
      min: fieldStats._min,
      max: fieldStats._max,
      // Aussi inclure la distribution pour histogramme
      distribution: Object.entries(fieldStats.values)
        .map(([name, value]) => ({ name: parseInt(name), value }))
        .sort((a, b) => a.name - b.name),
    };
  }

  // Sinon, formater pour un graphique pie/bar
  return Object.entries(fieldStats.values)
    .filter(([key]) => !key.startsWith("_"))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Récupère les réponses brutes d'une consultation (pour admin)
 * @param {string} consultationId - ID de la consultation
 * @param {Object} options - Options de pagination
 * @returns {Promise<Array>}
 */
export async function getConsultationResponses(consultationId, options = {}) {
  const { limit = 100, offset = 0, completeOnly = false } = options;

  let query = getSupabase()
    .from("consultation_responses")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (completeOnly) {
    query = query.eq("is_complete", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erreur récupération réponses:", error);
    return [];
  }

  return data || [];
}

// ============================================================================
// STATISTIQUES NATIONALES (fédération)
// ============================================================================

/**
 * Récupère les statistiques nationales d'une consultation
 * Agrège les réponses de toutes les communes
 * @param {string} consultationSlug - Slug de la consultation
 * @returns {Promise<Object|null>}
 */
export async function getNationalStats(consultationSlug) {
  // Si on est le hub national, on utilise notre propre base
  const client = nationalSupabase || getSupabase();

  if (!client) {
    console.warn("Pas de client Supabase disponible pour les stats nationales");
    return null;
  }

  try {
    // Trouver la consultation
    const { data: consultation, error: findError } = await client
      .from("consultations")
      .select("id")
      .eq("slug", consultationSlug)
      .single();

    if (findError || !consultation) {
      return null;
    }

    // Récupérer toutes les réponses
    const { data: responses, error } = await client
      .from("consultation_responses")
      .select("responses, is_complete, source")
      .eq("consultation_id", consultation.id)
      .eq("is_complete", true);

    if (error || !responses) {
      console.error("Erreur récupération stats nationales:", error);
      return null;
    }

    // Agrégation par commune
    const byCommune = {};
    const globalStats = {
      totalResponses: responses.length,
      byField: {},
    };

    responses.forEach(({ responses: r, source }) => {
      if (!r) return;

      // Identifier la commune
      const commune =
        r._commune ||
        (source?.startsWith("federated:")
          ? source.replace("federated:", "")
          : DEFAULT_COMMUNITY_NAME);

      if (!byCommune[commune]) {
        byCommune[commune] = { count: 0, byField: {} };
      }
      byCommune[commune].count++;

      // Agréger les champs
      Object.entries(r).forEach(([key, value]) => {
        // Ignorer les métadonnées
        if (key.startsWith("_")) return;

        // Stats globales
        if (!globalStats.byField[key]) {
          globalStats.byField[key] = { values: {}, _isNumeric: false };
        }

        // Stats par commune
        if (!byCommune[commune].byField[key]) {
          byCommune[commune].byField[key] = { values: {}, _isNumeric: false };
        }

        const aggregateValue = (target, val) => {
          if (Array.isArray(val)) {
            val.forEach((v) => {
              target.values[v] = (target.values[v] || 0) + 1;
            });
          } else if (typeof val === "number") {
            target._isNumeric = true;
            if (!target._sum) {
              target._sum = 0;
              target._count = 0;
            }
            target._sum += val;
            target._count += 1;
            target._average = target._sum / target._count;
            target.values[val] = (target.values[val] || 0) + 1;
          } else if (val !== null && val !== undefined && val !== "") {
            target.values[val] = (target.values[val] || 0) + 1;
          }
        };

        aggregateValue(globalStats.byField[key], value);
        aggregateValue(byCommune[commune].byField[key], value);
      });
    });

    return {
      global: globalStats,
      byCommune,
      communeCount: Object.keys(byCommune).length,
    };
  } catch (err) {
    console.error("Erreur stats nationales:", err);
    return null;
  }
}

/**
 * Compare les stats d'une commune avec la moyenne nationale
 * @param {string} consultationSlug - Slug de la consultation
 * @param {string} field - Champ à comparer
 * @returns {Promise<Object|null>}
 */
export async function compareWithNational(consultationSlug, field) {
  const nationalStats = await getNationalStats(consultationSlug);
  if (!nationalStats) return null;

  const localCommune = DEFAULT_COMMUNITY_NAME;
  const localStats = nationalStats.byCommune[localCommune];
  const globalStats = nationalStats.global;

  if (!localStats || !globalStats.byField[field]) {
    return null;
  }

  const localField = localStats.byField[field];
  const globalField = globalStats.byField[field];

  if (localField?._isNumeric && globalField?._isNumeric) {
    return {
      local: {
        average: Math.round(localField._average * 10) / 10,
        count: localField._count,
      },
      national: {
        average: Math.round(globalField._average * 10) / 10,
        count: globalField._count,
      },
      difference: Math.round((localField._average - globalField._average) * 10) / 10,
      communeCount: nationalStats.communeCount,
    };
  }

  return {
    local: localField?.values || {},
    national: globalField?.values || {},
    communeCount: nationalStats.communeCount,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Consultations
  getConsultationBySlug,
  getActiveConsultations,
  isConsultationOpen,

  // Réponses
  submitConsultationResponse,
  hasAlreadyResponded,
  getUserResponse,
  getConsultationResponses,

  // Validation
  validateResponses,

  // Brouillons
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  formatDraftDate,

  // Statistiques locales
  getConsultationStats,
  calculateResponseStats,
  formatStatsForChart,

  // Statistiques nationales
  getNationalStats,
  compareWithNational,

  // Partage
  getShareUrl,
  getShareText,
  getShareLinks,
  copyShareLink,
  nativeShare,
  getShareImageUrl,
  trackShare,

  // Utilitaires
  generateSessionId,
  getUserAgentCategory,
};

// ============================================================================
// PARTAGE DE CONSULTATIONS
// ============================================================================

/**
 * Génère l'URL de partage d'une consultation
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (scope, includeResults, utmParams)
 * @returns {string}
 */
export function getShareUrl(consultation, options = {}) {
  const { includeResults = false, utmSource = null, utmMedium = null } = options;

  const baseUrl = window.location.origin;
  let url = `${baseUrl}/consultation/${consultation.slug}`;

  const params = new URLSearchParams();
  if (includeResults) {
    params.set("view", "results");
  }
  if (utmSource) {
    params.set("utm_source", utmSource);
    params.set("utm_medium", utmMedium || "social");
    params.set("utm_campaign", `consultation_${consultation.slug}`);
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Génère le texte de partage pour une consultation
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (scope, stats, language)
 * @returns {Object} {title, text, hashtags}
 */
export function getShareText(consultation, options = {}) {
  const { scope = "local", stats = null, language = "fr" } = options;

  const scopeEmoji =
    {
      local: "🏘️",
      regional: "🗺️",
      national: "🇫🇷",
    }[scope] || "📊";

  const scopeLabel =
    {
      local: DEFAULT_COMMUNITY_NAME,
      regional: DEFAULT_REGION_NAME,
      national: "France",
    }[scope] || DEFAULT_COMMUNITY_NAME;

  let title = `${scopeEmoji} ${consultation.title}`;
  let text = consultation.description || "";

  if (stats?.totalResponses) {
    if (scope === "national" && stats.communeCount) {
      text += ` • ${stats.totalResponses} réponses de ${stats.communeCount} commune${stats.communeCount > 1 ? "s" : ""}`;
    } else {
      text += ` • ${stats.totalResponses} réponse${stats.totalResponses > 1 ? "s" : ""} à ${scopeLabel}`;
    }
  }

  text += " • Donnez votre avis !";

  const hashtags = [
    DEFAULT_HASHTAG.replace("#", ""),
    `democratie${scope === "local" ? "locale" : scope === "regional" ? "regionale" : "participative"}`,
    consultation.slug.replace(/-/g, ""),
  ];

  return { title, text, hashtags };
}

/**
 * Génère les liens de partage pour différentes plateformes
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (scope, stats)
 * @returns {Object} {twitter, facebook, linkedin, whatsapp, email, copy}
 */
export function getShareLinks(consultation, options = {}) {
  const url = getShareUrl(consultation, { utmSource: "share" });
  const { title, text, hashtags } = getShareText(consultation, options);
  const fullText = `${title}\n\n${text}`;
  const hashtagsStr = hashtags.map((h) => `#${h}`).join(" ");

  return {
    twitter: {
      name: "Twitter/X",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags.join(","))}`,
      color: "#000000",
    },
    facebook: {
      name: "Facebook",
      icon: "f",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(fullText)}`,
      color: "#1877f2",
    },
    linkedin: {
      name: "LinkedIn",
      icon: "in",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: "#0a66c2",
    },
    whatsapp: {
      name: "WhatsApp",
      icon: "📱",
      url: `https://wa.me/?text=${encodeURIComponent(`${fullText}\n\n${url}`)}`,
      color: "#25d366",
    },
    telegram: {
      name: "Telegram",
      icon: "✈️",
      url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fullText)}`,
      color: "#0088cc",
    },
    email: {
      name: "Email",
      icon: "✉️",
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${fullText}\n\n${url}\n\n${hashtagsStr}`)}`,
      color: "#ea4335",
    },
    copy: {
      name: "Copier le lien",
      icon: "📋",
      url: url,
      color: "#666666",
      action: "copy",
    },
  };
}

/**
 * Copie le lien de partage dans le presse-papiers
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options
 * @returns {Promise<boolean>}
 */
export async function copyShareLink(consultation, options = {}) {
  try {
    const url = getShareUrl(consultation, options);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error("Erreur copie lien:", err);
    // Fallback pour navigateurs anciens
    try {
      const textArea = document.createElement("textarea");
      textArea.value = getShareUrl(consultation, options);
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Utilise l'API Web Share si disponible
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options
 * @returns {Promise<boolean>}
 */
export async function nativeShare(consultation, options = {}) {
  if (!navigator.share) {
    return false;
  }

  try {
    const url = getShareUrl(consultation, { utmSource: "native_share" });
    const { title, text } = getShareText(consultation, options);

    await navigator.share({
      title,
      text,
      url,
    });
    return true;
  } catch (err) {
    if (err.name === "AbortError") {
      // L'utilisateur a annulé le partage
      return false;
    }
    console.error("Erreur partage natif:", err);
    return false;
  }
}

/**
 * Génère une image de partage (pour OpenGraph)
 * @param {Object} consultation - La consultation
 * @param {Object} stats - Statistiques optionnelles
 * @returns {string} URL de l'image
 */
export function getShareImageUrl(consultation, stats = null) {
  // Pour l'instant, retourne une URL d'image par défaut
  // Peut être étendu pour générer des images dynamiques via un service
  const baseUrl = window.location.origin;

  // Vérifier si une image spécifique existe pour la consultation
  if (consultation.share_image) {
    return consultation.share_image;
  }

  // Image par défaut
  return `${baseUrl}/images/og-consultation.png`;
}

/**
 * Suit un événement de partage (analytics)
 * @param {string} consultationSlug - Slug de la consultation
 * @param {string} platform - Plateforme de partage
 * @param {string} scope - Portée (local/regional/national)
 */
export function trackShare(consultationSlug, platform, scope = "local") {
  // Envoyer l'événement à l'analytics si configuré
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "share", {
      method: platform,
      content_type: "consultation",
      content_id: consultationSlug,
      custom_dimension_scope: scope,
    });
  }

  // Log pour debug
  console.log(`📤 Partage: ${consultationSlug} via ${platform} (${scope})`);
}
