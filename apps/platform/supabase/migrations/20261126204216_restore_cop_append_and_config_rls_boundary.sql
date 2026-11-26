-- Restore the intended service-only COP append boundary for every existing overload.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cop_event_append' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END
$$;
-- Configuration lookup must inherit the caller's existing row visibility.
ALTER FUNCTION public.get_effective_instance_config(uuid,text) SECURITY INVOKER;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cop_event_append' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'COP append privilege verification failed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.get_effective_instance_config(uuid,text)'::regprocedure AND prosecdef) THEN
    RAISE EXCEPTION 'Configuration invoker verification failed';
  END IF;
END
$$;
