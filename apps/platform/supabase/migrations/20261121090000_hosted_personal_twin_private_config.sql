-- Restrict nonpublic, nonsecret per-instance config to actual Principals and
-- the human Principal of the hosting instance (JHN while provisional).
-- Account bindings must not become readable by all authenticated users.
DROP POLICY IF EXISTS "Authenticated can read non-secret config" ON public.instance_config;
CREATE POLICY "Authenticated owned or hosted non-secret config"
 ON public.instance_config FOR SELECT TO authenticated
 USING (
  coalesce(is_secret,false)=false AND (
   coalesce(is_public,false)=true OR
   EXISTS (
    SELECT 1 FROM public.instances i
    LEFT JOIN public.instances h ON h.id=i.host_instance_id
    WHERE i.id=instance_config.instance_id
      AND (i.principal_id=(SELECT auth.uid())
           OR h.principal_id=(SELECT auth.uid()))
   )
  )
 );
