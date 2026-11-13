-- ============================================================================
-- Seed: pertitellu-hosted-seed.sql
-- Description: Enregistrement de l'instance collective civique pertitellu-corte
--              hébergée dans la base Supabase d'Agent John (JHN root).
-- Invariant: Hérite des clés d'infrastructure (LLM, API, DB) via get_effective_instance_config
-- ============================================================================

DO $$
DECLARE
  v_jhn_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_pertitellu_id uuid := '00000000-0000-0000-0000-000000000010'::uuid;
BEGIN

  -- 1. Enregistrement de l'instance pertitellu-corte
  INSERT INTO public.instances (
    id, host_instance_id, canonical_slug, display_name, bot_name,
    subject_ref, twin_root_ref, status, deployment_kind, subject_kind, is_claimable, metadata
  )
  VALUES (
    v_pertitellu_id,
    v_jhn_id,
    'pertitellu-corte',
    'Le Petit Parti — Corte',
    'Ophélia',
    'collective:pertitellu-corte',
    'twin:pertitellu-corte',
    'autonomous',
    'civic',
    'collective',
    false,
    '{"role": "civic_hub", "city": "Corte", "region": "Corse", "canonical_url": "https://lepp.baronsmariani.org"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    host_instance_id = EXCLUDED.host_instance_id,
    canonical_slug = EXCLUDED.canonical_slug,
    display_name = EXCLUDED.display_name,
    bot_name = EXCLUDED.bot_name,
    deployment_kind = EXCLUDED.deployment_kind,
    updated_at = now();

  -- 2. Enregistrement des alias (First come, first served)
  INSERT INTO public.instance_aliases (alias, instance_id, is_primary, alias_kind, description, allocated_at)
  VALUES
    ('pertitellu-corte', v_pertitellu_id, true, 'canonical_slug', 'Primary slug for Pertitellu Corte', now()),
    ('lepp', v_pertitellu_id, false, 'short_name', 'Short name for Le Petit Parti', now()),
    ('lepp.baronsmariani.org', v_pertitellu_id, false, 'subdomain', 'Current web hostname for LePP / U Pertitellu', now()),
    ('pertitellu', v_pertitellu_id, false, 'short_name', 'General collective name', now()),
    ('corte', v_pertitellu_id, false, 'name_variant', 'City name variant', now())
  ON CONFLICT (alias) DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    is_primary = EXCLUDED.is_primary,
    alias_kind = EXCLUDED.alias_kind;

  -- 3. Configuration spécifique (instance_config)
  INSERT INTO public.instance_config (instance_id, key, value, category, description, is_public, is_secret)
  VALUES
    (v_pertitellu_id, 'community_name', 'Le Petit Parti — Corte', 'identity', 'Nom officiel de la communauté', true, false),
    (v_pertitellu_id, 'community_code', 'pertitellu-corte', 'identity', 'Code unique d''instance', true, false),
    (v_pertitellu_id, 'community_type', 'association', 'identity', 'Type de communauté', true, false),
    (v_pertitellu_id, 'city_name', 'Corte', 'identity', 'Ville de rattachement', true, false),
    (v_pertitellu_id, 'region_code', 'COR', 'identity', 'Code région', true, false),
    (v_pertitellu_id, 'region_name', 'Corse', 'identity', 'Nom de la région', true, false),
    (v_pertitellu_id, 'bot_name', 'Ophélia', 'branding', 'Nom de l''assistant / persona', true, false),
    (v_pertitellu_id, 'app_url', 'https://lepp.baronsmariani.org', 'identity', 'URL canonique de production', true, false),
    (v_pertitellu_id, 'host_domain', 'lepp.baronsmariani.org', 'identity', 'Domaine hôte', true, false),
    (v_pertitellu_id, 'deployment_kind', 'civic', 'identity', 'Type de déploiement', true, false),
    (v_pertitellu_id, 'application_profile', 'civic-platform', 'identity', 'Profil applicatif', true, false),
    (v_pertitellu_id, 'contact_email', 'contact@baronsmariani.org', 'identity', 'Email de contact', true, false),
    (v_pertitellu_id, 'map_default_center', '42.3084,9.1505', 'map', 'Centre par défaut de la carte', true, false)
  ON CONFLICT (instance_id, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();

END;
$$;
