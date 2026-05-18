-- Migration: Apple App Review Guideline 1.2 (User-Generated Content) 대응
-- 목적:
--   - 사용자가 부적절한 콘텐츠/사용자를 신고할 수 있는 기능
--   - 사용자가 다른 사용자를 차단할 수 있는 기능
--   - 차단한 사용자의 콘텐츠는 자동으로 숨김
-- 적용 대상: 게스트/회원 모집글, 클럽, 프로필
-- Apple 요구사항:
--   1. 부적절 콘텐츠 신고 메커니즘 ✓ (reports 테이블)
--   2. 사용자 차단 메커니즘 ✓ (user_blocks 테이블)
--   3. 신고된 콘텐츠 24시간 내 처리 → 운영 정책으로 처리

-- ============================================================
-- 1. user_blocks: 사용자가 다른 사용자를 차단
-- ============================================================
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
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own blocks" ON public.user_blocks;
CREATE POLICY "Users can create their own blocks" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own blocks" ON public.user_blocks;
CREATE POLICY "Users can delete their own blocks" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- ============================================================
-- 2. content_reports: 콘텐츠/사용자 신고
-- ============================================================
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

-- 본인이 한 신고만 조회 가능
DROP POLICY IF EXISTS "Users can view their own reports" ON public.content_reports;
CREATE POLICY "Users can view their own reports" ON public.content_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- 관리자는 모든 신고 조회
DROP POLICY IF EXISTS "Admins can view all reports" ON public.content_reports;
CREATE POLICY "Admins can view all reports" ON public.content_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 누구나 신고 생성 가능 (본인이 reporter_id로)
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
CREATE POLICY "Users can create reports" ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- 관리자만 처리 (status 변경)
DROP POLICY IF EXISTS "Admins can update reports" ON public.content_reports;
CREATE POLICY "Admins can update reports" ON public.content_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
