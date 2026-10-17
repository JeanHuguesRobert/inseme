-- Z0 budget grants v2: epoch provenance != authorization mandate.
-- Deliberately fails closed until an independently approved mandate is present
-- in cop_mandates. No implicit grants, no epoch rewrites.
CREATE OR REPLACE FUNCTION public.cop_grant_epoch_budget_v2(
 p_epoch_id text,p_budget_ref text,p_mandate_ref text,p_mandate_version integer,
 p_unit text,p_amount numeric,p_actor text,p_authority_ref text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
 existing public.cop_accounting_epoch_budget%ROWTYPE;
 m public.cop_mandates%ROWTYPE;
 epoch_ref text;
 required_action constant text := 'cop.accounting.budget.grant';
 event_key text;
BEGIN
 IF coalesce(p_epoch_id,'')='' OR coalesce(p_budget_ref,'')=''
 OR coalesce(p_mandate_ref,'')='' OR p_mandate_version IS NULL
 OR coalesce(p_unit,'')='' OR p_amount IS NULL OR p_amount<=0
 OR coalesce(p_actor,'')='' OR coalesce(p_authority_ref,'')=''
 THEN RAISE EXCEPTION 'invalid_budget_grant'; END IF;
 SELECT mandate_ref INTO epoch_ref FROM public.cop_accounting_epoch
 WHERE epoch_id=p_epoch_id AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'epoch_not_open'; END IF;
 -- The epoch reference is historical provenance; not per-act authorization.
 SELECT * INTO m FROM public.cop_mandates WHERE mandate_ref=p_mandate_ref FOR SHARE;
 IF NOT FOUND OR m.status <> 'active' OR m.version <> p_mandate_version
 OR m.grantee_ref <> p_actor OR m.revoked_at IS NOT NULL
 OR (m.not_before IS NOT NULL AND m.not_before::timestamptz > now())
 OR (m.expires_at IS NOT NULL AND m.expires_at::timestamptz <= now())
 OR NOT (
  (m.permissions::jsonb ? required_action)
  OR (m.permissions::jsonb @> jsonb_build_array(required_action))
  OR (m.permissions::jsonb -> 'actions' @> jsonb_build_array(required_action))
 )
 THEN RAISE EXCEPTION 'accounting_mandate_not_authorized'; END IF;
 -- Require exact canonical identity as verified by the COP gateway.
 IF p_authority_ref <> p_mandate_ref||':v'||p_mandate_version::text
 THEN RAISE EXCEPTION 'authority_reference_mismatch'; END IF;
 event_key:='grant:'||p_budget_ref||':'||p_unit;
 SELECT * INTO existing FROM public.cop_accounting_epoch_budget
 WHERE epoch_id=p_epoch_id AND budget_ref=p_budget_ref AND unit=p_unit;
 IF FOUND THEN
  IF existing.granted<>p_amount OR existing.mandate_ref<>p_mandate_ref
  OR NOT EXISTS(SELECT 1 FROM public.cop_accounting_epoch_event e
    WHERE e.epoch_id=p_epoch_id AND e.idempotency_key=event_key
    AND e.actor_id=p_actor AND e.payload->>'authority_ref'=p_authority_ref)
  THEN RAISE EXCEPTION 'budget_grant_identity_conflict'; END IF;
  RETURN jsonb_build_object('budget_ref',p_budget_ref,'duplicate',true);
 END IF;
 INSERT INTO public.cop_accounting_epoch_budget(epoch_id,budget_ref,mandate_ref,unit,granted)
 VALUES(p_epoch_id,p_budget_ref,p_mandate_ref,p_unit,p_amount);
 INSERT INTO public.cop_accounting_epoch_event(epoch_id,idempotency_key,event_type,actor_id,mandate_ref,budget_ref,payload)
 VALUES(p_epoch_id,event_key,'accounting.budget.granted',p_actor,p_mandate_ref,p_budget_ref,
 jsonb_build_object('schema','cop.accounting-budget-grant/v2','amount',p_amount::text,
 'unit',p_unit,'authority_ref',p_authority_ref,'epoch_provenance_ref',epoch_ref,
 'mandate_version',p_mandate_version));
 RETURN jsonb_build_object('budget_ref',p_budget_ref,'duplicate',false);
END $$;
-- Only trusted server runtime may call; do not expose to anonymous clients.
REVOKE ALL ON FUNCTION public.cop_grant_epoch_budget_v2(text,text,text,integer,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cop_grant_epoch_budget_v2(text,text,text,integer,text,numeric,text,text) TO service_role;