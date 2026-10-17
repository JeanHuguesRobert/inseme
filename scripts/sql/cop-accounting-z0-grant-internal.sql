-- Trusted-perimeter Accounting Z0: separate operational access from delegated COP authority.
-- v3 intentionally uses the host's service_role capability as the admission boundary.
-- Only invariant and immutable-trace checks remain; no second mandate registry gate.
CREATE OR REPLACE FUNCTION public.cop_grant_epoch_budget_internal(
 p_epoch_id text,p_budget_ref text,p_unit text,p_amount numeric,
 p_actor text,p_authority_ref text
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE existing public.cop_accounting_epoch_budget%ROWTYPE; provenance text; event_key text;
BEGIN
 IF coalesce(p_epoch_id,'')='' OR coalesce(p_budget_ref,'')='' OR coalesce(p_unit,'')=''
 OR p_amount IS NULL OR p_amount<=0 OR coalesce(p_actor,'')='' OR coalesce(p_authority_ref,'')=''
 THEN RAISE EXCEPTION 'invalid_budget_grant'; END IF;
 SELECT mandate_ref INTO provenance FROM public.cop_accounting_epoch
 WHERE epoch_id=p_epoch_id AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'epoch_not_open'; END IF;
 event_key:='grant:'||p_budget_ref||':'||p_unit;
 SELECT * INTO existing FROM public.cop_accounting_epoch_budget
 WHERE epoch_id=p_epoch_id AND budget_ref=p_budget_ref AND unit=p_unit;
 IF FOUND THEN
  IF existing.granted<>p_amount OR existing.mandate_ref<>provenance
  OR NOT EXISTS(SELECT 1 FROM public.cop_accounting_epoch_event e
    WHERE e.epoch_id=p_epoch_id AND e.idempotency_key=event_key
    AND e.actor_id=p_actor AND e.payload->>'authority_ref'=p_authority_ref)
  THEN RAISE EXCEPTION 'budget_grant_identity_conflict'; END IF;
  RETURN jsonb_build_object('budget_ref',p_budget_ref,'duplicate',true);
 END IF;
 INSERT INTO public.cop_accounting_epoch_budget(epoch_id,budget_ref,mandate_ref,unit,granted)
 VALUES(p_epoch_id,p_budget_ref,provenance,p_unit,p_amount);
 INSERT INTO public.cop_accounting_epoch_event(epoch_id,idempotency_key,event_type,actor_id,mandate_ref,budget_ref,payload)
 VALUES(p_epoch_id,event_key,'accounting.budget.granted',p_actor,provenance,p_budget_ref,
 jsonb_build_object('schema','cop.accounting-budget-grant/internal-v1','amount',p_amount::text,
 'unit',p_unit,'authority_ref',p_authority_ref,'epoch_provenance_ref',provenance,
 'admission','trusted-runtime'));
 RETURN jsonb_build_object('budget_ref',p_budget_ref,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.cop_grant_epoch_budget_internal(text,text,text,numeric,text,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cop_grant_epoch_budget_internal(text,text,text,numeric,text,text)
 TO service_role;
