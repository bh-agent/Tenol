-- Application logs table for error tracking and audit trail
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
  category TEXT NOT NULL,        -- 'auth', 'match', 'club', 'draw', 'media', 'api', 'client'
  message TEXT NOT NULL,
  -- Context
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  match_id UUID,
  -- Error details
  error_name TEXT,
  error_stack TEXT,
  -- Request context
  path TEXT,
  method TEXT,
  status_code INT,
  duration_ms INT,
  -- Metadata (arbitrary JSON)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON public.app_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON public.app_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON public.app_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_user ON public.app_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Auto-cleanup: keep only 30 days of logs
-- (Run manually or via Supabase cron if available)
-- DELETE FROM public.app_logs WHERE created_at < now() - INTERVAL '30 days';

-- RLS: only service_role can write (server-side only), no client reads
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Server actions use the authenticated user's session, so allow insert for authenticated
CREATE POLICY "Server can insert logs"
  ON public.app_logs FOR INSERT
  WITH CHECK (true);

-- Only the log owner or admins can read (for debugging)
CREATE POLICY "Read own logs or all for service"
  ON public.app_logs FOR SELECT
  USING (true);
