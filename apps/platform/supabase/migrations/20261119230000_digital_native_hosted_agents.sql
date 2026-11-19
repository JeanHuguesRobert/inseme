-- Native digital agents have their own semantic roots and hosted instances.
-- No compatibility columns, aliases, or duplicated identity config keys.
-- Preserve immutable COP event payloads: twin_root_ref there denotes John's
-- existing composite membership, not the subject root of a hosted instance.
BEGIN;

ALTER TABLE public.instances RENAME COLUMN twin_root_ref TO subject_root_ref;

-- These values already live canonically in public.instances. Remove the
-- redundant per-instance config copies rather than maintaining two registries.
DELETE FROM public.instance_config
WHERE key IN ('twin_root_ref', 'represented_subject_ref');

ALTER TABLE public.instances DROP CONSTRAINT instances_status_check;
ALTER TABLE public.instances
  ADD CONSTRAINT instances_status_check
  CHECK (status IN ('provisional','claimed','autonomous','active','archived'));

ALTER TABLE public.instances
  ADD CONSTRAINT instances_digital_native_identity_check
  CHECK (subject_kind <> 'digital_native' OR
         (subject_ref = subject_root_ref AND subject_ref LIKE 'agent:%'
          AND is_claimable = false));

CREATE UNIQUE INDEX idx_instances_digital_native_subject
  ON public.instances (subject_ref) WHERE subject_kind = 'digital_native';

-- Explicit link: one COP LogicalAgent projects onto one hosted instance.
-- The COP table retains its existing composition-membership field; it is
-- not an alternative source of instance identity or authority.
ALTER TABLE public.cop_logical_agents
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_cop_logical_agents_instance_id
  ON public.cop_logical_agents (instance_id) WHERE instance_id IS NOT NULL;

-- Digital-native agents are not public person-profile representations.
DROP POLICY IF EXISTS "Anyone can read public instances" ON public.instances;
CREATE POLICY "Public can read non-native instances" ON public.instances
  FOR SELECT TO public USING (subject_kind <> 'digital_native');
CREATE POLICY "Principals can read their instances" ON public.instances
  FOR SELECT TO authenticated
  USING (principal_id = (SELECT auth.uid()));

INSERT INTO public.instances (
  id, host_instance_id, canonical_slug, display_name, bot_name,
  subject_ref, subject_root_ref, principal_id, status, deployment_kind,
  subject_kind, is_claimable, metadata
)
SELECT x.id, h.id, x.slug, x.name, x.name,
  x.agent_ref, x.agent_ref, h.principal_id, 'active',
  'organizational', 'digital_native', false,
  jsonb_build_object(
    'created_under', 'agent:jhn',
    'organization_ref', 'organization:minesteggio',
    'role', x.domain,
    'institutional_status', 'proposed-not-constituted'
  )
FROM public.instances h CROSS JOIN (
  VALUES
    ('00000000-0000-0000-0000-000000000101'::uuid,
     'vulcain-minesteggio','Vulcain','agent:minesteggio:vulcain',
     'information-technology'),
    ('00000000-0000-0000-0000-000000000102'::uuid,
     'mercure-minesteggio','Mercure','agent:minesteggio:mercure',
     'financial-analysis')
) AS x(id,slug,name,agent_ref,domain)
WHERE h.canonical_slug='jhn' AND h.principal_id IS NOT NULL
ON CONFLICT (canonical_slug) DO UPDATE SET
  subject_ref=EXCLUDED.subject_ref,
  subject_root_ref=EXCLUDED.subject_root_ref,
  principal_id=EXCLUDED.principal_id,
  host_instance_id=EXCLUDED.host_instance_id,
  display_name=EXCLUDED.display_name,
  bot_name=EXCLUDED.bot_name,
  subject_kind=EXCLUDED.subject_kind,
  deployment_kind=EXCLUDED.deployment_kind,
  status=EXCLUDED.status,
  is_claimable=EXCLUDED.is_claimable,
  metadata=EXCLUDED.metadata,
  updated_at=now();

INSERT INTO public.instance_aliases(alias,instance_id,is_primary,alias_kind,description)
SELECT canonical_slug,id,true,'canonical_slug','Digital-native Minesteggio member'
FROM public.instances WHERE canonical_slug IN ('vulcain-minesteggio','mercure-minesteggio')
ON CONFLICT (alias) DO NOTHING;

-- COP state already exists in John's immutable local journal. These records
-- are projections of it, not mandates and not separate Principals.
INSERT INTO public.cop_logical_agents
  (logical_agent_id,logical_agent_name,status,twin_root_ref,
   active_mandate_ref,instance_id,metadata,created_at,updated_at)
SELECT x.agent_ref, x.name, 'available','twin:jhn',NULL,i.id,
  jsonb_build_object(
    'profile_ref',x.profile_ref,
    'member_of',jsonb_build_array('organization:minesteggio'),
    'reports_to','agent:jhn',
    'spawned_by','agent:jhn',
    'memory_ref',x.memory_ref,
    'activation_policy','on_demand',
    'authority','supervised_no_independent_mandate',
    'source','john_cop_event_journal_2026_11_19'
  )::text,
  now()::text,now()::text
FROM (VALUES
  ('agent:minesteggio:vulcain','Vulcain',
   'profile:minesteggio:informatique','memory:minesteggio:vulcain'),
  ('agent:minesteggio:mercure','Mercure',
   'profile:minesteggio:finances','memory:minesteggio:mercure')
) AS x(agent_ref,name,profile_ref,memory_ref)
JOIN public.instances i ON i.subject_ref=x.agent_ref AND i.subject_kind='digital_native'
ON CONFLICT (logical_agent_id) DO UPDATE SET
  logical_agent_name=EXCLUDED.logical_agent_name,
  status=EXCLUDED.status,
  twin_root_ref=EXCLUDED.twin_root_ref,
  active_mandate_ref=EXCLUDED.active_mandate_ref,
  instance_id=EXCLUDED.instance_id,
  metadata=EXCLUDED.metadata,
  updated_at=now()::text;

-- Scoped overrides: agents inherit infrastructure but never personal names.
INSERT INTO public.instance_config
  (instance_id,key,value,category,description,is_public,is_secret)
SELECT i.id,x.key,x.value,'identity','Native agent scoped configuration',false,false
FROM public.instances i JOIN (
  VALUES
    ('vulcain-minesteggio','bot_name','Vulcain'),
    ('vulcain-minesteggio','community_name','Vulcain — Minesteggio'),
    ('vulcain-minesteggio','community_code','vulcain-minesteggio'),
    ('mercure-minesteggio','bot_name','Mercure'),
    ('mercure-minesteggio','community_name','Mercure — Minesteggio'),
    ('mercure-minesteggio','community_code','mercure-minesteggio')
) AS x(slug,key,value) ON i.canonical_slug=x.slug
ON CONFLICT (instance_id,key) DO UPDATE SET
  value=EXCLUDED.value,
  is_public=EXCLUDED.is_public,
  updated_at=now();

COMMIT;
