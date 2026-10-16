-- An audit is NOT an authorizer: a mandate row alone is not a signed capability.
-- Applied to JHN as cop_epoch_authority_evidence_audit.
CREATE OR REPLACE VIEW public.cop_accounting_epoch_authority_audit WITH (security_invoker=true) AS
SELECT b.epoch_id,b.budget_ref,b.unit,b.mandate_ref,
 CASE
 WHEN b.unit='TEST_UNIT' AND b.budget_ref LIKE 'test:%' THEN 'synthetic_test_only'
 WHEN m.mandate_ref IS NULL THEN 'mandate_not_found'
 WHEN m.status<>'active' THEN 'mandate_not_active'
 ELSE 'mandate_row_present_unverified'
 END AS authority_evidence_status,
 b.granted,b.reserved,b.settled
FROM public.cop_accounting_epoch_budget b
LEFT JOIN public.cop_mandates m ON m.mandate_ref=b.mandate_ref;
REVOKE ALL ON public.cop_accounting_epoch_authority_audit FROM PUBLIC,anon,authenticated;
