-- Watch the Watchers private access-path trace store (Inseme #120).
--
-- Purpose:
-- - opaque public tokens are NEVER stored in clear;
-- - token_ref is sha256:<hex> derived by the application;
-- - token -> recipient/context mapping is private and service-only;
-- - events are append-only through a SECURITY DEFINER ingress;
-- - retention is explicit through expires_at + service-only purge;
-- - no raw IP, User-Agent, referrer, fingerprint or analytics identifier is stored.
--
-- Security note:
-- SECURITY DEFINER is intentional here because the tables have RLS enabled and
-- no public policies. Every function below pins search_path, explicitly revokes
-- EXECUTE from PUBLIC/anon/authenticated, and grants EXECUTE only to service_role.

CREATE TABLE public.artifact_access_tokens (
  token_ref text PRIMARY KEY CHECK (token_ref ~ '^sha256:[0-9a-f]{64}$'),
  recipient_ref text NOT NULL,
  context_ref text,
  artifact_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  disabled_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX artifact_access_tokens_expiry
  ON public.artifact_access_tokens (expires_at)
  WHERE disabled_at IS NULL;

CREATE TABLE public.artifact_access_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_schema text NOT NULL DEFAULT 'artifact-access-event/v1'
    CHECK (event_schema = 'artifact-access-event/v1'),
  token_ref text NOT NULL
    REFERENCES public.artifact_access_tokens(token_ref)
    ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('LANDING', 'OPEN_PDF', 'REDIRECT')),
  event_at timestamptz NOT NULL,
  artifact_ref text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at >= event_at)
);

CREATE INDEX artifact_access_events_token_time
  ON public.artifact_access_events (token_ref, event_at, event_id);

CREATE INDEX artifact_access_events_expiry
  ON public.artifact_access_events (expires_at);

ALTER TABLE public.artifact_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artifact_access_tokens
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.artifact_access_events
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.artifact_access_token_register(
  p_token_ref text,
  p_recipient_ref text,
  p_context_ref text,
  p_artifact_ref text,
  p_expires_at timestamptz
)
RETURNS public.artifact_access_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted public.artifact_access_tokens;
BEGIN
  IF p_token_ref !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'artifact_access_token_ref_invalid';
  END IF;

  IF NULLIF(p_recipient_ref, '') IS NULL
     OR NULLIF(p_artifact_ref, '') IS NULL THEN
    RAISE EXCEPTION 'artifact_access_token_required_field_missing';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'artifact_access_token_expiry_invalid';
  END IF;

  INSERT INTO public.artifact_access_tokens (
    token_ref,
    recipient_ref,
    context_ref,
    artifact_ref,
    expires_at
  )
  VALUES (
    p_token_ref,
    p_recipient_ref,
    NULLIF(p_context_ref, ''),
    p_artifact_ref,
    p_expires_at
  )
  ON CONFLICT (token_ref) DO NOTHING
  RETURNING * INTO inserted;

  IF FOUND THEN
    RETURN inserted;
  END IF;

  SELECT *
    INTO inserted
    FROM public.artifact_access_tokens
   WHERE token_ref = p_token_ref
   LIMIT 1;

  IF inserted.recipient_ref <> p_recipient_ref
     OR COALESCE(inserted.context_ref, '') <> COALESCE(NULLIF(p_context_ref, ''), '')
     OR inserted.artifact_ref <> p_artifact_ref
     OR inserted.expires_at <> p_expires_at THEN
    RAISE EXCEPTION 'artifact_access_token_ref_conflict';
  END IF;

  RETURN inserted;
END;
$$;

CREATE FUNCTION public.artifact_access_token_lookup(
  p_token_ref text
)
RETURNS public.artifact_access_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  found_row public.artifact_access_tokens;
BEGIN
  IF p_token_ref !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'artifact_access_token_ref_invalid';
  END IF;

  SELECT *
    INTO found_row
    FROM public.artifact_access_tokens
   WHERE token_ref = p_token_ref
     AND disabled_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP
   LIMIT 1;

  RETURN found_row;
END;
$$;

CREATE FUNCTION public.artifact_access_event_append(
  p_event jsonb
)
RETURNS public.artifact_access_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_row public.artifact_access_tokens;
  inserted public.artifact_access_events;
  v_token_ref text;
  v_event text;
  v_event_at timestamptz;
  v_artifact_ref text;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RAISE EXCEPTION 'artifact_access_event_must_be_object';
  END IF;

  IF p_event->>'schema' <> 'artifact-access-event/v1' THEN
    RAISE EXCEPTION 'artifact_access_event_schema_invalid';
  END IF;

  v_token_ref := NULLIF(p_event->>'token_ref', '');
  v_event := NULLIF(p_event->>'event', '');
  v_event_at := NULLIF(p_event->>'timestamp', '')::timestamptz;
  v_artifact_ref := NULLIF(p_event->>'artifact_ref', '');

  IF v_token_ref !~ '^sha256:[0-9a-f]{64}$'
     OR v_event NOT IN ('LANDING', 'OPEN_PDF', 'REDIRECT')
     OR v_event_at IS NULL
     OR v_artifact_ref IS NULL THEN
    RAISE EXCEPTION 'artifact_access_event_invalid';
  END IF;

  SELECT *
    INTO token_row
    FROM public.artifact_access_tokens
   WHERE token_ref = v_token_ref
     AND disabled_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact_access_token_not_active';
  END IF;

  IF token_row.artifact_ref <> v_artifact_ref THEN
    RAISE EXCEPTION 'artifact_access_artifact_mismatch';
  END IF;

  INSERT INTO public.artifact_access_events (
    token_ref,
    event,
    event_at,
    artifact_ref,
    expires_at
  )
  VALUES (
    v_token_ref,
    v_event,
    v_event_at,
    v_artifact_ref,
    token_row.expires_at
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

CREATE FUNCTION public.artifact_access_purge_expired(
  p_before timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE(
  events_deleted bigint,
  tokens_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_events bigint;
  v_tokens bigint;
BEGIN
  DELETE FROM public.artifact_access_events
   WHERE expires_at <= p_before;

  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM public.artifact_access_tokens
   WHERE expires_at <= p_before
     AND NOT EXISTS (
       SELECT 1
         FROM public.artifact_access_events e
        WHERE e.token_ref = artifact_access_tokens.token_ref
     );

  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  RETURN QUERY SELECT v_events, v_tokens;
END;
$$;

REVOKE ALL ON FUNCTION public.artifact_access_token_register(
  text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.artifact_access_token_lookup(
  text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.artifact_access_event_append(
  jsonb
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.artifact_access_purge_expired(
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.artifact_access_token_register(
  text, text, text, text, timestamptz
) TO service_role;

GRANT EXECUTE ON FUNCTION public.artifact_access_token_lookup(
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.artifact_access_event_append(
  jsonb
) TO service_role;

GRANT EXECUTE ON FUNCTION public.artifact_access_purge_expired(
  timestamptz
) TO service_role;

COMMENT ON TABLE public.artifact_access_tokens IS
  'Restricted token-to-recipient/context mapping for Watch the Watchers. Public token bytes are not stored.';

COMMENT ON TABLE public.artifact_access_events IS
  'Restricted minimal access-path events. Semantics never claim proof of human reading.';

COMMENT ON FUNCTION public.artifact_access_purge_expired(timestamptz) IS
  'Service-only retention enforcement for expired mappings and raw events.';
