-- Migration deployed in JHN: cop_epoch_budget_deferred_event_guards
-- Enforce presence of append-only budget event in same DB transaction.
CREATE OR REPLACE FUNCTION public.cop_epoch_budget_event_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE key_value text; expected_type text; expected_amount text;
BEGIN
 IF TG_TABLE_NAME='cop_accounting_epoch_budget' THEN
  key_value:='grant:'||NEW.budget_ref||':'||NEW.unit;
  expected_type:='accounting.budget.granted';
  expected_amount:=NEW.granted::text;
 ELSIF TG_OP='INSERT' THEN
  key_value:='reserve:'||NEW.reservation_key;
  expected_type:='accounting.budget.reserved';
  expected_amount:=NEW.amount::text;
 ELSE
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  IF NEW.status<>'settled' OR OLD.status<>'reserved' THEN
   RAISE EXCEPTION 'unaccounted_reservation_transition';
  END IF;
  key_value:='settle:'||NEW.reservation_key;
  expected_type:='accounting.budget.settled';
  expected_amount:=NEW.spent::text;
 END IF;
 IF NOT EXISTS (
 SELECT 1 FROM public.cop_accounting_epoch_event e
 WHERE e.epoch_id=NEW.epoch_id AND e.idempotency_key=key_value
 AND e.event_type=expected_type AND e.mandate_ref=NEW.mandate_ref
 AND e.budget_ref=NEW.budget_ref
 AND (e.payload->>'amount'=expected_amount OR e.payload->>'spent'=expected_amount)
 AND e.payload->>'unit'=NEW.unit
 ) THEN RAISE EXCEPTION 'budget_event_required:%',key_value; END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS cop_epoch_budget_grant_event_guard ON public.cop_accounting_epoch_budget;
CREATE CONSTRAINT TRIGGER cop_epoch_budget_grant_event_guard
 AFTER INSERT ON public.cop_accounting_epoch_budget DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.cop_epoch_budget_event_guard();
DROP TRIGGER IF EXISTS cop_epoch_reservation_event_guard ON public.cop_accounting_epoch_reservation;
CREATE CONSTRAINT TRIGGER cop_epoch_reservation_event_guard
 AFTER INSERT OR UPDATE ON public.cop_accounting_epoch_reservation DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.cop_epoch_budget_event_guard();
REVOKE ALL ON FUNCTION public.cop_epoch_budget_event_guard() FROM PUBLIC,anon,authenticated;
