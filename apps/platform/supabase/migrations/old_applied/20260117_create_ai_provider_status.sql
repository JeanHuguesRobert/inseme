CREATE TABLE IF NOT EXISTS public.ai_provider_status (
    provider text NOT NULL,
    model text NOT NULL,
    status text NOT NULL DEFAULT 'available', -- 'available', 'rate_limited', 'quota_exceeded', 'degraded', 'offline'
    last_checked_at timestamp with time zone DEFAULT now(),
    last_error jsonb,
    metrics jsonb DEFAULT '{}'::jsonb, -- stores aggregated success/fail counts if needed
    metadata jsonb DEFAULT '{}'::jsonb,
    PRIMARY KEY (provider, model)
);

ALTER TABLE public.ai_provider_status ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (or everyone if public API needs it, but usually service-role/authenticated)
CREATE POLICY "Allow read access for authenticated users" ON public.ai_provider_status
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow write access only to service_role (Edge Functions usually run as service_role or have special privileges)
-- If Edge Functions run as anon/authenticated, they might need INSERT/UPDATE permissions.
-- Assuming Edge Functions use service_role for admin tasks:
CREATE POLICY "Allow write access for service role" ON public.ai_provider_status
    FOR ALL USING (auth.role() = 'service_role');
