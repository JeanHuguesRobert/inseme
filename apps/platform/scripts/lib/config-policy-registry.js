/**
 * Declarative policy for configuration keys managed by the first Digital Twin.
 *
 * This is deliberately a policy registry, not a second configuration store:
 * instance_config remains the canonical remote store and .env files remain
 * local caches where a policy allows them. Values never appear here.
 */
export const CONFIG_POLICY_VERSION = "cogentia.config_policy.v1";

const SECRET_KEY_RE =
  /(?:api_key|admin_key|auth_token|client_secret|token|capability|webhook_secret|service_role_key|db_url|_sid)$/;
const EXPLICIT_SECRET_KEYS = new Set([
  "agent_jhn_whatsapp_allowed_self_jid",
  "agent_jhn_whatsapp_grant_id",
  "agent_jhn_whatsapp_mandate_id",
  "agent_jhn_whatsapp_preferred_self_peer",
  "agent_jhn_whatsapp_state_dir",
  // Existing Cloudflare DNS/R2 slots were promoted as server-only secrets on
  // 2026-10-30. Match that proven Vault classification without disclosing values.
  "cloudflare_account_id",
  "cloudflare_api_key",
  "cloudflare_s3_access_key_id",
  "cloudflare_s3_api_endpoint",
  "cloudflare_s3_secret_access_key",
  "cartesia_voice_id",
  "magistral_embedding_policy",
  // Existing JHN HMAC session signing key and database connection string.
  // Never reduce their Vault classification to public/internal on key-name heuristics.
  "oleole_session_secret",
  "postgres_url",
  "nasa_principal_subject",
  "supabase_anon_key",
  "supabase_url",
]);

const JHN_PUBLIC_KEYS = new Set([
  "app_url",
  "bot_name",
  "chatbot_fallback_message",
  "chatbot_max_sources",
  "chatbot_similarity_threshold",
  "chatbot_welcome_message",
  "city_name",
  "city_tagline",
  "commune_insee",
  "community_code",
  "community_kind",
  "community_name",
  "community_tagline",
  "community_type",
  "contact_email",
  "country",
  "favicon",
  "feature_chatbot",
  "feature_comments",
  "feature_consultations",
  "feature_moderation",
  "feature_ocr",
  "feature_petitions",
  "feature_rag",
  "feature_ritornu",
  "feature_social",
  "feature_transparency",
  "feature_wiki",
  "hashtag",
  "host_domain",
  "locale",
  "logo",
  "map_default_center",
  "map_default_lat",
  "map_default_lng",
  "map_default_zoom",
  "map_style",
  "movement_name",
  "party_name",
  "primary_color",
  "region_code",
  "region_name",
  "secondary_color",
  "subject_kind",
  "substack_subdomain",
  "supabase_storage_bucket",
  "timezone",
  "axiom_org_id",
  "cogentia_mcp_jhn_mutate",
  "cogentia_mcp_url",
  "cop_base_url",
  "cop_network_id",
  "cop_node_id",
  "db_ssl_mode",
  "debug",
  "deployment_kind",
  "facebook_app_id",
  "federation_peers",
  "github_client_id",
  "global_gazette_editor_group",
  "gradium_voice_id",
  "grok_agent",
  "magistral_embedding_dimensions",
  "magistral_embedding_model",
  "magistral_embedding_provider",
  "magistral_embedding_timeout_ms",
  "magistral_embeddings_enabled",
]);

