-- Deployed on JHN via Supabase migration cop_epoch_budget_reservation_atomic.
-- Z0 experimental budget and reservation reference schema. Never a monetary grant by itself.
CREATE TABLE IF NOT EXISTS public.cop_accounting_epoch_budget (
 epoch_id text NOT NULL REFERENCES public.cop_accounting_epoch(epoch_id),
 budget_ref text NOT NULL,
 mandate_ref text NOT NULL,
 unit text NOT NULL,
 granted numeric NOT NULL CHECK(granted>=0),
 reserved numeric NOT NULL DEFAULT 0 CHECK(reserved>=0),
 settled numeric NOT NULL DEFAULT 0 CHECK(settled>=0),
 version bigint NOT NULL DEFAULT 1,
 PRIMARY KEY(epoch_id,budget_ref,unit),
 CHECK(reserved+settled<=granted)
);
CREATE TABLE IF NOT EXISTS public.cop_accounting_epoch_reservation (
 epoch_id text NOT NULL,
 reservation_key text NOT NULL,
 budget_ref text NOT NULL,
 unit text NOT NULL,
 mandate_ref text NOT NULL,
 amount numeric NOT NULL CHECK(amount>0),
 spent numeric,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','released')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(epoch_id,reservation_key),
 FOREIGN KEY(epoch_id,budget_ref,unit) REFERENCES public.cop_accounting_epoch_budget(epoch_id,budget_ref,unit),
 CHECK(spent IS NULL OR (spent>=0 AND spent<=amount))
);
ALTER TABLE public.cop_accounting_epoch_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_epoch_reservation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cop_accounting_epoch_budget,public.cop_accounting_epoch_reservation FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cop_reserve_epoch_budget(
 p_epoch_id text,p_budget_ref text,p_mandate_ref text,p_unit text,p_key text,p_amount numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE b public.cop_accounting_epoch_budget%ROWTYPE;
 old_r public.cop_accounting_epoch_reservation%ROWTYPE;
BEGIN
 IF p_amount IS NULL OR p_amount<=0 OR p_key IS NULL OR p_key=''
 THEN RAISE EXCEPTION 'invalid_reservation'; END IF;
 SELECT * INTO b FROM public.cop_accounting_epoch_budget
 WHERE epoch_id=p_epoch_id AND budget_ref=p_budget_ref AND unit=p_unit FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'budget_not_granted'; END IF;
 IF b.mandate_ref IS DISTINCT FROM p_mandate_ref THEN RAISE EXCEPTION 'mandate_mismatch'; END IF;
 SELECT * INTO old_r FROM public.cop_accounting_epoch_reservation
 WHERE epoch_id=p_epoch_id AND reservation_key=p_key;
 IF FOUND THEN
  IF old_r.budget_ref<>p_budget_ref OR old_r.unit<>p_unit
   OR old_r.mandate_ref<>p_mandate_ref OR old_r.amount<>p_amount
  THEN RAISE EXCEPTION 'reservation_identity_conflict'; END IF;
  RETURN jsonb_build_object('reservation_key',p_key,'duplicate',true,'status',old_r.status);
 END IF;
 IF b.reserved+b.settled+p_amount>b.granted THEN RAISE EXCEPTION 'budget_exhausted'; END IF;
 INSERT INTO public.cop_accounting_epoch_reservation
 (epoch_id,reservation_key,budget_ref,unit,mandate_ref,amount)
 VALUES(p_epoch_id,p_key,p_budget_ref,p_unit,p_mandate_ref,p_amount);
 UPDATE public.cop_accounting_epoch_budget
 SET reserved=reserved+p_amount,version=version+1
 WHERE epoch_id=p_epoch_id AND budget_ref=p_budget_ref AND unit=p_unit;
 RETURN jsonb_build_object('reservation_key',p_key,'duplicate',false,'status','reserved');
END $$;
REVOKE ALL ON FUNCTION public.cop_reserve_epoch_budget(text,text,text,text,text,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cop_reserve_epoch_budget(text,text,text,text,text,numeric)
 TO service_role;
