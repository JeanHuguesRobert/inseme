-- Migration: record the represented instance on every durable COP event
-- Date: 2026-09-07
--
-- `public.cop_event_log` is owned by the JHN instance store.  This separate
-- foreign key records the instance for whose account an action was performed:
-- JHN itself today, or a hosted/provisional instance tomorrow.  It is an
-- indexed relational fact, rather than optional JSON in `meta`, because it
-- determines durable attribution and is a normal query/join dimension.

SET lock_timeout = '5s';

ALTER TABLE public.cop_event_log
  ADD COLUMN on_behalf_of_instance_id uuid NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
    REFERENCES public.instances(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cop_event_log_on_behalf_created_at
  ON public.cop_event_log (on_behalf_of_instance_id, created_at DESC);

COMMENT ON COLUMN public.cop_event_log.on_behalf_of_instance_id IS
  'Instance represented by the event actor. Defaults to the JHN root for legacy and direct JHN events.';

-- Replace the append helper rather than leave an obsolete overload: callers
-- may omit the new final argument (the JHN root is then recorded), while a
-- hosted-instance action supplies its explicit represented-instance UUID.
DROP FUNCTION IF EXISTS public.cop_event_append(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text, uuid
);

CREATE FUNCTION public.cop_event_append(
  p_topic_id text,
  p_event_type text DEFAULT 'cop.event/v1',
  p_actor_id text DEFAULT NULL,
  p_epistemic_status text DEFAULT 'observed',
  p_origin_ref text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL,
  p_payload_hash text DEFAULT NULL,
  p_artifact_ref text DEFAULT NULL,
  p_visibility text DEFAULT 'restricted',
  p_event_id uuid DEFAULT NULL,
  p_on_behalf_of_instance_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
)
RETURNS public.cop_event_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.cop_event_log;
  inserted public.cop_event_log;
  next_seq bigint;
  eid uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO existing
      FROM public.cop_event_log
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  next_seq := public.cop_event_next_topic_seq(p_topic_id);
  eid := COALESCE(p_event_id, gen_random_uuid());

  INSERT INTO public.cop_event_log (
    id,
    event_id,
    topic_id,
    topic_seq,
    event_type,
    actor_id,
    epistemic_status,
    origin_ref,
    payload,
    meta,
    idempotency_key,
    payload_hash,
    artifact_ref,
    visibility,
    on_behalf_of_instance_id
  ) VALUES (
    eid,
    eid,
    p_topic_id,
    next_seq,
    COALESCE(p_event_type, 'cop.event/v1'),
    p_actor_id,
    COALESCE(p_epistemic_status, 'observed'),
    p_origin_ref,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_meta, '{}'::jsonb),
    p_idempotency_key,
    p_payload_hash,
    p_artifact_ref,
    COALESCE(p_visibility, 'restricted'),
    p_on_behalf_of_instance_id
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.cop_event_append(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cop_event_append(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text, uuid, uuid
) TO service_role;

COMMENT ON FUNCTION public.cop_event_append(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text, uuid, uuid
) IS
  'Append-only COP event insert with explicit represented-instance attribution, atomic topic_seq and idempotency.';
