-- A delegated OAuth client is not a direct human session.
-- Preserve all existing permissive policies; the MCP is the delivery boundary.
-- Deliberately leave anonymous public access and the service role unchanged.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cop_accounting_balance','cop_accounting_budget','cop_accounting_chart_account',
    'cop_accounting_packet_spend','cop_accounting_posting','cop_agents',
    'cop_event_log','cop_logical_agents','cop_nodes','cop_topic',
    'github_webhook_deliveries','instance_aliases','instance_config','instances','users'
  ] LOOP
    EXECUTE format('CREATE POLICY cogentia_direct_session_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (((SELECT auth.jwt())->>''client_id'') IS NULL) WITH CHECK (((SELECT auth.jwt())->>''client_id'') IS NULL)',t);
  END LOOP;
END
$$;
