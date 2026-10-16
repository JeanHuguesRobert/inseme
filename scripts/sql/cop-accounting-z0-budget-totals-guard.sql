-- FBF #163 — Z0 budget aggregates must equal reservation projection.
-- Deployed on JHN as cop_epoch_budget_totals_reconciliation_guard.
CREATE OR REPLACE FUNCTION public.cop_epoch_budget_reconcile_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE k record; actual_reserved numeric; actual_settled numeric; b record;
BEGIN
 FOR k IN SELECT DISTINCT epoch_id,budget_ref,unit FROM (
  SELECT NEW.epoch_id epoch_id,NEW.budget_ref budget_ref,NEW.unit unit
  UNION ALL
  SELECT OLD.epoch_id,OLD.budget_ref,OLD.unit WHERE TG_OP IN ('UPDATE','DELETE')
 ) keys LOOP
  SELECT granted,reserved,settled INTO b FROM public.cop_accounting_epoch_budget
  WHERE epoch_id=k.epoch_id AND budget_ref=k.budget_ref AND unit=k.unit;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT coalesce(sum(amount) FILTER(WHERE status='reserved'),0),
   coalesce(sum(spent) FILTER(WHERE status='settled'),0)
  INTO actual_reserved,actual_settled FROM public.cop_accounting_epoch_reservation
  WHERE epoch_id=k.epoch_id AND budget_ref=k.budget_ref AND unit=k.unit;
  IF b.reserved<>actual_reserved OR b.settled<>actual_settled THEN
   RAISE EXCEPTION 'budget_reservation_projection_mismatch: %',k.budget_ref;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS cop_budget_totals_reconcile ON public.cop_accounting_epoch_budget;
CREATE CONSTRAINT TRIGGER cop_budget_totals_reconcile
 AFTER INSERT OR UPDATE ON public.cop_accounting_epoch_budget DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.cop_epoch_budget_reconcile_guard();
DROP TRIGGER IF EXISTS cop_reservation_totals_reconcile ON public.cop_accounting_epoch_reservation;
CREATE CONSTRAINT TRIGGER cop_reservation_totals_reconcile
 AFTER INSERT OR UPDATE ON public.cop_accounting_epoch_reservation DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.cop_epoch_budget_reconcile_guard();
