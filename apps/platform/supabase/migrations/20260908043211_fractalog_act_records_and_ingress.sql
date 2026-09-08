-- FractaLog canonical act documents + service-only ingress (Inseme #59).
--
-- `document` is the retained complete source. The other columns are checked
-- projections for isolation, ordering, idempotence and indexed retrieval.
-- This migration does not change legacy `cop_event_log`.

CREATE TABLE public.fractalog_records (
  record_id text PRIMARY KEY,
  document_schema text NOT NULL,
  document_hash text NOT NULL CHECK (document_hash ~ '^sha256:[0-9a-f]{64}$'),
  act_id text NOT NULL,
  act_kind text NOT NULL,
  act_phase text NOT NULL CHECK (act_phase IN ('attempt', 'committed', 'failed', 'refused', 'observed')),
  owner_instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE RESTRICT,
  on_behalf_of_instance_id uuid REFERENCES public.instances(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL,
  idempotency_key text,
  correlation_id text,
  visibility text NOT NULL CHECK (visibility IN ('open', 'redacted', 'restricted', 'sealed', 'opaque_but_escrowed')),
  document jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (document->>'schema' = document_schema),
  CHECK (document->>'record_id' = record_id),
  CHECK (document->'integrity'->>'document_hash' = document_hash),
  CHECK (document->>'act_id' = act_id),
  CHECK (document->>'act_kind' = act_kind),
  CHECK (document->>'act_phase' = act_phase),
  CHECK (document->>'owner_instance_id' = owner_instance_id::text),
  CHECK (
    (on_behalf_of_instance_id IS NULL AND NULLIF(document->>'on_behalf_of_instance_id', '') IS NULL)
    OR document->>'on_behalf_of_instance_id' = on_behalf_of_instance_id::text
  ),
  CHECK ((document->'time'->>'recorded_at')::timestamptz = recorded_at),
  CHECK (COALESCE(document->>'idempotency_key', '') = COALESCE(idempotency_key, '')),
  CHECK (COALESCE(document->>'correlation_id', '') = COALESCE(correlation_id, '')),
  CHECK (COALESCE(document->>'visibility', 'restricted') = visibility)
);

CREATE UNIQUE INDEX fractalog_records_idempotency_key
  ON public.fractalog_records (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX fractalog_records_owner_recorded
  ON public.fractalog_records (owner_instance_id, recorded_at DESC, record_id);
CREATE INDEX fractalog_records_on_behalf_recorded
  ON public.fractalog_records (on_behalf_of_instance_id, recorded_at DESC, record_id)
  WHERE on_behalf_of_instance_id IS NOT NULL;
CREATE INDEX fractalog_records_act
  ON public.fractalog_records (act_id, recorded_at ASC, record_id);

ALTER TABLE public.fractalog_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fractalog_records FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.fractalog_append(p_document jsonb)
RETURNS public.fractalog_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted public.fractalog_records;
  existing public.fractalog_records;
  v_record_id text;
  v_document_hash text;
  v_idempotency_key text;
  v_owner_instance_id uuid;
  v_on_behalf_of_instance_id uuid;
BEGIN
  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object' THEN
    RAISE EXCEPTION 'fractalog_document_must_be_object';
  END IF;
  IF p_document->>'schema' <> 'fractalog.act-record/v1' THEN
    RAISE EXCEPTION 'fractalog_document_schema_invalid';
  END IF;

  v_record_id := NULLIF(p_document->>'record_id', '');
  v_document_hash := NULLIF(p_document->'integrity'->>'document_hash', '');
  v_idempotency_key := NULLIF(p_document->>'idempotency_key', '');
  v_owner_instance_id := NULLIF(p_document->>'owner_instance_id', '')::uuid;
  v_on_behalf_of_instance_id := NULLIF(p_document->>'on_behalf_of_instance_id', '')::uuid;

  IF v_record_id IS NULL OR v_document_hash !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'fractalog_document_identity_or_hash_invalid';
  END IF;
  IF v_owner_instance_id IS NULL THEN
    RAISE EXCEPTION 'fractalog_owner_instance_id_required';
  END IF;
  IF NULLIF(p_document->>'act_id', '') IS NULL
     OR NULLIF(p_document->>'act_kind', '') IS NULL
     OR p_document->>'act_phase' NOT IN ('attempt', 'committed', 'failed', 'refused', 'observed')
     OR NULLIF(p_document->'time'->>'recorded_at', '') IS NULL THEN
    RAISE EXCEPTION 'fractalog_document_required_projection_missing';
  END IF;

  INSERT INTO public.fractalog_records (
    record_id, document_schema, document_hash, act_id, act_kind, act_phase,
    owner_instance_id, on_behalf_of_instance_id, recorded_at, idempotency_key,
    correlation_id, visibility, document
  ) VALUES (
    v_record_id,
    p_document->>'schema',
    v_document_hash,
    p_document->>'act_id',
    p_document->>'act_kind',
    p_document->>'act_phase',
    v_owner_instance_id,
    v_on_behalf_of_instance_id,
    (p_document->'time'->>'recorded_at')::timestamptz,
    v_idempotency_key,
    NULLIF(p_document->>'correlation_id', ''),
    COALESCE(NULLIF(p_document->>'visibility', ''), 'restricted'),
    p_document
  ) ON CONFLICT DO NOTHING
  RETURNING * INTO inserted;

  IF FOUND THEN RETURN inserted; END IF;

  SELECT * INTO existing
    FROM public.fractalog_records
   WHERE record_id = v_record_id
      OR (v_idempotency_key IS NOT NULL AND idempotency_key = v_idempotency_key)
   ORDER BY accepted_at ASC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fractalog_append_conflict_without_record';
  END IF;
  IF existing.document_hash <> v_document_hash THEN
    RAISE EXCEPTION 'fractalog_idempotency_conflict';
  END IF;
  RETURN existing;
END;
$$;

REVOKE ALL ON FUNCTION public.fractalog_append(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fractalog_append(jsonb) TO service_role;

COMMENT ON TABLE public.fractalog_records IS
  'Append-only FractaLog source documents. Relational columns are checked projections.';
COMMENT ON FUNCTION public.fractalog_append(jsonb) IS
  'Service-only atomic FractaLog ingress: document plus checked projections and idempotent receipt.';
