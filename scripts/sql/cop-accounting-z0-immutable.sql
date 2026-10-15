-- Applied on JHN via Supabase migration cop_epoch_immutable_journal_postings, 2026-10-15.
-- Source-controlled companion for replay/review. Requires Z0 tables/functions.
CREATE OR REPLACE FUNCTION public.cop_accounting_epoch_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'cop_accounting_epoch_append_only:%',TG_TABLE_NAME;
END; $$;
DROP TRIGGER IF EXISTS cop_epoch_event_immutable ON public.cop_accounting_epoch_event;
CREATE TRIGGER cop_epoch_event_immutable BEFORE UPDATE OR DELETE
ON public.cop_accounting_epoch_event FOR EACH ROW
EXECUTE FUNCTION public.cop_accounting_epoch_reject_mutation();
DROP TRIGGER IF EXISTS cop_epoch_posting_immutable ON public.cop_accounting_epoch_posting;
CREATE TRIGGER cop_epoch_posting_immutable BEFORE UPDATE OR DELETE
ON public.cop_accounting_epoch_posting FOR EACH ROW
EXECUTE FUNCTION public.cop_accounting_epoch_reject_mutation();
REVOKE ALL ON FUNCTION public.cop_accounting_epoch_reject_mutation() FROM PUBLIC,anon,authenticated;
