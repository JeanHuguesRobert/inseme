-- Identity is the stable agent ref, never a globally unique human-readable name.
-- The Principal can inspect their hosted agents; anonymous users cannot.
BEGIN;
ALTER TABLE public.cop_logical_agents
  DROP CONSTRAINT cop_logical_agents_logical_agent_name_key;

GRANT SELECT ON public.cop_logical_agents TO authenticated;
CREATE POLICY "Principal can read hosted agents" ON public.cop_logical_agents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.instances i
    WHERE i.id = cop_logical_agents.instance_id
      AND i.principal_id = (SELECT auth.uid())
  ));
COMMIT;
