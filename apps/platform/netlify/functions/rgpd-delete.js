// netlify/functions/rgpd-delete.js
// ============================================================================
// Endpoint RGPD - Droit à l'effacement (Article 17 RGPD)
// POST /api/rgpd-delete - Supprime/anonymise toutes les données de l'utilisateur
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export async function handler(event, context) {
  // Vérification de la méthode
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  // Extraction du token d'authentification
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Authentification requise" }),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  // Vérification de la confirmation
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }

  if (body.confirmation !== "SUPPRIMER_MON_COMPTE") {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Confirmation requise",
        message: 'Envoyez { "confirmation": "SUPPRIMER_MON_COMPTE" } pour confirmer la suppression',
      }),
    };
  }

  try {
    // Charger la configuration
    await loadInstanceConfig();
    const supabaseUrl = getConfig("supabase_url");
    const supabaseServiceKey = getConfig("supabase_service_role_key");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token invalide ou expiré" }),
      };
    }

    const userId = user.id;
    const anonymizedName = `[Utilisateur supprimé]`;
    const deletionLog = {
      userId,
      deletedAt: new Date().toISOString(),
      actions: [],
    };

    // ============================================================================
    // STRATÉGIE D'EFFACEMENT selon le type de données
    // ============================================================================

    // 1. ANONYMISER les contributions publiques (conservation de l'historique civique)
    // Les posts, commentaires, propositions restent mais l'auteur est anonymisé

    // Anonymiser les posts (conserver le contenu, effacer le lien à l'utilisateur)
    const { error: postsError, count: postsCount } = await supabase
      .from("posts")
      .update({
        author_id: null,
        metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
      })
      .eq("author_id", userId);

    deletionLog.actions.push({ entity: "posts", count: postsCount || 0, action: "anonymized" });

    // Anonymiser les commentaires
    const { error: commentsError, count: commentsCount } = await supabase
      .from("comments")
      .update({
        user_id: null,
        metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
      })
      .eq("user_id", userId);

    deletionLog.actions.push({
      entity: "comments",
      count: commentsCount || 0,
      action: "anonymized",
    });

    // Anonymiser les propositions
    const { error: propositionsError, count: propositionsCount } = await supabase
      .from("propositions")
      .update({
        author_id: null,
        metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
      })
      .eq("author_id", userId);

    deletionLog.actions.push({
      entity: "propositions",
      count: propositionsCount || 0,
      action: "anonymized",
    });

    // 2. SUPPRIMER les données purement personnelles

    // Supprimer les votes (données de préférence personnelle)
    const { count: votesCount } = await supabase.from("votes").delete().eq("user_id", userId);

    deletionLog.actions.push({ entity: "votes", count: votesCount || 0, action: "deleted" });

    // Supprimer les réactions
    const { count: reactionsCount } = await supabase
      .from("reactions")
      .delete()
      .eq("user_id", userId);

    deletionLog.actions.push({
      entity: "reactions",
      count: reactionsCount || 0,
      action: "deleted",
    });

    // Supprimer les abonnements
    const { count: subscriptionsCount } = await supabase
      .from("content_subscriptions")
      .delete()
      .eq("user_id", userId);

    deletionLog.actions.push({
      entity: "subscriptions",
      count: subscriptionsCount || 0,
      action: "deleted",
    });

    // Supprimer les délégations données
    const { count: delegationsGivenCount } = await supabase
      .from("delegations")
      .delete()
      .eq("delegator_id", userId);

    deletionLog.actions.push({
      entity: "delegations_given",
      count: delegationsGivenCount || 0,
      action: "deleted",
    });

    // Supprimer les délégations reçues
    const { count: delegationsReceivedCount } = await supabase
      .from("delegations")
      .delete()
      .eq("delegate_id", userId);

    deletionLog.actions.push({
      entity: "delegations_received",
      count: delegationsReceivedCount || 0,
      action: "deleted",
    });

    // Supprimer l'historique chatbot
    const { count: chatCount } = await supabase
      .from("chat_interactions")
      .delete()
      .eq("user_id", userId);

    deletionLog.actions.push({
      entity: "chat_interactions",
      count: chatCount || 0,
      action: "deleted",
    });

    // Anonymiser les pages wiki (conserver le contenu)
    const { count: wikiCount } = await supabase
      .from("wiki_pages")
      .update({
        author_id: null,
        metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
      })
      .eq("author_id", userId);

    deletionLog.actions.push({ entity: "wiki_pages", count: wikiCount || 0, action: "anonymized" });

    // 3. ANONYMISER le profil utilisateur (conservation minimale pour intégrité référentielle)
    const { error: profileError } = await supabase
      .from("users")
      .update({
        display_name: anonymizedName,
        neighborhood: null,
        interests: null,
        metadata: {
          deleted: true,
          deletedAt: new Date().toISOString(),
          schemaVersion: 1,
        },
      })
      .eq("id", userId);

    deletionLog.actions.push({ entity: "user_profile", action: "anonymized" });

    // 4. Optionnel: Supprimer le compte auth.users (désactive la connexion)
    // Note: Cela supprime définitivement la capacité à se reconnecter
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      deletionLog.actions.push({
        entity: "auth_user",
        action: "deletion_failed",
        error: authDeleteError.message,
      });
    } else {
      deletionLog.actions.push({ entity: "auth_user", action: "deleted" });
    }

    // 5. Log de la suppression (pour audit légal - sans données personnelles)
    // Note: On ne stocke PAS l'email ou autres données sensibles dans le log
    await supabase.from("civic_audit_log").insert({
      user_id: null, // Anonymisé
      actor_type: "HUMAIN",
      action: "DELETE",
      entity_type: "USER",
      entity_id: userId,
      payload: {
        reason: "RGPD Right to Erasure - Article 17",
        summary: deletionLog.actions,
      },
      // IP non collectée pour cet événement
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Votre compte a été supprimé conformément à l'Article 17 du RGPD",
        summary: deletionLog,
        note: "Certaines contributions publiques ont été anonymisées plutôt que supprimées pour préserver l'intégrité des discussions civiques.",
      }),
    };
  } catch (error) {
    console.error("RGPD Delete error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur lors de la suppression du compte" }),
    };
  }
}
