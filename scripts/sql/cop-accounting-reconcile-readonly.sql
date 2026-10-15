-- COP Accounting #162: READ-ONLY reconstruction audit.
-- Run against JHN or a snapshot. No data modifications.
-- Exact decimal arithmetic; posting direction: debit +, credit -.
-- Events remain authoritative; projection balances are derived views.
WITH expected AS (
 SELECT COALESCE(e.payload->>'accounting_domain','provisional_execution_spending') AS domain,
 COALESCE(p->>'account',p->>'account_id') AS account_id,
 COALESCE(p->'quantity'->>'unit','USD') AS unit,
 SUM(
   CASE WHEN p->>'posting_type'='debit' THEN 1 ELSE -1 END *
   ((p->'quantity'->>'coefficient')::numeric /
     power(10::numeric, COALESCE((p->'quantity'->>'scale')::integer,0)))
 ) AS expected_amount
 FROM public.cop_accounting_event AS e
 CROSS JOIN LATERAL jsonb_array_elements(e.payload->'postings') AS p
 GROUP BY 1,2,3
), current_projection AS (
 SELECT domain,account_id,unit,
  (balance->>'coefficient')::numeric /
  power(10::numeric,COALESCE((balance->>'scale')::integer,0)) AS stored_amount
 FROM public.cop_accounting_balance
)
SELECT e.domain,e.account_id,e.unit,e.expected_amount,c.stored_amount,
 e.expected_amount - COALESCE(c.stored_amount,0) AS difference,
 CASE WHEN c.account_id IS NULL THEN 'missing'
 WHEN c.stored_amount <> e.expected_amount THEN 'mismatch'
 ELSE 'matches' END AS check_status
FROM expected AS e LEFT JOIN current_projection AS c USING(domain,account_id,unit)
ORDER BY check_status DESC,abs(e.expected_amount - COALESCE(c.stored_amount,0)) DESC;

-- Verify optional normalized posting index completeness separately.
SELECT e.id,e.created_at,e.idempotency_key,
 jsonb_array_length(e.payload->'postings') AS source_count,
 (SELECT count(*) FROM public.cop_accounting_posting AS p WHERE p.event_id=e.id) AS indexed_count
FROM public.cop_accounting_event AS e
WHERE e.payload ? 'postings'
 AND jsonb_array_length(e.payload->'postings') <>
     (SELECT count(*) FROM public.cop_accounting_posting AS p WHERE p.event_id=e.id)
ORDER BY e.created_at DESC;
