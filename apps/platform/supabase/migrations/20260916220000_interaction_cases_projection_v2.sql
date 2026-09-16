-- Interaction Cases projection quality v2 (Inseme #77 follow-up).
-- Adds operational columns driven by observed Reality / query pressure.
-- Does not introduce actors/probes/artifacts ontology.

ALTER TABLE public.interaction_cases
  ADD COLUMN IF NOT EXISTS status_label text,
  ADD COLUMN IF NOT EXISTS channel_kind text,
  ADD COLUMN IF NOT EXISTS next_watch_count integer
    CHECK (next_watch_count IS NULL OR next_watch_count >= 0);

COMMENT ON COLUMN public.interaction_cases.status_label IS
  'Narrative status (usually French `statut` or current_status.label). Distinct from machine status.';
COMMENT ON COLUMN public.interaction_cases.channel_kind IS
  'Derived coarse channel filter (email/postal/meeting/…). Not a closed taxonomy.';
COMMENT ON COLUMN public.interaction_cases.next_watch_count IS
  'Count of Packet next_watch[] entries. Does not invent a scalar next_followup_at.';

CREATE INDEX IF NOT EXISTS idx_interaction_cases_channel_kind
  ON public.interaction_cases (channel_kind);
CREATE INDEX IF NOT EXISTS idx_interaction_cases_status_label
  ON public.interaction_cases (status_label);
CREATE INDEX IF NOT EXISTS idx_interaction_cases_next_watch_count
  ON public.interaction_cases (next_watch_count)
  WHERE next_watch_count IS NOT NULL AND next_watch_count > 0;

-- Operational desk view: current-state projection without requiring jsonb unpacking.
CREATE OR REPLACE VIEW public.interaction_cases_desk
WITH (security_invoker = true)
AS
SELECT
  packet_id,
  status,
  status_label,
  COALESCE(status, status_label) AS status_display,
  disclosure,
  subject,
  primary_channel,
  channel_kind,
  counterparty_label,
  created_at,
  last_updated_at,
  next_followup_at,
  next_watch_count,
  superseded_by,
  revision,
  projection_version,
  projected_at,
  source_ref,
  (
    superseded_by IS NULL
    AND COALESCE(status, '') NOT IN ('superseded', 'closed', 'archived')
    -- Narrative French outcomes that are clearly terminal for desk filtering.
    AND COALESCE(status_label, '') !~* '(réponse reçue\s*:\s*négative|refus[ée]s?|closed|archived|termin[ée])'
  ) AS is_open
FROM public.interaction_cases;

COMMENT ON VIEW public.interaction_cases_desk IS
  'Operational desk projection over interaction_cases (Inseme #77). security_invoker=true so RLS of base table applies.';

REVOKE ALL ON public.interaction_cases_desk FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.interaction_cases_desk TO service_role;

-- Extend optimistic update to v2 projected columns.
CREATE OR REPLACE FUNCTION public.interaction_case_update_projected(
  p_packet_id text,
  p_expected_revision bigint,
  p_patch jsonb,
  p_merged_packet jsonb,
  p_changed_by text DEFAULT NULL,
  p_act_ref text DEFAULT NULL,
  p_packet_hash text DEFAULT NULL,
  p_field_bindings jsonb DEFAULT NULL
)
RETURNS public.interaction_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.interaction_cases;
  updated_row public.interaction_cases;
  next_rev bigint;
BEGIN
  IF p_packet_id IS NULL OR p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'interaction_case_update_projected: packet_id and expected_revision required';
  END IF;
  IF p_merged_packet IS NULL OR jsonb_typeof(p_merged_packet) <> 'object' THEN
    RAISE EXCEPTION 'interaction_case_update_projected: merged_packet must be a JSON object';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'interaction_case_update_projected: patch must be a JSON object';
  END IF;

  SELECT * INTO current_row
    FROM public.interaction_cases
   WHERE packet_id = p_packet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'interaction_case_not_found: %', p_packet_id;
  END IF;

  IF current_row.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'interaction_case_revision_mismatch: expected %, actual %',
      p_expected_revision, current_row.revision
      USING ERRCODE = '40001';
  END IF;

  next_rev := current_row.revision + 1;

  UPDATE public.interaction_cases SET
    status = CASE WHEN p_patch ? 'status' THEN NULLIF(p_patch->>'status', '') ELSE status END,
    status_label = CASE WHEN p_patch ? 'status_label' THEN NULLIF(p_patch->>'status_label', '') ELSE status_label END,
    disclosure = CASE WHEN p_patch ? 'disclosure' THEN NULLIF(p_patch->>'disclosure', '') ELSE disclosure END,
    subject = CASE WHEN p_patch ? 'subject' THEN NULLIF(p_patch->>'subject', '') ELSE subject END,
    primary_channel = CASE WHEN p_patch ? 'primary_channel' THEN NULLIF(p_patch->>'primary_channel', '') ELSE primary_channel END,
    channel_kind = CASE WHEN p_patch ? 'channel_kind' THEN NULLIF(p_patch->>'channel_kind', '') ELSE channel_kind END,
    counterparty_label = CASE WHEN p_patch ? 'counterparty_label' THEN NULLIF(p_patch->>'counterparty_label', '') ELSE counterparty_label END,
    created_at = CASE WHEN p_patch ? 'created_at' THEN NULLIF(p_patch->>'created_at', '')::date ELSE created_at END,
    last_updated_at = CASE WHEN p_patch ? 'last_updated_at' THEN NULLIF(p_patch->>'last_updated_at', '')::date ELSE last_updated_at END,
    next_followup_at = CASE WHEN p_patch ? 'next_followup_at' THEN NULLIF(p_patch->>'next_followup_at', '')::date ELSE next_followup_at END,
    next_watch_count = CASE
      WHEN p_patch ? 'next_watch_count' THEN NULLIF(p_patch->>'next_watch_count', '')::integer
      WHEN p_merged_packet ? 'next_watch' AND jsonb_typeof(p_merged_packet->'next_watch') = 'array'
        THEN jsonb_array_length(p_merged_packet->'next_watch')
      ELSE next_watch_count
    END,
    superseded_by = CASE WHEN p_patch ? 'superseded_by' THEN NULLIF(p_patch->>'superseded_by', '') ELSE superseded_by END,
    packet = p_merged_packet,
    packet_hash = COALESCE(p_packet_hash, packet_hash),
    field_bindings = COALESCE(p_field_bindings, field_bindings),
    projection_version = COALESCE(NULLIF(p_patch->>'projection_version', ''), projection_version),
    revision = next_rev,
    projected_at = now()
  WHERE packet_id = p_packet_id
    AND revision = p_expected_revision
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'interaction_case_revision_mismatch: concurrent update on %', p_packet_id
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.interaction_case_revisions (
    case_id, revision, previous_revision, changed_at, changed_by,
    patch, packet_hash, source_ref, act_ref
  ) VALUES (
    updated_row.packet_id,
    updated_row.revision,
    current_row.revision,
    updated_row.projected_at,
    p_changed_by,
    p_patch,
    updated_row.packet_hash,
    updated_row.source_ref,
    p_act_ref
  );

  RETURN updated_row;
END;
$$;
