-- JHN migration cop_epoch_budget_settlement_atomic. Prerequisite: budget reservation schema.
CREATE OR REPLACE FUNCTION public.cop_settle_epoch_budget(
 p_epoch_id text,p_reservation_key text,p_spent numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.cop_accounting_epoch_reservation%ROWTYPE;
BEGIN
 IF p_spent IS NULL OR p_spent<0 THEN RAISE EXCEPTION 'invalid_settlement'; END IF;
 SELECT * INTO r FROM public.cop_accounting_epoch_reservation
 WHERE epoch_id=p_epoch_id AND reservation_key=p_reservation_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
 IF r.status='settled' THEN
  IF r.spent IS DISTINCT FROM p_spent THEN RAISE EXCEPTION 'settlement_identity_conflict'; END IF;
  RETURN jsonb_build_object('reservation_key',p_reservation_key,'duplicate',true,'status','settled');
 END IF;
 IF r.status<>'reserved' THEN RAISE EXCEPTION 'reservation_not_active'; END IF;
 IF p_spent>r.amount THEN RAISE EXCEPTION 'settlement_exceeds_reservation'; END IF;
 UPDATE public.cop_accounting_epoch_budget
 SET reserved=reserved-r.amount, settled=settled+p_spent, version=version+1
 WHERE epoch_id=r.epoch_id AND budget_ref=r.budget_ref AND unit=r.unit;
 UPDATE public.cop_accounting_epoch_reservation SET spent=p_spent,status='settled'
 WHERE epoch_id=p_epoch_id AND reservation_key=p_reservation_key;
 RETURN jsonb_build_object('reservation_key',p_reservation_key,'duplicate',false,'status','settled','released',r.amount-p_spent);
END $$;
REVOKE ALL ON FUNCTION public.cop_settle_epoch_budget(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cop_settle_epoch_budget(text,text,numeric) TO service_role;
