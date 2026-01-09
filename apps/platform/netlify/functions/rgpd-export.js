// netlify/functions/rgpd-export.js
// ============================================================================
// Endpoint RGPD - Droit à la portabilité des données (Article 20 RGPD)
// GET /api/rgpd-export - Exporte toutes les données personnelles de l'utilisateur
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export async function handler(event, context) {
  // Vérification de la méthode
  if (event.httpMethod !== "GET") {
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

  try {
    // Charger la configuration
    await loadInstanceConfig();
    const supabaseUrl = getConfig("supabase_url");
    const supabaseServiceKey = getConfig("supabase_service_role_key");

    // Vérification de l'utilisateur via Supabase
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

    // Collecte de toutes les données de l'utilisateur
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
      rgpdInfo: {
        purpose: "Export de données personnelles - Article 20 RGPD",
        dataController: "Plateforme de participation civique",
        contactEmail: getConfig("contact_email", "jean_hugues_robert@yahoo.com"),
      },

      // 1. DONNÉES PUBLIQUES (visibles par tous)
      publicData: {},

      // 2. DONNÉES INTERNES (utilisées par la plateforme, non publiques)
      internalData: {},

      // 3. DONNÉES PRIVÉES (strictement personnelles)
      privateData: {},
    };

    // --- Profil utilisateur ---
    const { data: profile } = await supabase
      .from("users")
      .select(
        "id, display_name, neighborhood, interests, created_at, updated_at, rgpd_consent_accepted, rgpd_consent_date, metadata"
      )
      .eq("id", userId)
      .single();

    if (profile) {
      exportData.publicData.profile = {
        displayName: profile.display_name,
        neighborhood: profile.neighborhood,
        interests: profile.interests,
        memberSince: profile.created_at,
      };
      exportData.privateData.consentInfo = {
        rgpdConsentAccepted: profile.rgpd_consent_accepted,
        rgpdConsentDate: profile.rgpd_consent_date,
      };
    }

    // --- Posts (contributions) ---
    const { data: posts } = await supabase
      .from("posts")
      .select("id, content, created_at, updated_at")
      .eq("author_id", userId);

    exportData.publicData.posts = posts || [];

    // --- Commentaires ---
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content, post_id, created_at, updated_at")
      .eq("user_id", userId);

    exportData.publicData.comments = comments || [];

    // --- Propositions ---
    const { data: propositions } = await supabase
      .from("propositions")
      .select("id, title, description, status, created_at, updated_at")
      .eq("author_id", userId);

    exportData.publicData.propositions = propositions || [];

    // --- Votes (anonymisés pour l'export mais inclus pour l'utilisateur) ---
    const { data: votes } = await supabase
      .from("votes")
      .select("id, proposition_id, vote_value, created_at")
      .eq("user_id", userId);

    exportData.internalData.votes = votes || [];

    // --- Réactions ---
    const { data: reactions } = await supabase
      .from("reactions")
      .select("id, target_type, target_id, emoji, created_at")
      .eq("user_id", userId);

    exportData.publicData.reactions = reactions || [];

    // --- Pages Wiki créées ---
    const { data: wikiPages } = await supabase
      .from("wiki_pages")
      .select("id, slug, title, created_at, updated_at")
      .eq("author_id", userId);

    exportData.publicData.wikiPages = wikiPages || [];

    // --- Groupes/Missions créés ---
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, description, created_at")
      .eq("created_by", userId);

    exportData.publicData.groupsCreated = groups || [];

    // --- Abonnements ---
    const { data: subscriptions } = await supabase
      .from("content_subscriptions")
      .select("id, content_type, content_id, created_at")
      .eq("user_id", userId);

    exportData.internalData.subscriptions = subscriptions || [];

    // --- Délégations (pour le vote liquide) ---
    const { data: delegationsGiven } = await supabase
      .from("delegations")
      .select("id, delegate_id, tag_id, created_at")
      .eq("delegator_id", userId);

    const { data: delegationsReceived } = await supabase
      .from("delegations")
      .select("id, delegator_id, tag_id, created_at")
      .eq("delegate_id", userId);

    exportData.internalData.delegations = {
      given: delegationsGiven || [],
      received: delegationsReceived || [],
    };

    // --- Interactions chatbot (si applicable) ---
    const { data: chatInteractions } = await supabase
      .from("chat_interactions")
      .select("id, question, answer, created_at")
      .eq("user_id", userId);

    exportData.internalData.chatHistory = chatInteractions || [];

    // Note: Les adresses IP et user_agent ne sont PAS incluses dans l'export
    // conformément au principe de minimisation (ils sont pour l'audit uniquement)

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rgpd-export-${userId}-${new Date().toISOString().split("T")[0]}.json"`,
      },
      body: JSON.stringify(exportData, null, 2),
    };
  } catch (error) {
    console.error("RGPD Export error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur lors de l'export des données" }),
    };
  }
}