const JHN_VAULT_ONLY_KEYS = new Set([
  "anthropic_auth_token",
  "anthropic_base_url",
  "app_url",
  "bot_name",
  "chatbot_fallback_message",
  "chatbot_max_sources",
  "chatbot_similarity_threshold",
  "cloudflare_account_id",
  "cloudflare_api_key",
  "cloudflare_s3_access_key_id",
  "cloudflare_s3_api_endpoint",
  "cloudflare_s3_secret_access_key",
  "chatbot_welcome_message",
  "city_name",
  "city_tagline",
  "commune_insee",
  "community_code",
  "community_kind",
  "community_name",
  "community_tagline",
  "community_type",
  "contact_email",
  "cop_base_url",
  "cop_network_id",
  "cop_node_id",
  "country",
  "deployment_kind",
  "favicon",
  "feature_chatbot",
  "feature_comments",
  "feature_consultations",
  "feature_moderation",
  "feature_ocr",
  "feature_petitions",
  "feature_rag",
  "feature_ritornu",
  "feature_social",
  "feature_transparency",
  "feature_wiki",
  "federation_peers",
  "gemini_api_key",
  "github_webhook_secret",
  "github_repo_allowlist",
  "cop_artifact_bucket",
  "global_gazette_editor_group",
  "google_filesearch_api_key",
  "grok_agent",
  "hashtag",
  "host_domain",
  "jhn_cop_capability",
  "locale",
  "logo",
  "map_default_center",
  "map_default_lat",
  "map_default_lng",
  "map_default_zoom",
  "map_style",
  "mistral_api_key",
  "movement_name",
  "nasa_principal_subject",
  "netlify_auth_token",
  "openai_embedding_model",
  "party_name",
  "primary_color",
  "region_code",
  "region_name",
  "ritornu_storage_bucket",
  "secondary_color",
  "subject_kind",
  "substack_sid",
  "substack_subdomain",
  "supabase_anon_key",
  "supabase_db_url",
  "supabase_project_ref",
  "supabase_service_role_key",
  "supabase_storage_bucket",
  "supabase_url",
  "support_email",
  "timezone",
]);

const HOST_BOOTSTRAP_KEYS = new Set([
  "supabase_url",
  "supabase_anon_key",
  "supabase_project_ref",
  "supabase_service_role_key",
  "supabase_db_url",
]);
const REQUIRED_JHN_VAULT_KEYS = new Set(["github_webhook_secret", "github_repo_allowlist"]);

function policyForKey(key) {
  const isSecret = SECRET_KEY_RE.test(key) || EXPLICIT_SECRET_KEYS.has(key);
  const servesPublicSurface = !isSecret && JHN_PUBLIC_KEYS.has(key);
  // The existing JHN Vault deliberately makes public-surface values readable
  // through the non-secret public policy. Secrets remain server-only.
  const isPublic = servesPublicSurface;
  const bootstrap = HOST_BOOTSTRAP_KEYS.has(key);
  return {
    key,
    classification: bootstrap
      ? "host_bootstrap_mirror"
      : isSecret
        ? "instance_secret"
        : servesPublicSurface
          ? "instance_public_surface"
          : "instance_internal",
    expected: { is_secret: isSecret, is_public: isPublic },
    vault: "canonical",
    local_cache: bootstrap ? "bootstrap_only" : "allowed",
    promotion: bootstrap ? "host_managed" : "manual",
    required: REQUIRED_JHN_VAULT_KEYS.has(key),
  };
}

/** Build the JHN registry from the one existing env-to-Vault mapping. */
export function createJhnConfigPolicyRegistry(envKeyMapping) {
  const entries = new Map();
  const env = new Map();
  for (const [key, envNames] of Object.entries(envKeyMapping || {})) {
    const entry = policyForKey(key);
    entries.set(key, entry);
    for (const envName of envNames) {
      env.set(envName, {
        ...entry,
        env_key: envName,
        env_presentation: envName.startsWith("VITE_") ? "browser_candidate" : "server_or_local",
      });
    }
  }
  for (const key of JHN_VAULT_ONLY_KEYS) entries.set(key, policyForKey(key));

  // No implementation references this key yet. It must not silently enter the
  // Vault just because it happens to be present in a developer cache.
  env.set("COGENTIA_BLACKBOARD_UPSERT_TOKEN", {
    key: "cogentia_blackboard_upsert_token",
    env_key: "COGENTIA_BLACKBOARD_UPSERT_TOKEN",
    classification: "local_review",
    expected: null,
    vault: "not_managed",
    local_cache: "local_only",
    promotion: "human_review_required",
    env_presentation: "server_or_local",
  });

  return { version: CONFIG_POLICY_VERSION, instance: "jhn", entries, env };
}
