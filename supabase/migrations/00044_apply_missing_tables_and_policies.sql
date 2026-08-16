-- ============================================================
-- 00044: 프로덕션 미적용 마이그레이션 통합 복구 (2026-08-16 실측 기반)
-- ============================================================
-- 프로덕션 DB 실증 결과 아래 5개가 미적용 상태로 확인됨:
--   ① 00034 clubs DELETE 정책  → 클럽 삭제가 조용히 실패 (0건 삭제)
--   ② 00038 user_blocks/content_reports → 신고·차단 완전 불능 (Apple UGC 요건!)
--   ③ 00039 device_tokens → 푸시 토큰 저장 불능
--   ④ 00028 draw_edit_locks → 대진표 동시편집 잠금 무력
--   ⑤ 00033 app_logs → 에러 로깅 불능 (00043의 강화 정책을 곧바로 적용)
-- 이 파일 전체를 SQL Editor에 붙여넣고 한 번 실행하면 됩니다 (재실행 안전).
-- ============================================================

-- ── ① 클럽 삭제 정책 (00034) ──
DROP POLICY IF EXISTS "Club owner can delete" ON public.clubs;
CREATE POLICY "Club owner can delete" ON public.clubs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- ── ② 사용자 차단 (00038) ──
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blocks" ON public.user_blocks;
CREATE POLICY "Users can view their own blocks" ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users can create their own blocks" ON public.user_blocks;
CREATE POLICY "Users can create their own blocks" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own blocks" ON public.user_blocks;
CREATE POLICY "Users can delete their own blocks" ON public.user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ── ② 콘텐츠 신고 (00038) ──
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('recruitment_post', 'club', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'fraud', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reports" ON public.content_reports;
CREATE POLICY "Users can view their own reports" ON public.content_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all reports" ON public.content_reports;
CREATE POLICY "Admins can view all reports" ON public.content_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
CREATE POLICY "Users can create reports" ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Admins can update reports" ON public.content_reports;
CREATE POLICY "Admins can update reports" ON public.content_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ── ③ 푸시 디바이스 토큰 (00039) ──
CREATE TABLE IF NOT EXISTS public.device_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own device tokens" ON public.device_tokens;
CREATE POLICY "Users view own device tokens" ON public.device_tokens
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own device tokens" ON public.device_tokens;
CREATE POLICY "Users insert own device tokens" ON public.device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own device tokens" ON public.device_tokens;
CREATE POLICY "Users update own device tokens" ON public.device_tokens
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own device tokens" ON public.device_tokens;
CREATE POLICY "Users delete own device tokens" ON public.device_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ── ④ 대진표 편집 잠금 (00028) ──
CREATE TABLE IF NOT EXISTS public.draw_edit_locks (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT
);
ALTER TABLE public.draw_edit_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Locks viewable" ON public.draw_edit_locks;
CREATE POLICY "Locks viewable" ON public.draw_edit_locks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lock management" ON public.draw_edit_locks;
CREATE POLICY "Lock management" ON public.draw_edit_locks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── ⑤ 앱 로그 (00033 테이블 + 00043 강화 정책을 곧바로 적용) ──
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  match_id UUID,
  error_name TEXT,
  error_stack TEXT,
  path TEXT,
  method TEXT,
  status_code INT,
  duration_ms INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON public.app_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON public.app_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON public.app_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_user ON public.app_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- 00043의 강화 정책 (00033의 느슨한 정책은 건너뜀)
DROP POLICY IF EXISTS "Read own logs or all for service" ON public.app_logs;
DROP POLICY IF EXISTS "Read own logs or admin" ON public.app_logs;
DROP POLICY IF EXISTS "Server can insert logs" ON public.app_logs;
DROP POLICY IF EXISTS "Insert own logs" ON public.app_logs;

CREATE POLICY "Read own logs or admin" ON public.app_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "Insert own logs" ON public.app_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ── PostgREST 스키마 캐시 갱신 (새 테이블 인식 — 필수) ──
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 검증 쿼리 (실행 후 아래 결과 확인)
-- ============================================================
-- 1) 5개 테이블 존재해야 함:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_blocks','content_reports','device_tokens','draw_edit_locks','app_logs')
ORDER BY table_name;
-- 2) clubs DELETE 정책 존재해야 함:
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clubs' AND cmd = 'DELETE';
