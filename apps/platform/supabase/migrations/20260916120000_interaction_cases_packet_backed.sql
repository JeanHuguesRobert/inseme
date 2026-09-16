-- Packet-Backed Projection of JHN Interaction Cases (Inseme #77).
--
-- Architectural invariant:
--   The database is a projection of the Interaction Packet, not a replacement ontology.
--   A writer that understands only today's projected columns must not destroy fields
--   it does not understand.
--
-- Pattern: cogentia/patterns/packet-backed-projection (defensive publication 211194d…)
-- Scope: Agent JHN operational projection only. Do not apply to Pertitellu/Survey.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. Current-state projection + retained Packet
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interaction_cases (
  packet_id text PRIMARY KEY,
  status text,
  disclosure text
    CHECK (
      disclosure IS NULL
      OR disclosure IN ('D0', 'D1', 'D2', 'D3', 'D4')
    ),
  subject text,
  primary_channel text,
  counterparty_label text,
  created_at date,
  last_updated_at date,
  next_followup_at date,
  superseded_by text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  projection_version text NOT NULL DEFAULT 'interaction_case.v1',
  packet jsonb NOT NULL,
  packet_schema_version text,
  packet_hash text,
  source_ref jsonb,
  source_revision text,
  projected_at timestamptz NOT NULL DEFAULT now(),
  field_bindings jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(packet) = 'object'),
  CHECK (packet->>'id' IS NULL OR packet->>'id' = packet_id)
);

CREATE INDEX IF NOT EXISTS idx_interaction_cases_status
  ON public.interaction_cases (status);
CREATE INDEX IF NOT EXISTS idx_interaction_cases_disclosure
  ON public.interaction_cases (disclosure);
CREATE INDEX IF NOT EXISTS idx_interaction_cases_next_followup
  ON public.interaction_cases (next_followup_at)
  WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interaction_cases_counterparty
  ON public.interaction_cases (counterparty_label);
CREATE INDEX IF NOT EXISTS idx_interaction_cases_projected_at
  ON public.interaction_cases (projected_at DESC);

COMMENT ON TABLE public.interaction_cases IS
  'Packet-backed Interaction Case projection (Inseme #77). Columns are a small current-state view; packet jsonb retains the richer Interaction Packet.';
COMMENT ON COLUMN public.interaction_cases.packet IS
  'Complete Interaction Packet snapshot. Unknown/unprojected fields live here.';
COMMENT ON COLUMN public.interaction_cases.revision IS
  'Optimistic concurrency token. Stale writers must fail rather than last-write-wins.';
COMMENT ON COLUMN public.interaction_cases.disclosure IS
  'D0–D4 disclosure class. Presence of a row does NOT imply anonymous readability.';
COMMENT ON COLUMN public.interaction_cases.next_followup_at IS
  'Promoted only under query pressure. Existing packets use next_watch[]; this first slice does not auto-derive a scalar.';

--------------------------------------------------------------------------------
-- 2. Row-local revision history (shared physical table, local addressing)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interaction_case_revisions (
  case_id text NOT NULL REFERENCES public.interaction_cases(packet_id) ON DELETE CASCADE,
  revision bigint NOT NULL CHECK (revision > 0),
  previous_revision bigint,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  packet_hash text,
  source_ref jsonb,
  act_ref text,
  PRIMARY KEY (case_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_interaction_case_revisions_act
  ON public.interaction_case_revisions (act_ref)
  WHERE act_ref IS NOT NULL;

COMMENT ON TABLE public.interaction_case_revisions IS
  'Row-local history for interaction_cases. History of case A does not require replaying case B; optional act_ref correlates cross-case Acts.';

--------------------------------------------------------------------------------
-- 3. Optimistic projected-column update (service_role)
--
-- NULL semantics: SQL NULL in p_patch for a projected key means "leave Packet
-- property alone" at the application merge layer. This function only replaces
-- columns explicitly present in p_patch; it does not delete Packet keys.
-- Explicit Packet property deletion must be performed by application merge
-- (PACKET_DELETE) before calling this function with the already-merged packet.
--------------------------------------------------------------------------------

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
    disclosure = CASE WHEN p_patch ? 'disclosure' THEN NULLIF(p_patch->>'disclosure', '') ELSE disclosure END,
    subject = CASE WHEN p_patch ? 'subject' THEN NULLIF(p_patch->>'subject', '') ELSE subject END,
    primary_channel = CASE WHEN p_patch ? 'primary_channel' THEN NULLIF(p_patch->>'primary_channel', '') ELSE primary_channel END,
    counterparty_label = CASE WHEN p_patch ? 'counterparty_label' THEN NULLIF(p_patch->>'counterparty_label', '') ELSE counterparty_label END,
    created_at = CASE WHEN p_patch ? 'created_at' THEN NULLIF(p_patch->>'created_at', '')::date ELSE created_at END,
    last_updated_at = CASE WHEN p_patch ? 'last_updated_at' THEN NULLIF(p_patch->>'last_updated_at', '')::date ELSE last_updated_at END,
    next_followup_at = CASE WHEN p_patch ? 'next_followup_at' THEN NULLIF(p_patch->>'next_followup_at', '')::date ELSE next_followup_at END,
    superseded_by = CASE WHEN p_patch ? 'superseded_by' THEN NULLIF(p_patch->>'superseded_by', '') ELSE superseded_by END,
    packet = p_merged_packet,
    packet_hash = COALESCE(p_packet_hash, packet_hash),
    field_bindings = COALESCE(p_field_bindings, field_bindings),
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

REVOKE ALL ON FUNCTION public.interaction_case_update_projected(
  text, bigint, jsonb, jsonb, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.interaction_case_update_projected(
  text, bigint, jsonb, jsonb, text, text, text, jsonb
) TO service_role;

--------------------------------------------------------------------------------
-- 4. RLS / privacy — row existence ≠ public readability
--------------------------------------------------------------------------------

ALTER TABLE public.interaction_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_case_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.interaction_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interaction_case_revisions FROM PUBLIC, anon, authenticated;

CREATE POLICY service_role_all_interaction_cases
  ON public.interaction_cases
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_interaction_case_revisions
  ON public.interaction_case_revisions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON POLICY service_role_all_interaction_cases ON public.interaction_cases IS
  'Service role only. D0–D4 disclosure is semantic; anonymous/authenticated PostgREST gets no direct table access.';
